import { supabase } from '@/lib/supabase'
import type { Integrante } from '@/types/database'

export interface SaldoPar {
  integrante: Integrante
  /** Positivo = te debe. Negativo = le debes. 0 = sin deudas. */
  neto: number
}

/**
 * Calcula el saldo neto entre `miId` y cada otro integrante activo del grupo.
 *
 * Lógica por par (yo, otro):
 *   - Gastos donde `otro` pagó y `yo` estoy en divisiones → yo debo a otro
 *   - Gastos donde `yo` pagué y `otro` está en divisiones → otro me debe a mí
 *   - neto = (otro me debe) − (yo le debo)
 *
 * Solo se consideran gastos sin mes_cierre (activos).
 * Cada par es independiente — no se simplifican deudas entre distintos pares.
 */
export async function calcularSaldos(
  grupoId: string,
  miId: string
): Promise<SaldoPar[]> {
  // 1. Traer todas las divisiones de gastos activos del grupo, con el pagador
  const { data: divisiones, error } = await supabase
    .from('divisiones')
    .select(`
      monto_asignado,
      integrante_id,
      gastos!inner (
        pagado_por,
        grupo_id,
        mes_cierre
      )
    `)
    .eq('gastos.grupo_id', grupoId)
    .is('gastos.mes_cierre', null)

  if (error || !divisiones) return []

  // 2. Traer integrantes activos del grupo (excepto yo)
  const { data: integrantes } = await supabase
    .from('integrantes')
    .select('*')
    .eq('grupo_id', grupoId)
    .eq('activo', true)
    .neq('id', miId)
    .order('nombre')

  if (!integrantes || integrantes.length === 0) return []

  // 3. Construir mapa de saldos por par
  // saldoMap[otroId] = cuánto me debe ese otro (positivo) o le debo (negativo)
  const saldoMap: Record<string, number> = {}
  for (const i of integrantes) saldoMap[i.id] = 0

  for (const div of divisiones) {
    const gasto = div.gastos as unknown as { pagado_por: string; grupo_id: string; mes_cierre: string | null }
    const pagador = gasto.pagado_por
    const participante = div.integrante_id
    const monto = Number(div.monto_asignado)

    if (pagador === miId && participante !== miId) {
      // Yo pagué, otro participó → otro me debe
      if (participante in saldoMap) {
        saldoMap[participante] += monto
      }
    } else if (pagador !== miId && participante === miId) {
      // Otro pagó, yo participé → yo le debo al pagador
      if (pagador in saldoMap) {
        saldoMap[pagador] -= monto
      }
    }
  }

  // 4. Armar resultado ordenado: deudas primero, luego créditos, luego al día
  return integrantes
    .map(integrante => ({
      integrante,
      neto: Math.round(saldoMap[integrante.id] ?? 0),
    }))
    .sort((a, b) => {
      // Orden: quien me debe más primero, luego quien le debo más, luego cero
      if (a.neto === 0 && b.neto !== 0) return 1
      if (b.neto === 0 && a.neto !== 0) return -1
      return b.neto - a.neto
    })
}
