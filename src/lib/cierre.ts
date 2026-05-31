import { supabase } from '@/lib/supabase'
import type { Categoria, MetodoPago } from '@/types/database'
import { obtenerPagosDeMes, type PagoAnticipado } from '@/lib/pagos'

// ── Tipos ─────────────────────────────────────────────────────

export interface IntegranteMin {
  id: string
  nombre: string
  avatar_color: string
}

export interface SaldoIntegrante {
  integrante: IntegranteMin
  pago:        number  // total que pagó en el mes
  corresponde: number  // total que le corresponde pagar (suma de sus divisiones)
  neto:        number  // pago - corresponde (positivo = le deben, negativo = debe)
}

export interface DesgloseCat {
  categoria: Categoria
  total: number
  porcentaje: number
}

export interface ResumenMes {
  mes: string             // 'YYYY-MM'
  totalGastado: number
  saldos: SaldoIntegrante[]
  porCategoria: DesgloseCat[]
  gastoIds: string[]      // ids de los gastos a cerrar
  yaCerrado: boolean
  pagosAnticipados: PagoAnticipado[]
}

export interface TransferenciaCierre {
  id: string              // generado localmente
  de: IntegranteMin
  a: IntegranteMin
  monto: number
  pagado: boolean
  fecha: string           // 'YYYY-MM-DD'
  metodo: MetodoPago
}

// ── Helpers ───────────────────────────────────────────────────

function mesRango(mes: string): { from: string; to: string } {
  const [year, month] = mes.split('-').map(Number)
  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { from, to }
}

