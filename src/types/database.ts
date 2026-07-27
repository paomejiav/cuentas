// ============================================================
// Tipos TypeScript — espejo del schema de Supabase
// Generado desde supabase/migrations/002_schema_grupos.sql
// ============================================================

export type Categoria =
  | 'super' | 'comida' | 'transporte' | 'regalo' | 'cumpleanos'
  | 'tragos' | 'otro'

export type MetodoPago = 'transferencia' | 'efectivo' | 'otro'

// ============================================================
// Tablas base
// ============================================================

export interface Grupo {
  id: string
  nombre: string
  codigo_acceso: string
  creado_en: string
}

export interface Integrante {
  id: string
  grupo_id: string
  nombre: string
  avatar_color: string
  activo: boolean
  es_admin: boolean
  pin_configurado: boolean
  creado_en: string
}

export interface Gasto {
  id: string
  grupo_id: string
  descripcion: string
  monto_total: number
  pagado_por: string        // integrante_id
  categoria: Categoria
  fecha: string             // ISO date 'YYYY-MM-DD'
  nota: string | null
  creado_por: string        // integrante_id
  creado_en: string
  mes_cierre: string | null // 'YYYY-MM'
}

export interface Division {
  id: string
  gasto_id: string
  integrante_id: string
  monto_asignado: number
}

export interface Pago {
  id: string
  grupo_id: string
  de_integrante_id: string
  a_integrante_id: string
  monto: number
  fecha: string
  metodo: MetodoPago
  mes_cierre: string        // 'YYYY-MM'
  creado_en: string
}

export interface CiorreMensual {
  id: string
  grupo_id: string
  mes: string               // 'YYYY-MM'
  total_gastado: number
  cerrado_en: string
}

export type EstadoCuentaCompartida = 'abierta' | 'cerrada'

export interface CuentaCompartida {
  id: string
  grupo_id: string
  nombre: string
  fecha: string              // ISO date 'YYYY-MM-DD'
  pagado_por: string         // integrante_id
  estado: EstadoCuentaCompartida
  foto_boleta_url: string | null
  monto_propina: number | null
  creado_por: string         // integrante_id
  creado_en: string
}

export interface CuentaCompartidaParticipante {
  id: string
  cuenta_compartida_id: string
  integrante_id: string
  es_exento: boolean
}

export interface CuentaCompartidaItem {
  id: string
  cuenta_compartida_id: string
  descripcion: string
  precio_unitario: number
  cantidad: number
  total: number
  creado_en: string
}

export interface CuentaCompartidaConsumo {
  id: string
  item_id: string
  integrante_id: string
  cantidad_asignada: number
  actualizado_en: string
}

// ============================================================
// Tipos enriquecidos (con joins para queries frecuentes)
// ============================================================

export interface GastoConDetalle extends Gasto {
  pagador: Integrante
  divisiones: (Division & { integrante: Integrante })[]
}

export interface PagoConIntegrantes extends Pago {
  de: Integrante
  a: Integrante
}

export interface CuentaCompartidaConDetalle extends CuentaCompartida {
  pagador: Integrante
  participantes: (CuentaCompartidaParticipante & { integrante: Integrante })[]
}

// ============================================================
// Lógica de balances
// ============================================================

/** net > 0 = le deben · net < 0 = debe */
export interface BalanceIntegrante {
  integrante: Integrante
  net: number
  pagado: number   // suma de gastos que ella pagó
  debe: number     // suma de sus divisiones
}

export type MapaBalances = Record<string, BalanceIntegrante>

/** Transferencia para saldar deudas */
export interface Transferencia {
  de: Integrante
  a: Integrante
  monto: number
}

// ============================================================
// Formularios
// ============================================================

export interface FormGasto {
  descripcion: string
  monto_total: number
  pagado_por: string
  categoria: Categoria
  fecha: string
  nota: string
  tipo_division: 'igual' | 'exacto' | 'porcentaje'
  divisiones: { integrante_id: string; valor: number }[]
}

