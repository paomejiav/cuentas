import { supabase } from '@/lib/supabase'
import type {
  CuentaCompartida, CuentaCompartidaItem, CuentaCompartidaConsumo, Integrante,
  EstadoCuentaCompartida,
} from '@/types/database'

const BUCKET_BOLETAS = 'boletas-cuentas-compartidas'

export interface DatosCuentaCompartida {
  grupo_id: string
  nombre: string
  fecha: string // 'YYYY-MM-DD'
  pagado_por: string
  participantes: string[] // ids de integrantes
  creado_por: string
  foto: File | null
}

export interface ErrorValidacion {
  campo: string
  mensaje: string
}

// ── Validación ───────────────────────────────────────────────

export function validarCuentaCompartida(
  datos: Pick<DatosCuentaCompartida, 'nombre' | 'participantes' | 'pagado_por'>
): ErrorValidacion[] {
  const errores: ErrorValidacion[] = []

  if (!datos.nombre.trim()) {
    errores.push({ campo: 'nombre', mensaje: 'Ponle un nombre a la cuenta compartida.' })
  }
  if (datos.participantes.length < 2) {
    errores.push({ campo: 'participantes', mensaje: 'Seleccioná al menos 2 participantes.' })
  }
  if (!datos.pagado_por) {
    errores.push({ campo: 'pagado_por', mensaje: 'Indicá quién pagó la cuenta.' })
  } else if (!datos.participantes.includes(datos.pagado_por)) {
    errores.push({ campo: 'pagado_por', mensaje: 'El pagador debe ser uno de los participantes.' })
  }

  return errores
}

// ── Subir foto de boleta ────────────────────────────────────

export async function subirFotoBoleta(
  grupoId: string,
  archivo: File
): Promise<{ url: string; error: null } | { url: null; error: string }> {
  const extension = archivo.name.split('.').pop() ?? 'jpg'
  const path = `${grupoId}/${crypto.randomUUID()}.${extension}`

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_BOLETAS)
    .upload(path, archivo, { upsert: false })

  if (uploadError) {
    return { url: null, error: 'No se pudo subir la foto. Intentá de nuevo.' }
  }

  const { data } = supabase.storage.from(BUCKET_BOLETAS).getPublicUrl(path)
  return { url: data.publicUrl, error: null }
}

// ── Crear cuenta compartida ──────────────────────────────────

export async function crearCuentaCompartida(
  datos: DatosCuentaCompartida
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  let fotoBoletaUrl: string | null = null

  if (datos.foto) {
    const subida = await subirFotoBoleta(datos.grupo_id, datos.foto)
    if (subida.error) return { ok: false, error: subida.error }
    fotoBoletaUrl = subida.url
  }

  const { data: cuenta, error: cuentaError } = await supabase
    .from('cuentas_compartidas')
    .insert({
      grupo_id:        datos.grupo_id,
      nombre:          datos.nombre.trim(),
      fecha:           datos.fecha,
      pagado_por:      datos.pagado_por,
      estado:          'abierta',
      foto_boleta_url: fotoBoletaUrl,
      creado_por:      datos.creado_por,
    })
    .select('id')
    .single()

  if (cuentaError || !cuenta) {
    return { ok: false, error: 'No se pudo crear la cuenta compartida. Revisá tu conexión.' }
  }

  const participantesRows = datos.participantes.map(id => ({
    cuenta_compartida_id: cuenta.id,
    integrante_id:        id,
    es_exento:             false,
  }))

  const { error: participantesError } = await supabase
    .from('cuentas_compartidas_participantes')
    .insert(participantesRows)

  if (participantesError) {
    // Rollback manual: borrar la cuenta si no se pudieron guardar los participantes
    await supabase.from('cuentas_compartidas').delete().eq('id', cuenta.id)
    return { ok: false, error: 'No se pudieron guardar los participantes. Intentá de nuevo.' }
  }

  return { ok: true, id: cuenta.id }
}

// ── Obtener cuenta compartida ────────────────────────────────

export async function obtenerCuentaCompartida(id: string): Promise<CuentaCompartida | null> {
  const { data } = await supabase
    .from('cuentas_compartidas')
    .select('*')
    .eq('id', id)
    .single()

  return (data as CuentaCompartida) ?? null
}

// ── Items ────────────────────────────────────────────────────

export interface DatosItem {
  descripcion: string
  precio_unitario: number
  cantidad: number
}

