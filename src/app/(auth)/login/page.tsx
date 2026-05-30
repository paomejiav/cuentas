'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { verificarCodigo, seleccionarIntegrante, crearGrupo } from '@/lib/auth'
import { useSession } from '@/lib/session-store'
import { Avatar } from '@/components/app/Avatar'
import type { Grupo, Integrante } from '@/types/database'

type Modo = 'elegir' | 'codigo' | 'personas' | 'crear'

const F = 'var(--font-dm-sans), sans-serif'

const input: React.CSSProperties = {
  height: 52, width: '100%', boxSizing: 'border-box',
  padding: '0 16px', borderRadius: 14,
  border: '1.5px solid #D8D4CE', background: '#FFFFFF',
  fontSize: 16, color: '#1C2B1A', fontFamily: F, outline: 'none',
}

const btnPrimary: React.CSSProperties = {
  height: 56, width: '100%', borderRadius: 100, border: 'none',
  background: '#00C851', color: 'white', fontSize: 16, fontWeight: 600,
  fontFamily: F, cursor: 'pointer', outline: 'none',
  transition: 'transform 120ms ease, opacity 120ms ease',
}

const btnSecondary: React.CSSProperties = {
  height: 56, width: '100%', borderRadius: 100,
  border: '1.5px solid #D8D4CE', background: '#E8E4DE',
  color: '#1C2B1A', fontSize: 16, fontWeight: 600,
  fontFamily: F, cursor: 'pointer', outline: 'none',
  transition: 'transform 120ms ease',
}

function Label({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} style={{
      display: 'block', marginBottom: 4, fontSize: 11, fontWeight: 600,
      letterSpacing: '0.07em', textTransform: 'uppercase',
      color: '#6B7468', fontFamily: F,
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

export default function LoginPage() {
  const router = useRouter()
  const { setSesion } = useSession()

  const [modo, setModo] = useState<Modo>('elegir')
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
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      justifyContent: 'center', alignItems: 'center',
      padding: '40px 0', background: 'var(--color-bg)', overflowX: 'hidden',
    }}>
      {/* Logo */}
      <div style={{ marginBottom: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🧾</div>
        <h1 style={{ margin: 0, fontSize: 32, fontWeight: 700, fontFamily: 'var(--font-lora), serif', color: '#1C2B1A' }}>
          Cuentas
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: 14, color: '#6B7468', fontFamily: F }}>
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
              onFocus={e => (e.target.style.borderColor = '#00C851')}
              onBlur={e => (e.target.style.borderColor = '#D8D4CE')}
            />

            {error && (
              <p style={{ margin: 0, fontSize: 13, textAlign: 'center', color: 'var(--color-negative)', fontFamily: F }}>
                {error}
              </p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
              <PressBtn
                type="submit"
                style={{ ...btnPrimary, opacity: (!codigo || loading) ? 0.5 : 1 }}
                disabled={!codigo || loading}
              >
                {loading ? 'Buscando…' : 'Continuar →'}
              </PressBtn>
              <PressBtn style={btnSecondary} onClick={volver}>← Volver</PressBtn>
            </div>
          </form>
        )}

        {/* ─── PASO 2: SELECCIONAR PERSONA ─── */}
        {modo === 'personas' && grupo && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ textAlign: 'center', marginBottom: 4 }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#6B7468', fontFamily: F }}>
                Grupo encontrado
              </p>
              <h2 style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-lora), serif', color: '#1C2B1A' }}>
                {grupo.nombre}
              </h2>
              <p style={{ margin: '6px 0 0', fontSize: 13, color: '#6B7468', fontFamily: F }}>
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
                    border: '1.5px solid #D8D4CE', background: '#FFFFFF',
                    cursor: 'pointer', textAlign: 'left',
                    transition: 'all 150ms ease',
                    WebkitTapHighlightColor: 'transparent',
                  }}
                  onPointerDown={e => { e.currentTarget.style.borderColor = '#00C851'; e.currentTarget.style.transform = 'scale(0.98)' }}
                  onPointerUp={e => { e.currentTarget.style.borderColor = '#D8D4CE'; e.currentTarget.style.transform = 'scale(1)' }}
                  onPointerLeave={e => { e.currentTarget.style.borderColor = '#D8D4CE'; e.currentTarget.style.transform = 'scale(1)' }}
                >
                  <Avatar nombre={i.nombre} color={i.avatar_color} size={44} />
                  <span style={{ fontSize: 16, fontWeight: 600, color: '#1C2B1A', fontFamily: F }}>
                    {i.nombre}
                    {i.es_admin && (
                      <span style={{ marginLeft: 8, fontSize: 11, color: '#6B7468', fontWeight: 400 }}>admin</span>
                    )}
                  </span>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ marginLeft: 'auto', flexShrink: 0, opacity: 0.4 }}>
                    <path d="M6 4l4 4-4 4" stroke="#1C2B1A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              ))}
            </div>

            <PressBtn style={btnSecondary} onClick={volver}>← Volver</PressBtn>
          </div>
        )}

        {/* ─── CREAR GRUPO ─── */}
        {modo === 'crear' && (
          <form onSubmit={handleCrear} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
                onFocus={e => (e.target.style.borderColor = '#00C851')}
                onBlur={e => (e.target.style.borderColor = '#D8D4CE')}
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
                onFocus={e => (e.target.style.borderColor = '#00C851')}
                onBlur={e => (e.target.style.borderColor = '#D8D4CE')}
              />
            </div>

            <p style={{ margin: 0, fontSize: 12, textAlign: 'center', color: '#6B7468', fontFamily: F }}>
              Serás la administradora del grupo 👑
            </p>

            {error && (
              <p style={{ margin: 0, fontSize: 13, textAlign: 'center', color: 'var(--color-negative)', fontFamily: F }}>
                {error}
              </p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
              <PressBtn
                type="submit"
                style={{ ...btnPrimary, opacity: (!nombreGrupo || !nombreCrear || loading) ? 0.5 : 1 }}
                disabled={!nombreGrupo || !nombreCrear || loading}
              >
                {loading ? 'Creando…' : 'Crear grupo ✨'}
              </PressBtn>
              <PressBtn style={btnSecondary} onClick={volver}>← Volver</PressBtn>
            </div>
          </form>
        )}
      </div>

      <p style={{ marginTop: 48, fontSize: 12, textAlign: 'center', color: 'var(--color-text-disabled)', fontFamily: F }}>
        Sin email. Sin contraseña. Solo el código del grupo. 🔑
      </p>
    </main>
  )
}
