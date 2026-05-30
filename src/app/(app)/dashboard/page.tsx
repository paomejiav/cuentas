'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSession } from '@/lib/session-store'
import { calcularSaldos, type SaldoPar } from '@/lib/saldos'
import { formatCLP } from '@/lib/format'
import { Avatar } from '@/components/app/Avatar'
import { BottomNav } from '@/components/app/BottomNav'
import { Toast } from '@/components/app/Toast'
import { supabase } from '@/lib/supabase'

// ── Skeleton con shimmer ─────────────────────────────────────
function SkeletonCard() {
  return (
    <div
      aria-hidden="true"
      style={{
        borderRadius: 20, padding: '14px 16px',
        display: 'flex', alignItems: 'center', gap: 14,
        background: 'var(--color-card)',
      }}
    >
      <div className="skeleton" style={{ width: 44, height: 44, borderRadius: '50%', flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
        <div className="skeleton" style={{ height: 14, width: '38%', borderRadius: 6 }} />
        <div className="skeleton" style={{ height: 12, width: '54%', borderRadius: 6 }} />
      </div>
      <div className="skeleton" style={{ height: 14, width: 48, borderRadius: 6 }} />
    </div>
  )
}

// ── Estado vacío (cero gastos en el grupo) ───────────────────
function EstadoVacio() {
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px' }}>
      <div style={{ fontSize: 52, marginBottom: 12 }}>🧾</div>
      <p style={{
        margin: 0, fontSize: 18, fontWeight: 700,
        color: 'var(--color-text-primary)',
        fontFamily: 'var(--font-lora), serif',
      }}>
        Todavía no hay gastos
      </p>
      <p style={{
        margin: '8px 0 24px', fontSize: 14,
        color: 'var(--color-text-secondary)',
        fontFamily: 'var(--font-dm-sans), sans-serif',
        lineHeight: 1.5,
      }}>
        Agrega el primer gasto del grupo y los saldos aparecerán aquí automáticamente.
      </p>
      <Link
        href="/gastos/nuevo"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '14px 28px', borderRadius: 100,
          background: 'var(--color-cta)', color: 'white',
          textDecoration: 'none',
          fontSize: 15, fontWeight: 600,
          fontFamily: 'var(--font-dm-sans), sans-serif',
        }}
      >
        <span style={{ fontSize: 18 }}>+</span> Agregar primer gasto
      </Link>
    </div>
  )
}