export function validarItem(datos: DatosItem): ErrorValidacion[] {
  const errores: ErrorValidacion[] = []

  if (!datos.descripcion.trim()) {
    errores.push({ campo: 'descripcion', mensaje: 'Ponle una descripción al item.' })
  }
  if (!datos.precio_unitario || datos.precio_unitario <= 0) {
    errores.push({ campo: 'precio_unitario', mensaje: 'El precio unitario debe ser mayor a $0.' })
  }
  if (!datos.cantidad || datos.cantidad <= 0) {
    errores.push({ campo: 'cantidad', mensaje: 'La cantidad debe ser mayor a 0.' })
  }

  return errores
}

export function calcularTotalItem(precioUnitario: number, cantidad: number): number {
  return Math.round(precioUnitario * cantidad * 100) / 100
}

export async function listarItems(cuentaCompartidaId: string): Promise<CuentaCompartidaItem[]> {
  const { data } = await supabase
    .from('cuentas_compartidas_items')
    .select('*')
    .eq('cuenta_compartida_id', cuentaCompartidaId)
    .order('creado_en')

  return (data as CuentaCompartidaItem[]) ?? []
}

export async function crearItem(
  cuentaCompartidaId: string,
  datos: DatosItem
): Promise<{ ok: true; item: CuentaCompartidaItem } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from('cuentas_compartidas_items')
    .insert({
      cuenta_compartida_id: cuentaCompartidaId,
      descripcion:          datos.descripcion.trim(),
      precio_unitario:      datos.precio_unitario,
      cantidad:              datos.cantidad,
      total:                 calcularTotalItem(datos.precio_unitario, datos.cantidad),
    })
    .select('*')
    .single()

  if (error || !data) {
    return { ok: false, error: 'No se pudo guardar el item. Intentá de nuevo.' }
  }

  return { ok: true, item: data as CuentaCompartidaItem }
}

export async function editarItem(
  itemId: string,
  datos: DatosItem
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase
    .from('cuentas_compartidas_items')
    .update({
      descripcion:      datos.descripcion.trim(),
      precio_unitario:  datos.precio_unitario,
      cantidad:          datos.cantidad,
      total:             calcularTotalItem(datos.precio_unitario, datos.cantidad),
    })
    .eq('id', itemId)

  if (error) return { ok: false, error: 'No se pudo actualizar el item.' }
  return { ok: true }
}

export async function eliminarItem(itemId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.from('cuentas_compartidas_items').delete().eq('id', itemId)
  if (error) return { ok: false, error: 'No se pudo eliminar el item.' }
  return { ok: true }
}

// ── Participantes ────────────────────────────────────────────

export interface ParticipanteDetalle {
  id: string // id de cuentas_compartidas_participantes
  integrante: Integrante
  es_exento: boolean
}

export async function listarParticipantes(cuentaCompartidaId: string): Promise<ParticipanteDetalle[]> {
  const { data } = await supabase
    .from('cuentas_compartidas_participantes')
    .select('id, es_exento, integrante:integrantes(*)')
    .eq('cuenta_compartida_id', cuentaCompartidaId)

  return ((data ?? []) as unknown as { id: string; es_exento: boolean; integrante: Integrante }[])
    .map(row => ({ id: row.id, es_exento: row.es_exento, integrante: row.integrante }))
}

export async function actualizarExento(
  participanteId: string,
  esExento: boolean
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase
    .from('cuentas_compartidas_participantes')
    .update({ es_exento: esExento })
    .eq('id', participanteId)

  if (error) return { ok: false, error: 'No se pudo actualizar. Intentá de nuevo.' }
  return { ok: true }
}

// ── Consumo por persona ──────────────────────────────────────

export async function listarConsumoPorItems(itemIds: string[]): Promise<CuentaCompartidaConsumo[]> {
  if (itemIds.length === 0) return []

  const { data } = await supabase
    .from('cuentas_compartidas_consumo')
    .select('*')
    .in('item_id', itemIds)

  return (data as CuentaCompartidaConsumo[]) ?? []
}

export function redondear2(valor: number): number {
  return Math.round(valor * 100) / 100
}

export async function guardarConsumo(
  itemId: string,
  integranteId: string,
  cantidadAsignada: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  const valor = redondear2(Math.max(0, cantidadAsignada))

  if (valor === 0) {
    const { error } = await supabase
      .from('cuentas_compartidas_consumo')
      .delete()
      .eq('item_id', itemId)
      .eq('integrante_id', integranteId)
    if (error) return { ok: false, error: 'No se pudo actualizar el consumo.' }
    return { ok: true }
  }

  const { error } = await supabase
    .from('cuentas_compartidas_consumo')
    .upsert(
      { item_id: itemId, integrante_id: integranteId, cantidad_asignada: valor, actualizado_en: new Date().toISOString() },
      { onConflict: 'item_id,integrante_id' }
    )

  if (error) return { ok: false, error: 'No se pudo actualizar el consumo.' }
  return { ok: true }
}

