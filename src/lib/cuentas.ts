import { supabase } from '@/lib/supabase'

export type TipoCuenta = 'hogar' | 'viaje' | 'evento'

export const ICONO_TIPO: Record<TipoCuenta, string> = {
  hogar: '🏠',
  viaje: '✈️',
  evento: '🎉',
}

export const LABEL_TIPO: Record<TipoCuenta, string> = {
  hogar: 'Hogar',
  viaje: 'Viaje',
  evento: 'Evento',
}

export interface UsuarioMini {
  id: string
  nombre: string
  avatar_color: string
}

export interface CuentaResumen {
  id: string
  nombre: string
  tipo: TipoCuenta
  icono: string | null
  integrantes: UsuarioMini[]
  cantidadGastos: number
  gastoTotal: number
  estado: 'pendiente' | 'al-dia'
}

export interface ResumenGrupo {
  tuParteTotal: number
  pagado: number
  pendiente: number
}

/**
 * Cuentas activas del grupo donde el usuario es miembro (RLS ya filtra esto solo,
 * `cuentas_select` exige `es_miembro_cuenta`), con sus estadísticas agregadas.
 * También arma el resumen personal (tu parte / pagado / pendiente) sobre el
 * mismo set de cuentas — ver definición acordada: tu parte = suma de tus
 * divisiones.monto_asignado en esas cuentas; pagado = la porción saldada;
 * pendiente = la porción sin saldar.
 */
export async function listarCuentasConResumen(
  grupoId: string,
  usuarioId: string
): Promise<{ cuentas: CuentaResumen[]; resumen: ResumenGrupo }> {
  const { data: cuentasRaw } = await supabase
    .from('cuentas')
    .select('id, nombre, tipo, icono')
    .eq('grupo_id', grupoId)
    .eq('estado', 'activa')
    .order('creado_en', { ascending: false })

  const cuentas = (cuentasRaw ?? []) as { id: string; nombre: string; tipo: TipoCuenta; icono: string | null }[]
  if (cuentas.length === 0) {
    return { cuentas: [], resumen: { tuParteTotal: 0, pagado: 0, pendiente: 0 } }
  }

  const cuentaIds = cuentas.map(c => c.id)

  const [{ data: miembrosRaw }, { data: gastosRaw }, { data: divisionesRaw }] = await Promise.all([
    supabase
      .from('cuenta_miembros')
      .select('cuenta_id, usuarios ( id, nombre, avatar_color )')
      .in('cuenta_id', cuentaIds),
    supabase
      .from('gastos')
      .select('id, cuenta_id, monto_total')
      .in('cuenta_id', cuentaIds),
    supabase
      .from('divisiones')
      .select('monto_asignado, saldado, gastos!inner ( cuenta_id )')
      .eq('usuario_id', usuarioId)
      .in('gastos.cuenta_id', cuentaIds),
  ])

  const miembrosPorCuenta = new Map<string, UsuarioMini[]>()
  for (const fila of (miembrosRaw ?? []) as unknown as { cuenta_id: string; usuarios: UsuarioMini | null }[]) {
    if (!fila.usuarios) continue
    const lista = miembrosPorCuenta.get(fila.cuenta_id) ?? []
    lista.push(fila.usuarios)
    miembrosPorCuenta.set(fila.cuenta_id, lista)
  }

  const gastosPorCuenta = new Map<string, { cantidad: number; total: number }>()
  for (const g of (gastosRaw ?? []) as { id: string; cuenta_id: string; monto_total: number }[]) {
    const actual = gastosPorCuenta.get(g.cuenta_id) ?? { cantidad: 0, total: 0 }
    actual.cantidad += 1
    actual.total += g.monto_total
    gastosPorCuenta.set(g.cuenta_id, actual)
  }

  const divisionesTyped = (divisionesRaw ?? []) as unknown as {
    monto_asignado: number
    saldado: boolean
    gastos: { cuenta_id: string } | null
  }[]

  const pendientePorCuenta = new Set<string>()
  let tuParteTotal = 0
  let pagado = 0
  let pendiente = 0
  for (const d of divisionesTyped) {
    const cuentaId = d.gastos?.cuenta_id
    if (!cuentaId) continue
    tuParteTotal += d.monto_asignado
    if (d.saldado) {
      pagado += d.monto_asignado
    } else {
      pendiente += d.monto_asignado
      pendientePorCuenta.add(cuentaId)
    }
  }

  const cuentasConResumen: CuentaResumen[] = cuentas.map(c => ({
    id: c.id,
    nombre: c.nombre,
    tipo: c.tipo,
    icono: c.icono,
    integrantes: miembrosPorCuenta.get(c.id) ?? [],
    cantidadGastos: gastosPorCuenta.get(c.id)?.cantidad ?? 0,
    gastoTotal: gastosPorCuenta.get(c.id)?.total ?? 0,
    estado: pendientePorCuenta.has(c.id) ? 'pendiente' : 'al-dia',
  }))

  return { cuentas: cuentasConResumen, resumen: { tuParteTotal, pagado, pendiente } }
}

