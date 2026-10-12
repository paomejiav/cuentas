import { supabase } from '@/lib/supabase'

export interface GrupoOpcion {
  id: string
  nombre: string
}

export type ResolucionGrupo =
  | { estado: 'sin-grupos' }
  | { estado: 'elegir'; grupos: GrupoOpcion[] }
  | { estado: 'ok'; grupoId: string }

const COOKIE_NOMBRE = 'ultimo_grupo_activo'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 180 // 180 días

// Cookie simple, solo de lectura/escritura en el cliente — nadie del lado
// servidor necesita leerla (ni proxy.ts ni un server component), así que no
// hace falta un route handler ni una server action para esto.
function leerCookieGrupo(): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NOMBRE}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

function guardarCookieGrupo(grupoId: string): void {
  if (typeof document === 'undefined') return
  document.cookie = `${COOKIE_NOMBRE}=${encodeURIComponent(grupoId)}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`
}

function borrarCookieGrupo(): void {
  if (typeof document === 'undefined') return
  document.cookie = `${COOKIE_NOMBRE}=; path=/; max-age=0`
}

/**
 * No existe un selector global de "grupo activo" en la base — una persona
 * puede pertenecer a varios grupos a la vez. Esta función resuelve, en cada
 * carga de pantalla, cuál grupo usar, en este orden:
 *   1. `grupoIdParam` (?grupo= en la URL) si es uno de los suyos.
 *   2. El último grupo activo guardado en cookie, si sigue siendo miembro.
 *   3. Si tiene exactamente 1 grupo, ese.
 *   4. 'elegir' — selector simple (no hay forma automática de decidir).
 * Cualquier resultado 'ok' refresca la cookie, así que navegar por el tab
 * bar (sin ?grupo= propio) entra directo al último grupo usado en vez de
 * mostrar el selector en cada tap.
 */
export async function resolverGrupoActivo(
  usuarioId: string,
  grupoIdParam: string | null
): Promise<ResolucionGrupo> {
  const { data } = await supabase
    .from('grupo_miembros')
    .select('grupo_id, grupos ( id, nombre )')
    .eq('usuario_id', usuarioId)

  const filas = (data ?? []) as unknown as { grupo_id: string; grupos: { id: string; nombre: string } | null }[]
  const grupos: GrupoOpcion[] = filas
    .map(f => f.grupos)
    .filter((g): g is { id: string; nombre: string } => !!g)
    .sort((a, b) => a.nombre.localeCompare(b.nombre))

  if (grupos.length === 0) {
    borrarCookieGrupo()
    return { estado: 'sin-grupos' }
  }

  let grupoId: string | null = null
  if (grupoIdParam && grupos.some(g => g.id === grupoIdParam)) {
    grupoId = grupoIdParam
  } else {
    const grupoCookie = leerCookieGrupo()
    if (grupoCookie && grupos.some(g => g.id === grupoCookie)) {
      grupoId = grupoCookie
    } else if (grupos.length === 1) {
      grupoId = grupos[0].id
    }
  }

  if (grupoId) {
    guardarCookieGrupo(grupoId)
    return { estado: 'ok', grupoId }
  }

  return { estado: 'elegir', grupos }
}