export async function dividirEquitativamente(
  itemId: string,
  cantidadTotal: number,
  integranteIds: string[]
): Promise<{ ok: true; porPersona: number } | { ok: false; error: string }> {
  if (integranteIds.length === 0) return { ok: false, error: 'No hay participantes para repartir.' }

  const porPersona = redondear2(cantidadTotal / integranteIds.length)

  const { error: delError } = await supabase
    .from('cuentas_compartidas_consumo')
    .delete()
    .eq('item_id', itemId)

  if (delError) return { ok: false, error: 'No se pudo repartir el item.' }

  if (porPersona <= 0) return { ok: true, porPersona: 0 }

  const rows = integranteIds.map(id => ({
    item_id:            itemId,
    integrante_id:      id,
    cantidad_asignada:  porPersona,
  }))

  const { error: insError } = await supabase.from('cuentas_compartidas_consumo').insert(rows)
  if (insError) return { ok: false, error: 'No se pudo repartir el item.' }

  return { ok: true, porPersona }
}

// ── Propina ──────────────────────────────────────────────────

export async function actualizarPropina(
  cuentaCompartidaId: string,
  montoPropina: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase
    .from('cuentas_compartidas')
    .update({ monto_propina: montoPropina })
    .eq('id', cuentaCompartidaId)

  if (error) return { ok: false, error: 'No se pudo guardar la propina.' }
  return { ok: true }
}

// ── Cuadre pendiente ─────────────────────────────────────────

export function hayItemsSinAsignar(
  items: CuentaCompartidaItem[],
  consumo: CuentaCompartidaConsumo[]
): boolean {
  const asignadoPorItem = new Map<string, number>()
  consumo.forEach(c => {
    asignadoPorItem.set(c.item_id, (asignadoPorItem.get(c.item_id) ?? 0) + c.cantidad_asignada)
  })
  return items.some(item => Math.abs(item.cantidad - (asignadoPorItem.get(item.id) ?? 0)) > 0.01)
}

// ── Resumen final ────────────────────────────────────────────

export interface ResumenPersona {
  integrante: Integrante
  es_exento: boolean
  consumo_bruto: number
  extra_por_exentos: number
  consumo_final: number
  propina: number
  total_final: number
}

export interface ResumenFinal {
  personas: ResumenPersona[]
  nombresExentos: string[]
  totalExento: number
  subtotalItems: number
  montoPropina: number
  totalGeneral: number       // subtotalItems + montoPropina
  sumaTotalesFinales: number // suma de total_final de todas las personas
}

/**
 * Función pura: dado el estado cargado de items, consumo y participantes,
 * calcula el desglose final por persona (consumo + reparto de exentos + propina).
 */
export function calcularResumenFinal(
  items: CuentaCompartidaItem[],
  consumo: CuentaCompartidaConsumo[],
  participantes: ParticipanteDetalle[],
  montoPropina: number
): ResumenFinal {
  const precioPorItem = new Map(items.map(i => [i.id, i.precio_unitario]))

  const consumoBrutoPorPersona = new Map<string, number>()
  consumo.forEach(c => {
    const precio = precioPorItem.get(c.item_id)
    if (precio === undefined) return
    const acumulado = consumoBrutoPorPersona.get(c.integrante_id) ?? 0
    consumoBrutoPorPersona.set(c.integrante_id, acumulado + c.cantidad_asignada * precio)
  })

  const exentos = participantes.filter(p => p.es_exento)
  const noExentos = participantes.filter(p => !p.es_exento)

  const totalExento = exentos.reduce((s, p) => s + (consumoBrutoPorPersona.get(p.integrante.id) ?? 0), 0)
  const extraPorPersona = noExentos.length > 0 ? totalExento / noExentos.length : 0

  const consumoFinalPorPersona = new Map<string, number>()
  participantes.forEach(p => {
    const bruto = consumoBrutoPorPersona.get(p.integrante.id) ?? 0
    consumoFinalPorPersona.set(p.integrante.id, p.es_exento ? 0 : bruto + extraPorPersona)
  })

  const sumaConsumoFinalNoExentos = noExentos.reduce(
    (s, p) => s + (consumoFinalPorPersona.get(p.integrante.id) ?? 0), 0
  )

  const personas: ResumenPersona[] = participantes.map(p => {
    const consumoBruto = consumoBrutoPorPersona.get(p.integrante.id) ?? 0
    const consumoFinal = consumoFinalPorPersona.get(p.integrante.id) ?? 0
    const propina = (!p.es_exento && montoPropina > 0 && sumaConsumoFinalNoExentos > 0)
      ? montoPropina * (consumoFinal / sumaConsumoFinalNoExentos)
      : 0

    return {
      integrante:         p.integrante,
      es_exento:          p.es_exento,
      consumo_bruto:      consumoBruto,
      extra_por_exentos:  p.es_exento ? 0 : extraPorPersona,
      consumo_final:      consumoFinal,
      propina,
      total_final:        consumoFinal + propina,
    }
  })

  const subtotalItems = items.reduce((s, i) => s + i.total, 0)
  const sumaTotalesFinales = personas.reduce((s, p) => s + p.total_final, 0)

  return {
    personas,
    nombresExentos:     exentos.map(p => p.integrante.nombre),
    totalExento,
    subtotalItems,
    montoPropina,
    totalGeneral:        subtotalItems + montoPropina,
    sumaTotalesFinales,
  }
}

