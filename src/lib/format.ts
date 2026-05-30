export const formatCLP = (amount: number): string =>
  '$' + Math.round(amount).toLocaleString('es-CL')
