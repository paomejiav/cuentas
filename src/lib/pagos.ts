import { supabase } from '@/lib/supabase'
import type { MetodoPago } from '@/types/database'

// ── Liquidación directa: marcar divisiones puntuales como saldadas ──
// (fuera del cierre mensual — ver RegistrarPago.tsx modo "directo")

export interface DivisionASaldar {
  division_id: string
  gasto_id: string
  descripcion: string
  fecha: string // 'YYYY-MM-DD'
  monto_asignado: number
  grupo_id: string | null
}

/**
 * Tus divisiones sin saldar donde `contraparteId` es quien pagó el gasto —
 * acotado a una cuenta puntual (cuentaId) o a todo un grupo (grupoId).
 */
export async function listarDivisionesPendientesConPersona(opts: {
  usuarioId: string
  contraparteId: string
  grupoId?: string
  cuentaId?: string
}): Promise<DivisionASaldar[]> {
  let query = supabase
    .from('divisiones')
    .select('id, monto_asignado, gastos!inner ( id, descripcion, fecha, pagado_por, grupo_id, cuenta_id )')
    .eq('usuario_id', opts.usuarioId)
    .eq('saldado', false)
    .eq('gastos.pagado_por', opts.contraparteId)

  if (opts.cuentaId) {
    query = query.eq('gastos.cuenta_id', opts.cuentaId)
  } else if (opts.grupoId) {
    query = query.eq('gastos.grupo_id', opts.grupoId)
  }

  const { data } = await query

  type Fila = {
    id: string
    monto_asignado: number
    gastos: { id: string; descripcion: string; fecha: string; grupo_id: string | null } | null
  }

  return ((data ?? []) as unknown as Fila[])
    .filter((f): f is Fila & { gastos: NonNullable<Fila['gastos']> } => !!f.gastos)
    .map(f => ({
      division_id: f.id,
      gasto_id: f.gastos.id,
      descripcion: f.gastos.descripcion,
      fecha: f.gastos.fecha,
      monto_asignado: f.monto_asignado,
      grupo_id: f.gastos.grupo_id,
    }))
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
}

/**
 * Registra un pago directo (fuera del cierre mensual) que salda una o varias
 * divisiones puntuales hacia la misma persona. Inserta en `pagos`, vincula
 * cada división en `pago_divisiones`, y marca esas divisiones saldado=true.
 *
 * grupo_id del pago: el grupo de las divisiones, solo si todas comparten el
 * mismo grupo — si no (caso hoy no alcanzable desde la UI, ver resumen),
 * queda null (igual que un pago de gasto aislado).
 */
export async function registrarPagoDirecto(opts: {
  miId: string
  contraparteId: string
  divisiones: DivisionASaldar[]
  metodo: MetodoPago
  fecha: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (opts.divisiones.length === 0) {
    return { ok: false, error: 'No hay nada seleccionado para saldar.' }
  }

  const monto = opts.divisiones.reduce((s, d) => s + d.monto_asignado, 0)
  const gastoIdUnico = opts.divisiones.length === 1 ? opts.divisiones[0].gasto_id : null
  const gruposUnicos = new Set(opts.divisiones.map(d => d.grupo_id))
  const grupoId = gruposUnicos.size === 1 ? [...gruposUnicos][0] : null

  const { data: pago, error: pagoError } = await supabase
    .from('pagos')
    .insert({
      de_usuario_id: opts.miId,
      a_usuario_id: opts.contraparteId,
      monto,
      metodo: opts.metodo,
      fecha: opts.fecha,
      gasto_id: gastoIdUnico,
      mes_cierre: null,
      grupo_id: grupoId,
    })
    .select('id')
    .single()

  if (pagoError || !pago) {
    return { ok: false, error: 'No se pudo registrar el pago. Intentá de nuevo.' }
  }

  const filasPagoDivisiones = opts.divisiones.map(d => ({ pago_id: pago.id, division_id: d.division_id }))
  const { error: pdError } = await supabase.from('pago_divisiones').insert(filasPagoDivisiones)

  if (pdError) {
    await supabase.from('pagos').delete().eq('id', pago.id)
    return { ok: false, error: 'No se pudo vincular el pago con los gastos. Intentá de nuevo.' }
  }

  const { error: updError } = await supabase
    .from('divisiones')
    .update({ saldado: true, saldado_en: new Date().toISOString() })
    .in('id', opts.divisiones.map(d => d.division_id))

  if (updError) {
    return { ok: false, error: 'El pago se registró, pero no pudimos marcar todo como saldado. Refrescá para revisar.' }
  }

  return { ok: true }
}
