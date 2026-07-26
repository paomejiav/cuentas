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
import { RegistrarPago } from '@/components/app/RegistrarPago'
import { CATEGORIA_EMOJI, CATEGORIA_LABEL, type Categoria } from '@/types/database'
import { supabase } from '@/lib/supabase'

type Paso = 1 | 2 | 3 | 4
type ModoPago = 'optimizado' | 'individual'

// ── Componentes menores ───────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      margin: '0 4px 10px',
      fontSize: 11, fontWeight: 700,
      color: 'var(--color-text-muted)',
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
      border: '1px solid var(--color-border)',
      borderRadius: 18, padding: '16px 18px',
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
        width: '100%', height: 54, borderRadius: 15, border: 'none',
        background: (disabled || loading) ? 'var(--color-text-disabled)' : 'var(--gradient-cta)',
        color: 'white',
        fontSize: 15.5, fontWeight: 700,
        fontFamily: 'var(--font-dm-sans), sans-serif',
        cursor: (disabled || loading) ? 'not-allowed' : 'pointer',
        boxShadow: (disabled || loading) ? 'none' : 'var(--shadow-cta)',
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
        <span key={n} style={{
          height: 5, borderRadius: 3,
          width: n === paso ? 22 : 10,
          background: n <= paso ? 'var(--color-cta)' : '#DEDEE6',
          transition: 'all 250ms ease',
        }} />
      ))}
    </div>
  )
}

// ── Donut de progreso ────────────────────────────────────────

