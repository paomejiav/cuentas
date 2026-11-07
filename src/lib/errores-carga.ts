import type { PostgrestSingleResponse } from '@supabase/supabase-js'

export type TipoErrorCarga = 'red' | 'sesion' | 'permisos' | 'inesperado'

export class ErrorCarga extends Error {
  tipo: TipoErrorCarga
  causa?: unknown

  constructor(tipo: TipoErrorCarga, message: string, causa?: unknown) {
    super(message)
    this.name = 'ErrorCarga'
    this.tipo = tipo
    this.causa = causa
  }
}

export function mensajeErrorCarga(tipo: TipoErrorCarga): string {
  switch (tipo) {
    case 'red': return 'No pudimos conectarnos. Revisa tu internet.'
    case 'sesion': return 'Tu sesión venció. Inicia sesión de nuevo.'
    case 'permisos': return 'No tienes permiso para ver esto.'
    case 'inesperado': return 'Algo salió mal. Inténtalo de nuevo.'
  }
}

// Clasificación verificada con pruebas reales contra supabase-js 2.112.4
// (ver mensaje del commit): una consulta a una tabla con RLS, con (i) el
// host inalcanzable, (ii) un JWT inválido/vencido en el header Authorization,
// y (iii) un 500 simulado del servidor.
//
//   - Host inalcanzable (DNS, conexión rechazada, timeout de red): el fetch
//     nunca llega a tener respuesta — postgrest-js lo atrapa y devuelve
//     siempre `status: 0` con `error.code: ''`. Es la única manera real
//     de distinguir "no hubo respuesta" de un error que sí vino del server.
//   - JWT inválido o con una firma que no calza: siempre `status: 401` y
//     `error.code: 'PGRST301'` ("JWT cryptographic operation failed" /
//     "No suitable key or wrong key type" según el caso). Un JWT vencido
//     pero bien firmado no se probó en vivo (supabase-js intenta refrescarlo
//     antes de la consulta), pero por la documentación de PostgREST también
//     cae en la familia PGRST301/401 — mismo chequeo.
//   - 403 / code '42501' (insufficient_privilege): es el código estándar de
//     PostgREST/Postgres para un RLS que niega explícitamente el acceso
//     (vía una política que falla o un `RAISE EXCEPTION`). No se reprodujo
//     en vivo porque no hay una tabla de este proyecto que lo dispare en
//     vez de simplemente filtrar filas en silencio — se deja el chequeo
//     igual porque es inofensivo (si nunca ocurre, nunca clasifica nada).
//   - Todo lo demás (500, un body que no calza con ninguno de los
//     anteriores) queda como 'inesperado' — a propósito, para no inventar
//     una clasificación que no se vio nunca en la práctica.
function clasificarError(status: number, error: { code?: string } | null): TipoErrorCarga {
  if (status === 0) return 'red'
  if (status === 401 || error?.code === 'PGRST301') return 'sesion'
  if (status === 403 || error?.code === '42501') return 'permisos'
  return 'inesperado'
}

/**
 * Envuelve una consulta o RPC de Supabase: devuelve `data` si salió bien, o
 * lanza un ErrorCarga tipificado si no. `contexto` identifica el origen del
 * error en la consola — nunca se le muestra a la persona, y nunca incluye
 * datos de la respuesta (solo el objeto de error de Supabase).
 */
export async function leer<T>(
  promesa: PromiseLike<PostgrestSingleResponse<T>>,
  contexto: string
): Promise<T> {
  const { data, error, status } = await promesa
  if (error) {
    const tipo = clasificarError(status, error)
    if (tipo === 'inesperado') console.error(`[${contexto}]`, error)
    throw new ErrorCarga(tipo, mensajeErrorCarga(tipo), error)
  }
  return data
}
