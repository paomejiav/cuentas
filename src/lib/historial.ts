import { supabase } from '@/lib/supabase'
import type { Categoria, MetodoPago } from '@/types/database'

export interface IntegranteMin {
  id: string
  nombre: string
  avatar_color: string
}

export interface DivisionDetalle {
  integrante: IntegranteMin
  monto_asignado: number
}

export interface GastoResumen {
  id: string
  descripcion: string
  monto_total: number
  categoria: Categoria
  fecha: string
  mes_cierre: string | null
  creado_en: string
  pagador: IntegranteMin
  mi_division: number        // monto asignado al usuario actual (0 si no participa)
  divisiones: DivisionDetalle[]
}

export interface FiltrosHistorial {
  grupoId: string
  miId: string
  mes?: string              // 'YYYY-MM'
  categoria?: Categoria
  personaId?: string        // filtrar gastos donde esta persona pagó o participó
  cursor?: string           // creado_en del último ítem (para paginación)
  limit?: number
}

// ── Query principal ──────────────────────────────────────────

export async function obtenerGastos(filtros: FiltrosHistorial): Promise<{
  gastos: GastoResumen[]
  hayMas: boolean
}> {
  const limit = filtros.limit ?? 20

  let query = supabase
    .from('gastos')
    .select(`
      id, descripcion, monto_total, categoria, fecha, mes_cierre, creado_en,
      pagador:integrantes!gastos_pagado_por_fkey ( id, nombre, avatar_color ),
      divisiones (
        monto_asignado,
        integrante:integrantes!divisiones_integrante_id_fkey ( id, nombre, avatar_color )
      )
    `)
    .eq('grupo_id', filtros.grupoId)
    .order('fecha', { ascending: false })
    .order('creado_en', { ascending: false })
    .limit(limit + 1)

  if (filtros.mes) {
    // 'YYYY-MM' → rango de fechas
    const [year, month] = filtros.mes.split('-').map(Number)
    const from = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const to = `${year}-${String(month).padStart(2, '0')}-${lastDay}`
    query = query.gte('fecha', from).lte('fecha', to)
  }

  if (filtros.categoria) {
    query = query.eq('categoria', filtros.categoria)
  }

  if (filtros.cursor) {
    query = query.lt('creado_en', filtros.cursor)
  }

  const { data, error } = await query

  if (error || !data) return { gastos: [], hayMas: false }

  const hayMas = data.length > limit
  const rows = hayMas ? data.slice(0, limit) : data

  // Filtro por persona (pagó o participó) — post-query para simplificar
  let filtrados = rows
  if (filtros.personaId) {
    filtrados = rows.filter(g => {
      const pagador = g.pagador as unknown as IntegranteMin
      if (pagador?.id === filtros.personaId) return true
      const divs = g.divisiones as unknown as { integrante: IntegranteMin; monto_asignado: number }[]
      return divs.some(d => d.integrante?.id === filtros.personaId)
    })
  }

  const gastos: GastoResumen[] = filtrados.map(g => {
    const pagador = g.pagador as unknown as IntegranteMin
    const divs = g.divisiones as unknown as { integrante: IntegranteMin; monto_asignado: number }[]

    const miDiv = divs.find(d => d.integrante?.id === filtros.miId)

    return {
      id:          g.id,
      descripcion: g.descripcion,
      monto_total: Number(g.monto_total),
      categoria:   g.categoria as Categoria,
      fecha:       g.fecha,
      mes_cierre:  g.mes_cierre,
      creado_en:   g.creado_en,
      pagador,
      mi_division: miDiv ? Number(miDiv.monto_asignado) : 0,
      divisiones:  divs.map(d => ({
        integrante:     d.integrante,
        monto_asignado: Number(d.monto_asignado),
      })),
    }
  })

  return { gastos, hayMas }
}

// ── Historial entre dos personas ─────────────────────────────

export async function obtenerGastosEntreDos(
  grupoId: string,
  miId: string,
  otroId: string
): Promise<GastoResumen[]> {
  const { data, error } = await supabase
    .from('gastos')
    .select(`
      id, descripcion, monto_total, categoria, fecha, mes_cierre, creado_en,
      pagador:integrantes!gastos_pagado_por_fkey ( id, nombre, avatar_color ),
      divisiones (
        monto_asignado,
        integrante:integrantes!divisiones_integrante_id_fkey ( id, nombre, avatar_color )
      )
    `)
    .eq('grupo_id', grupoId)
    .is('mes_cierre', null)
    .order('fecha', { ascending: false })
    .order('creado_en', { ascending: false })

  if (error || !data) return []

  // Filtrar: gastos donde ambas (yo y otro) participan
  const gastos: GastoResumen[] = []

  for (const g of data) {
    const divs = g.divisiones as unknown as { integrante: IntegranteMin; monto_asignado: number }[]
    const ids = divs.map(d => d.integrante?.id)

    if (!ids.includes(miId) || !ids.includes(otroId)) continue

    const pagador = g.pagador as unknown as IntegranteMin
    const miDiv = divs.find(d => d.integrante?.id === miId)

    gastos.push({
      id:          g.id,
      descripcion: g.descripcion,
      monto_total: Number(g.monto_total),
      categoria:   g.categoria as Categoria,
      fecha:       g.fecha,
      mes_cierre:  g.mes_cierre,
      creado_en:   g.creado_en,
      pagador,
      mi_division: miDiv ? Number(miDiv.monto_asignado) : 0,
      divisiones:  divs.map(d => ({
        integrante:     d.integrante,
        monto_asignado: Number(d.monto_asignado),
      })),
    })
  }

  return gastos
}