function DonutProgreso({ pct }: { pct: number }) {
  const r = 24
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - Math.min(100, Math.max(0, pct)) / 100)
  return (
    <div style={{ position: 'relative', width: 56, height: 56, flexShrink: 0 }}>
      <svg width="56" height="56" viewBox="0 0 56 56">
        <circle cx="28" cy="28" r={r} fill="none" stroke="var(--color-track)" strokeWidth="7" />
        <circle
          cx="28" cy="28" r={r} fill="none" stroke="var(--color-cta)" strokeWidth="7"
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
          transform="rotate(-90 28 28)"
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-sora), sans-serif', fontSize: 14, fontWeight: 800, color: 'var(--color-cta)',
      }}>
        {Math.round(pct)}%
      </div>
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0 var(--page-px)' }}>
        {[52, 100, 180].map((h, i) => (
          <div key={i} className="skeleton" style={{ height: h, borderRadius: 18 }} />
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
            background: 'var(--color-surface-white)',
            border: '1px solid var(--color-border)', borderRadius: 14,
            padding: '0 15px',
            fontSize: 14.5, fontWeight: 600,
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
        <Card style={{ background: '#FFF3CD', border: 'none' }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: '#633806', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
            ⚠️ Este mes ya fue cerrado anteriormente.
          </p>
        </Card>
      )}

      {/* Total del mes */}
      {resumen && (
        <Card>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', fontFamily: 'var(--font-dm-sans), sans-serif', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Total gastado — {formatearMesLabel(mes)}
          </p>
          <p style={{ margin: '6px 0 0', fontSize: 32, fontWeight: 800, color: 'var(--color-text-primary)', fontFamily: 'var(--font-sora), sans-serif', letterSpacing: '-0.02em' }}>
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
          <div style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 18, padding: '4px 16px' }}>
            {resumen.saldos.map((s, i) => (
              <div key={s.integrante.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '13px 0',
                borderBottom: i === resumen.saldos.length - 1 ? 'none' : '1px solid var(--color-divider)',
              }}>
                <Avatar nombre={s.integrante.nombre} color={s.integrante.avatar_color} size={38} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
                    {s.integrante.nombre}
                  </p>
                  <p style={{ margin: '1px 0 0', fontSize: 11.5, color: 'var(--color-text-muted)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
                    Pagó {formatCLP(s.pago)} · Le toca {formatCLP(s.corresponde)}
                  </p>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <p style={{
                    margin: 0, fontFamily: 'var(--font-sora), sans-serif', fontSize: 15, fontWeight: 700,
                    color: s.neto === 0
                      ? 'var(--color-text-secondary)'
                      : s.neto > 0
                      ? 'var(--color-positive)'
                      : 'var(--color-negative)',
                  }}>
                    {s.neto === 0 ? '✓' : s.neto > 0 ? `+${formatCLP(s.neto)}` : `−${formatCLP(-s.neto)}`}
                  </p>
                  <p style={{ margin: '1px 0 0', fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
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
              {resumen.porCategoria.map((c: { categoria: Categoria; total: number; porcentaje: number }) => (
                <div key={c.categoria}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 13, fontFamily: 'var(--font-dm-sans), sans-serif', color: 'var(--color-text-primary)' }}>
                      {CATEGORIA_EMOJI[c.categoria]} {CATEGORIA_LABEL[c.categoria]}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-dm-sans), sans-serif', color: 'var(--color-text-primary)' }}>
                      {formatCLP(c.total)} <span style={{ fontWeight: 400, color: 'var(--color-text-secondary)' }}>({c.porcentaje}%)</span>
                    </span>
                  </div>
                  <div style={{ height: 6, background: 'var(--color-track)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: `${c.porcentaje}%`,
                      background: 'var(--color-cta)', borderRadius: 3,
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
              borderRadius: 18,
              border: activo ? '2px solid var(--color-cta)' : '1px solid var(--color-border)',
              background: activo ? 'var(--tint-cta)' : 'var(--color-surface-white)',
              cursor: 'pointer', textAlign: 'left',
              transition: 'all 150ms ease',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <span style={{ fontSize: 32, flexShrink: 0 }}>{op.emoji}</span>
            <div>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'var(--font-sora), sans-serif' }}>
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
  transferencias, setTransferencias, totalGastado, miId, onSiguiente,
}: {
  transferencias: TransferenciaCierre[]
  setTransferencias: React.Dispatch<React.SetStateAction<TransferenciaCierre[]>>
  totalGastado: number
  miId: string
  onSiguiente: () => void
}) {
  const [pagando, setPagando] = useState<TransferenciaCierre | null>(null)

  const montoTotal = transferencias.reduce((s, t) => s + t.monto, 0)
  const montoPagado = transferencias.filter(t => t.pagado).reduce((s, t) => s + t.monto, 0)
  const pctPagado = montoTotal > 0 ? (montoPagado / montoTotal) * 100 : 100

  function desmarcar(id: string) {
    setTransferencias(prev => prev.map(t => t.id === id ? { ...t, pagado: false } : t))
  }

  function confirmarPago(fecha: string, metodo: TransferenciaCierre['metodo']) {
    if (!pagando) return
    setTransferencias(prev => prev.map(t => t.id === pagando.id ? { ...t, pagado: true, fecha, metodo } : t))
    setPagando(null)
  }

  return (
    <div style={{ padding: '0 var(--page-px)', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {transferencias.length > 0 && (
        <Card style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <DonutProgreso pct={pctPagado} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--color-neutral)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
              Saldado del período
            </p>
            <p style={{ margin: '2px 0 0', fontFamily: 'var(--font-sora), sans-serif', fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--color-text-primary)' }}>
              {formatCLP(montoPagado)}
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--color-text-muted)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
              de {formatCLP(totalGastado)} total
            </p>
          </div>
        </Card>
      )}

      <SectionTitle>Transferencias sugeridas</SectionTitle>

      {transferencias.length === 0 && (
        <Card>
          <p style={{ margin: 0, textAlign: 'center', fontSize: 14, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
            🎉 ¡No hay deudas! Todas están al día.
          </p>
        </Card>
      )}

      {transferencias.map(t => (
        <div key={t.id} style={{
          background: 'var(--color-surface-white)',
          borderRadius: 18,
          border: t.pagado ? '1px solid var(--color-border)' : '1.6px solid var(--color-border)',
          padding: '16px',
          opacity: t.pagado ? 0.7 : 1,
          transition: 'all 200ms ease',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar nombre={t.de.nombre} color={t.de.avatar_color} size={38} />
            <svg width="26" height="16" viewBox="0 0 26 16" fill="none" style={{ flexShrink: 0 }}>
              <path d="M2 8h20m0 0l-5-5m5 5l-5 5" stroke="var(--color-text-disabled)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <Avatar nombre={t.a.nombre} color={t.a.avatar_color} size={38} />
            <div style={{ flex: 1, marginLeft: 4, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
                <b style={{ color: 'var(--color-text-primary)' }}>{t.de.nombre}</b> le paga a <b style={{ color: 'var(--color-text-primary)' }}>{t.a.nombre}</b>
              </p>
              <p style={{ margin: '1px 0 0', fontFamily: 'var(--font-sora), sans-serif', fontSize: 16, fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--color-text-primary)' }}>
                {formatCLP(t.monto)}
              </p>
            </div>
          </div>

          <button
            onClick={() => t.pagado ? desmarcar(t.id) : setPagando(t)}
            style={{
              width: '100%', height: 44, borderRadius: 12, border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              marginTop: 14, cursor: 'pointer',
              background: t.pagado ? 'var(--color-card-light)' : 'var(--tint-cta)',
            }}
          >
            {t.pagado ? (
              <>
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M4 12l5 5 11-11" stroke="var(--color-positive)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--color-positive)' }}>Saldado · toca para deshacer</span>
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M4 10l4 4 8-9" stroke="var(--color-cta-dark)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--color-cta-dark)' }}>Marcar como saldado</span>
              </>
            )}
          </button>
        </div>
      ))}

      <BtnPrimario onClick={onSiguiente}>
        Revisar y confirmar →
      </BtnPrimario>

      {pagando && (
        <RegistrarPago
          transferencia={pagando}
          miId={miId}
          onCerrar={() => setPagando(null)}
          onConfirmar={confirmarPago}
        />
      )}
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
        <h2 style={{ margin: 0, fontSize: 19, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'var(--font-sora), sans-serif' }}>
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
          <div style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 18, padding: '4px 16px' }}>
            {pagadas.map((t, i) => (
              <div key={t.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 0', borderBottom: i === pagadas.length - 1 ? 'none' : '1px solid var(--color-divider)',
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
        <Card style={{ background: '#FFF9E6', border: 'none' }}>
          <p style={{ margin: 0, fontSize: 13, color: '#7A5C00', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
            ⏳ <strong>{pendientes.length} transferencia{pendientes.length > 1 ? 's' : ''}</strong> quedarán pendientes pero el mes igual se cerrará. Los saldos se resetearán.
          </p>
        </Card>
      )}

      <Card>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-dm-sans), sans-serif', lineHeight: 1.6 }}>
          Al confirmar, todos los gastos de <strong style={{ color: 'var(--color-text-primary)' }}>{formatearMesLabel(mes)}</strong> quedarán archivados y los saldos volverán a cero. Esta acción no se puede deshacer.
        </p>
      </Card>

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
      <div style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 18, padding: '4px 16px' }}>
        {cierres.map((c, i) => {
          const fechaCierre = new Date(c.cerrado_en).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })
          return (
            <div key={c.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 0', borderBottom: i === cierres.length - 1 ? 'none' : '1px solid var(--color-divider)',
            }}>
              <div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
                  {formatearMesLabel(c.mes)}
                </p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--color-text-muted)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
                  Cerrado el {fechaCierre}
                </p>
              </div>
              <p style={{ margin: 0, fontFamily: 'var(--font-sora), sans-serif', fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)' }}>
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
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', paddingBottom: 96 }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>

      {/* Header */}
      <header style={{ padding: '56px var(--page-px) 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
        {paso > 1 ? (
          <button
            onClick={() => { setPaso(p => (p - 1) as Paso); window.scrollTo(0, 0) }}
            aria-label="Volver"
            style={{
              background: 'var(--color-surface-white)', border: '1px solid var(--color-border)',
              borderRadius: 13, width: 42, height: 42, padding: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M11 4L6 9l5 5" stroke="var(--color-text-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ) : (
          <div style={{ width: 42, flexShrink: 0 }} />
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{
            margin: 0, fontSize: paso === 1 ? 23 : 19, fontWeight: 700,
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-sora), sans-serif', letterSpacing: '-0.01em',
          }}>
            {paso === 1 ? 'Cierre de cuentas' : titulosPasos[paso - 1]}
          </h1>
          {paso > 1 && (
            <p style={{ margin: '1px 0 0', fontSize: 12, color: 'var(--color-neutral)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
              Paso {paso} de 4
            </p>
          )}
        </div>

        <PasoIndicador paso={paso} />
      </header>

      {paso === 1 && resumen && !resumen.yaCerrado && resumen.gastoIds.length > 0 && (
        <p style={{ padding: '0 var(--page-px)', margin: '0 0 16px', fontSize: 13, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
          Simplificamos las deudas al mínimo de transferencias posibles.
        </p>
      )}

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

      {paso === 3 && resumen && (
        <Paso3
          transferencias={transferencias}
          setTransferencias={setTransferencias}
          totalGastado={resumen.totalGastado}
          miId={sesion.integrante_id}
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

      </div>{/* end max-width wrapper */}

      <BottomNav />

      {toast && (
        <Toast mensaje={toast.mensaje} tipo={toast.tipo} onClose={() => setToast(null)} />
      )}
    </div>
  )
}
