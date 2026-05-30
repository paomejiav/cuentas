'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/lib/session-store'
import { Avatar } from '@/components/app/Avatar'
import { Toast } from '@/components/app/Toast'
import { supabase } from '@/lib/supabase'
import { AVATAR_COLORS } from '@/types/database'
import type { Integrante } from '@/types/database'

const F = 'var(--font-dm-sans), sans-serif'

const inputStyle: React.CSSProperties = {
  height: 52, width: '100%', boxSizing: 'border-box',
  padding: '0 16px', borderRadius: 14,
  border: '1.5px solid var(--color-border)', background: 'var(--color-card-light)',
  fontSize: 16, color: 'var(--color-text-primary)', fontFamily: F, outline: 'none',
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      margin: '0 0 6px', fontSize: 11, fontWeight: 600,
      letterSpacing: '0.07em', textTransform: 'uppercase',
      color: 'var(--color-text-secondary)', fontFamily: F,
    }}>
      {children}
    </p>
  )
}

export default function AdminPage() {
  const router = useRouter()
  const { sesion, loading: sesionLoading } = useSession()

  const [integrantes, setIntegrantes] = useState<Integrante[]>([])
  const [cargando, setCargando] = useState(true)
  const [confirmando, setConfirmando] = useState<string | null>(null) // id a desactivar
  const [guardando, setGuardando] = useState(false)
  const [toast, setToast] = useState<{ mensaje: string; tipo: 'exito' | 'error' } | null>(null)

  // Nuevo integrante
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevoColor, setNuevoColor] = useState(AVATAR_COLORS[0])
  const [agregando, setAgregando] = useState(false)

  useEffect(() => {
    if (sesionLoading) return
    if (!sesion) { router.replace('/login'); return }
    if (!sesion.es_admin) { router.replace('/dashboard'); return }
    cargarIntegrantes()
  }, [sesion, sesionLoading]) // eslint-disable-line react-hooks/exhaustive-deps

  async function cargarIntegrantes() {
    if (!sesion) return
    setCargando(true)
    const { data } = await supabase
      .from('integrantes')
      .select('*')
      .eq('grupo_id', sesion.grupo_id)
      .order('nombre')
    setIntegrantes((data ?? []) as Integrante[])
    setCargando(false)
  }

  async function handleDesactivar(id: string) {
    setGuardando(true)
    const { error } = await supabase
      .from('integrantes')
      .update({ activo: false })
      .eq('id', id)
    setGuardando(false)
    setConfirmando(null)
    if (error) {
      setToast({ mensaje: 'No se pudo desactivar. Intentá de nuevo.', tipo: 'error' })
    } else {
      setToast({ mensaje: 'Integrante desactivada.', tipo: 'exito' })
      cargarIntegrantes()
    }
  }

  async function handleActivar(id: string) {
    const { error } = await supabase
      .from('integrantes')
      .update({ activo: true })
      .eq('id', id)
    if (error) {
      setToast({ mensaje: 'No se pudo activar. Intentá de nuevo.', tipo: 'error' })
    } else {
      setToast({ mensaje: 'Integrante activada.', tipo: 'exito' })
      cargarIntegrantes()
    }
  }

  async function handleAgregar(e: React.FormEvent) {
    e.preventDefault()
    const nombre = nuevoNombre.trim()
    if (!nombre || !sesion) return
    setAgregando(true)

    const { error } = await supabase
      .from('integrantes')
      .insert({ grupo_id: sesion.grupo_id, nombre, avatar_color: nuevoColor, activo: true, es_admin: false })

    setAgregando(false)
    if (error) {
      setToast({ mensaje: 'No se pudo agregar. Intentá de nuevo.', tipo: 'error' })
    } else {
      setToast({ mensaje: `${nombre} agregada al grupo 🎉`, tipo: 'exito' })
      setNuevoNombre('')
      setNuevoColor(AVATAR_COLORS[0])
      cargarIntegrantes()
    }
  }

  if (sesionLoading || !sesion) return null

  const activas = integrantes.filter(i => i.activo)
  const inactivas = integrantes.filter(i => !i.activo)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', paddingBottom: 60 }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>

        {/* Header */}
        <header style={{
          paddingTop: 'max(56px, calc(env(safe-area-inset-top, 0px) + 16px))',
          paddingBottom: 20, paddingLeft: 'var(--page-px)', paddingRight: 'var(--page-px)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <button
            onClick={() => router.replace('/dashboard')}
            aria-label="Volver al dashboard"
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
          <div>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', fontFamily: F, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {sesion.grupo_nombre}
            </p>
            <h1 style={{ margin: '2px 0 0', fontSize: 24, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'var(--font-lora), serif' }}>
              Gestionar grupo
            </h1>
          </div>
        </header>

        <main style={{ padding: '0 var(--page-px)', display: 'flex', flexDirection: 'column', gap: 28 }}>

          {/* ── Integrantes activas ── */}
          <section>
            <Label>Integrantes activas ({activas.length})</Label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {cargando
                ? [1, 2, 3].map(i => (
                    <div key={i} style={{ height: 68, background: 'var(--color-card)', borderRadius: 16 }} />
                  ))
                : activas.map(i => (
                    <div key={i.id} style={{
                      background: 'var(--color-card)', borderRadius: 16,
                      padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12,
                    }}>
                      <Avatar nombre={i.nombre} color={i.avatar_color} size={44} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: F }}>
                          {i.nombre}
                          {i.es_admin && (
                            <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 400 }}>admin</span>
                          )}
                        </p>
                        <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--color-positive)', fontFamily: F }}>Activa</p>
                      </div>
                      {!i.es_admin && i.id !== sesion.integrante_id && (
                        confirmando === i.id ? (
                          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                            <button
                              onClick={() => handleDesactivar(i.id)}
                              disabled={guardando}
                              style={{
                                padding: '6px 12px', borderRadius: 8, border: 'none',
                                background: 'var(--color-negative)', color: 'white',
                                fontSize: 12, fontWeight: 600, fontFamily: F, cursor: 'pointer',
                              }}
                            >
                              {guardando ? '…' : 'Confirmar'}
                            </button>
                            <button
                              onClick={() => setConfirmando(null)}
                              style={{
                                padding: '6px 12px', borderRadius: 8,
                                border: '1.5px solid var(--color-border)', background: 'transparent',
                                fontSize: 12, fontWeight: 600, fontFamily: F, cursor: 'pointer',
                                color: 'var(--color-text-secondary)',
                              }}
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmando(i.id)}
                            style={{
                              padding: '6px 14px', borderRadius: 8,
                              border: '1.5px solid var(--color-border)', background: 'transparent',
                              fontSize: 12, fontWeight: 500, fontFamily: F, cursor: 'pointer',
                              color: 'var(--color-text-secondary)', flexShrink: 0,
                            }}
                          >
                            Desactivar
                          </button>
                        )
                      )}
                    </div>
                  ))
              }
            </div>
            {confirmando && (
              <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--color-negative)', fontFamily: F, textAlign: 'center' }}>
                ¿Segura que querés desactivar a {activas.find(i => i.id === confirmando)?.nombre}?
              </p>
            )}
          </section>

          {/* ── Agregar integrante ── */}
          <section>
            <Label>Agregar integrante</Label>
            <form onSubmit={handleAgregar} style={{
              background: 'var(--color-card)', borderRadius: 20, padding: '20px',
              display: 'flex', flexDirection: 'column', gap: 16,
            }}>
              <div>
                <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', fontFamily: F, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  Nombre
                </p>
                <input
                  type="text"
                  placeholder="Nombre de la integrante"
                  value={nuevoNombre}
                  onChange={e => setNuevoNombre(e.target.value)}
                  style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = 'var(--color-cta)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--color-border)')}
                />
              </div>

              <div>
                <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', fontFamily: F, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  Color de avatar
                </p>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {AVATAR_COLORS.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNuevoColor(color)}
                      aria-label={`Color ${color}`}
                      style={{
                        width: 36, height: 36, borderRadius: '50%', background: color,
                        border: nuevoColor === color ? '3px solid var(--color-text-primary)' : '3px solid transparent',
                        cursor: 'pointer', flexShrink: 0,
                        transition: 'border-color 120ms ease',
                        outline: 'none',
                      }}
                    />
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: nuevoColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 18, fontWeight: 700, color: 'white', fontFamily: F }}>
                      {nuevoNombre.trim().charAt(0).toUpperCase() || '?'}
                    </span>
                  </div>
                  <span style={{ fontSize: 13, color: 'var(--color-text-secondary)', fontFamily: F }}>
                    Vista previa del avatar
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={!nuevoNombre.trim() || agregando}
                style={{
                  height: 52, borderRadius: 100, border: 'none',
                  background: (!nuevoNombre.trim() || agregando) ? 'var(--color-text-disabled)' : 'var(--color-cta)',
                  color: 'white', fontSize: 15, fontWeight: 600, fontFamily: F,
                  cursor: (!nuevoNombre.trim() || agregando) ? 'not-allowed' : 'pointer',
                  transition: 'all 120ms ease',
                }}
                onPointerDown={e => { if (nuevoNombre.trim() && !agregando) e.currentTarget.style.transform = 'scale(0.97)' }}
                onPointerUp={e => (e.currentTarget.style.transform = 'scale(1)')}
                onPointerLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
              >
                {agregando ? 'Agregando…' : 'Agregar al grupo'}
              </button>
            </form>
          </section>

          {/* ── Inactivas ── */}
          {inactivas.length > 0 && (
            <section>
              <Label>Inactivas ({inactivas.length})</Label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {inactivas.map(i => (
                  <div key={i.id} style={{
                    background: 'var(--color-card)', borderRadius: 16,
                    padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12,
                    opacity: 0.6,
                  }}>
                    <Avatar nombre={i.nombre} color={i.avatar_color} size={44} />
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: F }}>
                        {i.nombre}
                      </p>
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--color-text-disabled)', fontFamily: F }}>Inactiva</p>
                    </div>
                    <button
                      onClick={() => handleActivar(i.id)}
                      style={{
                        padding: '6px 14px', borderRadius: 8,
                        border: '1.5px solid var(--color-border)', background: 'transparent',
                        fontSize: 12, fontWeight: 500, fontFamily: F, cursor: 'pointer',
                        color: 'var(--color-text-secondary)', flexShrink: 0,
                      }}
                    >
                      Activar
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

        </main>
      </div>

      {toast && <Toast mensaje={toast.mensaje} tipo={toast.tipo} onClose={() => setToast(null)} />}
    </div>
  )
}
