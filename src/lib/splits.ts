import type { Member, SplitType, ExpenseSplit } from '@/types'

interface SplitInput {
  member_id: string
  value: number  // monto exacto, porcentaje, o ignorado (equal)
}

/**
 * Dado un monto total y el tipo de división,
 * devuelve los splits con el monto final en CLP por persona.
 * El residuo de redondeo se asigna a la primera persona.
 */
export function computeSplits(
  expenseId: string,
  amount: number,
  splitType: SplitType,
  members: Member[],
  inputs: SplitInput[]
): Omit<ExpenseSplit, 'id' | 'created_at'>[] {
  const activeMembers = members.filter(m => m.is_active)

  if (splitType === 'equal') {
    const base     = Math.floor(amount / activeMembers.length)
    const remainder = Math.round(amount) - base * activeMembers.length

    return activeMembers.map((m, i) => ({
      expense_id: expenseId,
      member_id:  m.id,
      amount:     i === 0 ? base + remainder : base,
      percentage: null,
    }))
  }

  if (splitType === 'exact') {
    return inputs.map(input => ({
      expense_id: expenseId,
      member_id:  input.member_id,
      amount:     Math.round(input.value),
      percentage: null,
    }))
  }

  // percentage
  const splits = inputs.map(input => ({
    expense_id: expenseId,
    member_id:  input.member_id,
    amount:     Math.floor(amount * input.value / 100),
    percentage: input.value,
  }))

  // Asignar residuo a la primera persona
  const distributed = splits.reduce((s, x) => s + x.amount, 0)
  const residue      = Math.round(amount) - distributed
  if (splits.length > 0) splits[0].amount += residue

  return splits
}

/** Valida que los splits sean consistentes con el monto total */
export function validateSplits(
  amount: number,
  splitType: SplitType,
  inputs: SplitInput[]
): string | null {
  if (splitType === 'exact') {
    const total = inputs.reduce((s, i) => s + i.value, 0)
    if (Math.abs(total - amount) > 1) {
      return `La suma de los montos (${Math.round(total)}) no coincide con el total (${Math.round(amount)})`
    }
  }

  if (splitType === 'percentage') {
    const total = inputs.reduce((s, i) => s + i.value, 0)
    if (Math.abs(total - 100) > 0.01) {
      return `Los porcentajes suman ${total.toFixed(1)}% — deben sumar 100%`
    }
  }

  return null
}
