import { supabase } from '@/lib/supabase'
import type { UsuarioMini } from '@/lib/cuentas'

export interface IntegranteActivo extends UsuarioMini {
  rol: 'admin' | 'miembro'
  unido_en: string
}

export interface ExIntegrante extends UsuarioMini {
  salio_en: string
}

export interface DetalleGrupo {
  id: string
  nombre: string
  codigo_invitacion: string
  activos: IntegranteActivo[]
  exIntegrantes: ExIntegrante[]
  soyAdmin: boolean
  esUnicaAdminActiva: boolean
}

interface FilaGrupoMiembro {
  rol: 'admin' | 'miembro'
  unido_en: string
  activo: boolean
  salio_en: string | null
  usuarios: UsuarioMini | null
}

/**
 * Detalle completo del grupo para la pantalla Grupo: nombre, código, e
 * integrantes activos + históricos. La política RLS `grupo_miembros_select`
 * solo exige que VOS seas miembro activo de este grupo para verlo entero —
 * no filtra por el `activo` de cada fila devuelta, así que acá se separan
 * a mano en dos listas.
 */
export async function obtenerDetalleGrupo(grupoId: string, usuarioId: string): Promise<DetalleGrupo | null> {
  const [{ data: grupo }, { data: miembros }] = await Promise.all([
    supabase.from('grupos').select('id, nombre, codigo_invitacion').eq('id', grupoId).single(),
    supabase
      .from('grupo_miembros')
      .select('rol, unido_en, activo, salio_en, usuarios ( id, nombre, avatar_color )')
      .eq('grupo_id', grupoId),
  ])

  if (!grupo) return null

  const filas = (miembros ?? []) as unknown as FilaGrupoMiembro[]

  const activos: IntegranteActivo[] = filas
    .filter(f => f.activo && f.usuarios)
    .map(f => ({ ...(f.usuarios as UsuarioMini), rol: f.rol, unido_en: f.unido_en }))
    .sort((a, b) => a.unido_en.localeCompare(b.unido_en))

  const exIntegrantes: ExIntegrante[] = filas
    .filter(f => !f.activo && f.usuarios && f.salio_en)
    .map(f => ({ ...(f.usuarios as UsuarioMini), salio_en: f.salio_en as string }))
    .sort((a, b) => b.salio_en.localeCompare(a.salio_en))

  const miFila = activos.find(a => a.id === usuarioId)
  const soyAdmin = miFila?.rol === 'admin'
  const otroAdminActivo = activos.some(a => a.id !== usuarioId && a.rol === 'admin')
  const esUnicaAdminActiva = soyAdmin && !otroAdminActivo

  return {
    id: grupo.id,
    nombre: grupo.nombre,
    codigo_invitacion: grupo.codigo_invitacion,
    activos,
    exIntegrantes,
    soyAdmin,
    esUnicaAdminActiva,
  }
}

/** El UPDATE lo cubre la política RLS `grupos_update` (es_admin_grupo) — no hace falta RPC. */
export async function actualizarNombreGrupo(grupoId: string, nombre: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('grupos').update({ nombre: nombre.trim() }).eq('id', grupoId)
  return { error: error ? 'No pudimos guardar el nombre. Intentá de nuevo.' : null }
}

export async function salirDeGrupo(grupoId: string, nuevoAdminId?: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('salir_de_grupo', {
    p_grupo_id: grupoId,
    p_nuevo_admin_id: nuevoAdminId ?? null,
  })
  return { error: error ? error.message : null }
}

// ============================================================
// Perfil
// ============================================================

export interface GrupoNombre {
  id: string
  nombre: string
}

export async function listarGruposActivos(usuarioId: string): Promise<GrupoNombre[]> {
  const { data } = await supabase
    .from('grupo_miembros')
    .select('grupos ( id, nombre )')
    .eq('usuario_id', usuarioId)
    .eq('activo', true)

  const filas = (data ?? []) as unknown as { grupos: GrupoNombre | null }[]
  return filas.map(f => f.grupos).filter((g): g is GrupoNombre => !!g)
}

export async function reiniciarCuenta(): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('reiniciar_cuenta')
  return { error: error ? error.message : null }
}
