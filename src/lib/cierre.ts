import { supabase } from '@/lib/supabase'
import type { UsuarioMini } from '@/lib/cuentas'
import type { DivisionASaldar } from '@/lib/pagos'

// ── Tipos ─────────────────────────────────────────────────────

export interface TransferenciaSugerida {
  id: string               // `${de.id}|${a.id}`, generado localmente
  de: UsuarioMini
  a: UsuarioMini
  divisiones: DivisionASaldar[]
  monto: number             // = suma de divisiones.monto_asignado
}

export interface AristaCadena {
  de: UsuarioMini
  a: UsuarioMini
  monto: number             // lo efectivamente cancelado en esta arista, respaldado por `divisiones`
  divisiones: DivisionASaldar[]
}

export interface CadenaCancelada {
  id: string
  participantes: UsuarioMini[] // en el orden del ciclo: participantes[i] le debe a participantes[i+1]
  aristas: AristaCadena[]
  montoTotalCancelado: number  // suma de monto de todas las aristas
  montosIguales: boolean       // true si todas las aristas cancelaron el mismo monto
}

export interface ResumenCierre {
  totalPeriodo: number       // suma monto_asignado de TODAS las divisiones (saldadas y no) de los gastos del período
  saldadoPeriodo: number     // suma monto_asignado de las divisiones de ese conjunto ya saldado=true — igual en ambos modos
  hayPendientes: boolean     // true si algún gasto del grupo tiene al menos una división pendiente relevante
  bilateral: {
    transferencias: TransferenciaSugerida[]
    deudasIndividuales: number // cantidad de divisiones pendientes antes de agrupar por par
  }
  completa: {
    transferencias: TransferenciaSugerida[] // residuales, después de cancelar cadenas — "A transferir"
    cadenas: CadenaCancelada[]
  }
}

interface DivisionRaw {
  id: string
  usuario_id: string
  monto_asignado: number
  saldado: boolean
}

interface GastoRaw {
  id: string
  descripcion: string
  fecha: string
  monto_total: number
  pagado_por: string
  divisiones: DivisionRaw[]
}

// ── Cálculo del resumen (ambos modos) ────────────────────────────

/**
 * Todo lo pendiente de saldar hasta hoy en el grupo (sin importar la fecha del
 * gasto original, ni si tiene cuenta_id o no) — no filtra por mes calendario.
 *
 * "El período" = el conjunto de gastos que tienen al menos una división
 * pendiente relevante (saldado=false y usuario_id distinto del pagador — la
 * propia división del pagador nunca representa una deuda, mismo criterio que
 * calcularSaldosDesdeGastos en cuentas.ts).
 *
 * Arma el pool bilateral una sola vez (misma fuente para los dos modos) y
 * deriva de ahí tanto las transferencias Bilaterales (sin tocar su algoritmo)
 * como la cancelación de cadenas de Completa, sobre una copia — Bilateral
 * nunca ve los pools ya consumidos por el cancelado de ciclos.
 */
