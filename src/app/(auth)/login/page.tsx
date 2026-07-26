'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { verificarCodigo, seleccionarIntegrante, crearGrupo } from '@/lib/auth'
import { useSession } from '@/lib/session-store'
import { Avatar } from '@/components/app/Avatar'
import type { Grupo, Integrante } from '@/types/database'

type Modo = 'elegir' | 'codigo' | 'personas' | 'crear'

const F = 'var(--font-dm-sans), sans-serif'

const input: React.CSSProperties = {
  height: 52, width: '100%', boxSizing: 'border-box',
  padding: '0 15px', borderRadius: 14,
  border: '1px solid var(--color-border)', background: 'var(--color-surface-white)',
  fontSize: 14.5, fontWeight: 500, color: 'var(--color-text-primary)', fontFamily: F, outline: 'none',
}

const btnPrimary: React.CSSProperties = {
  height: 54, width: '100%', borderRadius: 15, border: 'none',
  background: 'var(--gradient-cta)', color: 'white', fontSize: 15.5, fontWeight: 700,
  fontFamily: F, cursor: 'pointer', outline: 'none', boxShadow: 'var(--shadow-cta)',
  transition: 'transform 120ms ease, opacity 120ms ease',
}

const btnSecondary: React.CSSProperties = {
  height: 54, width: '100%', borderRadius: 15,
  border: '1px solid var(--color-border)', background: 'var(--color-surface-white)',
  color: 'var(--color-text-primary)', fontSize: 15, fontWeight: 700,
  fontFamily: F, cursor: 'pointer', outline: 'none',
  transition: 'transform 120ms ease',
}