// ── Cerrar cuenta y generar deudas ──────────────────────────
//
// Reusa el mismo mecanismo que un gasto grupal normal (tablas `gastos` y
// `divisiones`, ver src/lib/gastos.ts) para que las deudas generadas acá
// alimenten los saldos y el cierre mensual igual que cualquier otro gasto.

export function personasQueGeneranDeuda(resumen: ResumenFinal, pagadoPor: string) {
  return resumen.personas.filter(p => !p.es_exento && p.integrante.id !== pagadoPor)
}

export async function cerrarCuentaCompartida(
  cuenta: CuentaCompartida,
  resumen: ResumenFinal,
  creadoPor: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const deudores = personasQueGeneranDeuda(resumen, cuenta.pagado_por)

  if (deudores.length === 0) {
    return { ok: false, error: 'No hay deudas que generar: nadie más participa en esta cuenta aparte del pagador.' }
  }

  const montoTotal = Math.round(
    resumen.personas.filter(p => !p.es_exento).reduce((s, p) => s + p.total_final, 0)
  )

  const { data: gasto, error: gastoError } = await supabase
    .from('gastos')
    .insert({
      grupo_id:    cuenta.grupo_id,
      descripcion: cuenta.nombre,
      monto_total: montoTotal,
      pagado_por:  cuenta.pagado_por,
      categoria:   'otro',
      fecha:       cuenta.fecha,
      nota:        null,
      creado_por:  creadoPor,
    })
    .select('id')
    .single()

  if (gastoError || !gasto) {
    return { ok: false, error: 'No se pudo generar el gasto. Intentá de nuevo.' }
  }

  const divisionesRows = deudores.map(p => ({
    gasto_id:        gasto.id,
    integrante_id:   p.integrante.id,
    monto_asignado:  Math.round(p.total_final),
  }))

  const { error: divError } = await supabase.from('divisiones').insert(divisionesRows)

  if (divError) {
    // Rollback manual: borrar el gasto si no se pudieron guardar las divisiones,
    // mismo criterio que crearCuentaCompartida — evita dejar un gasto huérfano.
    await supabase.from('gastos').delete().eq('id', gasto.id)
    return { ok: false, error: 'No se pudieron generar las deudas. Intentá de nuevo.' }
  }

  const { error: estadoError } = await supabase
    .from('cuentas_compartidas')
    .update({ estado: 'cerrada' })
    .eq('id', cuenta.id)

  if (estadoError) {
    return { ok: false, error: 'Las deudas se generaron, pero no se pudo marcar la cuenta como cerrada. Volvé a intentar cerrarla.' }
  }

  return { ok: true }
}

// ── Listado ──────────────────────────────────────────────────

export interface IntegranteMin {
  id: string
  nombre: string
  avatar_color: string
}

export interface CuentaCompartidaResumen {
  id: string
  nombre: string
  fecha: string
  estado: EstadoCuentaCompartida
  creado_en: string
  pagador: IntegranteMin
  subtotalItems: number
}

export async function listarCuentasCompartidas(grupoId: string): Promise<CuentaCompartidaResumen[]> {
  const { data } = await supabase
    .from('cuentas_compartidas')
    .select(`
      id, nombre, fecha, estado, creado_en,
      pagador:integrantes!cuentas_compartidas_pagado_por_fkey ( id, nombre, avatar_color ),
      cuentas_compartidas_items ( total )
    `)
    .eq('grupo_id', grupoId)
    .order('fecha', { ascending: false })
    .order('creado_en', { ascending: false })

  if (!data) return []

  return (data as unknown as {
    id: string; nombre: string; fecha: string; estado: EstadoCuentaCompartida; creado_en: string
    pagador: IntegranteMin
    cuentas_compartidas_items: { total: number }[]
  }[]).map(row => ({
    id:             row.id,
    nombre:         row.nombre,
    fecha:          row.fecha,
    estado:         row.estado,
    creado_en:      row.creado_en,
    pagador:        row.pagador,
    subtotalItems:  row.cuentas_compartidas_items.reduce((s, i) => s + Number(i.total), 0),
  }))
}
