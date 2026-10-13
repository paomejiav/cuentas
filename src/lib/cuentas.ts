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

/**
 * Saldo neto por persona sobre los gastos aislados (sin grupo) donde el
 * usuario participa — mismo núcleo que calcularSaldosGrupo, generalizado a
 * un universo sin grupo. La política RLS `gastos_select` ya solo devuelve,
 * para grupo_id null, las filas donde es_participante_gasto(id) es cierto,
 * así que no hace falta filtrar participación acá.
 */
export async function calcularSaldosPersonal(usuarioId: string): Promise<SaldoIntegrante[]> {
  const { data } = await supabase
    .from('gastos')
    .select('id, pagado_por, divisiones ( usuario_id, monto_asignado, saldado )')
    .is('grupo_id', null)

  const gastos = (data ?? []) as unknown as GastoConDivisiones[]

  // No hay una lista previa de "integrantes de lo personal" — se arma con
  // quien pagó y quienes tienen una división en estos mismos gastos. El
  // nombre/color no importa para este cálculo (solo se usa el neto total).
  const idsVistos = new Set<string>()
  for (const g of gastos) {
    idsVistos.add(g.pagado_por)
    for (const d of g.divisiones) idsVistos.add(d.usuario_id)
  }
  const integrantes: UsuarioMini[] = Array.from(idsVistos).map(id => ({ id, nombre: '', avatar_color: '' }))

  return calcularSaldosDesdeGastos(gastos, usuarioId, integrantes)
}

/**
 * Fecha de hoy "YYYY-MM-DD" en America/Santiago — nunca `new
 * Date().toISOString().slice(0,10)`, que usa UTC y puede adelantar un día
 * (o retrasarlo) cerca de la medianoche según la hora del navegador o del
 * servidor. Con esto, un gasto creado el último día del mes a las 23:30 en
 * Chile sigue fechado ese mismo día, no al siguiente.
 */
export function fechaActualSantiago(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
}

/**
 * Límites [desde, hasta) del mes calendario actual en America/Santiago,
 * como strings "YYYY-MM-DD" comparables directo contra `gastos.fecha`
 * (columna `date`, sin hora) — evita depender de la zona horaria del
 * navegador o el servidor.
 */
export function limitesMesActualSantiago(): { desde: string; hasta: string } {
  const hoy = fechaActualSantiago()
  const [anio, mes] = hoy.split('-').map(Number)
  const desde = `${anio}-${String(mes).padStart(2, '0')}-01`
  const anioProximo = mes === 12 ? anio + 1 : anio
  const mesProximo = mes === 12 ? 1 : mes + 1
  const hasta = `${anioProximo}-${String(mesProximo).padStart(2, '0')}-01`
  return { desde, hasta }
}

/**
 * Fecha "YYYY-MM-DD" de hace N meses, en America/Santiago — para filtros
 * tipo "Últimos 3 meses". Mismo criterio que limitesMesActualSantiago: se
 * arma a mano desde las partes de fechaActualSantiago(), nunca con
 * new Date().toISOString() ni con la hora/zona del navegador.
 */
