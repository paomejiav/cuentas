import { supabase } from '@/lib/supabase'
import type { Categoria } from '@/types/database'

export type TipoDivision = 'igual' | 'exacto' | 'porcentaje'

export interface DivisionInput {
  integrante_id: string
  valor: number // monto exacto, porcentaje, o ignorado si es igual
}

export interface DatosGasto {
  grupo_id: string
  descripcion: string
  monto_total: number
  pagado_por: string
  categoria: Categoria
  fecha: string // 'YYYY-MM-DD'
  nota: string
  creado_por: string
  tipo_division: TipoDivision
  participantes: string[] // ids de integrantes que participan
  divisiones: DivisionInput[] // valores según tipo_division
}

export interface ErrorValidacion {
  campo: string
  mensaje: string
}

// ── Validaciones ─────────────────────────────────────────────

export function validarPaso1(datos: Pick<DatosGasto, 'descripcion' | 'monto_total' | 'pagado_por'>): ErrorValidacion[] {
  const errores: ErrorValidacion[] = []
  if (!datos.descripcion.trim()) errores.push({ campo: 'descripcion', mensaje: 'La descripción es obligatoria.' })
  if (!datos.monto_total || datos.monto_total <= 0) errores.push({ campo: 'monto', mensaje: 'Ingresá un monto mayor a $0.' })
  if (!datos.pagado_por) errores.push({ campo: 'pagado_por', mensaje: 'Indicá quién pagó.' })
  return errores
}

export function validarPaso2(
  monto: number,
  tipo: TipoDivision,
  participantes: string[],
  divisiones: DivisionInput[]
): ErrorValidacion[] {
  const errores: ErrorValidacion[] = []

  if (participantes.length === 0) {
    errores.push({ campo: 'participantes', mensaje: 'Seleccioná al menos una participante.' })
    return errores
  }

  if (tipo === 'exacto') {
    const suma = divisiones.reduce((s, d) => s + (d.valor || 0), 0)
    const diff = Math.abs(suma - monto)
    if (diff > 1) {
      errores.push({
        campo: 'divisiones',
        mensaje: `Los montos suman ${formatCLPInterno(suma)}, pero el total es ${formatCLPInterno(monto)}.`,
      })
    }
  }

  if (tipo === 'porcentaje') {
    const suma = divisiones.reduce((s, d) => s + (d.valor || 0), 0)
    if (Math.abs(suma - 100) > 0.1) {
      errores.push({
        campo: 'divisiones',
        mensaje: `Los porcentajes suman ${suma.toFixed(1)}% — deben sumar 100%.`,
      })
    }
  }

  return errores
}

// ── Cálculo de divisiones ────────────────────────────────────

export function calcularMontosPorPersona(
  monto: number,
  tipo: TipoDivision,
  participantes: string[],
  divisiones: DivisionInput[]
): Record<string, number> {
  const montos: Record<string, number> = {}

  if (tipo === 'igual') {
    const base = Math.floor(monto / participantes.length)
    const residuo = Math.round(monto) - base * participantes.length
    participantes.forEach((id, i) => {
      montos[id] = i === 0 ? base + residuo : base
    })
  } else if (tipo === 'exacto') {
    divisiones.forEach(d => { montos[d.integrante_id] = Math.round(d.valor || 0) })
  } else {
    // porcentaje
    let distribuido = 0
    divisiones.forEach((d, i) => {
      const m = i < divisiones.length - 1
        ? Math.floor(monto * (d.valor || 0) / 100)
        : Math.round(monto) - distribuido
      montos[d.integrante_id] = m
      distribuido += m
    })
  }

  return montos
}

// ── Guardar gasto ────────────────────────────────────────────

