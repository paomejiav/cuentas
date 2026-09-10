'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Avatar } from '@/components/app/Avatar'
import type { AuthError } from '@supabase/supabase-js'

type Vista = 'onboarding' | 'login' | 'signup' | 'revisa-email' | 'recuperar' | 'recuperar-enviado'

const F_BODY = 'var(--font-dm-sans), sans-serif'
const F_HEAD = 'var(--font-sora), sans-serif'

const AVATAR_COLORS = ['#F4A79D', '#A8D8B9', '#A8C8E8', '#D4A8D8', '#F4D4A0']

const ICON_STROKE = 'var(--color-text-disabled)'

// ── Piezas visuales — tokens Walto (--color-*, --font-sora, --font-dm-sans) ──

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

function IconoPersona() {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="7" r="3.2" stroke={ICON_STROKE} strokeWidth="1.5" />
      <path d="M4 16.5c1-3 4-4 6-4s5 1 6 4" stroke={ICON_STROKE} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function IconoCorreo() {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
      <rect x="3" y="5" width="14" height="10" rx="2" stroke={ICON_STROKE} strokeWidth="1.5" />
      <path d="M3.5 6l6.5 4.5L16.5 6" stroke={ICON_STROKE} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
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
  id, name, label, icon, value, onChange, placeholder, type = 'text', autoComplete, autoFocus, rightSlot,
}: {
  id: string
  name?: string
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
          name={name}
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

const btnSecondary: React.CSSProperties = {
  height: 48, borderRadius: 15, border: '1px solid var(--color-border)',
  background: 'var(--color-surface-white)', color: 'var(--color-text-primary)',
  fontSize: 14.5, fontWeight: 700, fontFamily: F_BODY, cursor: 'pointer', outline: 'none',
  transition: 'transform 120ms ease',
}

function ErrorMsg({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div style={{
      borderRadius: 12, padding: '12px 14px', background: 'var(--color-negative-tint)',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--color-negative)', fontFamily: F_BODY, lineHeight: 1.4 }}>
        {children}
      </p>
      {action}
    </div>
  )
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function mensajeErrorLogin(error: AuthError): { mensaje: string; noConfirmado: boolean } {
  const code = (error as AuthError & { code?: string }).code
  const msg = error.message.toLowerCase()

  if (code === 'email_not_confirmed' || msg.includes('email not confirmed')) {
    return { mensaje: 'Confirmá tu email antes de entrar.', noConfirmado: true }
  }
  if (code === 'invalid_credentials' || msg.includes('invalid login credentials')) {
    return { mensaje: 'Email o contraseña incorrectos.', noConfirmado: false }
  }
  return { mensaje: 'No pudimos iniciar sesión. Intentá de nuevo.', noConfirmado: false }
}

function mensajeErrorSignup(error: AuthError): string {
  const code = (error as AuthError & { code?: string }).code
  const msg = error.message.toLowerCase()

  if (code === 'user_already_exists' || msg.includes('already registered') || msg.includes('already exists')) {
    return 'Ese email ya tiene una cuenta. Iniciá sesión en vez de crear una nueva.'
  }
  return 'No pudimos crear tu cuenta. Intentá de nuevo.'
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  )
}

function LoginInner() {
  const router = useRouter()
  const params = useSearchParams()

  const [vista, setVista] = useState<Vista>(params.get('modo') === 'crear' ? 'signup' : 'onboarding')
  const [loading, setLoading] = useState(false)

  // ── Login ──
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState<string | null>(null)
  const [loginNoConfirmado, setLoginNoConfirmado] = useState(false)
  const [reenviando, setReenviando] = useState(false)
  const [reenviado, setReenviado] = useState(false)
  const [verLoginPassword, setVerLoginPassword] = useState(false)

  // ── Signup ──
  const [nombre, setNombre] = useState('')
  const [signupEmail, setSignupEmail] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0])
  const [signupError, setSignupError] = useState<string | null>(null)
  const [emailEnviado, setEmailEnviado] = useState('')
  const [verSignupPassword, setVerSignupPassword] = useState(false)
  const [verConfirmPassword, setVerConfirmPassword] = useState(false)

  // ── Recuperar contraseña ──
  const [recuperarEmail, setRecuperarEmail] = useState('')
  const [recuperarError, setRecuperarError] = useState<string | null>(null)
  const [emailRecuperacion, setEmailRecuperacion] = useState('')

  function irA(v: Vista) {
    setVista(v)
    setLoginError(null)
    setLoginNoConfirmado(false)
    setReenviado(false)
    setSignupError(null)
    setRecuperarError(null)
  }

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoginError(null)
    setLoginNoConfirmado(false)

    // Leemos del FormData en vez de confiar solo en el estado controlado:
    // algunos autocompletados de navegador/gestores de contraseñas setean
    // el value del input sin disparar 'input', dejando loginEmail/loginPassword
    // vacíos aunque el campo se vea lleno.
    const formData = new FormData(e.currentTarget)
    const email = (formData.get('email') as string) || loginEmail
    const password = (formData.get('password') as string) || loginPassword

    if (!email || !password) {
      setLoginError('Completá email y contraseña.')
      return
    }

    setLoginEmail(email)
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (error) {
        const { mensaje, noConfirmado } = mensajeErrorLogin(error)
        setLoginError(mensaje)
        setLoginNoConfirmado(noConfirmado)
        return
      }
      router.replace('/')
    } catch {
      setLoginError('Error de conexión. Verificá tu internet e intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  async function handleReenviar() {
    setReenviando(true)
    setReenviado(false)
    try {
      await supabase.auth.resend({
        type: 'signup',
        email: loginEmail.trim(),
        options: { emailRedirectTo: `${window.location.origin}/` },
      })
      setReenviado(true)
    } finally {
      setReenviando(false)
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setSignupError(null)

    const email = signupEmail.trim()
    if (!nombre.trim()) { setSignupError('Ingresá tu nombre.'); return }
    if (!EMAIL_RE.test(email)) { setSignupError('Ingresá un email válido.'); return }
    if (signupPassword.length < 6) { setSignupError('La contraseña debe tener al menos 6 caracteres.'); return }
    if (signupPassword !== confirmPassword) { setSignupError('Las contraseñas no coinciden.'); return }

    setLoading(true)
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password: signupPassword,
        options: {
          data: { nombre: nombre.trim(), avatar_color: avatarColor },
          emailRedirectTo: `${window.location.origin}/`,
        },
      })
      if (error) {
        setSignupError(mensajeErrorSignup(error))
        return
      }
      setEmailEnviado(email)
      setVista('revisa-email')
    } catch {
      setSignupError('Error de conexión. Verificá tu internet e intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  async function handleReenviarSignup() {
    setReenviando(true)
    setReenviado(false)
    try {
      await supabase.auth.resend({
        type: 'signup',
        email: emailEnviado,
        options: { emailRedirectTo: `${window.location.origin}/` },
      })
      setReenviado(true)
    } finally {
      setReenviando(false)
    }
  }

  async function handleReenviarRecuperacion() {
    setReenviando(true)
    setReenviado(false)
    try {
      await supabase.auth.resetPasswordForEmail(emailRecuperacion, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      setReenviado(true)
    } finally {
      setReenviando(false)
    }
  }

  async function handleRecuperar(e: React.FormEvent) {
    e.preventDefault()
    setRecuperarError(null)

    const email = recuperarEmail.trim()
    if (!EMAIL_RE.test(email)) { setRecuperarError('Ingresá un email válido.'); return }

    setLoading(true)
    try {
      // Supabase no distingue "email no existe" de "listo, enviado" — por
      // diseño, para no dejar adivinar qué emails tienen cuenta. Mostramos
      // la confirmación siempre que la llamada no falle por un error real.
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) {
        setRecuperarError('No pudimos enviar el link. Intentá de nuevo.')
        return
      }
      setEmailRecuperacion(email)
      setVista('recuperar-enviado')
    } catch {
      setRecuperarError('Error de conexión. Verificá tu internet e intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      justifyContent: 'center', alignItems: 'center',
      padding: '40px 0', background: 'var(--color-bg)', overflowX: 'hidden',
    }}>
      <div style={{ width: '100%', maxWidth: 440, padding: '0 24px', boxSizing: 'border-box' }}>

        {/* ─── ONBOARDING ─── */}
        {vista === 'onboarding' && (
          <>
            <div style={{
              borderRadius: 32, background: 'var(--gradient-cta)', height: 340,
              position: 'relative', overflow: 'hidden', boxShadow: 'var(--shadow-cta)',
            }}>
              <div style={{ position: 'absolute', top: -40, right: -30, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,.12)' }} />
              <div style={{ position: 'absolute', bottom: -60, left: -40, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,.08)' }} />

              <div style={{
                position: 'absolute', top: 32, left: 22, right: 22,
                background: 'var(--color-surface-white)', borderRadius: 18, padding: '16px 18px',
                boxShadow: '0 18px 34px -14px rgba(24,34,26,.4)',
              }}>
                <p style={{ margin: 0, fontSize: 11.5, color: 'var(--color-neutral)', fontFamily: F_BODY }}>Saldo del grupo</p>
                <p style={{ margin: '3px 0 0', fontFamily: F_HEAD, fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--color-text-primary)' }}>$72.200</p>
                <div style={{ marginTop: 12, height: 10, borderRadius: 7, background: 'var(--color-track)', overflow: 'hidden' }}>
                  <div style={{ width: '74%', height: '100%', borderRadius: 7, background: 'repeating-linear-gradient(-45deg, #47C6F4, #47C6F4 5px, #6FD3F7 5px, #6FD3F7 10px)' }} />
                </div>
              </div>

              <div style={{
                position: 'absolute', bottom: 84, right: 20,
                background: 'var(--color-surface-white)', borderRadius: 100, padding: '8px 14px',
                display: 'flex', alignItems: 'center', gap: 7,
                boxShadow: '0 12px 24px -10px rgba(24,34,26,.4)',
              }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--color-positive)' }} />
                <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--color-positive)', fontFamily: F_BODY }}>Fabi te debe</span>
              </div>

              <div style={{ position: 'absolute', bottom: 26, left: 22, display: 'flex' }}>
                {[
                  { i: 'J', bg: '#FACFCA', c: '#E23219' },
                  { i: 'F', bg: '#FBE7C4', c: '#B67F0E' },
                  { i: 'N', bg: '#D2E9BC', c: '#489020' },
                ].map((a, idx) => (
                  <span key={a.i} style={{
                    width: 34, height: 34, borderRadius: '50%', marginLeft: idx === 0 ? 0 : -10,
                    background: a.bg, color: a.c,
                    fontFamily: F_HEAD, fontWeight: 800, fontSize: 13,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 0 0 3px #7A68EE',
                  }}>
                    {a.i}
                  </span>
                ))}
                <span style={{
                  width: 34, height: 34, borderRadius: '50%', marginLeft: -10,
                  background: 'rgba(255,255,255,.28)', color: '#fff',
                  fontFamily: F_HEAD, fontWeight: 700, fontSize: 12,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 0 0 3px #7A68EE',
                }}>
                  +2
                </span>
              </div>
            </div>

            <div style={{ textAlign: 'center', paddingTop: 30 }}>
              <h1 style={{
                margin: 0, fontFamily: F_HEAD, fontSize: 27, fontWeight: 800,
                letterSpacing: '-0.025em', lineHeight: 1.15, color: 'var(--color-text-primary)',
              }}>
                Divide gastos<br />sin dramas 🎉
              </h1>
              <p style={{ margin: '14px 0 0', fontSize: 14, lineHeight: 1.6, color: 'var(--color-text-secondary)', fontFamily: F_BODY }}>
                Registra, divide y salda cuentas con tu grupo en segundos. Nadie queda debiendo de más.
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 7, marginTop: 22 }}>
                <span style={{ width: 22, height: 6, borderRadius: 3, background: 'var(--color-cta)' }} />
                <span style={{ width: 6, height: 6, borderRadius: 3, background: 'var(--color-border)' }} />
                <span style={{ width: 6, height: 6, borderRadius: 3, background: 'var(--color-border)' }} />
              </div>
            </div>

            <div style={{ paddingTop: 30, paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>
              <PressBtn onClick={() => setVista('signup')} style={{ ...btnPrimary, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <span>Crear cuenta</span>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M7 4l5 5-5 5" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </PressBtn>
              <p style={{ textAlign: 'center', fontSize: 13.5, color: 'var(--color-text-secondary)', fontFamily: F_BODY, marginTop: 16 }}>
                ¿Ya tienes cuenta?{' '}
                <button
                  onClick={() => setVista('login')}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--color-cta)', fontWeight: 700, fontFamily: F_BODY, fontSize: 13.5 }}
                >
                  Inicia sesión
                </button>
              </p>
            </div>
          </>
        )}

        {(vista === 'login' || vista === 'signup' || vista === 'recuperar') && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
            <button
              onClick={() => irA(vista === 'recuperar' ? 'login' : 'onboarding')}
              aria-label="Volver"
              style={{
                width: 42, height: 42, borderRadius: 13, background: 'var(--color-surface-white)',
                border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', flexShrink: 0, padding: 0,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M11 4l-5 5 5 5" stroke="var(--color-text-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <div>
              <div style={{ fontFamily: F_HEAD, fontSize: 19, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--color-text-primary)' }}>
                {vista === 'login' ? 'Inicia sesión' : vista === 'signup' ? 'Crea tu cuenta' : 'Recuperar contraseña'}
              </div>
              <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--color-text-secondary)', fontFamily: F_BODY }}>
                {vista === 'login' ? 'Entrá con tu email y contraseña.' : vista === 'signup' ? 'Empieza a repartir gastos en menos de un minuto.' : 'Te mandamos un link a tu correo para elegir una nueva.'}
              </p>
            </div>
          </div>
        )}

        {/* ─── LOGIN ─── */}
        {vista === 'login' && (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <CampoTexto
              id="login-email"
              name="email"
              label="Correo"
              icon={<IconoCorreo />}
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="tu@email.com"
              value={loginEmail}
              onChange={e => setLoginEmail(e.target.value)}
            />
            <CampoTexto
              id="login-password"
              name="password"
              label="Contraseña"
              icon={<IconoCandado />}
              type={verLoginPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              value={loginPassword}
              onChange={e => setLoginPassword(e.target.value)}
              rightSlot={<BotonOjo visible={verLoginPassword} onClick={() => setVerLoginPassword(v => !v)} />}
            />

            <button
              type="button"
              onClick={() => irA('recuperar')}
              style={{
                alignSelf: 'flex-end', background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                fontSize: 12.5, fontWeight: 600, color: 'var(--color-cta)', fontFamily: F_BODY, marginTop: -4,
              }}
            >
              ¿Olvidaste tu contraseña?
            </button>

            {loginError && (
              <ErrorMsg
                action={loginNoConfirmado ? (
                  <PressBtn
                    type="button"
                    onClick={handleReenviar}
                    disabled={reenviando}
                    style={{ ...btnSecondary, height: 38, fontSize: 13, alignSelf: 'flex-start', padding: '0 14px' }}
                  >
                    {reenviando ? 'Enviando…' : reenviado ? 'Enviado ✓' : 'Reenviar email de confirmación'}
                  </PressBtn>
                ) : undefined}
              >
                {loginError}
              </ErrorMsg>
            )}

            <PressBtn
              type="submit"
              style={{ ...btnPrimary, opacity: loading ? 0.5 : 1, marginTop: 4 }}
              disabled={loading}
            >
              {loading ? 'Entrando…' : 'Entrar'}
            </PressBtn>
          </form>
        )}

        {/* ─── SIGNUP ─── */}
        {vista === 'signup' && (
          <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <CampoTexto
              id="signup-nombre"
              label="Nombre"
              icon={<IconoPersona />}
              autoComplete="name"
              autoFocus
              placeholder="¿Cómo te llaman?"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
            />

            <div>
              <Label>Color de avatar</Label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Avatar nombre={nombre || '?'} color={avatarColor} size={44} />
                <div style={{ display: 'flex', gap: 8 }}>
                  {AVATAR_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      aria-label={`Elegir color ${c}`}
                      onClick={() => setAvatarColor(c)}
                      style={{
                        width: 30, height: 30, borderRadius: '50%', background: c,
                        border: c === avatarColor ? '2px solid var(--color-text-primary)' : '2px solid transparent',
                        boxSizing: 'border-box', cursor: 'pointer', padding: 0,
                        outline: c === avatarColor ? '2px solid var(--color-surface-white)' : 'none',
                        outlineOffset: -4,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <CampoTexto
              id="signup-email"
              label="Correo"
              icon={<IconoCorreo />}
              type="email"
              autoComplete="email"
              placeholder="tu@email.com"
              value={signupEmail}
              onChange={e => setSignupEmail(e.target.value)}
            />

            <CampoTexto
              id="signup-password"
              label="Contraseña"
              icon={<IconoCandado />}
              type={verSignupPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Mínimo 6 caracteres"
              value={signupPassword}
              onChange={e => setSignupPassword(e.target.value)}
              rightSlot={<BotonOjo visible={verSignupPassword} onClick={() => setVerSignupPassword(v => !v)} />}
            />

            <CampoTexto
              id="signup-confirm"
              label="Confirmar contraseña"
              icon={<IconoCandado />}
              type={verConfirmPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              rightSlot={<BotonOjo visible={verConfirmPassword} onClick={() => setVerConfirmPassword(v => !v)} />}
            />

            {signupError && <ErrorMsg>{signupError}</ErrorMsg>}

            <PressBtn
              type="submit"
              style={{ ...btnPrimary, opacity: loading ? 0.5 : 1, marginTop: 4 }}
              disabled={loading}
            >
              {loading ? 'Creando…' : 'Crear cuenta'}
            </PressBtn>
          </form>
        )}

        {/* ─── REVISÁ TU EMAIL ─── */}
        {vista === 'revisa-email' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%', background: 'var(--color-surface-white)',
              border: '1px solid var(--color-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
            }}>
              ✉️
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 22, fontFamily: F_HEAD, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--color-text-primary)' }}>
                Revisá tu email
              </h2>
              <p style={{ margin: '10px 0 0', fontSize: 14, lineHeight: 1.5, color: 'var(--color-text-secondary)', fontFamily: F_BODY }}>
                Te mandamos un link de confirmación a <strong style={{ color: 'var(--color-text-primary)' }}>{emailEnviado}</strong>. Abrilo para activar tu cuenta.
              </p>
            </div>

            <PressBtn
              type="button"
              onClick={handleReenviarSignup}
              disabled={reenviando}
              style={{ ...btnSecondary, width: 'auto', padding: '0 20px' }}
            >
              {reenviando ? 'Enviando…' : reenviado ? 'Enviado ✓' : '¿No te llegó? Reenviar email'}
            </PressBtn>

            <button
              onClick={() => irA('login')}
              style={{
                marginTop: 4, background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 13.5, color: 'var(--color-text-secondary)', fontFamily: F_BODY, textDecoration: 'underline',
              }}
            >
              Volver a iniciar sesión
            </button>
          </div>
        )}

        {/* ─── RECUPERAR CONTRASEÑA ─── */}
        {vista === 'recuperar' && (
          <form onSubmit={handleRecuperar} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <CampoTexto
              id="recuperar-email"
              label="Correo"
              icon={<IconoCorreo />}
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="tu@email.com"
              value={recuperarEmail}
              onChange={e => setRecuperarEmail(e.target.value)}
            />

            {recuperarError && <ErrorMsg>{recuperarError}</ErrorMsg>}

            <PressBtn
              type="submit"
              style={{ ...btnPrimary, opacity: loading ? 0.5 : 1, marginTop: 4 }}
              disabled={loading}
            >
              {loading ? 'Enviando…' : 'Enviar link de recuperación'}
            </PressBtn>
          </form>
        )}

        {/* ─── LINK DE RECUPERACIÓN ENVIADO ─── */}
        {vista === 'recuperar-enviado' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%', background: 'var(--color-surface-white)',
              border: '1px solid var(--color-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
            }}>
              ✉️
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 22, fontFamily: F_HEAD, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--color-text-primary)' }}>
                Revisá tu correo
              </h2>
              <p style={{ margin: '10px 0 0', fontSize: 14, lineHeight: 1.5, color: 'var(--color-text-secondary)', fontFamily: F_BODY }}>
                Si hay una cuenta con <strong style={{ color: 'var(--color-text-primary)' }}>{emailRecuperacion}</strong>, te mandamos un link para elegir una contraseña nueva.
              </p>
            </div>

            <PressBtn
              type="button"
              onClick={handleReenviarRecuperacion}
              disabled={reenviando}
              style={{ ...btnSecondary, width: 'auto', padding: '0 20px' }}
            >
              {reenviando ? 'Enviando…' : reenviado ? 'Enviado ✓' : '¿No te llegó? Reenviar link'}
            </PressBtn>

            <button
              onClick={() => irA('login')}
              style={{
                marginTop: 4, background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 13.5, color: 'var(--color-text-secondary)', fontFamily: F_BODY, textDecoration: 'underline',
              }}
            >
              Volver a iniciar sesión
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
