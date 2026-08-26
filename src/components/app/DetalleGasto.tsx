'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Avatar } from '@/components/app/Avatar'
import { formatCLP } from '@/lib/format'
import { eliminarGasto, obtenerGastoConDivisiones, type GastoDetalleCompleto } from '@/lib/gastos'
import { CATEGORIA_EMOJI, CATEGORIA_LABEL } from '@/types/database'
import { RegistrarPago } from '@/components/app/RegistrarPago'

interface DetalleGastoProps {
  gastoId: string
  miId: string
  onClose: () => void
  onEliminado: () => void
  onPagoRegistrado: () => void
}

/**
 * Equivalente a GastoDetalle.tsx pero sobre el modelo nuevo (usuario_id,
 * saldado). GastoDetalle.tsx queda intacto — sigue usándose solo desde
 * /historial (modelo viejo, todavía sin reconectar).
 */
export function DetalleGasto({ gastoId, miId, onClose, onEliminado, onPagoRegistrado }: DetalleGastoProps) {
  const router = useRouter()
  const [visible, setVisible] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [gasto, setGasto] = useState<GastoDetalleCompleto | null>(null)
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false)
  const [eliminando, setEliminando] = useState(false)
  const [mostrarPago, setMostrarPago] = useState(false)
  const sheetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    let activo = true
    obtenerGastoConDivisiones(gastoId).then(g => {
      if (!activo) return
      setGasto(g)
      setCargando(false)
    })
    return () => { activo = false }
  }, [gastoId])

  function cerrar() {
    setVisible(false)
    setTimeout(onClose, 280)
  }

  async function handleEliminar() {
    setEliminando(true)
    const result = await eliminarGasto(gastoId)
    setEliminando(false)
    if (result.ok) {
      cerrar()
      setTimeout(onEliminado, 320)
    }
  }

  if (cargando || !gasto) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(26,26,30,0.45)' }} />
    )
  }

  const fecha = new Date(gasto.fecha + 'T12:00:00')
  const fechaFormateada = fecha.toLocaleDateString('es-CL', {
    weekday: 'short', day: 'numeric', month: 'short',
  }).replace(/^\w/, c => c.toUpperCase())

  const miDivision = gasto.divisiones.find(d => d.usuario_id === miId)
  const yoPague = gasto.pagado_por === miId
  const puedoMarcarPagada = !!miDivision && !miDivision.saldado && !yoPague

  return (
    <>
      <div
        onClick={cerrar}
        style={{
          position: 'fixed', inset: 0, zIndex: 60,
          background: 'rgba(26,26,30,0.45)',
          opacity: visible ? 1 : 0,
          transition: 'opacity 280ms ease',
        }}
      />

      <div
        ref={sheetRef}
        style={{
          position: 'fixed',
          bottom: 0, left: 0, right: 0,
          zIndex: 70,
          background: 'var(--color-surface-white)',
          borderRadius: '24px 24px 0 0',
          maxHeight: '90vh',
          overflowY: 'auto',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 280ms cubic-bezier(0.32, 0.72, 0, 1)',
          paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--color-border)' }} />
        </div>

        <div style={{ padding: '12px 20px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <button
              onClick={cerrar}
              aria-label="Cerrar"
              style={{
                width: 42, height: 42, borderRadius: 13, padding: 0,
                background: 'var(--color-surface-white)', border: '1px solid var(--color-border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', flexShrink: 0,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M11 4l-5 5 5 5" stroke="var(--color-text-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <h2 style={{
              flex: 1, margin: 0, fontSize: 19, fontWeight: 700, color: 'var(--color-text-primary)',
              fontFamily: 'var(--font-sora), sans-serif', letterSpacing: '-0.01em',
            }}>
              Detalle del gasto
            </h2>
            {!confirmandoEliminar && (
              <button
                onClick={() => setConfirmandoEliminar(true)}
                aria-label="Eliminar gasto"
                style={{
                  width: 38, height: 38, borderRadius: 13, padding: 0,
                  background: 'var(--color-surface-white)', border: '1px solid var(--color-border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', flexShrink: 0,
                }}
              >
                <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
                  <path d="M4 6h12M8 6V4.5A1.5 1.5 0 019.5 3h1A1.5 1.5 0 0112 4.5V6m2 0v10a1 1 0 01-1 1H7a1 1 0 01-1-1V6" stroke="var(--color-negative)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}
          </div>

          <div style={{ textAlign: 'center', padding: '8px 0 22px' }}>
            <div style={{
              width: 60, height: 60, borderRadius: 18, background: 'var(--tint-cta)',
              fontSize: 28, margin: '0 auto 14px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {CATEGORIA_EMOJI[gasto.categoria] ?? '📦'}
            </div>
            <div style={{ fontFamily: 'var(--font-sora), sans-serif', fontSize: 36, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--color-text-primary)' }}>
              {formatCLP(gasto.monto_total)}
            </div>
            <p style={{ margin: '6px 0 0', fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
              {gasto.descripcion}
            </p>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10,
              background: 'var(--tint-cta)', border: '1px solid var(--border-cta)', borderRadius: 100,
              padding: '5px 12px', fontSize: 12.5, fontWeight: 600, color: 'var(--color-cta-dark)',
            }}>
              {CATEGORIA_EMOJI[gasto.categoria] ?? '📦'} {CATEGORIA_LABEL[gasto.categoria]}
            </div>
          </div>

          <div style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 18, padding: '4px 16px', marginBottom: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 0', borderBottom: '1px solid var(--color-divider)' }}>
              <Avatar nombre={gasto.pagador?.nombre ?? '?'} color={gasto.pagador?.avatar_color ?? '#A8D8B9'} size={38} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
                  Pagado por {yoPague ? 'ti' : gasto.pagador?.nombre}
                </p>
              </div>
              <span style={{ fontFamily: 'var(--font-sora), sans-serif', fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                {formatCLP(gasto.monto_total)}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 0' }}>
              <div style={{ width: 38, height: 38, borderRadius: 13, background: 'var(--color-icon-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                  <rect x="3" y="4" width="14" height="13" rx="2.5" stroke="var(--color-neutral)" strokeWidth="1.5" />
                  <path d="M3 8h14M7 2.5v3M13 2.5v3" stroke="var(--color-neutral)" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <p style={{ flex: 1, margin: 0, fontSize: 13.5, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
                Fecha
              </p>
              <span style={{ fontSize: 13, color: 'var(--color-text-secondary)', fontWeight: 500, fontFamily: 'var(--font-dm-sans), sans-serif' }}>
                {fechaFormateada}
              </span>
            </div>
          </div>

          <p style={{
            margin: '0 2px 10px', fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)',
            fontFamily: 'var(--font-dm-sans), sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>
            División · {gasto.divisiones.length} participantes
          </p>

          <div style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 18, padding: '4px 16px', marginBottom: 24 }}>
            {gasto.divisiones
              .slice()
              .sort((a, b) => b.monto_asignado - a.monto_asignado)
              .map((div, idx, arr) => {
                const esYo = div.usuario_id === miId
                const esPagador = div.usuario_id === gasto.pagado_por
                const pill = esPagador
                  ? { label: 'Pagó', color: 'var(--color-positive)', tint: 'var(--color-positive-tint)', border: 'var(--color-positive-border)' }
                  : div.saldado
                  ? { label: 'Saldado', color: 'var(--color-neutral)', tint: 'var(--color-neutral-tint)', border: 'var(--color-neutral-border)' }
                  : { label: 'Debe', color: 'var(--color-negative)', tint: 'var(--color-negative-tint)', border: 'var(--color-negative-border)' }
                return (
                  <div key={div.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0',
                    borderBottom: idx === arr.length - 1 ? 'none' : '1px solid var(--color-divider)',
                  }}>
                    <Avatar nombre={div.usuario?.nombre ?? '?'} color={div.usuario?.avatar_color ?? '#A8D8B9'} size={34} />
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
                      {esYo ? 'Tú' : div.usuario?.nombre}
                    </span>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5, marginRight: 10,
                      border: `1px solid ${pill.border}`, background: pill.tint, borderRadius: 100, padding: '3px 9px',
                    }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: pill.color }}>{pill.label}</span>
                    </span>
                    <span style={{ fontFamily: 'var(--font-sora), sans-serif', fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                      {formatCLP(div.monto_asignado)}
                    </span>
                  </div>
                )
              })}
          </div>

          {miDivision && (
            <p style={{ margin: '-12px 2px 24px', fontSize: 12, color: 'var(--color-text-muted)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
              Tu parte: <strong style={{ color: yoPague ? 'var(--color-positive)' : 'var(--color-negative)' }}>{formatCLP(miDivision.monto_asignado)}</strong>
            </p>
          )}

          {!confirmandoEliminar && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {puedoMarcarPagada && (
                <button
                  onClick={() => setMostrarPago(true)}
                  style={{
                    width: '100%', height: 54, borderRadius: 15, border: 'none',
                    background: 'var(--gradient-cta)', color: 'white',
                    fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-dm-sans), sans-serif',
                    cursor: 'pointer', boxShadow: 'var(--shadow-cta)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M4 10l4 4 8-9" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  Marcar mi parte como pagada
                </button>
              )}
              <button
                onClick={() => router.push(`/gastos/${gasto.id}/editar`)}
                style={{
                  width: '100%', height: 54, borderRadius: 15, border: '1px solid var(--color-border)',
                  background: 'var(--color-surface-white)', color: 'var(--color-text-primary)',
                  fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-dm-sans), sans-serif',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M4 13.5V16h2.5l8-8-2.5-2.5-8 8z" stroke="var(--color-text-primary)" strokeWidth="1.6" strokeLinejoin="round" /></svg>
                Editar gasto
              </button>
            </div>
          )}

          {confirmandoEliminar && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ margin: 0, fontSize: 14, textAlign: 'center', color: 'var(--color-text-primary)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
                ¿Segura? Esto no se puede deshacer.
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setConfirmandoEliminar(false)}
                  style={{
                    flex: 1, height: 48, borderRadius: 100, border: '1px solid var(--color-border)',
                    background: 'var(--color-surface-white)', color: 'var(--color-text-primary)',
                    fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-dm-sans), sans-serif', cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleEliminar}
                  disabled={eliminando}
                  style={{
                    flex: 1, height: 48, borderRadius: 100, border: 'none',
                    background: 'var(--color-negative)', color: 'white',
                    fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-dm-sans), sans-serif', cursor: 'pointer',
                    opacity: eliminando ? 0.6 : 1,
                  }}
                >
                  {eliminando ? 'Eliminando…' : 'Sí, eliminar'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {mostrarPago && miDivision && gasto.pagador && (
        <RegistrarPago
          miId={miId}
          contraparte={gasto.pagador}
          divisiones={[{
            division_id: miDivision.id,
            gasto_id: gasto.id,
            descripcion: gasto.descripcion,
            fecha: gasto.fecha,
            monto_asignado: miDivision.monto_asignado,
            grupo_id: gasto.grupo_id,
          }]}
          onCerrar={() => setMostrarPago(false)}
          onConfirmado={() => {
            setMostrarPago(false)
            cerrar()
            setTimeout(onPagoRegistrado, 320)
          }}
        />
      )}
    </>
  )
}