export async function calcularResumenCierre(grupoId: string): Promise<ResumenCierre> {
  const [{ data: gastosRaw }, { data: miembrosRaw }] = await Promise.all([
    supabase
      .from('gastos')
      .select('id, descripcion, fecha, monto_total, pagado_por, divisiones ( id, usuario_id, monto_asignado, saldado )')
      .eq('grupo_id', grupoId),
    supabase
      .from('grupo_miembros')
      .select('usuarios ( id, nombre, avatar_color )')
      .eq('grupo_id', grupoId),
  ])

  const gastos = (gastosRaw ?? []) as unknown as GastoRaw[]
  const miembros = ((miembrosRaw ?? []) as unknown as { usuarios: UsuarioMini | null }[])
    .map(f => f.usuarios)
    .filter((u): u is UsuarioMini => !!u)

  const esPendienteRelevante = (d: DivisionRaw, pagadoPor: string) => !d.saldado && d.usuario_id !== pagadoPor

  const gastosPeriodo = gastos.filter(g => g.divisiones.some(d => esPendienteRelevante(d, g.pagado_por)))

  let totalPeriodo = 0
  let saldadoPeriodo = 0
  let deudasIndividuales = 0

  // Bilateral: para cada par (deudor, acreedor) concreto, todas las
  // divisiones pendientes que se le deben — la llave es exactamente quién le
  // debe a quién según el propio gasto (gasto.pagado_por), nunca un saldo
  // abstracto de grupo. Esto es deliberado: cada transferencia sugerida solo
  // puede quedar respaldada por divisiones reales de ESE par de personas —
  // ver nota en construirTransferencias.
  const poolBilateral = new Map<string, DivisionASaldar[]>()

  for (const g of gastosPeriodo) {
    for (const d of g.divisiones) {
      totalPeriodo += d.monto_asignado
      if (d.saldado) { saldadoPeriodo += d.monto_asignado; continue }
      if (!esPendienteRelevante(d, g.pagado_por)) continue // división propia del pagador

      const key = `${d.usuario_id}|${g.pagado_por}`
      const lista = poolBilateral.get(key) ?? []
      lista.push({
        division_id:    d.id,
        gasto_id:       g.id,
        descripcion:    g.descripcion,
        fecha:          g.fecha,
        monto_asignado: d.monto_asignado,
        grupo_id:       grupoId,
      })
      poolBilateral.set(key, lista)
      deudasIndividuales++
    }
  }

  for (const lista of poolBilateral.values()) lista.sort((a, b) => a.fecha.localeCompare(b.fecha))

  const bilateralTransferencias = construirTransferencias(miembros, poolBilateral)

  // Completa: cancelación de ciclos sobre una COPIA de los pools — construir-
  // Transferencias para Bilateral ya corrió sobre los pools originales arriba.
  const poolsCompleta = new Map<string, DivisionASaldar[]>()
  for (const [key, lista] of poolBilateral) poolsCompleta.set(key, [...lista])

  const { eventos } = cancelarCiclos(poolsCompleta)
  const cadenas = construirCadenas(eventos, miembros)
  const completaTransferencias = construirTransferencias(miembros, poolsCompleta) // pools ya reducidos por los ciclos

  return {
    totalPeriodo:   Math.round(totalPeriodo),
    saldadoPeriodo: Math.round(saldadoPeriodo),
    hayPendientes:  gastosPeriodo.length > 0,
    bilateral: { transferencias: bilateralTransferencias, deudasIndividuales },
    completa:  { transferencias: completaTransferencias, cadenas },
  }
}

// ── Modo Bilateral: agrupa las divisiones pendientes por par
// (deudor, acreedor) — cada gasto que una misma persona le debe a otra
// dentro del período se junta en UNA sola transferencia sugerida, en vez de
// una por gasto. NO TOCAR — ver la nota larga original sobre por qué se
// descartó el neteo global (rompe trazabilidad de qué división quedó
// saldada por qué pago). El modo Completa cancela ciclos por separado,
// sin modificar este algoritmo.
function construirTransferencias(
  miembros: UsuarioMini[],
  poolBilateral: Map<string, DivisionASaldar[]>
): TransferenciaSugerida[] {
  const porId = new Map(miembros.map(m => [m.id, m]))
  const transferencias: TransferenciaSugerida[] = []

  for (const [key, divisiones] of poolBilateral) {
    if (divisiones.length === 0) continue
    const [deId, aId] = key.split('|')
    const de = porId.get(deId)
    const a = porId.get(aId)
    if (!de || !a) continue // persona ya no está en el grupo — no debería pasar

    transferencias.push({
      id: key,
      de,
      a,
      divisiones,
      monto: Math.round(divisiones.reduce((s, d) => s + d.monto_asignado, 0)),
    })
  }

  return transferencias.sort((x, y) => y.monto - x.monto)
}

