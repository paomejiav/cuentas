import { supabase } from '@/lib/supabase'
import type { Categoria, MetodoPago } from '@/types/database'
import type { UsuarioMini } from '@/lib/cuentas'

// ── Tipos ─────────────────────────────────────────────────────

export interface DivisionHistorial {
  usuario: UsuarioMini | null
  monto_asignado: number
}

export interface GastoHistorial {
  id: string
  descripcion: string
  monto_total: number
  categoria: Categoria
  fecha: string
  creado_en: string
  cuenta_id: string | null
  cuenta_nombre: string | null
  pagado_por: string
  pagador: UsuarioMini | null
  divisiones: DivisionHistorial[]
}

export interface PagoHistorial {
  id: string
  monto: number
  fecha: string
  metodo: MetodoPago
  creado_en: string
  de_usuario_id: string
  a_usuario_id: string
  de: UsuarioMini | null
  a: UsuarioMini | null
}

/** Todos los gastos (con o sin cuenta) y todos los pagos (cierre o directos) del grupo activo. */
export async function obtenerHistorialGrupo(grupoId: string): Promise<{
  gastos: GastoHistorial[]
  pagos: PagoHistorial[]
}> {
  const [{ data: gastosData }, { data: pagosData }] = await Promise.all([
    supabase
      .from('gastos')
      .select(`
        id, descripcion, monto_total, categoria, fecha, creado_en, cuenta_id, pagado_por,
        cuentas ( nombre ),
        usuarios!gastos_pagado_por_fkey ( id, nombre, avatar_color ),
        divisiones ( monto_asignado, usuario_id, usuarios ( id, nombre, avatar_color ) )
      `)
      .eq('grupo_id', grupoId)
      .order('fecha', { ascending: false })
      .order('creado_en', { ascending: false }),
    supabase
      .from('pagos')
      .select(`
        id, monto, fecha, metodo, creado_en, de_usuario_id, a_usuario_id,
        de:usuarios!pagos_de_usuario_id_fkey ( id, nombre, avatar_color ),
        a:usuarios!pagos_a_usuario_id_fkey ( id, nombre, avatar_color )
      `)
      .eq('grupo_id', grupoId)
      .order('fecha', { ascending: false })
      .order('creado_en', { ascending: false }),
  ])

  type FilaGasto = {
    id: string; descripcion: string; monto_total: number; categoria: Categoria; fecha: string; creado_en: string
    cuenta_id: string | null; pagado_por: string
    cuentas: { nombre: string } | null
    usuarios: UsuarioMini | null
    divisiones: { monto_asignado: number; usuario_id: string; usuarios: UsuarioMini | null }[]
  }

  const gastos: GastoHistorial[] = ((gastosData ?? []) as unknown as FilaGasto[]).map(g => ({
    id: g.id,
    descripcion: g.descripcion,
    monto_total: Number(g.monto_total),
    categoria: g.categoria,
    fecha: g.fecha,
    creado_en: g.creado_en,
    cuenta_id: g.cuenta_id,
    cuenta_nombre: g.cuentas?.nombre ?? null,
    pagado_por: g.pagado_por,
    pagador: g.usuarios,
    divisiones: g.divisiones.map(d => ({ usuario: d.usuarios, monto_asignado: Number(d.monto_asignado) })),
  }))

  type FilaPago = {
    id: string; monto: number; fecha: string; metodo: MetodoPago; creado_en: string
    de_usuario_id: string; a_usuario_id: string
    de: UsuarioMini | null; a: UsuarioMini | null
  }

  const pagos: PagoHistorial[] = ((pagosData ?? []) as unknown as FilaPago[]).map(p => ({
    id: p.id,
    monto: Number(p.monto),
    fecha: p.fecha,
    metodo: p.metodo,
    creado_en: p.creado_en,
    de_usuario_id: p.de_usuario_id,
    a_usuario_id: p.a_usuario_id,
    de: p.de,
    a: p.a,
  }))

  return { gastos, pagos }
}

