'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSession } from '@/lib/session-store'
import { listarCuentasCompartidas, type CuentaCompartidaResumen } from '@/lib/cuentas-compartidas'
import { formatearFechaCorta } from '@/lib/historial'
import { formatCLP } from '@/lib/format'
import { Avatar } from '@/components/app/Avatar'
import { BottomNav } from '@/components/app/BottomNav'

// ── Skeleton ─────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div aria-hidden="true" style={{
      background: 'var(--color-card)', borderRadius: 18, padding: '13px 16px',
      display: 'flex', alignItems: 'center', gap: 13,
    }}>
      <div className="skeleton" style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
        <div className="skeleton" style={{ height: 14, width: '48%', borderRadius: 6 }} />
        <div className="skeleton" style={{ height: 12, width: '33%', borderRadius: 6 }} />
      </div>
      <div className="skeleton" style={{ height: 14, width: 55, borderRadius: 6 }} />
    </div>
  )
}

// ── Badge de estado ──────────────────────────────────────────

function BadgeEstado({ estado }: { estado: 'abierta' | 'cerrada' }) {
  const abierta = estado === 'abierta'
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
      padding: '2px 8px', borderRadius: 100,
      background: abierta ? 'rgba(0,200,81,0.15)' : 'var(--color-card-light)',
      color: abierta ? 'var(--color-cta-dark)' : 'var(--color-text-secondary)',
      fontFamily: 'var(--font-dm-sans), sans-serif',
      flexShrink: 0,
    }}>
      {abierta ? 'ABIERTA' : 'CERRADA'}
    </span>
  )
}

// ── Card de cuenta compartida ────────────────────────────────

function CuentaCard({ cuenta, onClick }: { cuenta: CuentaCompartidaResumen; onClick: () => void }) {
  const cerrada = cuenta.estado === 'cerrada'
  return (
    <button
      onClick={onClick}
      style={{
        background: 'var(--color-card)', borderRadius: 18, padding: '13px 16px',
        border: 'none', width: '100%',
        display: 'flex', alignItems: 'center', gap: 13,
        cursor: 'pointer', textAlign: 'left',
        opacity: cerrada ? 0.75 : 1,
        transition: 'transform 120ms ease',
        WebkitTapHighlightColor: 'transparent',
      }}
      onPointerDown={e => (e.currentTarget.style.transform = 'scale(0.97)')}
      onPointerUp={e => (e.currentTarget.style.transform = 'scale(1)')}
      onPointerLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
    >
      <Avatar nombre={cuenta.pagador.nombre} color={cuenta.pagador.avatar_color} size={40} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)',
          fontFamily: 'var(--font-dm-sans), sans-serif',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {cuenta.nombre}
        </p>
        <p style={{
          margin: '2px 0 0', fontSize: 12, color: 'var(--color-text-secondary)',
          fontFamily: 'var(--font-dm-sans), sans-serif',
        }}>
          Pagó {cuenta.pagador.nombre} · {formatearFechaCorta(cuenta.fecha)}
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5, flexShrink: 0 }}>
        <span style={{
          fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)',
          fontFamily: 'var(--font-dm-sans), sans-serif',
        }}>
          {formatCLP(cuenta.subtotalItems)}
        </span>
        <BadgeEstado estado={cuenta.estado} />
      </div>
    </button>
  )
}

// ── Estado vacío ──────────────────────────────────────────────

