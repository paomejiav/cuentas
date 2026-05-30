'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { crearGrupo, unirseAGrupo } from '@/lib/auth'
import { useSession } from '@/lib/session-store'

type Modo = 'elegir' | 'unirse' | 'crear'

const F = 'var(--font-dm-sans), sans-serif'

const input: React.CSSProperties = {
  height: 52,
  width: '100%',
  boxSizing: 'border-box',
  padding: '0 16px',
  borderRadius: 14,
  border: '1.5px solid #D8D4CE',
  background: '#FFFFFF',
  fontSize: 16,
  color: '#1C2B1A',
  fontFamily: F,
  outline: 'none',
}

const btnPrimary: React.CSSProperties = {
  height: 56,
  width: '100%',
  borderRadius: 100,
  border: 'none',
  background: '#00C851',
  color: 'white',
  fontSize: 16,
  fontWeight: 600,
  fontFamily: F,
  cursor: 'pointer',
  outline: 'none',
  transition: 'transform 120ms ease, opacity 120ms ease',
}

const btnSecondary: React.CSSProperties = {
  height: 56,
  width: '100%',
  borderRadius: 100,
  border: '1.5px solid #D8D4CE',
  background: '#E8E4DE',
  color: '#1C2B1A',
  fontSize: 16,
  fontWeight: 600,
  fontFamily: F,
  cursor: 'pointer',
  outline: 'none',
  transition: 'transform 120ms ease',
}

function Label({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      style={{
        display: 'block',
        marginBottom: 4,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.07em',
        textTransform: 'uppercase',
        color: '#6B7468',
        fontFamily: F,
        cursor: htmlFor ? 'pointer' : 'default',
      }}
    >
      {children}
    </label>
  )
}

function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  )
}

