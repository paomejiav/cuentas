'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/lib/session-store'
import {
  calcularResumenMes, calcularPagosOptimizados, calcularPagosIndividuales,
  cerrarMes, obtenerCierresAnteriores, mesPorDefecto, formatearMesLabel,
  generarMesesDisponibles,
  type ResumenMes, type TransferenciaCierre, type CierreHistorial,
} from '@/lib/cierre'
import { formatCLP } from '@/lib/format'
import { Avatar } from '@/components/app/Avatar'
import { BottomNav } from '@/components/app/BottomNav'
import { Toast } from '@/components/app/Toast'
import { CATEGORIA_EMOJI, CATEGORIA_LABEL, type Categoria } from '@/types/database'
import { supabase } from '@/lib/supabase'

type Paso = 1 | 2 | 3 | 4
type ModoPago = 'optimizado' | 'individual'

// ── Componentes menores ───────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      margin: '0 4px 10px',
      fontSize: 11, fontWeight: 600,
      color: 'var(--color-text-secondary)',
      fontFamily: 'var(--font-dm-sans), sans-serif',
      textTransform: 'uppercase', letterSpacing: '0.08em',
    }}>
      {children}
    </p>
  )
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'var(--color-card)',
      borderRadius: 20, padding: '16px 18px',
      ...style,
    }}>
      {children}
    </div>
  )
}

function BtnPrimario({ onClick, disabled, loading, children }: {
  onClick?: () => void
  disabled?: boolean
  loading?: boolean
  children: React.ReactNode
  type?: 'submit'
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        width: '100%', height: 56, borderRadius: 100,
        background: (disabled || loading) ? 'var(--color-text-disabled)' : 'var(--color-cta)',
        color: 'white', border: 'none',
        fontSize: 16, fontWeight: 600,
        fontFamily: 'var(--font-dm-sans), sans-serif',
        cursor: (disabled || loading) ? 'not-allowed' : 'pointer',
        transition: 'all 120ms ease',
        marginTop: 8,
      }}
      onPointerDown={e => { if (!disabled && !loading) e.currentTarget.style.transform = 'scale(0.97)' }}
      onPointerUp={e => (e.currentTarget.style.transform = 'scale(1)')}
      onPointerLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
    >
      {loading ? 'Procesando…' : children}
    </button>
  )
}

// ── Barra de progreso de pasos ────────────────────────────────

function PasoIndicador({ paso, total = 4 }: { paso: Paso; total?: number }) {
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
      {Array.from({ length: total }, (_, i) => i + 1).map(n => (
        <div key={n} style={{
          height: 6, borderRadius: 3,
          width: n === paso ? 24 : 8,
          background: n < paso
            ? 'var(--color-cta)'
            : n === paso
            ? 'var(--color-cta)'
            : 'var(--color-border)',
          opacity: n < paso ? 0.5 : 1,
          transition: 'all 250ms ease',
        }} />
      ))}
    </div>
  )
}

// ── PASO 1: Resumen del mes ───────────────────────────────────

