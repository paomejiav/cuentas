export const formatCLP = (amount: number): string =>
  '$' + Math.round(amount).toLocaleString('es-CL')

/** Monto con signo explícito y menos tipográfico — "+$72.200" / "−$18.400" / "$0" */
export function formatCLPConSigno(amount: number): string {
  const redondeado = Math.round(amount)
  if (redondeado === 0) return '$0'
  return (redondeado > 0 ? '+' : '−') + formatCLP(Math.abs(redondeado))
}

/** Primera letra en mayúscula — "octubre" → "Octubre" */
export const capitalizar = (s: string): string => s.replace(/^\p{L}/u, c => c.toUpperCase())

export function formatearTiempoRelativo(fechaISO: string): string {
  const diffMs = Math.max(0, Date.now() - new Date(fechaISO).getTime())
  const min = Math.floor(diffMs / 60000)
  if (min < 1) return 'hace instantes'
  if (min < 60) return `hace ${min} min`
  const horas = Math.floor(min / 60)
  if (horas < 24) return `hace ${horas} h`
  const dias = Math.floor(horas / 24)
  return `hace ${dias} d`
}

/** Nombre del mes en español, minúsculas — "Se sumó en marzo" / "Salió en agosto" */
export const mesEnMinusculas = (fechaISO: string): string =>
  new Date(fechaISO).toLocaleDateString('es-CL', { month: 'long' })
