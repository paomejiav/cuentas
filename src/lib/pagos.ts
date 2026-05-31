import { supabase } from '@/lib/supabase'
import type { MetodoPago } from '@/types/database'

export interface PagoAnticipado {
  id: string
  grupo_id: string
  de_integrante_id: string
  a_integrante_id: string
  monto: number
  fecha: string
  metodo: MetodoPago
  mes_cierre: string | null
  creado_en: string
  de: { id: string; nombre: string; avatar_color: string }
  a:  { id: string; nombre: string; avatar_color: string }
}

// ── Entre dos personas (sin mes_cierre) ──────────────────────

export async function obtenerPagosEntreDos(
  grupoId: string,
  idA: string,
  idB: string
): Promise<PagoAnticipado[]> {
  const { data, error } = await supabase
    .from('pagos')
    .select(`
      id, grupo_id, de_integrante_id, a_integrante_id,
      monto, fecha, metodo, mes_cierre, creado_en,
      de:integrantes!pagos_de_integrante_id_fkey ( id, nombre, avatar_color ),
      a:integrantes!pagos_a_integrante_id_fkey  ( id, nombre, avatar_color )
    `)
    .eq('grupo_id', grupoId)
    .is('mes_cierre', null)
    .or(`and(de_integrante_id.eq.${idA},a_integrante_id.eq.${idB}),and(de_integrante_id.eq.${idB},a_integrante_id.eq.${idA})`)
    .order('fecha', { ascending: false })
    .order('creado_en', { ascending: false })

  if (error || !data) return []
  return data.map(normalizarPago)
}

// ── Todos los pagos activos del grupo ────────────────────────

export async function obtenerTodosPagos(grupoId: string): Promise<PagoAnticipado[]> {
  const { data, error } = await supabase
    .from('pagos')
    .select(`
      id, grupo_id, de_integrante_id, a_integrante_id,
      monto, fecha, metodo, mes_cierre, creado_en,
      de:integrantes!pagos_de_integrante_id_fkey ( id, nombre, avatar_color ),
      a:integrantes!pagos_a_integrante_id_fkey  ( id, nombre, avatar_color )
    `)
    .eq('grupo_id', grupoId)
    .is('mes_cierre', null)
    .order('fecha', { ascending: false })
    .order('creado_en', { ascending: false })

  if (error || !data) return []
  return data.map(normalizarPago)
}

// ── Pagos de un mes específico (para cierre) ─────────────────

export async function obtenerPagosDeMes(
  grupoId: string,
  mes: string
): Promise<PagoAnticipado[]> {
  const [year, month] = mes.split('-').map(Number)
  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const { data, error } = await supabase
    .from('pagos')
    .select(`
      id, grupo_id, de_integrante_id, a_integrante_id,
      monto, fecha, metodo, mes_cierre, creado_en,
      de:integrantes!pagos_de_integrante_id_fkey ( id, nombre, avatar_color ),
      a:integrantes!pagos_a_integrante_id_fkey  ( id, nombre, avatar_color )
    `)
    .eq('grupo_id', grupoId)
    .is('mes_cierre', null)
    .gte('fecha', from)
    .lte('fecha', to)
    .order('fecha', { ascending: false })

  if (error || !data) return []
  return data.map(normalizarPago)
}

// ── Insertar ─────────────────────────────────────────────────

export interface NuevoPago {
  grupo_id: string
  de_integrante_id: string
  a_integrante_id: string
  monto: number
  fecha: string
  metodo: MetodoPago
}

export async function registrarPago(
  pago: NuevoPago
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const payload = { ...pago, mes_cierre: null }
  const { data, error } = await supabase
    .from('pagos')
    .insert(payload)
    .select('id')
    .single()

  if (error || !data) return { ok: false, error: 'No se pudo registrar el pago.' }
  return { ok: true, id: data.id }
}

// ── Eliminar ─────────────────────────────────────────────────

export async function eliminarPago(
  pagoId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.from('pagos').delete().eq('id', pagoId)
  if (error) return { ok: false, error: 'No se pudo eliminar el pago.' }
  return { ok: true }
}

// ── Label de método ──────────────────────────────────────────

export const METODO_LABEL: Record<MetodoPago, string> = {
  transferencia: 'Transferencia',
  efectivo:      'Efectivo',
  otro:          'Otro',
}

// ── Helper interno ───────────────────────────────────────────

function normalizarPago(raw: Record<string, unknown>): PagoAnticipado {
  return {
    id:                 raw.id as string,
    grupo_id:           raw.grupo_id as string,
    de_integrante_id:   raw.de_integrante_id as string,
    a_integrante_id:    raw.a_integrante_id as string,
    monto:              Number(raw.monto),
    fecha:              raw.fecha as string,
    metodo:             raw.metodo as MetodoPago,
    mes_cierre:         raw.mes_cierre as string | null,
    creado_en:          raw.creado_en as string,
    de:                 raw.de as PagoAnticipado['de'],
    a:                  raw.a  as PagoAnticipado['a'],
  }
}
