'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from '@/lib/session-store'
import {
  obtenerCuentaCompartida,
  listarItems,
  listarParticipantes,
  listarConsumoPorItems,
  calcularResumenFinal,
  hayItemsSinAsignar,
  personasQueGeneranDeuda,
  cerrarCuentaCompartida,
  type ParticipanteDetalle,
} from '@/lib/cuentas-compartidas'
import { ResumenPersonas } from '@/components/app/ResumenPersonas'
import { Toast } from '@/components/app/Toast'
import type { CuentaCompartida, CuentaCompartidaItem, CuentaCompartidaConsumo } from '@/types/database'

export default function CierreCuentaCompartidaPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const { sesion } = useSession()

  const [cuenta, setCuenta] = useState<CuentaCompartida | null>(null)
  const [items, setItems] = useState<CuentaCompartidaItem[]>([])
  const [participantes, setParticipantes] = useState<ParticipanteDetalle[]>([])
  const [consumo, setConsumo] = useState<CuentaCompartidaConsumo[]>([])
  const [cargando, setCargando] = useState(true)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [cerrando, setCerrando] = useState(false)
  const [toast, setToast] = useState<{ mensaje: string; tipo: 'exito' | 'error' } | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    const cuentaData = await obtenerCuentaCompartida(id)
    const [itemsData, participantesData] = await Promise.all([
      listarItems(id),
      listarParticipantes(id),
    ])
    const consumoData = await listarConsumoPorItems(itemsData.map(i => i.id))

    setCuenta(cuentaData)
    setItems(itemsData)
    setParticipantes(participantesData)
    setConsumo(consumoData)
    setCargando(false)
  }, [id])

  useEffect(() => { cargar() }, [cargar])

  const resumen = useMemo(
    () => calcularResumenFinal(items, consumo, participantes, cuenta?.monto_propina ?? 0),
    [items, consumo, participantes, cuenta]
  )

  const asignacionIncompleta = useMemo(() => hayItemsSinAsignar(items, consumo), [items, consumo])

  const deudores = useMemo(
    () => cuenta ? personasQueGeneranDeuda(resumen, cuenta.pagado_por) : [],
    [resumen, cuenta]
  )

  const yaCerrada = cuenta?.estado === 'cerrada'
  const puedeCerrar = !yaCerrada && !asignacionIncompleta && deudores.length > 0

  const pagador = participantes.find(p => p.integrante.id === cuenta?.pagado_por)?.integrante

  async function handleConfirmarCierre() {
    if (!cuenta || !sesion) return
    setCerrando(true)
    const result = await cerrarCuentaCompartida(cuenta, resumen, sesion.integrante_id)
    setCerrando(false)

    if (!result.ok) {
      setModalAbierto(false)
      setToast({ mensaje: result.error, tipo: 'error' })
      return
    }

    setModalAbierto(false)
    setToast({ mensaje: '¡Cuenta cerrada! Se generaron las deudas.', tipo: 'exito' })
    setTimeout(() => router.push('/cuentas-compartidas'), 1000)
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
              {yaCerrada && ' · Cerrada'}
            </p>
            <h1 style={{
              margin: '2px 0 0', fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)',
              fontFamily: 'var(--font-lora), serif',
            }}>
              Cerrar cuenta
            </h1>
          </div>
        </header>

        <main style={{ padding: '0 var(--page-px)' }}>

          {cargando && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[80, 90, 90, 56].map((h, i) => (
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
              {yaCerrada && (
                <div style={{ background: 'var(--color-card)', borderRadius: 16, padding: '14px 16px', marginBottom: 20 }}>
                  <p style={{
                    margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--color-positive)',
                    fontFamily: 'var(--font-dm-sans), sans-serif', lineHeight: 1.5,
                  }}>
                    ✅ Esta cuenta ya fue cerrada — las deudas ya se generaron.
                  </p>
                </div>
              )}

              {!yaCerrada && asignacionIncompleta && (
                <div style={{ background: '#FFF3CD', borderRadius: 16, padding: '14px 16px', marginBottom: 20 }}>
                  <p style={{
                    margin: '0 0 8px', fontSize: 13, fontWeight: 500, color: '#633806',
                    fontFamily: 'var(--font-dm-sans), sans-serif', lineHeight: 1.5,
                  }}>
                    ⚠️ Hay items sin asignar completamente. Completá la asignación antes de cerrar la cuenta.
                  </p>
                  <button
                    onClick={() => router.push(`/cuentas-compartidas/${id}/asignacion`)}
                    style={{
                      height: 34, padding: '0 14px', borderRadius: 100, border: 'none',
                      background: 'rgba(99,56,6,0.12)', color: '#633806',
                      fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-dm-sans), sans-serif', cursor: 'pointer',
                    }}
                  >
                    Revisar asignación →
                  </button>
                </div>
              )}

              {!yaCerrada && !asignacionIncompleta && deudores.length === 0 && (
                <div style={{ background: 'var(--color-card)', borderRadius: 16, padding: '14px 16px', marginBottom: 20 }}>
                  <p style={{
                    margin: 0, fontSize: 13, color: 'var(--color-text-secondary)',
                    fontFamily: 'var(--font-dm-sans), sans-serif', lineHeight: 1.5,
                  }}>
                    No hay deudas que generar: nadie más participa en esta cuenta aparte de {pagador?.nombre ?? 'quien pagó'}.
                  </p>
                </div>
              )}

              <p style={{
                margin: '0 0 10px 4px', fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)',
                fontFamily: 'var(--font-dm-sans), sans-serif',
                textTransform: 'uppercase', letterSpacing: '0.08em',
              }}>
                Resumen final
              </p>

              <div style={{ marginBottom: 20 }}>
                <ResumenPersonas personas={resumen.personas} nombresExentos={resumen.nombresExentos} />
              </div>

              {!yaCerrada && (
                <>
                  <p style={{
                    margin: '0 0 20px', fontSize: 12, lineHeight: 1.5, color: 'var(--color-text-secondary)',
                    fontFamily: 'var(--font-dm-sans), sans-serif',
                  }}>
                    Cerrar la cuenta es una acción irreversible: genera las deudas reales hacia {pagador?.nombre ?? 'quien pagó'} y bloquea la edición de items, consumo, exentos y propina de esta cuenta compartida.
                  </p>

                  <button
                    onClick={() => setModalAbierto(true)}
                    disabled={!puedeCerrar}
                    style={{
                      width: '100%', height: 56, borderRadius: 100, border: 'none',
                      background: puedeCerrar ? 'var(--color-cta)' : 'var(--color-border)',
                      color: puedeCerrar ? 'white' : 'var(--color-text-disabled)',
                      fontSize: 16, fontWeight: 600,
                      fontFamily: 'var(--font-dm-sans), sans-serif',
                      cursor: puedeCerrar ? 'pointer' : 'not-allowed',
                    }}
                  >
                    Cerrar cuenta y generar deudas
                  </button>
                </>
              )}
            </>
          )}
        </main>
      </div>

      {/* Modal de confirmación */}
      {modalAbierto && cuenta && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(28,43,26,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20,
          }}
        >
          <div style={{
            background: 'var(--color-surface-white)', borderRadius: 24, padding: 24,
            maxWidth: 340, width: '100%',
          }}>
            <p style={{
              margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)',
              fontFamily: 'var(--font-lora), serif',
            }}>
              ¿Cerrar esta cuenta?
            </p>
            <p style={{
              margin: '0 0 24px', fontSize: 14, lineHeight: 1.5, color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-dm-sans), sans-serif',
            }}>
              Se generarán las deudas hacia {pagador?.nombre ?? 'quien pagó'}. Esta acción no se puede deshacer.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setModalAbierto(false)}
                disabled={cerrando}
                style={{
                  flex: 1, height: 48, borderRadius: 100, border: 'none',
                  background: 'var(--color-card)', color: 'var(--color-text-primary)',
                  fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-dm-sans), sans-serif',
                  cursor: cerrando ? 'not-allowed' : 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmarCierre}
                disabled={cerrando}
                style={{
                  flex: 1, height: 48, borderRadius: 100, border: 'none',
                  background: 'var(--color-cta)', color: 'white',
                  fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-dm-sans), sans-serif',
                  cursor: cerrando ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  opacity: cerrando ? 0.7 : 1,
                }}
              >
                {cerrando && <span className="spinner" aria-hidden="true" />}
                {cerrando ? 'Cerrando…' : 'Sí, cerrar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <Toast mensaje={toast.mensaje} tipo={toast.tipo} onClose={() => setToast(null)} />
      )}
    </div>
  )
}