export interface FormPago {
  de_integrante_id: string
  a_integrante_id: string
  monto: number
  metodo: MetodoPago
  mes_cierre: string
}

export interface FormCuentaCompartida {
  nombre: string
  fecha: string
  participantes: string[]
  pagado_por: string
  foto: File | null
}

// ============================================================
// Helpers de UI
// ============================================================

export const CATEGORIA_EMOJI: Record<Categoria, string> = {
  super:           '🛒',
  comida:          '🍕',
  transporte:      '🚌',
  regalo:          '🎁',
  cumpleanos:      '🎂',
  tragos:          '🍻',
  otro:            '📦',
}

export const CATEGORIA_LABEL: Record<Categoria, string> = {
  super:           'Súper',
  comida:          'Comida y salidas',
  transporte:      'Transporte',
  regalo:          'Regalo',
  cumpleanos:      'Cumpleaños',
  tragos:          'Tragos / bar',
  otro:            'Otro',
}

export const METODO_LABEL: Record<MetodoPago, string> = {
  transferencia: 'Transferencia',
  efectivo:      'Efectivo',
  otro:          'Otro',
}

export const AVATAR_COLORS = [
  '#F4A79D', '#A8D8B9', '#A8C8E8', '#D4A8D8',
  '#F4D4A0', '#A8D4D4', '#D4C4A8', '#C4D4A8',
]

// ============================================================
// Tipo de base de datos para el cliente de Supabase tipado
// ============================================================

export interface Database {
  public: {
    Tables: {
      grupos: {
        Row:    Grupo
        Insert: Omit<Grupo, 'id' | 'creado_en'>
        Update: Partial<Omit<Grupo, 'id' | 'creado_en'>>
      }
      integrantes: {
        Row:    Integrante
        Insert: Omit<Integrante, 'id' | 'creado_en'>
        Update: Partial<Omit<Integrante, 'id' | 'creado_en'>>
      }
      gastos: {
        Row:    Gasto
        Insert: Omit<Gasto, 'id' | 'creado_en'>
        Update: Partial<Omit<Gasto, 'id' | 'creado_en'>>
      }
      divisiones: {
        Row:    Division
        Insert: Omit<Division, 'id'>
        Update: Partial<Omit<Division, 'id'>>
      }
      pagos: {
        Row:    Pago
        Insert: Omit<Pago, 'id' | 'creado_en'>
        Update: Partial<Omit<Pago, 'id' | 'creado_en'>>
      }
      cierres_mensuales: {
        Row:    CiorreMensual
        Insert: Omit<CiorreMensual, 'id' | 'cerrado_en'>
        Update: Partial<Omit<CiorreMensual, 'id' | 'cerrado_en'>>
      }
      cuentas_compartidas: {
        Row:    CuentaCompartida
        Insert: Omit<CuentaCompartida, 'id' | 'creado_en'>
        Update: Partial<Omit<CuentaCompartida, 'id' | 'creado_en'>>
      }
      cuentas_compartidas_participantes: {
        Row:    CuentaCompartidaParticipante
        Insert: Omit<CuentaCompartidaParticipante, 'id'>
        Update: Partial<Omit<CuentaCompartidaParticipante, 'id'>>
      }
      cuentas_compartidas_items: {
        Row:    CuentaCompartidaItem
        Insert: Omit<CuentaCompartidaItem, 'id' | 'creado_en'>
        Update: Partial<Omit<CuentaCompartidaItem, 'id' | 'creado_en'>>
      }
      cuentas_compartidas_consumo: {
        Row:    CuentaCompartidaConsumo
        Insert: Omit<CuentaCompartidaConsumo, 'id' | 'actualizado_en'>
        Update: Partial<Omit<CuentaCompartidaConsumo, 'id' | 'actualizado_en'>>
      }
    }
  }
}