export function fechaHaceMesesSantiago(n: number): string {
  const [anio, mes, dia] = fechaActualSantiago().split('-').map(Number)
  const d = new Date(anio, mes - 1, dia) // constructor numérico = fecha de calendario local, sin zona/UTC de por medio
  d.setMonth(d.getMonth() - n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ── Fechas "YYYY-MM-DD" (columna `date`, sin hora) para mostrar ──────────
//
// Este archivo es el único lugar autorizado para resolver "hoy" y "mes
// actual": todo lo de arriba (fechaActualSantiago, limitesMesActualSantiago,
// fechaHaceMesesSantiago) y lo de abajo (formatear/comparar una fecha ya
// guardada) vive acá para que nadie vuelva a escribir
// `new Date().toISOString().slice(0,10)` (usa UTC, puede adelantar el día
// cerca de medianoche en Chile) ni `new Date(fecha)` sobre una fecha sin
// hora (los date-only strings se interpretan como medianoche UTC — en
// Chile eso siempre muestra el día anterior). Como una fecha "YYYY-MM-DD"
// ya es el día que importa, se formatea leyendo sus partes directo, sin
// pasar nunca por el constructor Date(string) ni por ninguna zona horaria.

const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** Nombre del mes en español a partir de una fecha "YYYY-MM-DD" o "YYYY-MM" — "2026-10..." → "octubre". */
export function nombreMesDeFecha(fecha: string, formato: 'largo' | 'corto' = 'largo'): string {
  const mes = Number(fecha.slice(5, 7))
  return (formato === 'largo' ? MESES_LARGOS : MESES_CORTOS)[mes - 1]
}

/** Fecha corta en español ("31 oct") a partir de "YYYY-MM-DD" — por partes, nunca via new Date(string). */
export function formatearFechaCortaSantiago(fecha: string): string {
  const [, , dia] = fecha.split('-')
  return `${Number(dia)} ${nombreMesDeFecha(fecha, 'corto')}`
}

/**
 * "Hoy" / "Ayer" si la fecha coincide con el día actual o el anterior en
 * America/Santiago, o null si no es ninguno — comparación de strings
 * "YYYY-MM-DD" puras, nunca contra new Date() del dispositivo.
 */
export function etiquetaHoyAyerSantiago(fecha: string): 'Hoy' | 'Ayer' | null {
  const hoy = fechaActualSantiago()
  if (fecha === hoy) return 'Hoy'
  const [anio, mes, dia] = hoy.split('-').map(Number)
  const d = new Date(anio, mes - 1, dia)
  d.setDate(d.getDate() - 1)
  const ayer = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return fecha === ayer ? 'Ayer' : null
}

/** Total de gastos del grupo en el mes calendario actual (no la parte del usuario). */
export async function obtenerGastoMesGrupo(grupoId: string, desde: string, hasta: string): Promise<number> {
  const { data } = await supabase
    .from('gastos')
    .select('monto_total')
    .eq('grupo_id', grupoId)
    .gte('fecha', desde)
    .lt('fecha', hasta)

  return ((data ?? []) as { monto_total: number }[]).reduce((s, g) => s + Number(g.monto_total), 0)
}

/** Total de gastos aislados (sin grupo) del usuario en el mes calendario actual. */
export async function obtenerGastoMesPersonal(usuarioId: string, desde: string, hasta: string): Promise<number> {
  const { data } = await supabase
    .from('gastos')
    .select('monto_total')
    .is('grupo_id', null)
    .gte('fecha', desde)
    .lt('fecha', hasta)

  return ((data ?? []) as { monto_total: number }[]).reduce((s, g) => s + Number(g.monto_total), 0)
}

export interface GastoMesPorCuenta {
  cuentaId: string | null // null = "General", gastos del grupo sin cuenta
  nombre: string
  monto: number
}

/** Gasto del mes calendario actual del grupo, agrupado por cuenta (sin cuenta → "General"). */
export async function obtenerGastoMesPorCuenta(grupoId: string, desde: string, hasta: string): Promise<GastoMesPorCuenta[]> {
  const [{ data: gastosRaw }, { data: cuentasRaw }] = await Promise.all([
    supabase
      .from('gastos')
      .select('monto_total, cuenta_id')
      .eq('grupo_id', grupoId)
      .gte('fecha', desde)
      .lt('fecha', hasta),
    supabase.from('cuentas').select('id, nombre').eq('grupo_id', grupoId),
  ])

  const nombrePorCuenta = new Map<string, string>()
  for (const c of (cuentasRaw ?? []) as { id: string; nombre: string }[]) nombrePorCuenta.set(c.id, c.nombre)

  const montoPorCuenta = new Map<string | null, number>()
  for (const g of (gastosRaw ?? []) as { monto_total: number; cuenta_id: string | null }[]) {
    const clave = g.cuenta_id
    montoPorCuenta.set(clave, (montoPorCuenta.get(clave) ?? 0) + Number(g.monto_total))
  }

  return Array.from(montoPorCuenta.entries())
    .map(([cuentaId, monto]) => ({
      cuentaId,
      nombre: cuentaId ? (nombrePorCuenta.get(cuentaId) ?? '—') : 'General',
      monto,
    }))
    .sort((a, b) => b.monto - a.monto)
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

// ── Acceso a una cuenta vía enlace (pantalla /cuentas/[id]/acceso) ──────

export interface AccesoCuenta {
  existe: boolean
  tiene_acceso: boolean
  es_miembro_del_grupo: boolean
  nombre_cuenta: string | null
  nombre_grupo: string | null
}

export async function verificarAccesoCuenta(cuentaId: string): Promise<AccesoCuenta | null> {
  const { data } = await supabase.rpc('verificar_acceso_cuenta', { p_cuenta_id: cuentaId }).single()
  return (data as AccesoCuenta | null) ?? null
}