/**
 * Historial "Personal": gastos aislados (grupo_id null) donde el usuario
 * participa (pagador, creador, o con una división — el mismo criterio que
 * es_participante_gasto en RLS), más los pagos asociados.
 *
 * Los gastos no llevan filtro explícito de participación: la política RLS
 * `gastos_select` ya solo devuelve, para grupo_id null, las filas donde
 * es_participante_gasto(id) es cierto — filtrar por participación acá sería
 * redundante.
 *
 * Los pagos SÍ se filtran explícitamente por de/a = usuarioId. En teoría
 * "asociado a un gasto aislado" es más amplio (cualquier pago vinculado vía
 * pago_divisiones a una división de un gasto donde participo), pero para
 * gastos sin grupo la política `pagos_all` solo deja leer un pago a sus dos
 * partes directas (de/a) — nunca a un tercer participante del mismo gasto
 * que no sea parte de ESE pago puntual. Como además todo pago aislado en
 * este modelo se genera pagando la propia división de quien llama
 * (RegistrarPago modo directo), quien aparece como de/a siempre es alguien
 * con una división real en el gasto — así que este filtro coincide en la
 * práctica con "pagos de gastos donde participo", y es lo único que RLS
 * dejaría ver de todos modos.
 */
export async function obtenerHistorialPersonal(usuarioId: string): Promise<{
  gastos: GastoHistorial[]
  pagos: PagoHistorial[]
}> {
  const [{ data: gastosData }, { data: pagosData }] = await Promise.all([
    supabase
      .from('gastos')
      .select(`
        id, descripcion, monto_total, categoria, fecha, creado_en, cuenta_id, pagado_por,
        usuarios!gastos_pagado_por_fkey ( id, nombre, avatar_color ),
        divisiones ( monto_asignado, usuario_id, usuarios ( id, nombre, avatar_color ) )
      `)
      .is('grupo_id', null)
      .order('fecha', { ascending: false })
      .order('creado_en', { ascending: false }),
    supabase
      .from('pagos')
      .select(`
        id, monto, fecha, metodo, creado_en, de_usuario_id, a_usuario_id,
        de:usuarios!pagos_de_usuario_id_fkey ( id, nombre, avatar_color ),
        a:usuarios!pagos_a_usuario_id_fkey ( id, nombre, avatar_color )
      `)
      .is('grupo_id', null)
      .or(`de_usuario_id.eq.${usuarioId},a_usuario_id.eq.${usuarioId}`)
      .order('fecha', { ascending: false })
      .order('creado_en', { ascending: false }),
  ])

  type FilaGastoSinCuenta = {
    id: string; descripcion: string; monto_total: number; categoria: Categoria; fecha: string; creado_en: string
    cuenta_id: string | null; pagado_por: string
    usuarios: UsuarioMini | null
    divisiones: { monto_asignado: number; usuario_id: string; usuarios: UsuarioMini | null }[]
  }

  const gastos: GastoHistorial[] = ((gastosData ?? []) as unknown as FilaGastoSinCuenta[]).map(g => ({
    id: g.id,
    descripcion: g.descripcion,
    monto_total: Number(g.monto_total),
    categoria: g.categoria,
    fecha: g.fecha,
    creado_en: g.creado_en,
    cuenta_id: g.cuenta_id, // siempre null acá, pero se conserva el campo por consistencia de tipo
    cuenta_nombre: null,
    pagado_por: g.pagado_por,
    pagador: g.usuarios,
    divisiones: g.divisiones.map(d => ({ usuario: d.usuarios, monto_asignado: Number(d.monto_asignado) })),
  }))

  type FilaPago = {
    id: string; monto: number; fecha: string; metodo: MetodoPago; creado_en: string
    de_usuario_id: string; a_usuario_id: string
    de: UsuarioMini | null; a: UsuarioMini | null
  }

  const pagos: PagoHistorial[] = ((pagosData ?? []) as unknown as FilaPago[]).map(p => ({
    id: p.id,
    monto: Number(p.monto),
    fecha: p.fecha,
    metodo: p.metodo,
    creado_en: p.creado_en,
    de_usuario_id: p.de_usuario_id,
    a_usuario_id: p.a_usuario_id,
    de: p.de,
    a: p.a,
  }))

  return { gastos, pagos }
}

// ── Helpers de formato ───────────────────────────────────────

export function formatearFechaCorta(fecha: string): string {
  const [year, month, day] = fecha.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  const hoy = new Date()
  const ayer = new Date(hoy); ayer.setDate(hoy.getDate() - 1)

  if (d.toDateString() === hoy.toDateString()) return 'Hoy'
  if (d.toDateString() === ayer.toDateString()) return 'Ayer'

  return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })
}

export function formatearEncabezadoFecha(fecha: string): string {
  const corta = formatearFechaCorta(fecha)
  if (corta === 'Hoy' || corta === 'Ayer') {
    const [, month, day] = fecha.split('-').map(Number)
    const d = new Date(fecha + 'T12:00:00')
    const mes = d.toLocaleDateString('es-CL', { month: 'short' })
    return `${corta} · ${day} ${mes}`
  }
  return corta
}