export interface CuentaDetalle {
  id: string
  grupo_id: string
  nombre: string
  tipo: TipoCuenta
  icono: string | null
  estado: string
}

export interface MiembroCuenta extends UsuarioMini {
  rol: 'admin' | 'miembro'
}

export async function obtenerCuenta(cuentaId: string): Promise<CuentaDetalle | null> {
  const { data } = await supabase
    .from('cuentas')
    .select('id, grupo_id, nombre, tipo, icono, estado')
    .eq('id', cuentaId)
    .single()
  return data as CuentaDetalle | null
}

export async function obtenerMiembrosCuenta(cuentaId: string): Promise<MiembroCuenta[]> {
  const { data } = await supabase
    .from('cuenta_miembros')
    .select('rol, usuarios ( id, nombre, avatar_color )')
    .eq('cuenta_id', cuentaId)

  return ((data ?? []) as unknown as { rol: 'admin' | 'miembro'; usuarios: UsuarioMini | null }[])
    .filter(f => f.usuarios)
    .map(f => ({ ...(f.usuarios as UsuarioMini), rol: f.rol }))
}

export interface SaldoCuenta {
  gastoTotal: number
  tuParte: number
  tuSaldo: number // saldado - tuParte: 0 = al día, negativo = le debés al grupo
}

export async function calcularSaldoCuenta(cuentaId: string, usuarioId: string): Promise<SaldoCuenta> {
  const [{ data: gastos }, { data: divisiones }] = await Promise.all([
    supabase.from('gastos').select('monto_total').eq('cuenta_id', cuentaId),
    supabase
      .from('divisiones')
      .select('monto_asignado, saldado, gastos!inner ( cuenta_id )')
      .eq('usuario_id', usuarioId)
      .eq('gastos.cuenta_id', cuentaId),
  ])

  const gastoTotal = (gastos ?? []).reduce((acc, g) => acc + (g as { monto_total: number }).monto_total, 0)

  let tuParte = 0
  let saldadoSum = 0
  for (const d of (divisiones ?? []) as unknown as { monto_asignado: number; saldado: boolean }[]) {
    tuParte += d.monto_asignado
    if (d.saldado) saldadoSum += d.monto_asignado
  }

  return { gastoTotal, tuParte, tuSaldo: saldadoSum - tuParte }
}

export interface GastoDeCuenta {
  id: string
  descripcion: string
  monto_total: number
  categoria: string
  fecha: string
  pagador: UsuarioMini | null
}

export async function listarGastosCuenta(cuentaId: string): Promise<GastoDeCuenta[]> {
  const { data } = await supabase
    .from('gastos')
    .select('id, descripcion, monto_total, categoria, fecha, usuarios!gastos_pagado_por_fkey ( id, nombre, avatar_color )')
    .eq('cuenta_id', cuentaId)
    .order('fecha', { ascending: false })
    .order('creado_en', { ascending: false })

  return ((data ?? []) as unknown as (Omit<GastoDeCuenta, 'pagador'> & { usuarios: UsuarioMini | null })[])
    .map(g => ({ ...g, pagador: g.usuarios }))
}

