// ============================================================
// Tipos base — espejo del schema de Supabase
// ============================================================

export type SplitType = 'equal' | 'exact' | 'percentage'
export type ExpenseCategory =
  | 'comida' | 'transporte' | 'regalo' | 'cumpleanos'
  | 'tragos' | 'entretenimiento' | 'otro'
export type SettlementStatus = 'open' | 'closed'
export type SettlementMode = 'individual' | 'optimized'
export type PaymentMethod = 'transferencia' | 'efectivo' | 'mercadopago' | 'otro'

export interface Member {
  id: string
  name: string
  avatar_color: string
  is_active: boolean
  created_at: string
}

export interface Expense {
  id: string
  title: string
  amount: number
  category: ExpenseCategory
  paid_by: string
  split_type: SplitType
  date: string
  notes: string | null
  settlement_id: string | null
  created_at: string
}

export interface ExpenseSplit {
  id: string
  expense_id: string
  member_id: string
  amount: number
  percentage: number | null
  created_at: string
}

export interface Settlement {
  id: string
  period_label: string
  status: SettlementStatus
  mode: SettlementMode
  balance_snapshot: BalanceSnapshot | null
  opened_at: string
  closed_at: string | null
}

export interface Payment {
  id: string
  settlement_id: string
  from_member_id: string
  to_member_id: string
  amount: number
  method: PaymentMethod
  notes: string | null
  confirmed_at: string | null
  created_at: string
}

// ============================================================
// Tipos enriquecidos (con joins)
// ============================================================

export interface ExpenseWithSplits extends Expense {
  payer: Member
  splits: (ExpenseSplit & { member: Member })[]
}

export interface PaymentWithMembers extends Payment {
  from: Member
  to: Member
}

// ============================================================
// Lógica de balances
// ============================================================

/** Positivo = le deben. Negativo = debe. */
export type MemberBalance = {
  member: Member
  net: number
  paid: number
  owes: number
}

export type BalanceMap = Record<string, MemberBalance>

export type BalanceSnapshot = {
  computed_at: string
  balances: MemberBalance[]
  total_expenses: number
}

export type Transfer = {
  from: Member
  to: Member
  amount: number
}

// ============================================================
// Formulario de nuevo gasto
// ============================================================

export interface NewExpenseForm {
  title: string
  amount: number
  category: ExpenseCategory
  paid_by: string
  split_type: SplitType
  date: string
  notes: string
  splits: { member_id: string; value: number }[]
}

// ============================================================
// Constantes de UI
// ============================================================

export const CATEGORY_EMOJI: Record<ExpenseCategory, string> = {
  comida:          '🍕',
  transporte:      '🚌',
  regalo:          '🎁',
  cumpleanos:      '🎂',
  tragos:          '🍻',
  entretenimiento: '🎬',
  otro:            '📦',
}

export const CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  comida:          'Comida y salidas',
  transporte:      'Transporte',
  regalo:          'Regalo',
  cumpleanos:      'Cumpleaños',
  tragos:          'Tragos / bar',
  entretenimiento: 'Entretenimiento',
  otro:            'Otro',
}

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  transferencia: 'Transferencia',
  efectivo:      'Efectivo',
  mercadopago:   'MercadoPago',
  otro:          'Otro',
}

export const AVATAR_COLORS = [
  '#F4A79D', '#A8D8B9', '#A8C8E8', '#D4A8D8',
  '#F4D4A0', '#A8D4D4', '#D4C4A8', '#C4D4A8',
]