// ── Modo Completa: cancelación de ciclos de deuda ────────────────
//
// Partiendo de las mismas aristas bilaterales (persona X debe $monto a
// persona Y), busca ciclos dirigidos y cancela el monto mínimo del ciclo en
// cada una de sus aristas — repite hasta que no queden ciclos. Las aristas
// que sobreviven son la lista "A transferir" de Completa (se arman con el
// mismo construirTransferencias de arriba, sobre los pools ya reducidos).
//
// Trazabilidad: el "peso" de una arista es SIEMPRE la suma de las divisiones
// reales que le quedan en su pool — nunca un número llevado aparte — así que
// nunca puede haber una cancelación de $X que no esté respaldada por
// divisiones reales por ese mismo $X. Como la arista de menor peso del ciclo
// se cancela consumiendo su pool COMPLETO, esa arista siempre queda
// perfectamente en $0 (garantiza que el algoritmo progresa). Las demás
// aristas del ciclo se reducen consumiendo divisiones enteras (de más antigua
// a más nueva) hasta cubrir el monto objetivo SIN pasarse — si el monto
// objetivo no alcanza a completar una división entera más, esa arista queda
// con menos cancelado de lo que el ciclo "en teoría" le tocaba (nunca de más,
// nunca partiendo una división). Ver `EventoCancelacion.aristas[].cubierto`.

interface EventoCancelacion {
  ciclo: string[] // usuario_ids en el orden del ciclo: ciclo[i] le debe a ciclo[i+1]
  aristas: { from: string; to: string; cubierto: number; divisiones: DivisionASaldar[] }[]
}

function pesoDePool(pool: DivisionASaldar[]): number {
  return pool.reduce((s, d) => s + d.monto_asignado, 0)
}

// DFS clásico de detección de ciclos en grafo dirigido: 0 = no visitado,
// 1 = en el camino actual, 2 = cerrado. Si desde un nodo en camino se llega a
// otro nodo también en camino, ese tramo del camino es el ciclo. `ignoradas`
// son aristas que se sabe que no se pueden cancelar con divisiones enteras
// (ver más abajo) — se excluyen solo de esta búsqueda, sus divisiones reales
// no se tocan y van a seguir apareciendo en "A transferir".
function encontrarCiclo(pools: Map<string, DivisionASaldar[]>, ignoradas: Set<string>): string[] | null {
  const adj = new Map<string, string[]>()
  const nodos = new Set<string>()

  for (const [key, pool] of pools) {
    if (ignoradas.has(key)) continue
    if (pesoDePool(pool) < 0.5) continue
    const [from, to] = key.split('|')
    nodos.add(from)
    nodos.add(to)
    const lista = adj.get(from) ?? []
    lista.push(to)
    adj.set(from, lista)
  }

  const estado = new Map<string, 0 | 1 | 2>()
  const camino: string[] = []

  function dfs(n: string): string[] | null {
    estado.set(n, 1)
    camino.push(n)
    for (const vecino of adj.get(n) ?? []) {
      const e = estado.get(vecino) ?? 0
      if (e === 1) {
        const idx = camino.indexOf(vecino)
        return camino.slice(idx)
      }
      if (e === 0) {
        const r = dfs(vecino)
        if (r) return r
      }
    }
    camino.pop()
    estado.set(n, 2)
    return null
  }

  for (const n of nodos) {
    if ((estado.get(n) ?? 0) === 0) {
      const r = dfs(n)
      if (r) return r
    }
  }
  return null
}

// Sumas acumuladas alcanzables consumiendo divisiones ENTERAS de más antigua
// a más nueva — [0, d0, d0+d1, d0+d1+d2, ...]. El monto que se cancela en una
// arista tiene que ser uno de estos valores, nunca uno intermedio (eso
// implicaría partir una división).
function sumasAlcanzables(pool: DivisionASaldar[]): number[] {
  let acc = 0
  const sumas = [0]
  for (const d of pool) { acc += d.monto_asignado; sumas.push(Math.round(acc)) }
  return sumas
}

