import { supabase } from '@/lib/supabase'

export interface GrupoOpcion {
  id: string
  nombre: string
}

export type ResolucionGrupo =
  | { estado: 'sin-grupos' }
  | { estado: 'elegir'; grupos: GrupoOpcion[] }
  | { estado: 'ok'; grupoId: string }

/**
 * No existe todavía un selector global de "grupo activo" en la app (una persona
 * puede pertenecer a varios grupos). Esta función resuelve, en cada carga de
 * pantalla, cuál grupo usar:
 *   - 0 grupos  → 'sin-grupos' (la pantalla llamante redirige a "/")
 *   - 1 grupo   → 'ok', se usa automáticamente
 *   - 2+ grupos → si viene `grupoIdParam` y es uno de los suyos, 'ok' con ese;
 *                 si no, 'elegir' para mostrar el selector simple.
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

  if (grupos.length === 0) return { estado: 'sin-grupos' }
  if (grupos.length === 1) return { estado: 'ok', grupoId: grupos[0].id }
  if (grupoIdParam && grupos.some(g => g.id === grupoIdParam)) {
    return { estado: 'ok', grupoId: grupoIdParam }
  }
  return { estado: 'elegir', grupos }
}
