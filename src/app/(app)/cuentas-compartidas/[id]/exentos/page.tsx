'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  obtenerCuentaCompartida,
  listarParticipantes,
  actualizarExento,
  type ParticipanteDetalle,
} from '@/lib/cuentas-compartidas'
import { Avatar } from '@/components/app/Avatar'
import { Toast } from '@/components/app/Toast'
import type { CuentaCompartida } from '@/types/database'

// ── Toggle ───────────────────────────────────────────────────

function Toggle({ activo, disabled, onClick, label }: { activo: boolean; disabled: boolean; onClick: () => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={activo}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 44, height: 26, borderRadius: 100, border: 'none',
        background: activo ? 'var(--color-cta)' : 'var(--color-border)',
        position: 'relative', flexShrink: 0,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        transition: 'background 150ms ease',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: 'absolute', top: 3, left: activo ? 21 : 3,
          width: 20, height: 20, borderRadius: '50%',
          background: 'white',
          transition: 'left 150ms ease',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }}
      />
    </button>
  )
}

// ── Página principal ─────────────────────────────────────────

export default function ExentosCuentaCompartidaPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()

  const [cuenta, setCuenta] = useState<CuentaCompartida | null>(null)
  const [participantes, setParticipantes] = useState<ParticipanteDetalle[]>([])
  const [cargando, setCargando] = useState(true)
  const [actualizandoId, setActualizandoId] = useState<string | null>(null)
  const [continuando, setContinuando] = useState(false)
  const [toast, setToast] = useState<{ mensaje: string; tipo: 'exito' | 'error' } | null>(null)

  const soloLectura = cuenta?.estado === 'cerrada'
  const todosExentos = participantes.length > 0 && participantes.every(p => p.es_exento)

  const cargar = useCallback(async () => {
    setCargando(true)
    const [cuentaData, participantesData] = await Promise.all([
      obtenerCuentaCompartida(id),
      listarParticipantes(id),
    ])
    setCuenta(cuentaData)
    setParticipantes(participantesData)
    setCargando(false)
  }, [id])

  useEffect(() => { cargar() }, [cargar])

  async function handleToggle(participante: ParticipanteDetalle) {
    if (soloLectura) return
    const nuevoValor = !participante.es_exento

    setParticipantes(prev => prev.map(p => p.id === participante.id ? { ...p, es_exento: nuevoValor } : p))
    setActualizandoId(participante.id)
    const result = await actualizarExento(participante.id, nuevoValor)
    setActualizandoId(null)

    if (!result.ok) {
      setParticipantes(prev => prev.map(p => p.id === participante.id ? { ...p, es_exento: !nuevoValor } : p))
      setToast({ mensaje: result.error, tipo: 'error' })
    }
  }

  function handleContinuar() {
    if (todosExentos) {
      setToast({ mensaje: 'No pueden estar todas exentas — no quedaría quién pague.', tipo: 'error' })
      return
    }
    setContinuando(true)
    router.push(`/cuentas-compartidas/${id}/cierre`)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', paddingBottom: 40 }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>

        {/* Header */}
        <header style={{
          paddingTop: 'max(56px, calc(env(safe-area-inset-top, 0px) + 16px))',
          paddingBottom: 20,
          paddingLeft: 'var(--page-px)',
          paddingRight: 'var(--page-px)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <button
            onClick={() => router.back()}
            aria-label="Volver"
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

          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-dm-sans), sans-serif',
              textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>
              {cargando ? 'Cargando…' : (cuenta?.nombre ?? 'Cuenta no encontrada')}
              {soloLectura && ' · Cerrada'}
            </p>
            <h1 style={{
              margin: '2px 0 0', fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)',
              fontFamily: 'var(--font-lora), serif',
            }}>
              Marcar exentos
            </h1>
          </div>
        </header>

        <main style={{ padding: '0 var(--page-px)' }}>

          {cargando && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[64, 64, 64].map((h, i) => (
                <div key={i} className="skeleton" style={{ height: h, borderRadius: 16 }} />
              ))}
            </div>
          )}

          {!cargando && !cuenta && (
            <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
              No se encontró esta cuenta compartida.
            </p>
          )}

          {!cargando && cuenta && (
            <>
              <p style={{
                margin: '0 0 20px', fontSize: 13, lineHeight: 1.5, color: 'var(--color-text-secondary)',
                fontFamily: 'var(--font-dm-sans), sans-serif',
              }}>
                Si alguien no debe pagar esta cuenta (ej. la cumpleañera), márcala acá. Su consumo se reparte en partes iguales entre el resto de los participantes.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                {participantes.map(p => (
                  <div
                    key={p.id}
                    style={{
                      background: 'var(--color-card)', borderRadius: 16, padding: '12px 16px',
                      display: 'flex', alignItems: 'center', gap: 12,
                      opacity: actualizandoId === p.id ? 0.7 : 1,
                    }}
                  >
                    <Avatar nombre={p.integrante.nombre} color={p.integrante.avatar_color} size={36} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)',
                        fontFamily: 'var(--font-dm-sans), sans-serif',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {p.integrante.nombre}
                      </p>
                      <p style={{
                        margin: '2px 0 0', fontSize: 12, color: 'var(--color-text-secondary)',
                        fontFamily: 'var(--font-dm-sans), sans-serif',
                      }}>
                        {p.es_exento ? 'No paga esta cuenta' : 'Paga su parte'}
                      </p>
                    </div>
                    <Toggle
                      activo={p.es_exento}
                      disabled={!!soloLectura || actualizandoId === p.id}
                      onClick={() => handleToggle(p)}
                      label={`No paga esta cuenta — ${p.integrante.nombre}`}
                    />
                  </div>
                ))}
              </div>

              {todosExentos && (
                <div style={{
                  background: '#FFF3CD', borderRadius: 16, padding: '14px 16px', marginBottom: 20,
                }}>
                  <p style={{
                    margin: 0, fontSize: 13, fontWeight: 500, color: '#633806',
                    fontFamily: 'var(--font-dm-sans), sans-serif', lineHeight: 1.5,
                  }}>
                    ⚠️ Marcaste a todas como exentas — no quedaría nadie a quién repartirle el consumo. Desmarca al menos a una persona para continuar.
                  </p>
                </div>
              )}

              {/* CTA Continuar */}
              <button
                onClick={handleContinuar}
                disabled={continuando || todosExentos}
                style={{
                  width: '100%', height: 56, borderRadius: 100, border: 'none',
                  background: (continuando || todosExentos) ? 'var(--color-cta-dark)' : 'var(--color-cta)',
                  color: 'white', fontSize: 16, fontWeight: 600,
                  fontFamily: 'var(--font-dm-sans), sans-serif',
                  cursor: (continuando || todosExentos) ? 'not-allowed' : 'pointer',
                  opacity: todosExentos ? 0.6 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                }}
              >
                {continuando && <span className="spinner" aria-hidden="true" />}
                {continuando ? 'Cargando…' : 'Continuar →'}
              </button>
            </>
          )}
        </main>
      </div>

      {toast && (
        <Toast mensaje={toast.mensaje} tipo={toast.tipo} onClose={() => setToast(null)} />
      )}
    </div>
  )
}