export default function LoginPage() {
  const router = useRouter()
  const { setSesion } = useSession()

  const [modo, setModo] = useState<Modo>('elegir')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [codigo, setCodigo] = useState('')
  const [nombreUnirse, setNombreUnirse] = useState('')
  const [nombreGrupo, setNombreGrupo] = useState('')
  const [nombreCrear, setNombreCrear] = useState('')

  function volver() { setModo('elegir'); setError(null) }

  async function handleUnirse(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const result = await unirseAGrupo(codigo, nombreUnirse)
      if (result.error) { setError(result.error); return }
      setSesion(result.sesion)
      router.replace('/dashboard')
    } catch (err) {
      setError('Error de conexión. Verificá tu internet e intentá de nuevo.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleCrear(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const result = await crearGrupo(nombreGrupo, nombreCrear)
      if (result.error) { setError(result.error); return }
      setSesion(result.sesion)
      router.replace('/dashboard')
    } catch (err) {
      setError('Error de conexión. Verificá tu internet e intentá de nuevo.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '40px 0',
      background: 'var(--color-bg)',
      overflowX: 'hidden',
    }}>

      {/* ── Logo ── */}
      <div style={{ marginBottom: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🧾</div>
        <h1 style={{
          margin: 0,
          fontSize: 32,
          fontWeight: 700,
          fontFamily: 'var(--font-lora), serif',
          color: '#1C2B1A',
        }}>
          Cuentas
        </h1>
        <p style={{
          margin: '6px 0 0',
          fontSize: 14,
          color: '#6B7468',
          fontFamily: F,
        }}>
          Gastos compartidos sin drama
        </p>
      </div>

      {/* ── Contenedor de acciones ── */}
      <div style={{
        width: '100%',
        maxWidth: 440,
        padding: '0 24px',
        boxSizing: 'border-box',
      }}>

        {/* ─── ELEGIR MODO ─── */}
        {modo === 'elegir' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button
              onClick={() => setModo('unirse')}
              style={btnPrimary}
              onPointerDown={e => (e.currentTarget.style.transform = 'scale(0.97)')}
              onPointerUp={e => (e.currentTarget.style.transform = 'scale(1)')}
              onPointerLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
            >
              Unirme a un grupo 🙋‍♀️
            </button>
            <button
              onClick={() => setModo('crear')}
              style={btnSecondary}
              onPointerDown={e => (e.currentTarget.style.transform = 'scale(0.97)')}
              onPointerUp={e => (e.currentTarget.style.transform = 'scale(1)')}
              onPointerLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
            >
              Crear un grupo nuevo ✨
            </button>
          </div>
        )}

        {/* ─── UNIRSE ─── */}
        {modo === 'unirse' && (
          <form onSubmit={handleUnirse} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field label="Código del grupo" htmlFor="input-codigo">
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
            </Field>

            <Field label="Tu nombre" htmlFor="input-nombre-unirse">
              <input
                id="input-nombre-unirse"
                type="text"
                placeholder="¿Cómo te llaman?"
                value={nombreUnirse}
                onChange={e => setNombreUnirse(e.target.value)}
                style={input}
                onFocus={e => (e.target.style.borderColor = '#00C851')}
                onBlur={e => (e.target.style.borderColor = '#D8D4CE')}
              />
            </Field>

            {error && (
              <p style={{
                margin: 0,
                fontSize: 13,
                textAlign: 'center',
                color: 'var(--color-negative)',
                fontFamily: F,
              }}>
                {error}
              </p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
              <button
                type="submit"
                disabled={loading || !codigo || !nombreUnirse}
                style={{ ...btnPrimary, opacity: (loading || !codigo || !nombreUnirse) ? 0.5 : 1, cursor: loading ? 'wait' : 'pointer' }}
                onPointerDown={e => { if (!loading) e.currentTarget.style.transform = 'scale(0.97)' }}
                onPointerUp={e => (e.currentTarget.style.transform = 'scale(1)')}
                onPointerLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
              >
                {loading ? 'Entrando…' : 'Entrar al grupo →'}
              </button>
              <button
                type="button"
                onClick={volver}
                style={btnSecondary}
                onPointerDown={e => (e.currentTarget.style.transform = 'scale(0.97)')}
                onPointerUp={e => (e.currentTarget.style.transform = 'scale(1)')}
                onPointerLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
              >
                ← Volver
              </button>
            </div>
          </form>
        )}

        {/* ─── CREAR ─── */}
        {modo === 'crear' && (
          <form onSubmit={handleCrear} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field label="Nombre del grupo" htmlFor="input-nombre-grupo">
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
            </Field>

            <Field label="Tu nombre" htmlFor="input-nombre-crear">
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
            </Field>

            <p style={{ margin: 0, fontSize: 12, textAlign: 'center', color: '#6B7468', fontFamily: F }}>
              Se generará un código para que tus amigas se unan 🎉
            </p>

            {error && (
              <p style={{ margin: 0, fontSize: 13, textAlign: 'center', color: 'var(--color-negative)', fontFamily: F }}>
                {error}
              </p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
              <button
                type="submit"
                disabled={loading || !nombreGrupo || !nombreCrear}
                style={{ ...btnPrimary, opacity: (loading || !nombreGrupo || !nombreCrear) ? 0.5 : 1, cursor: loading ? 'wait' : 'pointer' }}
                onPointerDown={e => { if (!loading) e.currentTarget.style.transform = 'scale(0.97)' }}
                onPointerUp={e => (e.currentTarget.style.transform = 'scale(1)')}
                onPointerLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
              >
                {loading ? 'Creando…' : 'Crear grupo ✨'}
              </button>
              <button
                type="button"
                onClick={volver}
                style={btnSecondary}
                onPointerDown={e => (e.currentTarget.style.transform = 'scale(0.97)')}
                onPointerUp={e => (e.currentTarget.style.transform = 'scale(1)')}
                onPointerLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
              >
                ← Volver
              </button>
            </div>
          </form>
        )}
      </div>

      {/* ── Footer ── */}
      <p style={{
        marginTop: 48,
        fontSize: 12,
        textAlign: 'center',
        color: 'var(--color-text-disabled)',
        fontFamily: F,
      }}>
        Sin email. Sin contraseña. Solo el código del grupo. 🔑
      </p>
    </main>
  )
}