export function mesActual(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function mesPorDefecto(): string {
  const d = new Date()
  // Si estamos en el primer día, usar el mes anterior
  if (d.getDate() === 1) {
    d.setDate(0)
  } else {
    // Proponer el mes actual (se cierra el período vigente)
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function formatearMesLabel(mes: string): string {
  const [year, month] = mes.split('-').map(Number)
  return new Date(year, month - 1, 1)
    .toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })
    .replace(/^\w/, c => c.toUpperCase())
}

// Genera meses desde el primero con gastos hasta hoy
export function generarMesesDisponibles(desde: string): string[] {
  const [fy, fm] = desde.split('-').map(Number)
  const hoy = new Date()
  const meses: string[] = []

  let y = fy, m = fm
  while (y < hoy.getFullYear() || (y === hoy.getFullYear() && m <= hoy.getMonth() + 1)) {
    meses.push(`${y}-${String(m).padStart(2, '0')}`)
    m++
    if (m > 12) { m = 1; y++ }
  }
  return meses.reverse()
}

// ── calcularResumenMes ────────────────────────────────────────

export async function calcularResumenMes(
  grupoId: string,
  mes: string
): Promise<ResumenMes | null> {
  const { from, to } = mesRango(mes)

  // ¿Ya fue cerrado?
  const { data: cierre } = await supabase
    .from('cierres_mensuales')
    .select('id')
    .eq('grupo_id', grupoId)
    .eq('mes', mes)
    .maybeSingle()

  // Gastos del mes sin cerrar
  const { data: gastos, error } = await supabase
    .from('gastos')
    .select(`
      id, monto_total, categoria,
      pagado_por,
      divisiones ( integrante_id, monto_asignado )
    `)
    .eq('grupo_id', grupoId)
    .gte('fecha', from)
    .lte('fecha', to)
    .is('mes_cierre', null)

  if (error) return null

  // Integrantes activos del grupo
  const { data: integrantes } = await supabase
    .from('integrantes')
    .select('id, nombre, avatar_color')
    .eq('grupo_id', grupoId)
    .eq('activo', true)
    .order('nombre')

  if (!integrantes) return null

  // Acumular pagos y correspondencias
  const pagos: Record<string, number> = {}
  const corresponde: Record<string, number> = {}
  const porCat: Record<string, number> = {}

  for (const i of integrantes) { pagos[i.id] = 0; corresponde[i.id] = 0 }

  let totalGastado = 0

  for (const g of gastos ?? []) {
    const monto = Number(g.monto_total)
    totalGastado += monto

    if (g.pagado_por in pagos) pagos[g.pagado_por] += monto

    porCat[g.categoria] = (porCat[g.categoria] ?? 0) + monto

    for (const d of g.divisiones as { integrante_id: string; monto_asignado: number }[]) {
      if (d.integrante_id in corresponde) {
        corresponde[d.integrante_id] += Number(d.monto_asignado)
      }
    }
  }

  const saldos: SaldoIntegrante[] = integrantes.map(i => ({
    integrante: { id: i.id, nombre: i.nombre, avatar_color: i.avatar_color },
    pago:        Math.round(pagos[i.id]       ?? 0),
    corresponde: Math.round(corresponde[i.id] ?? 0),
    neto:        Math.round((pagos[i.id] ?? 0) - (corresponde[i.id] ?? 0)),
  }))

  const porCategoria: DesgloseCat[] = Object.entries(porCat)
    .map(([categoria, total]) => ({
      categoria:   categoria as Categoria,
      total:       Math.round(total),
      porcentaje:  totalGastado > 0 ? Math.round((total / totalGastado) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total)

  const gastoIds = (gastos ?? []).map(g => g.id)

  const pagosAnticipados = await obtenerPagosDeMes(grupoId, mes)

  return {
    mes,
    totalGastado: Math.round(totalGastado),
    saldos,
    porCategoria,
    gastoIds,
    yaCerrado: Boolean(cierre),
    pagosAnticipados,
  }
}

// ── calcularPagosOptimizados ──────────────────────────────────
// Algoritmo greedy: empareja al mayor deudor con el mayor acreedor
// hasta saldar todos los balances. Mínimo de transferencias.

export function calcularPagosOptimizados(saldos: SaldoIntegrante[]): TransferenciaCierre[] {
  const hoy = new Date().toISOString().slice(0, 10)

  const deudores  = saldos.filter(s => s.neto < -0.5).map(s => ({ integrante: s.integrante, monto: -s.neto })).sort((a, b) => b.monto - a.monto)
  const acreedores = saldos.filter(s => s.neto > 0.5).map(s => ({ integrante: s.integrante, monto: s.neto  })).sort((a, b) => b.monto - a.monto)

  const transferencias: TransferenciaCierre[] = []
  let i = 0, j = 0

  while (i < deudores.length && j < acreedores.length) {
    const pago = Math.min(deudores[i].monto, acreedores[j].monto)

    if (pago >= 1) {
      transferencias.push({
        id:     `opt-${i}-${j}`,
        de:     deudores[i].integrante,
        a:      acreedores[j].integrante,
        monto:  Math.round(pago),
        pagado: false,
        fecha:  hoy,
        metodo: 'transferencia',
      })
    }

    deudores[i].monto   -= pago
    acreedores[j].monto -= pago

    if (deudores[i].monto   < 0.5) i++
    if (acreedores[j].monto < 0.5) j++
  }

  return transferencias
}

// ── calcularPagosIndividuales ─────────────────────────────────
// Cada deudora le paga directamente a cada acreedora en proporción.
// Más transparente, pero genera más transferencias.

export function calcularPagosIndividuales(
  grupoId: string,
  saldos: SaldoIntegrante[],
  gastos: { pagado_por: string; divisiones: { integrante_id: string; monto: number }[] }[]
): TransferenciaCierre[] {
  // Construir mapa de deudas directas par a par usando los gastos reales
  const hoy = new Date().toISOString().slice(0, 10)
  const deudaMap: Record<string, Record<string, number>> = {}

  for (const g of gastos) {
    const pagador = g.pagado_por
    for (const d of g.divisiones) {
      if (d.integrante_id === pagador) continue
      if (!deudaMap[d.integrante_id]) deudaMap[d.integrante_id] = {}
      deudaMap[d.integrante_id][pagador] = (deudaMap[d.integrante_id][pagador] ?? 0) + d.monto
    }
  }

  // Netear par a par (si A le debe a B y B le debe a A, solo queda la diferencia)
  const intMap: Record<string, IntegranteMin> = {}
  for (const s of saldos) intMap[s.integrante.id] = s.integrante

  const transferencias: TransferenciaCierre[] = []
  const procesados = new Set<string>()

  for (const [deudorId, acreedores] of Object.entries(deudaMap)) {
    for (const [acreedorId, monto] of Object.entries(acreedores)) {
      const key = [deudorId, acreedorId].sort().join('|')
      if (procesados.has(key)) continue
      procesados.add(key)

      const inverso = deudaMap[acreedorId]?.[deudorId] ?? 0
      const neto = monto - inverso

      if (Math.abs(neto) < 1) continue

      const de = neto > 0 ? deudorId  : acreedorId
      const a  = neto > 0 ? acreedorId : deudorId

      if (!intMap[de] || !intMap[a]) continue

      transferencias.push({
        id:     `ind-${de}-${a}`,
        de:     intMap[de],
        a:      intMap[a],
        monto:  Math.round(Math.abs(neto)),
        pagado: false,
        fecha:  hoy,
        metodo: 'transferencia',
      })
    }
  }

  return transferencias.sort((a, b) => b.monto - a.monto)
}

// ── cerrarMes ─────────────────────────────────────────────────

export async function cerrarMes(
  grupoId: string,
  mes: string,
  gastoIds: string[],
  totalGastado: number,
  transferencias: TransferenciaCierre[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  // 1. Marcar gastos con mes_cierre
  if (gastoIds.length > 0) {
    const { error: gastoErr } = await supabase
      .from('gastos')
      .update({ mes_cierre: mes })
      .in('id', gastoIds)

    if (gastoErr) return { ok: false, error: 'No se pudieron cerrar los gastos.' }
  }

  // 2. Guardar pagos realizados
  const pagosRealizados = transferencias.filter(t => t.pagado)
  if (pagosRealizados.length > 0) {
    const rows = pagosRealizados.map(t => ({
      grupo_id:          grupoId,
      de_integrante_id:  t.de.id,
      a_integrante_id:   t.a.id,
      monto:             t.monto,
      fecha:             t.fecha,
      metodo:            t.metodo,
      mes_cierre:        mes,
    }))

    const { error: pagoErr } = await supabase.from('pagos').insert(rows)
    if (pagoErr) return { ok: false, error: 'No se pudieron guardar los pagos.' }
  }

  // 3. Crear registro de cierre
  const { error: cierreErr } = await supabase
    .from('cierres_mensuales')
    .insert({ grupo_id: grupoId, mes, total_gastado: totalGastado })

  if (cierreErr) return { ok: false, error: 'No se pudo registrar el cierre.' }

  return { ok: true }
}

// ── Historial de cierres ──────────────────────────────────────

export interface CierreHistorial {
  id: string
  mes: string
  total_gastado: number
  cerrado_en: string
}

export async function obtenerCierresAnteriores(grupoId: string): Promise<CierreHistorial[]> {
  const { data } = await supabase
    .from('cierres_mensuales')
    .select('id, mes, total_gastado, cerrado_en')
    .eq('grupo_id', grupoId)
    .order('mes', { ascending: false })

  return (data ?? []) as CierreHistorial[]
}