export interface SaldoIntegrante {
  usuario: UsuarioMini
  neto: number // positivo = te debe, negativo = le debés
}

interface GastoConDivisiones {
  id: string
  pagado_por: string
  divisiones: { usuario_id: string; monto_asignado: number; saldado: boolean }[]
}

/**
 * Núcleo puro del cálculo de saldo neto por persona: por cada gasto, quien
 * pagó vs quien tiene la división. Solo considera divisiones sin saldar —
 * una vez saldada una división ya no cuenta como deuda pendiente.
 * Reutilizado tanto para el saldo de una cuenta puntual como para el de
 * todo un grupo (mismo criterio, distinto universo de gastos de entrada).
 */
function calcularSaldosDesdeGastos(
  gastos: GastoConDivisiones[],
  usuarioId: string,
  integrantes: UsuarioMini[]
): SaldoIntegrante[] {
  const netoPorUsuario = new Map<string, number>()
  for (const otro of integrantes) {
    if (otro.id === usuarioId) continue
    netoPorUsuario.set(otro.id, 0)
  }

  for (const gasto of gastos) {
    for (const div of gasto.divisiones) {
      if (div.saldado) continue
      if (gasto.pagado_por === usuarioId && div.usuario_id !== usuarioId && netoPorUsuario.has(div.usuario_id)) {
        // otro me debe su parte
        netoPorUsuario.set(div.usuario_id, (netoPorUsuario.get(div.usuario_id) ?? 0) + div.monto_asignado)
      }
      if (div.usuario_id === usuarioId && gasto.pagado_por !== usuarioId && netoPorUsuario.has(gasto.pagado_por)) {
        // yo le debo mi parte a quien pagó
        netoPorUsuario.set(gasto.pagado_por, (netoPorUsuario.get(gasto.pagado_por) ?? 0) - div.monto_asignado)
      }
    }
  }

  return integrantes
    .filter(i => i.id !== usuarioId)
    .map(i => ({ usuario: i, neto: netoPorUsuario.get(i.id) ?? 0 }))
}

/** Saldo neto por integrante, acotado a los gastos/divisiones de ESTA cuenta. */
export async function calcularSaldosCuenta(
  cuentaId: string,
  usuarioId: string,
  integrantes: MiembroCuenta[]
): Promise<SaldoIntegrante[]> {
  const { data } = await supabase
    .from('gastos')
    .select('id, pagado_por, divisiones ( usuario_id, monto_asignado, saldado )')
    .eq('cuenta_id', cuentaId)

  const gastos = (data ?? []) as unknown as GastoConDivisiones[]
  return calcularSaldosDesdeGastos(gastos, usuarioId, integrantes)
}

/**
 * Saldo neto por integrante sobre TODOS los gastos del grupo (con o sin
 * cuenta_id) — misma lógica que calcularSaldosCuenta, generalizada al grupo
 * entero. Usada por el dashboard (pantalla 03).
 */
export async function calcularSaldosGrupo(
  grupoId: string,
  usuarioId: string
): Promise<SaldoIntegrante[]> {
  const [{ data: miembrosRaw }, { data: gastosRaw }] = await Promise.all([
    supabase
      .from('grupo_miembros')
      .select('usuarios ( id, nombre, avatar_color )')
      .eq('grupo_id', grupoId),
    supabase
      .from('gastos')
      .select('id, pagado_por, divisiones ( usuario_id, monto_asignado, saldado )')
      .eq('grupo_id', grupoId),
  ])

  const integrantes = ((miembrosRaw ?? []) as unknown as { usuarios: UsuarioMini | null }[])
    .map(f => f.usuarios)
    .filter((u): u is UsuarioMini => !!u)
  const gastos = (gastosRaw ?? []) as unknown as GastoConDivisiones[]

  return calcularSaldosDesdeGastos(gastos, usuarioId, integrantes)
}