// ── Card de saldo por par ────────────────────────────────────
function SaldoCard({
  par, onClick, animDelay,
}: {
  par: SaldoPar; onClick: () => void; animDelay: number
}) {
  const { neto, integrante } = par

  const etiqueta =
    neto > 0 ? `Te debe ${formatCLP(neto)}`
    : neto < 0 ? `Le debes ${formatCLP(-neto)}`
    : 'Sin deudas ✓'

  const colorEtiqueta =
    neto > 0 ? 'var(--color-positive)'
    : neto < 0 ? 'var(--color-negative)'
    : 'var(--color-text-secondary)'

  return (
    <button
      onClick={onClick}
      aria-label={`${integrante.nombre}: ${etiqueta}`}
      className="list-item-enter saldo-card"
      style={{
        background: 'var(--color-card)', borderRadius: 20,
        padding: '14px 16px', border: 'none', width: '100%',
        display: 'flex', alignItems: 'center', gap: 14,
        cursor: 'pointer', textAlign: 'left',
        transition: 'transform 120ms ease, background 120ms ease',
        WebkitTapHighlightColor: 'transparent',
        animationDelay: `${animDelay}ms`,
      }}
      onPointerDown={e => (e.currentTarget.style.transform = 'scale(0.97)')}
      onPointerUp={e => (e.currentTarget.style.transform = 'scale(1)')}
      onPointerLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
    >
      <Avatar nombre={integrante.nombre} color={integrante.avatar_color} size={44} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          margin: 0, fontSize: 15, fontWeight: 600,
          color: 'var(--color-text-primary)',
          fontFamily: 'var(--font-dm-sans), sans-serif',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {integrante.nombre}
        </p>
        <p style={{
          margin: '2px 0 0', fontSize: 13,
          fontWeight: neto === 0 ? 400 : 600,
          color: colorEtiqueta,
          fontFamily: 'var(--font-dm-sans), sans-serif',
        }}>
          {etiqueta}
        </p>
      </div>

      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
        aria-hidden="true" style={{ flexShrink: 0, opacity: 0.5 }}>
        <path d="M6 4l4 4-4 4" stroke="var(--color-text-primary)"
          strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}

// ── Resumen de deuda total ────────────────────────────────────
function ResumenDeuda({ saldos }: { saldos: SaldoPar[] }) {
  const totalQueTeDeban = saldos.filter(s => s.neto > 0).reduce((acc, s) => acc + s.neto, 0)
  const totalQueDebes   = saldos.filter(s => s.neto < 0).reduce((acc, s) => acc + Math.abs(s.neto), 0)

  if (totalQueTeDeban === 0 && totalQueDebes === 0 && saldos.length > 0) {
    return (
      <div style={{
        background: 'var(--color-card)', borderRadius: 20,
        padding: '20px', textAlign: 'center', marginBottom: 8,
      }}>
        <div style={{ fontSize: 30, marginBottom: 6 }}>🎉</div>
        <p style={{
          margin: 0, fontSize: 15, fontWeight: 600,
          color: 'var(--color-text-primary)',
          fontFamily: 'var(--font-dm-sans), sans-serif',
        }}>
          ¡Todo al día!
        </p>
        <p style={{
          margin: '4px 0 0', fontSize: 13,
          color: 'var(--color-text-secondary)',
          fontFamily: 'var(--font-dm-sans), sans-serif',
        }}>
          Sin deudas pendientes entre el grupo
        </p>
      </div>
    )
  }

  if (totalQueTeDeban === 0 && totalQueDebes === 0) return null

  return (
    <div style={{
      background: 'var(--color-card)', borderRadius: 20,
      padding: '20px 24px', display: 'flex',
      justifyContent: 'space-around', marginBottom: 8,
      gap: 12,
    }}>
      {totalQueDebes > 0 && (
        <div style={{ textAlign: 'center', flex: 1 }}>
          <p style={{
            margin: 0, fontSize: 11, fontWeight: 600,
            color: 'var(--color-text-secondary)',
            fontFamily: 'var(--font-dm-sans), sans-serif',
            textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>
            Debes en total
          </p>
          <p style={{
            margin: '6px 0 0', fontSize: 28, fontWeight: 700,
            color: 'var(--color-negative)',
            fontFamily: 'var(--font-lora), serif',
            lineHeight: 1,
          }}>
            {formatCLP(totalQueDebes)}
          </p>
        </div>
      )}
      {totalQueTeDeban > 0 && totalQueDebes > 0 && (
        <div style={{ width: 1, background: 'var(--color-border)', flexShrink: 0, alignSelf: 'stretch' }} />
      )}
      {totalQueTeDeban > 0 && (
        <div style={{ textAlign: 'center', flex: 1 }}>
          <p style={{
            margin: 0, fontSize: 11, fontWeight: 600,
            color: 'var(--color-text-secondary)',
            fontFamily: 'var(--font-dm-sans), sans-serif',
            textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>
            Te deben en total
          </p>
          <p style={{
            margin: '6px 0 0', fontSize: 28, fontWeight: 700,
            color: 'var(--color-positive)',
            fontFamily: 'var(--font-lora), serif',
            lineHeight: 1,
          }}>
            {formatCLP(totalQueTeDeban)}
          </p>
        </div>
      )}
    </div>
  )
}

// ── Página principal ─────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter()
  const { sesion, loading: sesionLoading, cerrarSesion } = useSession()
  const [saldos, setSaldos] = useState<SaldoPar[]>([])
  const [cargando, setCargando] = useState(true)
  const [tieneGastos, setTieneGastos] = useState(true)
  const [toast, setToast] = useState<{ mensaje: string; tipo: 'exito' | 'error' } | null>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const cargarSaldos = useCallback(async () => {
    if (!sesion) return
    setCargando(true)
    try {
      const resultado = await calcularSaldos(sesion.grupo_id, sesion.integrante_id)
      setSaldos(resultado)

      // Verificar si hay algún gasto (para el estado vacío)
      const { count } = await supabase
        .from('gastos')
        .select('id', { count: 'exact', head: true })
        .eq('grupo_id', sesion.grupo_id)
        .is('mes_cierre', null)
      setTieneGastos((count ?? 0) > 0)
    } catch {
      setToast({ mensaje: 'Sin conexión. Intenta de nuevo.', tipo: 'error' })
    } finally {
      setCargando(false)
    }
  }, [sesion])

  // Suscripción Realtime — escucha inserciones en gastos del grupo
  useEffect(() => {
    if (!sesion) return

    const channel = supabase
      .channel(`gastos-grupo-${sesion.grupo_id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'gastos',
          filter: `grupo_id=eq.${sesion.grupo_id}`,
        },
        payload => {
          const nuevoGasto = payload.new as { creado_por: string; descripcion: string }
          // Si no fui yo quien lo creó, mostrar notificación
          if (nuevoGasto.creado_por !== sesion.integrante_id) {
            // Buscar nombre del integrante
            supabase
              .from('integrantes')
              .select('nombre')
              .eq('id', nuevoGasto.creado_por)
              .single()
              .then(({ data }) => {
                const quien = data?.nombre ?? 'Alguien'
                setToast({
                  mensaje: `${quien} agregó "${nuevoGasto.descripcion}"`,
                  tipo: 'exito',
                })
              })
          }
          // Recargar saldos en ambos casos
          cargarSaldos()
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'gastos', filter: `grupo_id=eq.${sesion.grupo_id}` },
        () => cargarSaldos()
      )
      .subscribe()

    channelRef.current = channel
    return () => { supabase.removeChannel(channel) }
  }, [sesion, cargarSaldos])

  useEffect(() => {
    if (!sesionLoading && !sesion) { router.replace('/login'); return }
    if (sesion) cargarSaldos()
  }, [sesion, sesionLoading, router, cargarSaldos])

  function handleCerrarSesion() {
    if (channelRef.current) supabase.removeChannel(channelRef.current)
    cerrarSesion()
    router.replace('/login')
  }

  if (sesionLoading || !sesion) return null

  const hayDeudas = saldos.some(s => s.neto !== 0)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', paddingBottom: 80 }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>

      {/* ── HEADER ── */}
      <header style={{
        paddingTop: 'max(56px, calc(env(safe-area-inset-top, 0px) + 16px))',
        paddingBottom: 20,
        paddingLeft: 'var(--page-px)',
        paddingRight: 'var(--page-px)',
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', gap: 12,
      }}>
        <div style={{ minWidth: 0 }}>
          <p style={{
            margin: 0, fontSize: 12, fontWeight: 600,
            color: 'var(--color-text-secondary)',
            fontFamily: 'var(--font-dm-sans), sans-serif',
            textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>
            {sesion.grupo_nombre}
          </p>
          <h1 style={{
            margin: '2px 0 0', fontSize: 26, fontWeight: 700,
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-lora), serif',
            lineHeight: 1.2,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            Mis saldos
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <Avatar
            nombre={sesion.nombre}
            color={sesion.avatar_color}
            size={40}
            aria-label={`Avatar de ${sesion.nombre}`}
          />
          <button
            onClick={handleCerrarSesion}
            aria-label="Cerrar sesión"
            style={{
              background: 'var(--color-card)', border: 'none', borderRadius: 12,
              width: 44, height: 44,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M7 3H4a1 1 0 00-1 1v10a1 1 0 001 1h3M11 12l3-3-3-3M14 9H7"
                stroke="var(--color-text-secondary)"
                strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </header>

      {/* ── CONTENIDO ── */}
      <main style={{ padding: '12px var(--page-px) 0' }}>

        {!cargando && tieneGastos && <ResumenDeuda saldos={saldos} />}

        {!cargando && !tieneGastos && <EstadoVacio />}

        {tieneGastos && (
          <>
            <p style={{
              margin: '28px 0 10px', fontSize: 11, fontWeight: 600,
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-dm-sans), sans-serif',
              textTransform: 'uppercase', letterSpacing: '0.09em',
            }}>
              Con cada una
            </p>

            <div
              role="list"
              aria-label="Saldos con cada integrante"
              style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
            >
              {cargando
                ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
                : saldos.map((par, i) => (
                    <div role="listitem" key={par.integrante.id}>
                      <SaldoCard
                        par={par}
                        animDelay={i * 40}
                        onClick={() => router.push(`/historial?persona=${par.integrante.id}`)}
                      />
                    </div>
                  ))
              }
            </div>

            {!cargando && saldos.length > 0 && (
              <p style={{
                margin: '28px 0 0', fontSize: 12,
                color: 'var(--color-text-disabled)',
                fontFamily: 'var(--font-dm-sans), sans-serif',
                textAlign: 'center',
                lineHeight: 1.5,
              }}>
                Solo gastos del período actual · Los meses cerrados no cuentan
              </p>
            )}
          </>
        )}
      </main>

      </div>{/* end max-width wrapper */}

      {/* ── BOTÓN FLOTANTE "+" ── */}
      <Link
        href="/gastos/nuevo"
        aria-label="Agregar nuevo gasto"
        style={{
          position: 'fixed', bottom: 80, right: 20,
          width: 56, height: 56, borderRadius: 18,
          background: 'var(--color-cta)',
          boxShadow: '0 4px 16px rgba(0,200,81,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          textDecoration: 'none', zIndex: 50,
          transition: 'transform 120ms ease',
        }}
        onPointerDown={e => (e.currentTarget.style.transform = 'scale(0.93)')}
        onPointerUp={e => (e.currentTarget.style.transform = 'scale(1)')}
        onPointerLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </Link>

      <BottomNav />

      {toast && (
        <Toast mensaje={toast.mensaje} tipo={toast.tipo} onClose={() => setToast(null)} />
      )}
    </div>
  )
}
