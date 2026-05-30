'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { crearGrupo, unirseAGrupo } from '@/lib/auth'
import { useSession } from '@/lib/session-store'

type Modo = 'elegir' | 'unirse' | 'crear'

const inputStyle: React.CSSProperties = {
  background: 'var(--color-card-light)',
  color: 'var(--color-text-primary)',
  fontFamily: 'var(--font-dm-sans), sans-serif',
  height: '52px',
  border: 'none',
  width: '100%',
  padding: '0 16px',
  borderRadius: '14px',
  fontSize: '16px',
  outline: 'none',
  boxSizing: 'border-box',
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label
        className="block text-xs font-semibold mb-1.5 tracking-wide uppercase"
        style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-dm-sans), sans-serif' }}
      >
        {label}
      </label>
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

  function volver() {
    setModo('elegir')
    setError(null)
  }

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
    <main
      className="min-h-[100dvh] flex flex-col items-center justify-center px-5"
      style={{ background: 'var(--color-bg)' }}
    >
      {/* Header */}
      <div className="mb-10 text-center">
        <div className="text-5xl mb-3">🧾</div>
        <h1
          className="text-3xl font-bold"
          style={{ fontFamily: 'var(--font-lora), serif', color: 'var(--color-text-primary)' }}
        >
          Cuentas
        </h1>
        <p
          className="mt-1 text-sm"
          style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-dm-sans), sans-serif' }}
        >
          Gastos compartidos sin drama
        </p>
      </div>

      <div style={{ width: '100%', maxWidth: 440 }}>

        {/* ─── ELEGIR MODO ─── */}
        {modo === 'elegir' && (
          <div className="flex flex-col gap-3">
            <button
              onClick={() => setModo('unirse')}
              className="w-full h-14 rounded-[100px] text-base font-semibold transition-transform active:scale-[0.97]"
              style={{ background: 'var(--color-cta)', color: 'white', border: 'none', outline: 'none', fontFamily: 'var(--font-dm-sans), sans-serif' }}
            >
              Unirme a un grupo 🙋‍♀️
            </button>
            <button
              onClick={() => setModo('crear')}
              className="w-full h-14 rounded-[100px] text-base font-medium transition-transform active:scale-[0.97]"
              style={{ background: 'var(--color-card)', color: 'var(--color-text-primary)', border: '1.5px solid var(--color-border)', outline: 'none', fontFamily: 'var(--font-dm-sans), sans-serif' }}
            >
              Crear un grupo nuevo ✨
            </button>
          </div>
        )}

        {/* ─── UNIRSE ─── */}
        {modo === 'unirse' && (
          <form onSubmit={handleUnirse} className="flex flex-col gap-4">
            <Field label="Código del grupo">
              <input
                type="text"
                placeholder="Ej: MGL001"
                maxLength={8}
                value={codigo}
                onChange={e => setCodigo(e.target.value.toUpperCase())}
                autoFocus
                style={{ ...inputStyle, textAlign: 'center', letterSpacing: '0.15em', fontWeight: 600 }}
                onFocus={e => { e.target.style.outline = '2px solid var(--color-cta)'; e.target.style.background = 'white' }}
                onBlur={e => { e.target.style.outline = 'none'; e.target.style.background = 'var(--color-card-light)' }}
              />
            </Field>

            <Field label="Tu nombre">
              <input
                type="text"
                placeholder="¿Cómo te llaman?"
                value={nombreUnirse}
                onChange={e => setNombreUnirse(e.target.value)}
                style={inputStyle}
                onFocus={e => { e.target.style.outline = '2px solid var(--color-cta)'; e.target.style.background = 'white' }}
                onBlur={e => { e.target.style.outline = 'none'; e.target.style.background = 'var(--color-card-light)' }}
              />
            </Field>

            {error && (
              <p className="text-sm text-center" style={{ color: 'var(--color-negative)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !codigo || !nombreUnirse}
              className="w-full h-14 rounded-[100px] text-base font-semibold transition-all active:scale-[0.97] disabled:opacity-50"
              style={{ background: 'var(--color-cta)', color: 'white', fontFamily: 'var(--font-dm-sans), sans-serif', marginTop: '4px' }}
            >
              {loading ? 'Entrando…' : 'Entrar al grupo →'}
            </button>

            <button type="button" onClick={volver} className="text-sm text-center"
              style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
              ← Volver
            </button>
          </form>
        )}

        {/* ─── CREAR ─── */}
        {modo === 'crear' && (
          <form onSubmit={handleCrear} className="flex flex-col gap-4">
            <Field label="Nombre del grupo">
              <input
                type="text"
                placeholder="Ej: Las chicas"
                value={nombreGrupo}
                onChange={e => setNombreGrupo(e.target.value)}
                autoFocus
                style={inputStyle}
                onFocus={e => { e.target.style.outline = '2px solid var(--color-cta)'; e.target.style.background = 'white' }}
                onBlur={e => { e.target.style.outline = 'none'; e.target.style.background = 'var(--color-card-light)' }}
              />
            </Field>

            <Field label="Tu nombre">
              <input
                type="text"
                placeholder="¿Cómo te llaman?"
                value={nombreCrear}
                onChange={e => setNombreCrear(e.target.value)}
                style={inputStyle}
                onFocus={e => { e.target.style.outline = '2px solid var(--color-cta)'; e.target.style.background = 'white' }}
                onBlur={e => { e.target.style.outline = 'none'; e.target.style.background = 'var(--color-card-light)' }}
              />
            </Field>

            <p className="text-xs text-center -mt-1"
              style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
              Se generará un código para que tus amigas se unan 🎉
            </p>

            {error && (
              <p className="text-sm text-center" style={{ color: 'var(--color-negative)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !nombreGrupo || !nombreCrear}
              className="w-full h-14 rounded-[100px] text-base font-semibold transition-all active:scale-[0.97] disabled:opacity-50"
              style={{ background: 'var(--color-cta)', color: 'white', fontFamily: 'var(--font-dm-sans), sans-serif', marginTop: '4px' }}
            >
              {loading ? 'Creando…' : 'Crear grupo ✨'}
            </button>

            <button type="button" onClick={volver} className="text-sm text-center"
              style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
              ← Volver
            </button>
          </form>
        )}
      </div>

      <p
        className="mt-12 text-xs text-center"
        style={{ color: 'var(--color-text-disabled)', fontFamily: 'var(--font-dm-sans), sans-serif' }}
      >
        Sin email. Sin contraseña. Solo el código del grupo. 🔑
      </p>
    </main>
  )
}
