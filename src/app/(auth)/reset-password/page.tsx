'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const F_BODY = 'var(--font-dm-sans), sans-serif'
const F_HEAD = 'var(--font-sora), sans-serif'
const ICON_STROKE = 'var(--color-text-disabled)'

// ── Piezas visuales — mismas que /login, mismo lenguaje Walto ──────

function Label({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} style={{
      display: 'block', marginBottom: 8, fontSize: 11, fontWeight: 700,
      letterSpacing: '0.08em', textTransform: 'uppercase',
      color: 'var(--color-text-muted)', fontFamily: F_BODY,
    }}>
      {children}
    </label>
  )
}

function IconoCandado() {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
      <rect x="4" y="9" width="12" height="8" rx="2" stroke={ICON_STROKE} strokeWidth="1.5" />
      <path d="M7 9V7a3 3 0 016 0v2" stroke={ICON_STROKE} strokeWidth="1.5" />
    </svg>
  )
}

function BotonOjo({ visible, onClick }: { visible: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', flexShrink: 0 }}
    >
      {visible ? (
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
          <path d="M2 10s3-5 8-5 8 5 8 5-3 5-8 5-8-5-8-5z" stroke={ICON_STROKE} strokeWidth="1.5" />
          <path d="M3 3l14 14" stroke={ICON_STROKE} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
          <path d="M2 10s3-5 8-5 8 5 8 5-3 5-8 5-8-5-8-5z" stroke={ICON_STROKE} strokeWidth="1.5" />
          <circle cx="10" cy="10" r="2" stroke={ICON_STROKE} strokeWidth="1.5" />
        </svg>
      )}
    </button>
  )
}

function CampoTexto({
  id, label, icon, value, onChange, placeholder, type = 'text', autoComplete, autoFocus, rightSlot,
}: {
  id: string
  label: string
  icon: React.ReactNode
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholder?: string
  type?: string
  autoComplete?: string
  autoFocus?: boolean
  rightSlot?: React.ReactNode
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div style={{
        background: 'var(--color-surface-white)', border: '1px solid var(--color-border)',
        borderRadius: 14, height: 52, boxSizing: 'border-box',
        display: 'flex', alignItems: 'center', padding: '0 15px', gap: 11,
      }}>
        {icon}
        <input
          id={id}
          type={type}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          style={{
            flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent',
            fontSize: 14.5, fontWeight: 500, color: 'var(--color-text-primary)', fontFamily: F_BODY,
          }}
        />
        {rightSlot}
      </div>
    </div>
  )
}

function PressBtn({ style, onClick, children, type = 'button', disabled }: {
  style: React.CSSProperties
  onClick?: () => void
  children: React.ReactNode
  type?: 'button' | 'submit'
  disabled?: boolean
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={style}
      onPointerDown={e => { if (!disabled) e.currentTarget.style.transform = 'scale(0.97)' }}
      onPointerUp={e => (e.currentTarget.style.transform = 'scale(1)')}
      onPointerLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
    >
      {children}
    </button>
  )
}

const btnPrimary: React.CSSProperties = {
  height: 54, width: '100%', borderRadius: 15, border: 'none',
  background: 'var(--gradient-cta)', boxShadow: 'var(--shadow-cta)',
  color: '#fff', fontSize: 15.5, fontWeight: 700,
  fontFamily: F_BODY, cursor: 'pointer', outline: 'none',
  transition: 'transform 120ms ease, opacity 120ms ease',
}

function ErrorMsg({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ borderRadius: 12, padding: '12px 14px', background: 'var(--color-negative-tint)' }}>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--color-negative)', fontFamily: F_BODY, lineHeight: 1.4 }}>
        {children}
      </p>
    </div>
  )
}

function IconoCirculo({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      width: 64, height: 64, borderRadius: '50%', background: 'var(--color-surface-white)',
      border: '1px solid var(--color-border)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
    }}>
      {children}
    </div>
  )
}

// ── Página ───────────────────────────────────────────────────

type Estado = 'procesando' | 'listo' | 'invalido' | 'guardado'

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordInner />
    </Suspense>
  )
}