// El monto de cancelación de un ciclo tiene que ser un valor alcanzable EN
// SIMULTÁNEO por las divisiones enteras de TODAS sus aristas — si no, aunque
// el grafo "en teoría" permita cancelar $X, no hay manera de marcar
// saldado=true un conjunto de divisiones reales que sume exactamente $X en
// cada arista sin partir ninguna. Devuelve el mayor valor común (>0), o 0 si
// no hay ninguno — en ese caso el ciclo no se cancela.
function mayorMontoComun(aristasCiclo: string[], pools: Map<string, DivisionASaldar[]>): number {
  let comunes: Set<number> = new Set(sumasAlcanzables(pools.get(aristasCiclo[0]) ?? []))
  for (const key of aristasCiclo.slice(1)) {
    const propias = new Set(sumasAlcanzables(pools.get(key) ?? []))
    comunes = new Set([...comunes].filter(v => propias.has(v)))
  }
  const valores = [...comunes].filter(v => v > 0.5)
  return valores.length > 0 ? Math.max(...valores) : 0
}

function cancelarCiclos(pools: Map<string, DivisionASaldar[]>): {
  eventos: EventoCancelacion[]
  ciclosNoCancelables: string[][] // diagnóstico — ciclos reales que no se pudieron cancelar por indivisibilidad
} {
  const eventos: EventoCancelacion[] = []
  const ciclosNoCancelables: string[][] = []
  const ignoradas = new Set<string>()

  // Tope de seguridad: cada cancelación exitosa consume al menos una
  // división entera de cada arista del ciclo (progreso real), y cada ciclo
  // no-cancelable agrega una arista a `ignoradas` (no se puede repetir) — en
  // ambos casos el estado avanza, el tope es solo un resguardo defensivo.
  for (let salvaguarda = 0; salvaguarda < 200; salvaguarda++) {
    const ciclo = encontrarCiclo(pools, ignoradas)
    if (!ciclo) break

    const aristasCiclo = ciclo.map((n, i) => `${n}|${ciclo[(i + 1) % ciclo.length]}`)
    const montoObjetivo = mayorMontoComun(aristasCiclo, pools)

    if (montoObjetivo < 0.5) {
      // Existe el ciclo en el grafo, pero ninguna combinación de divisiones
      // enteras permite cancelar un monto común en las tres aristas a la vez
      // (ver ejemplo concreto con montos $30.000/$20.000/$10.000 de a una
      // división cada uno en el resumen final). No se fuerza ningún
      // redondeo: se deja el ciclo sin cancelar y se excluye la arista más
      // chica de futuras búsquedas para no volver a toparse con él.
      ciclosNoCancelables.push(ciclo)
      const masChica = aristasCiclo.reduce((min, k) =>
        pesoDePool(pools.get(k) ?? []) < pesoDePool(pools.get(min) ?? []) ? k : min
      )
      ignoradas.add(masChica)
      continue
    }

    const aristas: EventoCancelacion['aristas'] = []
    for (const key of aristasCiclo) {
      const pool = pools.get(key) ?? []
      const usadas: DivisionASaldar[] = []
      let cubierto = 0
      while (pool.length > 0 && cubierto < montoObjetivo - 0.5) {
        const d = pool.shift()!
        usadas.push(d)
        cubierto += d.monto_asignado
      }
      const [from, to] = key.split('|')
      aristas.push({ from, to, cubierto: Math.round(cubierto), divisiones: usadas })
    }

    eventos.push({ ciclo, aristas })
  }

  return { eventos, ciclosNoCancelables }
}