export async function crearGasto(datos: DatosGasto): Promise<{ ok: true } | { ok: false; error: string }> {
  const montosPorPersona = calcularMontosPorPersona(
    datos.monto_total,
    datos.tipo_division,
    datos.participantes,
    datos.divisiones
  )

  // Insertar gasto
  const { data: gasto, error: gastoError } = await supabase
    .from('gastos')
    .insert({
      grupo_id:    datos.grupo_id,
      descripcion: datos.descripcion.trim(),
      monto_total: datos.monto_total,
      pagado_por:  datos.pagado_por,
      categoria:   datos.categoria,
      fecha:       datos.fecha,
      nota:        datos.nota.trim() || null,
      creado_por:  datos.creado_por,
    })
    .select('id')
    .single()

  if (gastoError || !gasto) {
    return { ok: false, error: 'No se pudo guardar el gasto. Revisá tu conexión.' }
  }

  // Insertar divisiones
  const divisionesRows = datos.participantes.map(id => ({
    gasto_id:        gasto.id,
    integrante_id:   id,
    monto_asignado:  montosPorPersona[id] ?? 0,
  }))

  const { error: divError } = await supabase
    .from('divisiones')
    .insert(divisionesRows)

  if (divError) {
    // Rollback manual: borrar el gasto si no se pudieron guardar las divisiones
    await supabase.from('gastos').delete().eq('id', gasto.id)
    return { ok: false, error: 'No se pudieron guardar las divisiones. Intentá de nuevo.' }
  }

  return { ok: true }
}

// ── Editar gasto ─────────────────────────────────────────────

export interface DatosEdicion {
  descripcion?: string
  monto_total?: number
  pagado_por?: string
  categoria?: Categoria
  fecha?: string
  nota?: string
  // Si se proveen, reemplaza todas las divisiones
  tipo_division?: TipoDivision
  participantes?: string[]
  divisiones?: DivisionInput[]
}

export async function editarGasto(
  gastoId: string,
  datos: DatosEdicion
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Actualizar campos del gasto
  const campos: Record<string, unknown> = {}
  if (datos.descripcion !== undefined) campos.descripcion = datos.descripcion.trim()
  if (datos.monto_total  !== undefined) campos.monto_total  = datos.monto_total
  if (datos.pagado_por   !== undefined) campos.pagado_por   = datos.pagado_por
  if (datos.categoria    !== undefined) campos.categoria    = datos.categoria
  if (datos.fecha        !== undefined) campos.fecha        = datos.fecha
  if (datos.nota         !== undefined) campos.nota         = datos.nota.trim() || null

  if (Object.keys(campos).length > 0) {
    const { error } = await supabase.from('gastos').update(campos).eq('id', gastoId)
    if (error) return { ok: false, error: 'No se pudo actualizar el gasto.' }
  }

  // Reemplazar divisiones si se enviaron
  if (datos.participantes && datos.divisiones && datos.tipo_division && datos.monto_total) {
    const montosPorPersona = calcularMontosPorPersona(
      datos.monto_total,
      datos.tipo_division,
      datos.participantes,
      datos.divisiones
    )

    await supabase.from('divisiones').delete().eq('gasto_id', gastoId)

    const rows = datos.participantes.map(id => ({
      gasto_id:       gastoId,
      integrante_id:  id,
      monto_asignado: montosPorPersona[id] ?? 0,
    }))

    const { error: divError } = await supabase.from('divisiones').insert(rows)
    if (divError) return { ok: false, error: 'No se pudieron actualizar las divisiones.' }
  }

  return { ok: true }
}

// ── Eliminar gasto ───────────────────────────────────────────

export async function eliminarGasto(
  gastoId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Las divisiones se borran en cascada (on delete cascade en el schema)
  const { error } = await supabase.from('gastos').delete().eq('id', gastoId)
  if (error) return { ok: false, error: 'No se pudo eliminar el gasto.' }
  return { ok: true }
}

// ── Formato interno ──────────────────────────────────────────

function formatCLPInterno(n: number) {
  return '$' + Math.round(n).toLocaleString('es-CL')
}
