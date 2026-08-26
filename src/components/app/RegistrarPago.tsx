'use client'

import { useEffect, useState } from 'react'
import { Avatar } from '@/components/app/Avatar'
import { formatCLP } from '@/lib/format'
import type { MetodoPago } from '@/types/database'
import type { UsuarioMini } from '@/lib/cuentas'
import { registrarPagoDirecto, type DivisionASaldar } from '@/lib/pagos'
import { supabase } from '@/lib/supabase'

// Salda una o varias divisiones puntuales hacia la misma persona — fuera del
// cierre mensual (liquidación directa) o como acción sobre una transferencia
// sugerida del cierre (pantalla 12). El componente hace los inserts/updates él
// mismo vía registrarPagoDirecto.
interface RegistrarPagoProps {
  divisiones: DivisionASaldar[]
  contraparte: UsuarioMini
  onConfirmado: () => void
  miId: string
  onCerrar: () => void
}

const METODOS: { id: MetodoPago; label: string; desc: string; icon: React.ReactNode }[] = [
  {
    id: 'transferencia',
    label: 'Transferencia',
    desc: 'Registrar como transferencia bancaria',
    icon: (
      <svg width="19" height="19" viewBox="0 0 20 20" fill="none">
        <rect x="2.5" y="5" width="15" height="10" rx="2" stroke="var(--color-cta-dark)" strokeWidth="1.6" />
        <path d="M2.5 8h15" stroke="var(--color-cta-dark)" strokeWidth="1.6" />
      </svg>
    ),
  },
  {
    id: 'efectivo',
    label: 'Efectivo',
    desc: 'Registrar pago en mano',
    icon: (
      <svg width="19" height="19" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="7" stroke="var(--color-neutral)" strokeWidth="1.6" />
        <path d="M10 6.5v7M8 8.5c0-1 4-1 4 0s-4 1-4 2 4 1 4 0" stroke="var(--color-neutral)" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'otro',
    label: 'Otro',
    desc: 'App de pago, cheque u otro medio',
    icon: (
      <svg width="19" height="19" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="7.5" stroke="var(--color-neutral)" strokeWidth="1.5" />
        <path d="M10 9v4M10 6.5h.01" stroke="var(--color-neutral)" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
]

function fechaCorta(fechaISO: string): string {
  return new Date(fechaISO + 'T12:00:00').toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })
}

export function RegistrarPago(props: RegistrarPagoProps) {
  const { miId, onCerrar } = props

  const [metodo, setMetodo] = useState<MetodoPago>('transferencia')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [miInfo, setMiInfo] = useState<UsuarioMini | null>(null)

  // No recibimos el nombre/avatar de quien paga por props — lo traemos.
  useEffect(() => {
    let activo = true
    supabase.from('usuarios').select('id, nombre, avatar_color').eq('id', miId).single()
      .then(({ data }) => { if (activo && data) setMiInfo(data as UsuarioMini) })
    return () => { activo = false }
  }, [miId])

  const de = miInfo ?? { id: miId, nombre: 'Tú', avatar_color: '#EDEDF1' }
  const a = props.contraparte
  const soyElQuePaga = de.id === miId

  const montoTotal = props.divisiones.reduce((s, d) => s + d.monto_asignado, 0)

  async function confirmar() {
    const fecha = new Date().toISOString().slice(0, 10)

    setError(null)
    setGuardando(true)
    const result = await registrarPagoDirecto({
      miId,
      contraparteId: props.contraparte.id,
      divisiones: props.divisiones,
      metodo,
      fecha,
    })
    setGuardando(false)

    if (!result.ok) {
      setError(result.error)
      return
    }
    props.onConfirmado()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 80,
      background: 'var(--color-bg)', overflowY: 'auto',
    }}>
      <div style={{ maxWidth: 640, margin: '0 auto', minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
        <header style={{
          paddingTop: 'max(56px, calc(env(safe-area-inset-top, 0px) + 16px))',
          paddingBottom: 8, paddingLeft: 'var(--page-px)', paddingRight: 'var(--page-px)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <button
            onClick={onCerrar}
            aria-label="Volver"
            style={{
              background: 'var(--color-surface-white)', border: '1px solid var(--color-border)',
              borderRadius: 13, width: 42, height: 42, padding: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M11 4l-5 5 5 5" stroke="var(--color-text-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <h1 style={{
            margin: 0, fontSize: 19, fontWeight: 700, color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-sora), sans-serif', letterSpacing: '-0.01em',
          }}>
            Registrar pago
          </h1>
        </header>

        <main style={{ flex: 1, padding: '0 var(--page-px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, margin: '26px 0 8px' }}>
            <div style={{ textAlign: 'center' }}>
              <Avatar nombre={de.nombre} color={de.avatar_color} size={56} />
              <p style={{ margin: '8px 0 0', fontSize: 12, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
                {de.nombre}
              </p>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
                {soyElQuePaga ? 'Tú' : 'Paga'}
              </p>
            </div>
            <svg width="34" height="18" viewBox="0 0 34 18" fill="none" style={{ flexShrink: 0 }}>
              <path d="M2 9h28m0 0l-6-6m6 6l-6 6" stroke="var(--color-cta)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div style={{ textAlign: 'center' }}>
              <Avatar nombre={a.nombre} color={a.avatar_color} size={56} />
              <p style={{ margin: '8px 0 0', fontSize: 12, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
                {a.nombre}
              </p>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
                {a.id === miId ? 'Tú' : 'Recibe'}
              </p>
            </div>
          </div>

          <div style={{
            textAlign: 'center', background: 'var(--color-surface-white)', border: '1px solid var(--color-border)',
            borderRadius: 18, padding: 22, marginTop: 18,
          }}>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--color-neutral)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
              Vas a saldar
            </p>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 6, marginTop: 6 }}>
              <span style={{ fontFamily: 'var(--font-sora), sans-serif', fontSize: 40, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--color-text-primary)' }}>
                {formatCLP(montoTotal)}
              </span>
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-muted)' }}>CLP</span>
            </div>
          </div>

          <p style={{
            margin: '22px 2px 10px', fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)',
            fontFamily: 'var(--font-dm-sans), sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>
            Gastos incluidos · {props.divisiones.length}
          </p>
          <div style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 18, padding: '4px 16px' }}>
            {props.divisiones.map((d, idx) => (
              <div key={d.division_id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '13px 0',
                borderBottom: idx === props.divisiones.length - 1 ? 'none' : '1px solid var(--color-divider)',
              }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 12, background: 'var(--tint-cta)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0,
                }}>
                  🧾
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'var(--font-dm-sans), sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {d.descripcion}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--color-neutral)', marginTop: 1, fontFamily: 'var(--font-dm-sans), sans-serif' }}>
                    {fechaCorta(d.fecha)}
                  </div>
                </div>
                <span style={{ fontFamily: 'var(--font-sora), sans-serif', fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)', flexShrink: 0 }}>
                  {formatCLP(d.monto_asignado)}
                </span>
              </div>
            ))}
          </div>

          <p style={{
            margin: '22px 2px 10px', fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)',
            fontFamily: 'var(--font-dm-sans), sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>
            Método
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {METODOS.map(m => {
              const activo = metodo === m.id
              return (
                <button
                  key={m.id}
                  onClick={() => setMetodo(m.id)}
                  style={{
                    background: 'var(--color-surface-white)',
                    border: activo ? '1.6px solid var(--color-cta)' : '1px solid var(--color-border)',
                    borderRadius: 14, padding: '14px 16px',
                    display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', textAlign: 'left',
                    WebkitTapHighlightColor: 'transparent',
                  }}
                >
                  <div style={{
                    width: 38, height: 38, borderRadius: 12,
                    background: activo ? 'var(--tint-cta)' : 'var(--color-icon-bg)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    {m.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
                      {m.label}
                    </p>
                    <p style={{ margin: 0, fontSize: 11.5, color: 'var(--color-text-muted)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
                      {m.desc}
                    </p>
                  </div>
                  <span style={{
                    width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                    background: activo ? 'var(--color-cta)' : 'transparent',
                    border: activo ? 'none' : '1.6px solid #D6D6DE',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {activo && (
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                        <path d="M3 6l2 2 4-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                </button>
              )
            })}
          </div>

          {error && (
            <div style={{ marginTop: 14, borderRadius: 12, padding: '10px 14px', background: 'var(--color-negative-tint)' }}>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--color-negative)', fontFamily: 'var(--font-dm-sans), sans-serif', lineHeight: 1.4 }}>{error}</p>
            </div>
          )}
        </main>

        <div style={{ padding: '16px var(--page-px) max(22px, env(safe-area-inset-bottom))' }}>
          <button
            onClick={confirmar}
            disabled={guardando}
            style={{
              width: '100%', height: 54, borderRadius: 15, border: 'none',
              background: 'var(--gradient-cta)', color: 'white',
              fontSize: 15.5, fontWeight: 700, fontFamily: 'var(--font-dm-sans), sans-serif',
              cursor: guardando ? 'default' : 'pointer', boxShadow: 'var(--shadow-cta)',
              opacity: guardando ? 0.6 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M4 10l4 4 8-9" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            {guardando ? 'Guardando…' : 'Confirmar pago'}
          </button>
        </div>
      </div>
    </div>
  )
}