function construirCadenas(eventos: EventoCancelacion[], miembros: UsuarioMini[]): CadenaCancelada[] {
  const porId = new Map(miembros.map(m => [m.id, m]))
  const cadenas: CadenaCancelada[] = []

  eventos.forEach((evento, idx) => {
    const participantes = evento.ciclo.map(id => porId.get(id)).filter((u): u is UsuarioMini => !!u)
    if (participantes.length !== evento.ciclo.length) return // alguien ya no está en el grupo — no debería pasar

    const aristas: AristaCadena[] = []
    for (const a of evento.aristas) {
      if (a.divisiones.length === 0) continue // sin divisiones reales que la respalden — no se registra esta arista
      const de = porId.get(a.from)
      const aUsr = porId.get(a.to)
      if (!de || !aUsr) continue
      aristas.push({ de, a: aUsr, monto: a.cubierto, divisiones: a.divisiones })
    }

    if (aristas.length === 0) return // el ciclo no dejó ninguna arista respaldada — no hay nada que mostrar ni guardar

    const montoTotalCancelado = Math.round(aristas.reduce((s, a) => s + a.monto, 0))
    const montosIguales = aristas.every(a => Math.abs(a.monto - aristas[0].monto) < 1)

    cadenas.push({
      id: `cadena-${idx}-${evento.ciclo.join('-')}`,
      participantes,
      aristas,
      montoTotalCancelado,
      montosIguales,
    })
  })

  return cadenas
}

// ── Persistencia de cadenas canceladas ───────────────────────────
//
// Un pago por cada arista de cada cadena (metodo='cancelacion_cadena',
// gasto_id=null porque abarca varias divisiones), vinculado a las divisiones
// que efectivamente se marcaron saldado=true. Idempotente por construcción:
// solo se le pasan cadenas recién calculadas sobre divisiones saldado=false,
// así que una vez escritas no vuelven a detectarse en una pasada posterior.
export async function confirmarCancelacionesCadena(
  grupoId: string,
  cadenas: CadenaCancelada[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  const fecha = new Date().toISOString().slice(0, 10)

  for (const cadena of cadenas) {
    for (const arista of cadena.aristas) {
      if (arista.divisiones.length === 0) continue

      const { data: pago, error: pagoError } = await supabase
        .from('pagos')
        .insert({
          de_usuario_id: arista.de.id,
          a_usuario_id:  arista.a.id,
          monto:         Math.round(arista.divisiones.reduce((s, d) => s + d.monto_asignado, 0)),
          metodo:        'cancelacion_cadena',
          fecha,
          gasto_id:      null,
          mes_cierre:    null,
          grupo_id:      grupoId,
        })
        .select('id')
        .single()

      if (pagoError || !pago) {
        return { ok: false, error: 'No se pudo registrar una de las cancelaciones de cadena.' }
      }

      const filasPagoDivisiones = arista.divisiones.map(d => ({ pago_id: pago.id, division_id: d.division_id }))
      const { error: pdError } = await supabase.from('pago_divisiones').insert(filasPagoDivisiones)
      if (pdError) {
        await supabase.from('pagos').delete().eq('id', pago.id)
        return { ok: false, error: 'No se pudo vincular una cancelación de cadena con sus divisiones.' }
      }

      const { error: updError } = await supabase
        .from('divisiones')
        .update({ saldado: true, saldado_en: new Date().toISOString() })
        .in('id', arista.divisiones.map(d => d.division_id))

      if (updError) {
        return { ok: false, error: 'Una cancelación de cadena se registró, pero no pudimos marcar todo como saldado. Refrescá para revisar.' }
      }
    }
  }

  return { ok: true }
}

// ── Cerrar: crear el registro de cierres_mensuales una vez que ya no
// queda ninguna división pendiente en el grupo ──────────────────

export function mesActualStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function formatearMesLabel(mes: string): string {
  const [year, month] = mes.split('-').map(Number)
  return new Date(year, month - 1, 1)
    .toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })
    .replace(/^\w/, c => c.toUpperCase())
}

export async function registrarCierreCompleto(
  grupoId: string,
  totalGastado: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase
    .from('cierres_mensuales')
    .insert({ grupo_id: grupoId, mes: mesActualStr(), total_gastado: totalGastado })

  if (error) return { ok: false, error: 'No se pudo registrar el cierre. Los pagos ya quedaron guardados.' }
  return { ok: true }
}
