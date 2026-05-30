'use client'

import { useEffect, useRef, useState } from 'react'
import { Avatar } from '@/components/app/Avatar'
import { formatCLP } from '@/lib/format'
import { eliminarGasto } from '@/lib/gastos'
import { CATEGORIA_EMOJI, CATEGORIA_LABEL } from '@/types/database'
import type { GastoResumen } from '@/lib/historial'

interface GastoDetalleProps {
  gasto: GastoResumen
  miId: string
  onClose: () => void
  onEliminado: () => void
}

export function GastoDetalle({ gasto, miId, onClose, onEliminado }: GastoDetalleProps) {
  const [visible, setVisible] = useState(false)
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false)
  const [eliminando, setEliminando] = useState(false)
  const sheetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10)
    return () => clearTimeout(t)
  }, [])

  function cerrar() {
    setVisible(false)
    setTimeout(onClose, 280)
  }

  async function handleEliminar() {
    setEliminando(true)
    const result = await eliminarGasto(gasto.id)
    setEliminando(false)
    if (result.ok) {
      cerrar()
      setTimeout(onEliminado, 320)
    }
  }

  const fecha = new Date(gasto.fecha + 'T12:00:00')
  const fechaFormateada = fecha.toLocaleDateString('es-CL', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).replace(/^\w/, c => c.toUpperCase())

  const yo = gasto.divisiones.find(d => d.integrante?.id === miId)
  const yoPague = gasto.pagador?.id === miId

  return (
    <>
      {/* Overlay */}
      <div
        onClick={cerrar}
        style={{
          position: 'fixed', inset: 0, zIndex: 60,
          background: 'rgba(0,0,0,0.4)',
          opacity: visible ? 1 : 0,
          transition: 'opacity 280ms ease',
        }}
      />

      {/* Bottom sheet */}
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
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 8px' }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--color-border)' }} />
        </div>

        <div style={{ padding: '8px 20px 0' }}>
          {/* Cabecera */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <span style={{ fontSize: 28 }}>
                  {CATEGORIA_EMOJI[gasto.categoria] ?? '📦'}
                </span>
                <h2 style={{
                  margin: 0,
                  fontSize: 20,
                  fontWeight: 700,
                  color: 'var(--color-text-primary)',
                  fontFamily: 'var(--font-lora), serif',
                  lineHeight: 1.2,
                }}>
                  {gasto.descripcion}
                </h2>
              </div>
              <p style={{
                margin: 0,
                fontSize: 12,
                color: 'var(--color-text-secondary)',
                fontFamily: 'var(--font-dm-sans), sans-serif',
                textTransform: 'capitalize',
              }}>
                {CATEGORIA_LABEL[gasto.categoria]} · {fechaFormateada}
              </p>
            </div>
            <button onClick={cerrar} style={{
              background: 'var(--color-card)',
              border: 'none',
              borderRadius: 10,
              width: 32, height: 32,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0, marginLeft: 12,
            }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 2l10 10M12 2L2 12" stroke="var(--color-text-secondary)" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Monto total */}
          <div style={{
            background: 'var(--color-card)',
            borderRadius: 18,
            padding: '14px 18px',
            marginBottom: 16,
          }}>
            <p style={{
              margin: 0,
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-dm-sans), sans-serif',
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
            }}>
              Total del gasto
            </p>
            <p style={{
              margin: '4px 0 0',
              fontSize: 28,
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              fontFamily: 'var(--font-lora), serif',
            }}>
              {formatCLP(gasto.monto_total)}
            </p>
          </div>

          {/* Quién pagó */}
          <div style={{
            background: 'var(--color-card)',
            borderRadius: 18,
            padding: '14px 16px',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}>
            <Avatar
              nombre={gasto.pagador?.nombre ?? '?'}
              color={gasto.pagador?.avatar_color ?? '#A8D8B9'}
              size={40}
            />
            <div>
              <p style={{
                margin: 0,
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--color-text-secondary)',
                fontFamily: 'var(--font-dm-sans), sans-serif',
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
              }}>
                Pagó
              </p>
              <p style={{
                margin: '2px 0 0',
                fontSize: 15,
                fontWeight: 600,
                color: 'var(--color-text-primary)',
                fontFamily: 'var(--font-dm-sans), sans-serif',
              }}>
                {yoPague ? 'Tú' : gasto.pagador?.nombre}
              </p>
            </div>

            {/* Mi parte */}
            {yo && (
              <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                <p style={{
                  margin: 0,
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--color-text-secondary)',
                  fontFamily: 'var(--font-dm-sans), sans-serif',
                  textTransform: 'uppercase',
                  letterSpacing: '0.07em',
                }}>
                  Tu parte
                </p>
                <p style={{
                  margin: '2px 0 0',
                  fontSize: 16,
                  fontWeight: 700,
                  color: yoPague ? 'var(--color-positive)' : 'var(--color-negative)',
                  fontFamily: 'var(--font-dm-sans), sans-serif',
                }}>
                  {formatCLP(yo.monto_asignado)}
                </p>
              </div>
            )}
          </div>

          {/* División completa */}
          <p style={{
            margin: '0 4px 10px',
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--color-text-secondary)',
            fontFamily: 'var(--font-dm-sans), sans-serif',
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
          }}>
            División ({gasto.divisiones.length} participantes)
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
            {gasto.divisiones
              .slice()
              .sort((a, b) => b.monto_asignado - a.monto_asignado)
              .map(div => {
                const esYo = div.integrante?.id === miId
                const esPagador = div.integrante?.id === gasto.pagador?.id
                return (
                  <div key={div.integrante?.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    background: esYo ? 'var(--color-card)' : 'transparent',
                    borderRadius: 14,
                    padding: esYo ? '10px 14px' : '4px 14px',
                  }}>
                    <Avatar
                      nombre={div.integrante?.nombre ?? '?'}
                      color={div.integrante?.avatar_color ?? '#A8D8B9'}
                      size={34}
                    />
                    <span style={{
                      flex: 1,
                      fontSize: 14,
                      fontWeight: esYo ? 600 : 400,
                      color: 'var(--color-text-primary)',
                      fontFamily: 'var(--font-dm-sans), sans-serif',
                    }}>
                      {esYo ? 'Tú' : div.integrante?.nombre}
                      {esPagador && (
                        <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--color-positive)', fontWeight: 600 }}>
                          · pagó
                        </span>
                      )}
                    </span>
                    <span style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: esYo
                        ? (yoPague ? 'var(--color-positive)' : 'var(--color-negative)')
                        : 'var(--color-text-primary)',
                      fontFamily: 'var(--font-dm-sans), sans-serif',
                    }}>
                      {formatCLP(div.monto_asignado)}
                    </span>
                  </div>
                )
              })}
          </div>

          {/* Acciones */}
          {!confirmandoEliminar ? (
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setConfirmandoEliminar(true)}
                style={{
                  flex: 1,
                  height: 48,
                  borderRadius: 100,
                  border: 'none',
                  background: 'var(--color-card)',
                  color: 'var(--color-negative)',
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: 'var(--font-dm-sans), sans-serif',
                  cursor: 'pointer',
                }}
              >
                Eliminar
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{
                margin: 0,
                fontSize: 14,
                textAlign: 'center',
                color: 'var(--color-text-primary)',
                fontFamily: 'var(--font-dm-sans), sans-serif',
              }}>
                ¿Segura? Esto no se puede deshacer.
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setConfirmandoEliminar(false)}
                  style={{
                    flex: 1, height: 48, borderRadius: 100, border: 'none',
                    background: 'var(--color-card)',
                    color: 'var(--color-text-primary)',
                    fontSize: 14, fontWeight: 600,
                    fontFamily: 'var(--font-dm-sans), sans-serif', cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleEliminar}
                  disabled={eliminando}
                  style={{
                    flex: 1, height: 48, borderRadius: 100, border: 'none',
                    background: 'var(--color-negative)',
                    color: 'white',
                    fontSize: 14, fontWeight: 600,
                    fontFamily: 'var(--font-dm-sans), sans-serif', cursor: 'pointer',
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
    </>
  )
}