function Label({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} style={{
      display: 'block', marginBottom: 8, fontSize: 11, fontWeight: 700,
      letterSpacing: '0.08em', textTransform: 'uppercase',
      color: 'var(--color-text-muted)', fontFamily: F,
    }}>
      {children}
    </label>
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

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Volver"
      style={{
        position: 'absolute', top: 'max(24px, env(safe-area-inset-top, 0px))', left: 20,
        background: 'var(--color-surface-white)', border: '1px solid var(--color-border)',
        borderRadius: 13, width: 42, height: 42, padding: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
      }}
    >
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M11 4l-5 5 5 5" stroke="var(--color-text-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
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
  const { setSesion } = useSession()

  const [modo, setModo] = useState<Modo>(params.get('modo') === 'crear' ? 'crear' : 'elegir')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Paso 1 — código
  const [codigo, setCodigo] = useState('')
  const [grupo, setGrupo] = useState<Grupo | null>(null)
  const [integrantes, setIntegrantes] = useState<Integrante[]>([])

  // Crear grupo
  const [nombreGrupo, setNombreGrupo] = useState('')
  const [nombreCrear, setNombreCrear] = useState('')

  function volver() { setModo('elegir'); setError(null); setCodigo(''); setGrupo(null) }

  // ── Paso 1: verificar código ──
  async function handleVerificarCodigo(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const result = await verificarCodigo(codigo)
      if (result.error) { setError(result.error); return }
      setGrupo(result.grupo!)
      setIntegrantes(result.integrantes!)
      setModo('personas')
    } catch {
      setError('Error de conexión. Verificá tu internet e intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  // ── Paso 2: seleccionar integrante ──
  function handleSeleccionar(integrante: Integrante) {
    if (!grupo) return
    const sesion = seleccionarIntegrante(grupo, integrante)
    setSesion(sesion)
    router.replace('/dashboard')
  }

  // ── Crear grupo nuevo ──
  async function handleCrear(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const result = await crearGrupo(nombreGrupo, nombreCrear)
      if (result.error) { setError(result.error); return }
      setSesion(result.sesion)
      router.replace('/dashboard')
    } catch {
      setError('Error de conexión. Verificá tu internet e intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{
      position: 'relative',
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      justifyContent: 'center', alignItems: 'center',
      padding: '40px 0', background: 'var(--color-bg)', overflowX: 'hidden',
    }}>
      {modo !== 'elegir' && <BackButton onClick={volver} />}

      {/* Logo */}
      <div style={{ marginBottom: 36, textAlign: 'center' }}>
        <div style={{
          width: 54, height: 54, borderRadius: 17, margin: '0 auto 16px',
          background: 'var(--gradient-cta)', boxShadow: 'var(--shadow-cta)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="27" height="27" viewBox="0 0 24 24" fill="none">
            <path d="M6 3h9l3 3v15a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
            <path d="M8.5 9h7M8.5 13h7" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, fontFamily: 'var(--font-sora), sans-serif', letterSpacing: '-0.02em', color: 'var(--color-text-primary)' }}>
          Better than Split
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: 13.5, color: 'var(--color-text-secondary)', fontFamily: F }}>
          Gastos compartidos sin drama
        </p>
      </div>

      <div style={{ width: '100%', maxWidth: 440, padding: '0 24px', boxSizing: 'border-box' }}>

        {/* ─── ELEGIR MODO ─── */}
        {modo === 'elegir' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <PressBtn style={btnPrimary} onClick={() => setModo('codigo')}>
              Unirme a un grupo 🙋‍♀️
            </PressBtn>
            <PressBtn style={btnSecondary} onClick={() => setModo('crear')}>
              Crear un grupo nuevo ✨
            </PressBtn>
          </div>
        )}

        {/* ─── PASO 1: CÓDIGO ─── */}
        {modo === 'codigo' && (
          <form onSubmit={handleVerificarCodigo} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Label htmlFor="input-codigo">Código del grupo</Label>
            <input
              id="input-codigo"
              type="text"
              placeholder="Ej: MGL001"
              maxLength={8}
              value={codigo}
              onChange={e => setCodigo(e.target.value.toUpperCase())}
              autoFocus
              style={{ ...input, textAlign: 'center', letterSpacing: '0.15em', fontWeight: 700 }}
              onFocus={e => (e.target.style.borderColor = 'var(--color-cta)')}
              onBlur={e => (e.target.style.borderColor = 'var(--color-border)')}
            />

            {error && (
              <p style={{ margin: 0, fontSize: 13, textAlign: 'center', color: 'var(--color-negative)', fontFamily: F }}>
                {error}
              </p>
            )}

            <PressBtn
              type="submit"
              style={{ ...btnPrimary, opacity: (!codigo || loading) ? 0.5 : 1, marginTop: 4 }}
              disabled={!codigo || loading}
            >
              {loading ? 'Buscando…' : 'Continuar →'}
            </PressBtn>
          </form>
        )}

        {/* ─── PASO 2: SELECCIONAR PERSONA ─── */}
        {modo === 'personas' && grupo && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ textAlign: 'center', marginBottom: 4 }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontFamily: F }}>
                Grupo encontrado
              </p>
              <h2 style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 800, fontFamily: 'var(--font-sora), sans-serif', letterSpacing: '-0.02em', color: 'var(--color-text-primary)' }}>
                {grupo.nombre}
              </h2>
              <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--color-text-secondary)', fontFamily: F }}>
                ¿Quién eres?
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {integrantes.map(i => (
                <button
                  key={i.id}
                  onClick={() => handleSeleccionar(i)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '12px 16px', borderRadius: 16,
                    border: '1px solid var(--color-border)', background: 'var(--color-surface-white)',
                    cursor: 'pointer', textAlign: 'left',
                    transition: 'all 150ms ease',
                    WebkitTapHighlightColor: 'transparent',
                  }}
                  onPointerDown={e => { e.currentTarget.style.borderColor = 'var(--color-cta)'; e.currentTarget.style.transform = 'scale(0.98)' }}
                  onPointerUp={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.transform = 'scale(1)' }}
                  onPointerLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.transform = 'scale(1)' }}
                >
                  <Avatar nombre={i.nombre} color={i.avatar_color} size={44} />
                  <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: F }}>
                    {i.nombre}
                    {i.es_admin && (
                      <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 400 }}>admin</span>
                    )}
                  </span>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ marginLeft: 'auto', flexShrink: 0, opacity: 0.4 }}>
                    <path d="M6 4l4 4-4 4" stroke="var(--color-text-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ─── CREAR GRUPO ─── */}
        {modo === 'crear' && (
          <form onSubmit={handleCrear} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h2 style={{ margin: '0 0 4px', textAlign: 'center', fontSize: 24, fontWeight: 800, fontFamily: 'var(--font-sora), sans-serif', letterSpacing: '-0.02em', color: 'var(--color-text-primary)' }}>
              Crear un grupo
            </h2>
            <p style={{ margin: '0 0 8px', textAlign: 'center', fontSize: 13, color: 'var(--color-text-secondary)', fontFamily: F }}>
              Serás la administradora del grupo 👑
            </p>

            <div>
              <Label htmlFor="input-nombre-grupo">Nombre del grupo</Label>
              <input
                id="input-nombre-grupo"
                type="text"
                placeholder="Ej: Las chicas"
                value={nombreGrupo}
                onChange={e => setNombreGrupo(e.target.value)}
                autoFocus
                style={input}
                onFocus={e => (e.target.style.borderColor = 'var(--color-cta)')}
                onBlur={e => (e.target.style.borderColor = 'var(--color-border)')}
              />
            </div>

            <div>
              <Label htmlFor="input-nombre-crear">Tu nombre</Label>
              <input
                id="input-nombre-crear"
                type="text"
                placeholder="¿Cómo te llaman?"
                value={nombreCrear}
                onChange={e => setNombreCrear(e.target.value)}
                style={input}
                onFocus={e => (e.target.style.borderColor = 'var(--color-cta)')}
                onBlur={e => (e.target.style.borderColor = 'var(--color-border)')}
              />
            </div>

            {error && (
              <p style={{ margin: 0, fontSize: 13, textAlign: 'center', color: 'var(--color-negative)', fontFamily: F }}>
                {error}
              </p>
            )}

            <PressBtn
              type="submit"
              style={{ ...btnPrimary, opacity: (!nombreGrupo || !nombreCrear || loading) ? 0.5 : 1, marginTop: 4 }}
              disabled={!nombreGrupo || !nombreCrear || loading}
            >
              {loading ? 'Creando…' : 'Crear grupo ✨'}
            </PressBtn>
          </form>
        )}
      </div>

      <p style={{ marginTop: 48, fontSize: 12, textAlign: 'center', color: 'var(--color-text-disabled)', fontFamily: F }}>
        Sin email. Sin contraseña. Solo el código del grupo. 🔑
      </p>
    </main>
  )
}