function Paso1({
  resumen, mes, setMes, mesesDisponibles, cargando, onSiguiente,
}: {
  resumen: ResumenMes | null
  mes: string
  setMes: (m: string) => void
  mesesDisponibles: string[]
  cargando: boolean
  onSiguiente: () => void
}) {
  if (cargando) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0 16px' }}>
        {[80, 120, 200].map((h, i) => (
          <div key={i} style={{ height: h, background: 'var(--color-card)', borderRadius: 20 }} />
        ))}
      </div>
    )
  }

  return (
    <div style={{ padding: '0 var(--page-px)', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Selector de mes */}
      <div>
        <SectionTitle>Mes a cerrar</SectionTitle>
        <select
          value={mes}
          onChange={e => setMes(e.target.value)}
          style={{
            width: '100%', height: 52,
            background: 'var(--color-card-light)',
            border: 'none', borderRadius: 14,
            padding: '0 16px',
            fontSize: 15, fontWeight: 600,
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-dm-sans), sans-serif',
            appearance: 'none',
            cursor: 'pointer',
          }}
        >
          {mesesDisponibles.map(m => (
            <option key={m} value={m}>{formatearMesLabel(m)}</option>
          ))}
        </select>
      </div>

      {resumen?.yaCerrado && (
        <Card style={{ background: '#FFF3CD' }}>
          <p style={{ margin: 0, fontSize: 14, color: '#856404', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
            ⚠️ Este mes ya fue cerrado anteriormente.
          </p>
        </Card>
      )}

      {/* Total del mes */}
      {resumen && (
        <Card>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-dm-sans), sans-serif', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Total gastado — {formatearMesLabel(mes)}
          </p>
          <p style={{ margin: '6px 0 0', fontSize: 36, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'var(--font-lora), serif' }}>
            {formatCLP(resumen.totalGastado)}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
            {resumen.gastoIds.length} gasto{resumen.gastoIds.length !== 1 ? 's' : ''} en el período
          </p>
        </Card>
      )}

      {/* Tabla de saldos */}
      {resumen && resumen.saldos.length > 0 && (
        <div>
          <SectionTitle>Balance por persona</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {resumen.saldos.map(s => (
              <div key={s.integrante.id} style={{
                background: 'var(--color-card)',
                borderRadius: 16, padding: '12px 16px',
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <Avatar nombre={s.integrante.nombre} color={s.integrante.avatar_color} size={38} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
                    {s.integrante.nombre}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
                    Pagó {formatCLP(s.pago)} · Le toca {formatCLP(s.corresponde)}
                  </p>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <p style={{
                    margin: 0, fontSize: 15, fontWeight: 700,
                    color: s.neto === 0
                      ? 'var(--color-text-secondary)'
                      : s.neto > 0
                      ? 'var(--color-positive)'
                      : 'var(--color-negative)',
                    fontFamily: 'var(--font-dm-sans), sans-serif',
                  }}>
                    {s.neto === 0 ? '✓' : s.neto > 0 ? `+${formatCLP(s.neto)}` : `−${formatCLP(-s.neto)}`}
                  </p>
                  <p style={{ margin: '1px 0 0', fontSize: 11, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
                    {s.neto === 0 ? 'Al día' : s.neto > 0 ? 'le deben' : 'debe'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Desglose por categoría */}
      {resumen && resumen.porCategoria.length > 0 && (
        <div>
          <SectionTitle>Por categoría</SectionTitle>
          <Card style={{ padding: '14px 18px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {resumen.porCategoria.map(c => (
                <div key={c.categoria}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 13, fontFamily: 'var(--font-dm-sans), sans-serif', color: 'var(--color-text-primary)' }}>
                      {CATEGORIA_EMOJI[c.categoria]} {CATEGORIA_LABEL[c.categoria]}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-dm-sans), sans-serif', color: 'var(--color-text-primary)' }}>
                      {formatCLP(c.total)} <span style={{ fontWeight: 400, color: 'var(--color-text-secondary)' }}>({c.porcentaje}%)</span>
                    </span>
                  </div>
                  {/* Barra */}
                  <div style={{ height: 6, background: 'var(--color-border)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${c.porcentaje}%`,
                      background: 'var(--color-cta)',
                      borderRadius: 3,
                      transition: 'width 600ms ease',
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {resumen && !resumen.yaCerrado && resumen.gastoIds.length > 0 && (
        <BtnPrimario onClick={onSiguiente}>
          Continuar al cierre →
        </BtnPrimario>
      )}

      {resumen && resumen.gastoIds.length === 0 && (
        <Card>
          <p style={{ margin: 0, fontSize: 14, textAlign: 'center', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
            No hay gastos pendientes para cerrar en {formatearMesLabel(mes)} 🎉
          </p>
        </Card>
      )}
    </div>
  )
}

// ── PASO 2: Elegir modo de pago ───────────────────────────────

function Paso2({
  modo, setModo, onSiguiente,
}: {
  modo: ModoPago
  setModo: (m: ModoPago) => void
  onSiguiente: () => void
}) {
  const opciones: { id: ModoPago; emoji: string; titulo: string; desc: string }[] = [
    {
      id: 'optimizado',
      emoji: '⚡',
      titulo: 'Optimizado',
      desc: 'La app calcula el mínimo de transferencias posibles para saldar todo. Menos movimientos.',
    },
    {
      id: 'individual',
      emoji: '🔍',
      titulo: 'Pago individual',
      desc: 'Cada una ve exactamente cuánto le debe a cada persona por sus gastos directos. Más transparente.',
    },
  ]

  return (
    <div style={{ padding: '0 var(--page-px)', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionTitle>¿Cómo quieren saldar?</SectionTitle>

      {opciones.map(op => {
        const activo = modo === op.id
        return (
          <button
            key={op.id}
            onClick={() => setModo(op.id)}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 16,
              padding: '18px 18px',
              borderRadius: 20,
              border: activo ? '2px solid var(--color-cta)' : '2px solid transparent',
              background: activo ? 'white' : 'var(--color-card)',
              cursor: 'pointer', textAlign: 'left',
              transition: 'all 150ms ease',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <span style={{ fontSize: 32, flexShrink: 0 }}>{op.emoji}</span>
            <div>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'var(--font-lora), serif' }}>
                {op.titulo}
              </p>
              <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-dm-sans), sans-serif', lineHeight: 1.5 }}>
                {op.desc}
              </p>
            </div>
            <div style={{
              marginLeft: 'auto', flexShrink: 0,
              width: 22, height: 22, borderRadius: '50%',
              border: activo ? '2px solid var(--color-cta)' : '2px solid var(--color-border)',
              background: activo ? 'var(--color-cta)' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {activo && (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
          </button>
        )
      })}

      <BtnPrimario onClick={onSiguiente}>
        Ver transferencias →
      </BtnPrimario>
    </div>
  )
}

// ── PASO 3: Marcar pagos ──────────────────────────────────────

function Paso3({
  transferencias,
  setTransferencias,
  onSiguiente,
}: {
  transferencias: TransferenciaCierre[]
  setTransferencias: React.Dispatch<React.SetStateAction<TransferenciaCierre[]>>
  onSiguiente: () => void
}) {
  const pagadas = transferencias.filter(t => t.pagado).length

  function togglePagado(id: string) {
    setTransferencias(prev => prev.map(t => t.id === id ? { ...t, pagado: !t.pagado } : t))
  }

  function setFecha(id: string, fecha: string) {
    setTransferencias(prev => prev.map(t => t.id === id ? { ...t, fecha } : t))
  }

  function setMetodo(id: string, metodo: string) {
    setTransferencias(prev => prev.map(t => t.id === id ? { ...t, metodo: metodo as TransferenciaCierre['metodo'] } : t))
  }

  const metodos = [
    { id: 'transferencia', label: '🏦 Transferencia' },
    { id: 'efectivo',      label: '💵 Efectivo'      },
    { id: 'otro',          label: '📱 Otro'           },
  ]

  return (
    <div style={{ padding: '0 var(--page-px)', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Progreso */}
      <Card style={{ padding: '14px 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
            Progreso
          </p>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--color-cta)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
            {pagadas} / {transferencias.length}
          </p>
        </div>
        <div style={{ height: 8, background: 'var(--color-border)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: transferencias.length > 0 ? `${(pagadas / transferencias.length) * 100}%` : '0%',
            background: 'var(--color-cta)',
            borderRadius: 4,
            transition: 'width 400ms ease',
          }} />
        </div>
      </Card>

      <SectionTitle>Transferencias a realizar</SectionTitle>

      {transferencias.length === 0 && (
        <Card>
          <p style={{ margin: 0, textAlign: 'center', fontSize: 14, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
            🎉 ¡No hay deudas! Todas están al día.
          </p>
        </Card>
      )}

      {transferencias.map(t => (
        <div key={t.id} style={{
          background: t.pagado ? 'var(--color-card)' : 'white',
          borderRadius: 20,
          border: t.pagado ? 'none' : '2px solid var(--color-border)',
          overflow: 'hidden',
          opacity: t.pagado ? 0.75 : 1,
          transition: 'all 200ms ease',
        }}>
          {/* Fila principal */}
          <button
            onClick={() => togglePagado(t.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '16px 18px', width: '100%',
              border: 'none', background: 'transparent',
              cursor: 'pointer', textAlign: 'left',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {/* Checkbox */}
            <div style={{
              width: 24, height: 24, borderRadius: 8, flexShrink: 0,
              border: t.pagado ? 'none' : '2px solid var(--color-border)',
              background: t.pagado ? 'var(--color-cta)' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 200ms ease',
            }}>
              {t.pagado && (
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M2 6.5l3.5 3.5 5.5-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>

            {/* Avatares + flecha */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
              <Avatar nombre={t.de.nombre} color={t.de.avatar_color} size={34} />
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                <path d="M4 8h8M9 5l3 3-3 3" stroke="var(--color-text-secondary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <Avatar nombre={t.a.nombre} color={t.a.avatar_color} size={34} />
              <div style={{ marginLeft: 4, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'var(--font-dm-sans), sans-serif', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {t.de.nombre} → {t.a.nombre}
                </p>
                <p style={{ margin: '2px 0 0', fontSize: 16, fontWeight: 700, color: t.pagado ? 'var(--color-positive)' : 'var(--color-text-primary)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
                  {formatCLP(t.monto)}
                </p>
              </div>
            </div>
          </button>

          {/* Campos adicionales si está marcado como pagado */}
          {t.pagado && (
            <div style={{
              padding: '0 18px 16px',
              display: 'flex', gap: 10,
              borderTop: '1px solid var(--color-border)',
              paddingTop: 12,
            }}>
              <input
                type="date"
                value={t.fecha}
                onChange={e => setFecha(t.id, e.target.value)}
                style={{
                  flex: 1, height: 42,
                  background: 'var(--color-card-light)',
                  border: 'none', borderRadius: 12,
                  padding: '0 12px',
                  fontSize: 13, fontFamily: 'var(--font-dm-sans), sans-serif',
                  color: 'var(--color-text-primary)', outline: 'none',
                }}
              />
              <select
                value={t.metodo}
                onChange={e => setMetodo(t.id, e.target.value)}
                style={{
                  flex: 1, height: 42,
                  background: 'var(--color-card-light)',
                  border: 'none', borderRadius: 12,
                  padding: '0 12px',
                  fontSize: 13, fontFamily: 'var(--font-dm-sans), sans-serif',
                  color: 'var(--color-text-primary)', outline: 'none',
                  appearance: 'none',
                }}
              >
                {metodos.map(m => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      ))}

      <BtnPrimario onClick={onSiguiente}>
        Revisar y confirmar →
      </BtnPrimario>
    </div>
  )
}

// ── PASO 4: Confirmar cierre ──────────────────────────────────

function Paso4({
  resumen, mes, transferencias, onConfirmar, cerrando,
}: {
  resumen: ResumenMes
  mes: string
  transferencias: TransferenciaCierre[]
  onConfirmar: () => void
  cerrando: boolean
}) {
  const pagadas   = transferencias.filter(t => t.pagado)
  const pendientes = transferencias.filter(t => !t.pagado)

  return (
    <div style={{ padding: '0 var(--page-px)', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Resumen visual */}
      <Card style={{ textAlign: 'center', padding: '24px 20px' }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>📅</div>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'var(--font-lora), serif' }}>
          Cierre de {formatearMesLabel(mes)}
        </h2>
        <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
          Total gastado: <strong style={{ color: 'var(--color-text-primary)' }}>{formatCLP(resumen.totalGastado)}</strong>
          {' · '}{resumen.gastoIds.length} gastos
        </p>
      </Card>

      {pagadas.length > 0 && (
        <div>
          <SectionTitle>Pagos registrados ({pagadas.length})</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pagadas.map(t => (
              <div key={t.id} style={{
                background: 'var(--color-card)',
                borderRadius: 16, padding: '12px 16px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16 }}>✅</span>
                  <span style={{ fontSize: 13, fontFamily: 'var(--font-dm-sans), sans-serif', color: 'var(--color-text-primary)' }}>
                    {t.de.nombre} → {t.a.nombre}
                  </span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-positive)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
                  {formatCLP(t.monto)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {pendientes.length > 0 && (
        <Card style={{ background: '#FFF9E6' }}>
          <p style={{ margin: 0, fontSize: 13, color: '#7A5C00', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
            ⏳ <strong>{pendientes.length} transferencia{pendientes.length > 1 ? 's' : ''}</strong> quedarán pendientes pero el mes igual se cerrará. Los saldos se resetearán.
          </p>
        </Card>
      )}

      <div style={{
        background: 'var(--color-card)',
        borderRadius: 20, padding: '16px 18px',
        border: '2px solid var(--color-border)',
      }}>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-dm-sans), sans-serif', lineHeight: 1.6 }}>
          Al confirmar, todos los gastos de <strong style={{ color: 'var(--color-text-primary)' }}>{formatearMesLabel(mes)}</strong> quedarán archivados y los saldos volverán a cero. Esta acción no se puede deshacer.
        </p>
      </div>

      <BtnPrimario onClick={onConfirmar} loading={cerrando}>
        {cerrando ? 'Cerrando el mes…' : `Cerrar ${formatearMesLabel(mes)} ✓`}
      </BtnPrimario>
    </div>
  )
}

// ── Vista de cierres anteriores ───────────────────────────────

function CierresAnteriores({ cierres }: { cierres: CierreHistorial[] }) {
  if (cierres.length === 0) return null

  return (
    <div style={{ padding: '0 var(--page-px)', marginTop: 8 }}>
      <SectionTitle>Meses cerrados anteriores</SectionTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {cierres.map(c => {
          const fechaCierre = new Date(c.cerrado_en).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })
          return (
            <div key={c.id} style={{
              background: 'var(--color-card)',
              borderRadius: 16, padding: '12px 16px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
                  {formatearMesLabel(c.mes)}
                </p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
                  Cerrado el {fechaCierre}
                </p>
              </div>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
                {formatCLP(c.total_gastado)}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────

export default function CierrePage() {
  const router = useRouter()
  const { sesion, loading: sesionLoading } = useSession()

  const [paso, setPaso] = useState<Paso>(1)
  const [mes, setMesState] = useState(mesPorDefecto())
  const [mesesDisponibles, setMesesDisponibles] = useState<string[]>([mesPorDefecto()])
  const [resumen, setResumen] = useState<ResumenMes | null>(null)
  const [cargando, setCargando] = useState(true)
  const [modo, setModo] = useState<ModoPago>('optimizado')
  const [transferencias, setTransferencias] = useState<TransferenciaCierre[]>([])
  const [cerrando, setCerrando] = useState(false)
  const [toast, setToast] = useState<{ mensaje: string; tipo: 'exito' | 'error' } | null>(null)
  const [cierresAnteriores, setCierresAnteriores] = useState<CierreHistorial[]>([])

  // Cargar datos de soporte al montar
  useEffect(() => {
    if (!sesion) return

    obtenerCierresAnteriores(sesion.grupo_id).then(setCierresAnteriores)

    // Meses disponibles desde el primer gasto
    supabase
      .from('gastos')
      .select('fecha')
      .eq('grupo_id', sesion.grupo_id)
      .order('fecha', { ascending: true })
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) {
          const primerMes = data[0].fecha.slice(0, 7)
          setMesesDisponibles(generarMesesDisponibles(primerMes))
        }
      })
  }, [sesion])

  // Cargar resumen cuando cambia el mes
  const cargarResumen = useCallback(async () => {
    if (!sesion) return
    setCargando(true)
    const r = await calcularResumenMes(sesion.grupo_id, mes)
    setResumen(r)
    setCargando(false)
  }, [sesion, mes])

  useEffect(() => {
    if (!sesionLoading && !sesion) { router.replace('/login'); return }
    if (sesion) cargarResumen()
  }, [sesion, sesionLoading, mes, router, cargarResumen])

  // Resetear pasos al cambiar de mes
  function setMes(m: string) {
    setMesState(m)
    setPaso(1)
    setTransferencias([])
  }

  function handlePaso1Siguiente() { setPaso(2) }

  function handlePaso2Siguiente() {
    if (!resumen) return
    // Calcular transferencias según el modo
    const t = modo === 'optimizado'
      ? calcularPagosOptimizados(resumen.saldos)
      : calcularPagosIndividuales(
          sesion!.grupo_id,
          resumen.saldos,
          [] // simplificado: usar optimizado cuando no hay gastos detallados
        )

    // Fallback a optimizado si individual devuelve vacío
    setTransferencias(t.length > 0 || modo === 'optimizado' ? t : calcularPagosOptimizados(resumen.saldos))
    setPaso(3)
    window.scrollTo(0, 0)
  }

  function handlePaso3Siguiente() {
    setPaso(4)
    window.scrollTo(0, 0)
  }

  async function handleCerrarMes() {
    if (!resumen || !sesion) return
    setCerrando(true)

    const result = await cerrarMes(
      sesion.grupo_id,
      mes,
      resumen.gastoIds,
      resumen.totalGastado,
      transferencias
    )

    setCerrando(false)

    if (!result.ok) {
      setToast({ mensaje: result.error, tipo: 'error' })
      return
    }

    setToast({ mensaje: `¡${formatearMesLabel(mes)} cerrado! Los saldos vuelven a cero. 🎉`, tipo: 'exito' })
    setTimeout(() => router.replace('/dashboard'), 2200)
  }

  const titulosPasos = [
    'Resumen del mes',
    'Modo de pago',
    'Marcar pagos',
    'Confirmar cierre',
  ]

  if (sesionLoading || !sesion) return null

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', paddingBottom: 80 }}>

      {/* Header */}
      <header style={{ padding: '56px 20px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        {paso > 1 ? (
          <button
            onClick={() => { setPaso(p => (p - 1) as Paso); window.scrollTo(0, 0) }}
            style={{
              background: 'var(--color-card)', border: 'none', borderRadius: 12,
              width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M11 4L6 9l5 5" stroke="var(--color-text-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ) : (
          <div style={{ width: 40, flexShrink: 0 }} />
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            margin: 0, fontSize: 12, fontWeight: 600,
            color: 'var(--color-text-secondary)',
            fontFamily: 'var(--font-dm-sans), sans-serif',
            textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>
            Paso {paso} de 4
          </p>
          <h1 style={{
            margin: '2px 0 0', fontSize: 22, fontWeight: 700,
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-lora), serif',
          }}>
            {titulosPasos[paso - 1]}
          </h1>
        </div>

        <PasoIndicador paso={paso} />
      </header>

      {/* Contenido por paso */}
      {paso === 1 && (
        <>
          <Paso1
            resumen={resumen}
            mes={mes}
            setMes={setMes}
            mesesDisponibles={mesesDisponibles}
            cargando={cargando}
            onSiguiente={handlePaso1Siguiente}
          />
          <div style={{ marginTop: 32 }}>
            <CierresAnteriores cierres={cierresAnteriores} />
          </div>
        </>
      )}

      {paso === 2 && (
        <Paso2 modo={modo} setModo={setModo} onSiguiente={handlePaso2Siguiente} />
      )}

      {paso === 3 && (
        <Paso3
          transferencias={transferencias}
          setTransferencias={setTransferencias}
          onSiguiente={handlePaso3Siguiente}
        />
      )}

      {paso === 4 && resumen && (
        <Paso4
          resumen={resumen}
          mes={mes}
          transferencias={transferencias}
          onConfirmar={handleCerrarMes}
          cerrando={cerrando}
        />
      )}

      <BottomNav />

      {toast && (
        <Toast mensaje={toast.mensaje} tipo={toast.tipo} onClose={() => setToast(null)} />
      )}
    </div>
  )
}
