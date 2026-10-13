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
const TODOS = 'todos' as const

// Cookie simple, solo de lectura/escritura en el cliente — nadie del lado
// servidor necesita leerla (ni proxy.ts ni un server component), así que no
// hace falta un route handler ni una server action para esto. Guarda un id
// de grupo o el valor especial 'todos'.
function leerCookieGrupo(): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NOMBRE}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

function guardarCookieGrupo(valor: string): void {
  if (typeof document === 'undefined') return
  document.cookie = `${COOKIE_NOMBRE}=${encodeURIComponent(valor)}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`
}

function borrarCookieGrupo(): void {
  if (typeof document === 'undefined') return
  document.cookie = `${COOKIE_NOMBRE}=; path=/; max-age=0`
}

/**
 * Selección global de grupo ("todos" o un grupo puntual), para usarla desde
 * ChipGrupo / SelectorGrupoSheet. Escribe la cookie y refresca la pantalla
 * actual — el único lugar donde se decide qué queda "elegido".
 */
export function seleccionarGrupo(idOTodos: string, router: { refresh: () => void }): void {
  if (idOTodos === TODOS) borrarCookieGrupo()
  else guardarCookieGrupo(idOTodos)
  router.refresh()
}

export type Seleccion = { tipo: 'todos' } | { tipo: 'grupo'; grupoId: string }

/**
 * Para pantallas "flexibles" que pueden mostrar todo sin asumir un grupo
 * (Inicio/Historial, prompts 2 y 3). Sin cookie ni ?grupo=, el default es
 * 'todos'. Si la cookie guarda un grupo del que la persona ya no es
 * miembro, cae a 'todos' en vez de romper.
 */
export async function obtenerSeleccion(
  usuarioId: string,
  grupoIdParam: string | null
): Promise<{ seleccion: Seleccion; grupos: GrupoOpcion[] }> {
  const grupos = await listarGruposDeUsuario(usuarioId)

  if (grupoIdParam === TODOS) return { seleccion: { tipo: 'todos' }, grupos }
  if (grupoIdParam && grupos.some(g => g.id === grupoIdParam)) {
    return { seleccion: { tipo: 'grupo', grupoId: grupoIdParam }, grupos }
  }

  const cookie = leerCookieGrupo()
  if (cookie && cookie !== TODOS && grupos.some(g => g.id === cookie)) {
    return { seleccion: { tipo: 'grupo', grupoId: cookie }, grupos }
  }

  return { seleccion: { tipo: 'todos' }, grupos }
}

async function listarGruposDeUsuario(usuarioId: string): Promise<GrupoOpcion[]> {
  const { data } = await supabase
    .from('grupo_miembros')
    .select('grupo_id, grupos ( id, nombre )')
    .eq('usuario_id', usuarioId)

  const filas = (data ?? []) as unknown as { grupo_id: string; grupos: { id: string; nombre: string } | null }[]
  return filas
    .map(f => f.grupos)
    .filter((g): g is { id: string; nombre: string } => !!g)
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
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
  const grupos = await listarGruposDeUsuario(usuarioId)

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
