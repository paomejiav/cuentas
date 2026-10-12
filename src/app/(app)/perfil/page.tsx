'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { listarGruposActivos, reiniciarCuenta, type GrupoNombre } from '@/lib/grupo'
import { Avatar } from '@/components/app/Avatar'
import { BottomNav } from '@/components/app/BottomNav'

const F_HEAD = 'var(--font-sora), sans-serif'
const F_BODY = 'var(--font-dm-sans), sans-serif'
const CONFIRMACION = 'REINICIAR'

function BotonVolver({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Volver"
      style={{
        width: 42, height: 42, borderRadius: 13, background: 'var(--color-surface-white)',
        border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', flexShrink: 0, padding: 0,
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M15 6l-6 6 6 6" stroke="var(--color-text-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}

function formatearListaConY(nombres: string[]): string {
  if (nombres.length === 0) return ''
  if (nombres.length === 1) return nombres[0]
  if (nombres.length === 2) return `${nombres[0]} y ${nombres[1]}`
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`
}

export default function PerfilPage() {
  const router = useRouter()

  const [cargando, setCargando] = useState(true)
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [avatarColor, setAvatarColor] = useState('#A8D8B9')
  const [grupos, setGrupos] = useState<GrupoNombre[]>([])

  const [mostrarModal, setMostrarModal] = useState(false)
  const [confirmacion, setConfirmacion] = useState('')
  const [reiniciando, setReiniciando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cerrandoSesion, setCerrandoSesion] = useState(false)

  useEffect(() => {
    let activo = true
    async function cargar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }

      const [{ data: usuario }, listaGrupos] = await Promise.all([
        supabase.from('usuarios').select('nombre, avatar_color').eq('id', user.id).single(),
        listarGruposActivos(user.id),
      ])
      if (!activo) return
      setNombre(usuario?.nombre ?? '')
      setEmail(user.email ?? '')
      setAvatarColor(usuario?.avatar_color ?? '#A8D8B9')
      setGrupos(listaGrupos)
      setCargando(false)
    }
    cargar()
    return () => { activo = false }
  }, [router])

  function abrirModal() {
    setConfirmacion('')
    setError(null)
    setMostrarModal(true)
  }

  async function handleReiniciar() {
    if (confirmacion !== CONFIRMACION) return
    setReiniciando(true)
    setError(null)
    try {
      const { error } = await reiniciarCuenta()
      if (error) { setError(error); return }
      router.replace('/')
    } finally {
      setReiniciando(false)
    }
  }

  async function handleCerrarSesion() {
    setCerrandoSesion(true)
    await supabase.auth.signOut()
    router.replace('/login')
  }

  if (cargando) {
    return (
      <main style={{ minHeight: '100dvh', background: 'var(--color-bg)' }}>
        <p style={{ padding: 24, fontSize: 13.5, color: 'var(--color-text-secondary)', fontFamily: F_BODY }}>Cargando…</p>
      </main>
    )
  }

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--color-bg)', paddingBottom: 96 }}>
      <div style={{ maxWidth: 440, margin: '0 auto', padding: '0 18px', paddingTop: 'max(20px, env(safe-area-inset-top, 0px))' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <BotonVolver onClick={() => router.push('/')} />
          <div style={{ fontFamily: F_HEAD, fontSize: 19, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--color-text-primary)' }}>
            Perfil
          </div>
        </div>

        {/* ─── Card de identidad ─── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14, marginTop: 14,
          background: 'var(--color-surface-white)', border: '1px solid var(--color-border)', borderRadius: 18, padding: 16,
        }}>
          <Avatar nombre={nombre || '?'} color={avatarColor} size={52} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: F_BODY }}>
              {nombre}
            </div>
            <div style={{
              fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 2, fontFamily: F_BODY,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {email}
            </div>
          </div>
        </div>

        {/* ─── Sección Cuenta ─── */}
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)', margin: '22px 2px 10px' }}>
          Cuenta
        </div>
        <div style={{ background: 'var(--color-surface-white)', border: '1px solid var(--color-border)', borderRadius: 18, padding: '4px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '13px 0' }}>
            <div style={{
              width: 36, height: 36, borderRadius: 11, background: 'var(--tint-cta)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-cta-dark)', fontFamily: F_BODY }}>$</span>
            </div>
            <span style={{ flex: 1, fontSize: 14.5, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: F_BODY }}>
              Moneda de visualización
            </span>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-secondary)', fontFamily: F_BODY }}>
              CLP
            </span>
          </div>
        </div>

        {/* ─── Sección sensible — sin título, separada por aire ─── */}
        <div style={{ background: 'var(--color-surface-white)', border: '1px solid var(--color-border)', borderRadius: 18, padding: '4px 16px', marginTop: 28 }}>
          <button
            onClick={abrirModal}
            disabled={grupos.length === 0}
            style={{
              display: 'flex', alignItems: 'center', gap: 13, padding: '13px 0', width: '100%',
              background: 'none', border: 'none', textAlign: 'left', borderBottom: '1px solid var(--color-divider)',
              cursor: grupos.length === 0 ? 'default' : 'pointer', opacity: grupos.length === 0 ? 0.5 : 1,
            }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: 11, background: 'var(--color-negative-tint)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                <path d="M4 6h12M8 6V4.5A1.5 1.5 0 019.5 3h1A1.5 1.5 0 0112 4.5V6m2 0v10a1 1 0 01-1 1H7a1 1 0 01-1-1V6" stroke="var(--color-negative)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span style={{ flex: 1, fontSize: 14.5, fontWeight: 600, color: 'var(--color-negative)', fontFamily: F_BODY }}>
              Reiniciar mi cuenta
            </span>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="var(--color-text-disabled)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>

          <button
            onClick={handleCerrarSesion}
            disabled={cerrandoSesion}
            style={{
              display: 'flex', alignItems: 'center', gap: 13, padding: '13px 0', width: '100%',
              background: 'none', border: 'none', textAlign: 'left',
              cursor: 'pointer', opacity: cerrandoSesion ? 0.6 : 1,
            }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: 11, background: 'var(--color-icon-bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                <path d="M7 3H4a1 1 0 00-1 1v10a1 1 0 001 1h3M11 12l3-3-3-3M14 9H7" stroke="var(--color-text-secondary)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span style={{ flex: 1, fontSize: 14.5, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: F_BODY }}>
              {cerrandoSesion ? 'Cerrando sesión…' : 'Cerrar sesión'}
            </span>
          </button>
        </div>

        <p style={{ textAlign: 'center', marginTop: 32, fontSize: 12, color: 'var(--color-text-disabled)', fontFamily: F_BODY }}>
          v1.0.0
        </p>
      </div>

      <BottomNav />

      {/* ─── P2 · Confirmación de reinicio — modal centrado ─── */}
      {mostrarModal && (
        <>
          <div
            onClick={() => !reiniciando && setMostrarModal(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(26,26,30,0.5)' }}
          />
          <div style={{
            position: 'fixed', inset: 0, zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
          }}>
            <div style={{
              width: '100%', maxWidth: 380, background: 'var(--color-surface-white)', borderRadius: 22,
              padding: 24, boxSizing: 'border-box', boxShadow: '0 20px 50px rgba(0,0,0,.25)',
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%', background: 'var(--color-negative-tint)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px',
                }}>
                  <svg width="24" height="24" viewBox="0 0 20 20" fill="none">
                    <path d="M15.5 6.5A6 6 0 105.6 12M15.5 6.5V3M15.5 6.5H12" stroke="var(--color-negative)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <h2 style={{ margin: 0, fontFamily: F_HEAD, fontSize: 19, fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--color-text-primary)' }}>
                  Vas a salir de tus {grupos.length} grupo{grupos.length === 1 ? '' : 's'}
                </h2>
                <p style={{ margin: '8px 0 0', fontSize: 13, lineHeight: 1.5, color: 'var(--color-text-secondary)', fontFamily: F_BODY }}>
                  {formatearListaConY(grupos.map(g => g.nombre))}. Tu historial queda en cada uno, marcado como que ya no pertenecés.
                </p>
              </div>

              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 8, textAlign: 'center' }}>
                  Escribí {CONFIRMACION} para confirmar
                </div>
                <input
                  value={confirmacion}
                  onChange={e => setConfirmacion(e.target.value.toUpperCase())}
                  autoFocus
                  style={{
                    width: '100%', height: 50, borderRadius: 13, textAlign: 'center', boxSizing: 'border-box',
                    border: `1.5px solid ${confirmacion === CONFIRMACION ? 'var(--color-cta)' : 'var(--color-border)'}`,
                    fontSize: 16, fontWeight: 700, letterSpacing: '.1em', color: 'var(--color-text-primary)',
                    fontFamily: F_BODY, outline: 'none',
                  }}
                />
              </div>

              {error && (
                <p style={{ margin: '12px 0 0', fontSize: 13, color: 'var(--color-negative)', fontFamily: F_BODY, textAlign: 'center' }}>{error}</p>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 18 }}>
                <button
                  onClick={handleReiniciar}
                  disabled={confirmacion !== CONFIRMACION || reiniciando}
                  style={{
                    height: 52, width: '100%', borderRadius: 15, border: 'none',
                    background: confirmacion === CONFIRMACION ? 'var(--color-negative)' : '#E7E7EE',
                    color: confirmacion === CONFIRMACION ? '#fff' : '#AFAFBC',
                    fontSize: 14.5, fontWeight: 700, fontFamily: F_BODY,
                    cursor: confirmacion === CONFIRMACION ? 'pointer' : 'default',
                    transition: 'background 150ms ease, color 150ms ease',
                  }}
                >
                  {reiniciando ? 'Reiniciando…' : 'Reiniciar mi cuenta'}
                </button>
                <button
                  onClick={() => setMostrarModal(false)}
                  disabled={reiniciando}
                  style={{
                    height: 52, width: '100%', borderRadius: 15, border: '1px solid var(--color-border)',
                    background: 'var(--color-surface-white)', color: 'var(--color-text-primary)',
                    fontSize: 14.5, fontWeight: 700, fontFamily: F_BODY, cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  )
}
