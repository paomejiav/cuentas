export const formatCLP = (amount: number): string =>
  '$' + Math.round(amount).toLocaleString('es-CL')

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