export interface ResumenGastosGrupo {
  saldoTotal: number
  ultimaActividad: string | null // creado_en del gasto más reciente del grupo, o null si no hay gastos
}

/** Suma de monto_total de TODOS los gastos del grupo (con o sin cuenta_id). */
export async function obtenerResumenGastosGrupo(grupoId: string): Promise<ResumenGastosGrupo> {
  const { data } = await supabase
    .from('gastos')
    .select('monto_total, creado_en')
    .eq('grupo_id', grupoId)
    .order('creado_en', { ascending: false })

  const rows = (data ?? []) as { monto_total: number; creado_en: string }[]
  const saldoTotal = rows.reduce((s, r) => s + r.monto_total, 0)
  return { saldoTotal, ultimaActividad: rows[0]?.creado_en ?? null }
}

export interface MiembroGrupoMini extends UsuarioMini {
  yaEsMiembroCuenta: boolean
}

export async function listarMiembrosGrupoParaCuenta(
  grupoId: string,
  cuentaId: string | null,
  usuarioIdExcluir: string | null
): Promise<MiembroGrupoMini[]> {
  const [{ data: miembrosGrupo }, existentes] = await Promise.all([
    supabase
      .from('grupo_miembros')
      .select('usuario_id, usuarios ( id, nombre, avatar_color )')
      .eq('grupo_id', grupoId),
    cuentaId ? obtenerMiembrosCuenta(cuentaId) : Promise.resolve([] as MiembroCuenta[]),
  ])

  const idsExistentes = new Set(existentes.map(m => m.id))

  return ((miembrosGrupo ?? []) as unknown as { usuario_id: string; usuarios: UsuarioMini | null }[])
    .filter(f => f.usuarios && f.usuarios.id !== usuarioIdExcluir)
    .map(f => ({ ...(f.usuarios as UsuarioMini), yaEsMiembroCuenta: idsExistentes.has(f.usuarios!.id) }))
}

// ── Contactos compartidos (para gastos aislados, sin grupo) ──────
//
// Unión de todas las personas con las que el usuario comparte al menos un
// grupo donde su membresía sigue activa — no solo el grupo activo, pero
// tampoco grupos que ya abandonó. Sin duplicados, sin incluirse a sí mismo
// (un gasto aislado se arma entre "yo" + estos contactos; el "yo" se agrega
// aparte en el punto de uso, ver obtenerUsuarioMini). También excluye a
// quienes hayan salido de esos grupos — alguien que ya no pertenece no es
// candidato para un gasto aislado nuevo.
export async function listarContactosCompartidos(usuarioId: string): Promise<UsuarioMini[]> {
  const { data: misGrupos } = await supabase
    .from('grupo_miembros')
    .select('grupo_id')
    .eq('usuario_id', usuarioId)
    .eq('activo', true)

  const grupoIds = (misGrupos ?? []).map(g => g.grupo_id as string)
  if (grupoIds.length === 0) return []

  const { data } = await supabase
    .from('grupo_miembros')
    .select('usuarios ( id, nombre, avatar_color )')
    .in('grupo_id', grupoIds)
    .neq('usuario_id', usuarioId)
    .eq('activo', true)

  const vistos = new Set<string>()
  const contactos: UsuarioMini[] = []
  for (const fila of ((data ?? []) as unknown as { usuarios: UsuarioMini | null }[])) {
    const u = fila.usuarios
    if (!u || vistos.has(u.id)) continue
    vistos.add(u.id)
    contactos.push(u)
  }

  return contactos.sort((a, b) => a.nombre.localeCompare(b.nombre))
}

/** El propio perfil mini del usuario — para agregarse a sí mismo a una lista de contactos. */
export async function obtenerUsuarioMini(usuarioId: string): Promise<UsuarioMini | null> {
  const { data } = await supabase
    .from('usuarios')
    .select('id, nombre, avatar_color')
    .eq('id', usuarioId)
    .single()
  return (data as UsuarioMini | null) ?? null
}
