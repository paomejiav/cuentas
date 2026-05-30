import type { Member, ExpenseWithSplits, MemberBalance, BalanceMap, Transfer } from '@/types'

/**
 * Calcula los balances netos de todos los miembros activos
 * dado un conjunto de gastos (con sus splits ya cargados).
 *
 * net > 0 → le deben dinero
 * net < 0 → debe dinero
 */
export function computeBalances(
  members: Member[],
  expenses: ExpenseWithSplits[]
): BalanceMap {
  const map: BalanceMap = {}

  for (const m of members) {
    map[m.id] = { member: m, net: 0, paid: 0, owes: 0 }
  }

  for (const expense of expenses) {
    // Lo que pagó quien pagó
    if (map[expense.paid_by]) {
      map[expense.paid_by].paid += expense.amount
    }

    // Lo que le corresponde a cada una según el split
    for (const split of expense.splits) {
      if (map[split.member_id]) {
        map[split.member_id].owes += split.amount
      }
    }
  }

  for (const id in map) {
    map[id].net = map[id].paid - map[id].owes
  }

  return map
}

/**
 * Algoritmo greedy para calcular el mínimo número de transferencias
 * que saldan todos los balances del grupo.
 */
export function computeMinTransfers(balanceMap: BalanceMap): Transfer[] {
  const balances = Object.values(balanceMap)

  // Deudores (net < 0) y acreedoras (net > 0), ordenados por monto absoluto desc
  const debtors  = balances.filter(b => b.net < -0.5).map(b => ({ member: b.member, amount: -b.net })).sort((a, b) => b.amount - a.amount)
  const creditors = balances.filter(b => b.net > 0.5).map(b => ({ member: b.member, amount: b.net })).sort((a, b) => b.amount - a.amount)

  const transfers: Transfer[] = []
  let i = 0, j = 0

  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amount, creditors[j].amount)

    transfers.push({
      from:   debtors[i].member,
      to:     creditors[j].member,
      amount: Math.round(pay),
    })

    debtors[i].amount   -= pay
    creditors[j].amount -= pay

    if (debtors[i].amount   < 0.5) i++
    if (creditors[j].amount < 0.5) j++
  }

  return transfers
}

/**
 * Calcula las transferencias individuales: cada deudora le paga
 * directamente a cada acreedora en proporción a su deuda.
 * Produce más transferencias pero es más transparente.
 */
export function computeIndividualTransfers(balanceMap: BalanceMap): Transfer[] {
  const debtors   = Object.values(balanceMap).filter(b => b.net < -0.5)
  const creditors = Object.values(balanceMap).filter(b => b.net > 0.5)

  const transfers: Transfer[] = []
  const totalCredit = creditors.reduce((s, c) => s + c.net, 0)

  for (const debtor of debtors) {
    const debt = -debtor.net
    for (const creditor of creditors) {
      const share = Math.round(debt * (creditor.net / totalCredit))
      if (share > 0) {
        transfers.push({ from: debtor.member, to: creditor.member, amount: share })
      }
    }
  }

  return transfers
}