function ResetPasswordInner() {
  const router = useRouter()

  const [estado, setEstado] = useState<Estado>('procesando')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [verPassword, setVerPassword] = useState(false)
  const [verConfirmPassword, setVerConfirmPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    // Supabase agrega error/error_description directo a la URL (query o
    // hash, según el caso) cuando el link ya no sirve — expiró o ya se
    // usó — antes de que haya nada que intercambiar. Se revisa primero.
    const query = new URLSearchParams(window.location.search)
    const hash = window.location.hash ? new URLSearchParams(window.location.hash.slice(1)) : null
    const errorDescription = query.get('error_description') || hash?.get('error_description')
    if (errorDescription) {
      setEstado('invalido')
      return
    }

    if (!query.get('code')) {
      // Nadie llegó acá con un link real del correo.
      setEstado('invalido')
      return
    }

    let activo = true

    // El cliente (@supabase/ssr, flujo PKCE) detecta el ?code= de la URL
    // solo y lo intercambia por una sesión temporal — no hace falta leer
    // tokens a mano. Cuando termina, dispara este evento.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(event => {
      if (!activo) return
      if (event === 'PASSWORD_RECOVERY') setEstado('listo')
    })

    // Resguardo: si el intercambio falla en silencio (código ya usado, por
    // ejemplo) y el evento nunca llega, no dejamos la pantalla cargando
    // para siempre.
    const timeout = setTimeout(() => {
      setEstado(prev => (prev === 'procesando' ? 'invalido' : prev))
    }, 8000)

    return () => {
      activo = false
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  async function handleGuardar(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return }
    if (password !== confirmPassword) { setError('Las contraseñas no coinciden.'); return }

    setGuardando(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) {
        setError('No pudimos guardar la contraseña. Intentá de nuevo.')
        return
      }
      setEstado('guardado')
      setTimeout(() => router.replace('/'), 1600)
    } catch {
      setError('Error de conexión. Verificá tu internet e intentá de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <main style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      justifyContent: 'center', alignItems: 'center',
      padding: '40px 0', background: 'var(--color-bg)', overflowX: 'hidden',
    }}>
      <div style={{ width: '100%', maxWidth: 440, padding: '0 24px', boxSizing: 'border-box' }}>

        {estado === 'procesando' && (
          <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--color-text-secondary)', fontFamily: F_BODY }}>
            Verificando el link…
          </p>
        )}

        {estado === 'invalido' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
            <IconoCirculo>⚠️</IconoCirculo>
            <div>
              <h2 style={{ margin: 0, fontSize: 22, fontFamily: F_HEAD, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--color-text-primary)' }}>
                Este link ya no es válido
              </h2>
              <p style={{ margin: '10px 0 0', fontSize: 14, lineHeight: 1.5, color: 'var(--color-text-secondary)', fontFamily: F_BODY }}>
                Puede haber expirado o ya haberse usado. Pedí uno nuevo desde el login.
              </p>
            </div>
            <PressBtn onClick={() => router.replace('/login')} style={{ ...btnPrimary, width: 'auto', padding: '0 24px' }}>
              Volver al login
            </PressBtn>
          </div>
        )}

        {estado === 'listo' && (
          <>
            <div style={{ marginBottom: 22 }}>
              <div style={{ fontFamily: F_HEAD, fontSize: 19, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--color-text-primary)' }}>
                Elegí tu nueva contraseña
              </div>
              <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--color-text-secondary)', fontFamily: F_BODY }}>
                Mínimo 6 caracteres.
              </p>
            </div>
            <form onSubmit={handleGuardar} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <CampoTexto
                id="reset-password"
                label="Contraseña nueva"
                icon={<IconoCandado />}
                type={verPassword ? 'text' : 'password'}
                autoComplete="new-password"
                autoFocus
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={e => setPassword(e.target.value)}
                rightSlot={<BotonOjo visible={verPassword} onClick={() => setVerPassword(v => !v)} />}
              />
              <CampoTexto
                id="reset-confirm"
                label="Confirmar contraseña"
                icon={<IconoCandado />}
                type={verConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                rightSlot={<BotonOjo visible={verConfirmPassword} onClick={() => setVerConfirmPassword(v => !v)} />}
              />

              {error && <ErrorMsg>{error}</ErrorMsg>}

              <PressBtn
                type="submit"
                style={{ ...btnPrimary, opacity: guardando ? 0.5 : 1, marginTop: 4 }}
                disabled={guardando}
              >
                {guardando ? 'Guardando…' : 'Guardar contraseña'}
              </PressBtn>
            </form>
          </>
        )}

        {estado === 'guardado' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
            <IconoCirculo>✅</IconoCirculo>
            <div>
              <h2 style={{ margin: 0, fontSize: 22, fontFamily: F_HEAD, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--color-text-primary)' }}>
                ¡Contraseña actualizada!
              </h2>
              <p style={{ margin: '10px 0 0', fontSize: 14, lineHeight: 1.5, color: 'var(--color-text-secondary)', fontFamily: F_BODY }}>
                Ya podés seguir usando la app.
              </p>
            </div>
          </div>
        )}

      </div>
    </main>
  )
}