function EstadoVacio() {
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px' }}>
      <div style={{ fontSize: 52, marginBottom: 12 }}>🧾</div>
      <p style={{
        margin: 0, fontSize: 18, fontWeight: 700,
        color: 'var(--color-text-primary)', fontFamily: 'var(--font-lora), serif',
      }}>
        Todavía no hay cuentas compartidas
      </p>
      <p style={{
        margin: '8px 0 24px', fontSize: 14, color: 'var(--color-text-secondary)',
        fontFamily: 'var(--font-dm-sans), sans-serif', lineHeight: 1.5,
      }}>
        Creá la primera para digitalizar el reparto de una boleta grupal.
      </p>
      <Link
        href="/cuentas-compartidas/nueva"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '14px 28px', borderRadius: 100,
          background: 'var(--color-cta)', color: 'white',
          textDecoration: 'none', fontSize: 15, fontWeight: 600,
          fontFamily: 'var(--font-dm-sans), sans-serif',
        }}
      >
        <span style={{ fontSize: 18 }}>+</span> Nueva cuenta compartida
      </Link>
    </div>
  )
}

// ── Página principal ─────────────────────────────────────────

export default function CuentasCompartidasPage() {
  const router = useRouter()
  const { sesion, loading: sesionLoading } = useSession()
  const [cuentas, setCuentas] = useState<CuentaCompartidaResumen[]>([])
  const [cargando, setCargando] = useState(true)

  const cargar = useCallback(async () => {
    if (!sesion) return
    setCargando(true)
    const data = await listarCuentasCompartidas(sesion.grupo_id)
    setCuentas(data)
    setCargando(false)
  }, [sesion])

  useEffect(() => {
    if (!sesionLoading && !sesion) { router.replace('/login'); return }
    if (sesion) cargar()
  }, [sesion, sesionLoading, router, cargar])

  if (sesionLoading || !sesion) return null

  const abiertas = cuentas.filter(c => c.estado === 'abierta')
  const cerradas = cuentas.filter(c => c.estado === 'cerrada')

  function irACuenta(cuenta: CuentaCompartidaResumen) {
    if (cuenta.estado === 'abierta') {
      router.push(`/cuentas-compartidas/${cuenta.id}/items`)
    } else {
      router.push(`/cuentas-compartidas/${cuenta.id}/cierre`)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', paddingBottom: 80 }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>

        {/* Header */}
        <header style={{ padding: '56px var(--page-px) 20px' }}>
          <p style={{
            margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)',
            fontFamily: 'var(--font-dm-sans), sans-serif',
            textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>
            {sesion.grupo_nombre}
          </p>
          <h1 style={{
            margin: '2px 0 0', fontSize: 26, fontWeight: 700, color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-lora), serif',
          }}>
            Cuentas compartidas
          </h1>
        </header>

        <main style={{ padding: '0 var(--page-px)' }}>

          {cargando && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[0, 1, 2].map(i => <SkeletonCard key={i} />)}
            </div>
          )}

          {!cargando && cuentas.length === 0 && <EstadoVacio />}

          {!cargando && cuentas.length > 0 && (
            <>
              {abiertas.length > 0 && (
                <section style={{ marginBottom: 24 }}>
                  <p style={{
                    margin: '0 0 10px 2px', fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)',
                    fontFamily: 'var(--font-dm-sans), sans-serif',
                    textTransform: 'uppercase', letterSpacing: '0.09em',
                  }}>
                    Abiertas
                  </p>
                  <div role="list" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {abiertas.map(c => (
                      <div role="listitem" key={c.id}>
                        <CuentaCard cuenta={c} onClick={() => irACuenta(c)} />
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {cerradas.length > 0 && (
                <section>
                  <p style={{
                    margin: '0 0 10px 2px', fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)',
                    fontFamily: 'var(--font-dm-sans), sans-serif',
                    textTransform: 'uppercase', letterSpacing: '0.09em',
                  }}>
                    Cerradas
                  </p>
                  <div role="list" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {cerradas.map(c => (
                      <div role="listitem" key={c.id}>
                        <CuentaCard cuenta={c} onClick={() => irACuenta(c)} />
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </main>
      </div>

      {/* Botón flotante "+" */}
      {!cargando && cuentas.length > 0 && (
        <Link
          href="/cuentas-compartidas/nueva"
          aria-label="Nueva cuenta compartida"
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
      )}

      <BottomNav />
    </div>
  )
}