// ── Pagos (transferencias de saldo) ──────────────────────────

export interface PagoResumen {
  id: string
  monto: number
  fecha: string
  metodo: MetodoPago
  creado_en: string
  de: IntegranteMin
  a: IntegranteMin
}

export interface FiltrosPagos {
  grupoId: string
  mes?: string
  personaId?: string
  cursor?: string
  limit?: number
}

export async function obtenerPagos(filtros: FiltrosPagos): Promise<{
  pagos: PagoResumen[]
  hayMas: boolean
}> {
  const limit = filtros.limit ?? 20

  let query = supabase
    .from('pagos')
    .select(`
      id, monto, fecha, metodo, creado_en,
      de:integrantes!pagos_de_integrante_id_fkey ( id, nombre, avatar_color ),
      a:integrantes!pagos_a_integrante_id_fkey ( id, nombre, avatar_color )
    `)
    .eq('grupo_id', filtros.grupoId)
    .order('fecha', { ascending: false })
    .order('creado_en', { ascending: false })
    .limit(limit + 1)

  if (filtros.mes) {
    const [year, month] = filtros.mes.split('-').map(Number)
    const from = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const to = `${year}-${String(month).padStart(2, '0')}-${lastDay}`
    query = query.gte('fecha', from).lte('fecha', to)
  }

  if (filtros.cursor) {
    query = query.lt('creado_en', filtros.cursor)
  }

  const { data, error } = await query
  if (error || !data) return { pagos: [], hayMas: false }

  const hayMas = data.length > limit
  const rows = hayMas ? data.slice(0, limit) : data

  let filtrados = rows
  if (filtros.personaId) {
    filtrados = rows.filter(p => {
      const de = p.de as unknown as IntegranteMin
      const a = p.a as unknown as IntegranteMin
      return de?.id === filtros.personaId || a?.id === filtros.personaId
    })
  }

  const pagos: PagoResumen[] = filtrados.map(p => ({
    id:        p.id,
    monto:     Number(p.monto),
    fecha:     p.fecha,
    metodo:    p.metodo as MetodoPago,
    creado_en: p.creado_en,
    de:        p.de as unknown as IntegranteMin,
    a:         p.a as unknown as IntegranteMin,
  }))

  return { pagos, hayMas }
}

export async function obtenerPagosEntreDos(
  grupoId: string,
  miId: string,
  otroId: string
): Promise<PagoResumen[]> {
  const { data, error } = await supabase
    .from('pagos')
    .select(`
      id, monto, fecha, metodo, creado_en,
      de:integrantes!pagos_de_integrante_id_fkey ( id, nombre, avatar_color ),
      a:integrantes!pagos_a_integrante_id_fkey ( id, nombre, avatar_color )
    `)
    .eq('grupo_id', grupoId)
    .order('fecha', { ascending: false })
    .order('creado_en', { ascending: false })

  if (error || !data) return []

  return data
    .filter(p => {
      const de = p.de as unknown as IntegranteMin
      const a = p.a as unknown as IntegranteMin
      return (de?.id === miId && a?.id === otroId) || (de?.id === otroId && a?.id === miId)
    })
    .map(p => ({
      id:        p.id,
      monto:     Number(p.monto),
      fecha:     p.fecha,
      metodo:    p.metodo as MetodoPago,
      creado_en: p.creado_en,
      de:        p.de as unknown as IntegranteMin,
      a:         p.a as unknown as IntegranteMin,
    }))
}

// ── Meses disponibles ────────────────────────────────────────

export async function obtenerMesesDisponibles(grupoId: string): Promise<string[]> {
  const { data } = await supabase
    .from('gastos')
    .select('fecha')
    .eq('grupo_id', grupoId)
    .order('fecha', { ascending: false })

  if (!data) return []

  const meses = new Set<string>()
  for (const g of data) {
    const [year, month] = g.fecha.split('-')
    meses.add(`${year}-${month}`)
  }

  return Array.from(meses)
}

// ── Helpers de formato ───────────────────────────────────────

export function formatearMes(mesYYYYMM: string): string {
  const [year, month] = mesYYYYMM.split('-').map(Number)
  const d = new Date(year, month - 1, 1)
  return d.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })
    .replace(/^\w/, c => c.toUpperCase())
}

export function formatearFechaCorta(fecha: string): string {
  const [year, month, day] = fecha.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  const hoy = new Date()
  const ayer = new Date(hoy); ayer.setDate(hoy.getDate() - 1)

  if (d.toDateString() === hoy.toDateString()) return 'Hoy'
  if (d.toDateString() === ayer.toDateString()) return 'Ayer'

  return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })
}
