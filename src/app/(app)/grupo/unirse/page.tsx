'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { hrefHomeGrupo, guardarCodigoInvitacionPendiente } from '@/lib/grupo'

const F_HEAD = 'var(--font-sora), sans-serif'
const F_BODY = 'var(--font-dm-sans), sans-serif'
const F_MONO = 'ui-monospace, Menlo, monospace'

type Estado = 'cargando' | 'invalido' | 'exito'

interface GrupoUnido {
  id: string
  nombre: string
}

function IconoCirculo({ children, negativo }: { children: React.ReactNode; negativo?: boolean }) {
  return (
    <div style={{
      width: 64, height: 64, borderRadius: '50%',
      background: negativo ? 'var(--color-negative-tint)' : 'var(--color-surface-white)',
      border: negativo ? 'none' : '1px solid var(--color-border)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
    }}>
      {children}
    </div>
  )
}

function BotonPrimario({ children, type = 'button', disabled }: {
  children: React.ReactNode
  type?: 'button' | 'submit'
  disabled?: boolean
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      style={{
        height: 54, width: '100%', borderRadius: 15, border: 'none',
        background: 'var(--gradient-cta)', boxShadow: 'var(--shadow-cta)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: F_BODY, fontSize: 15.5, fontWeight: 700, color: '#fff',
        cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.55 : 1,
      }}
    >
      {children}
    </button>
  )
}

export default function UnirseGrupoPage() {
  return (
    <Suspense>
      <UnirseGrupoInner />
    </Suspense>
  )
}

function UnirseGrupoInner() {
  const router = useRouter()
  const params = useSearchParams()
  const codigoUrl = (params.get('codigo') ?? '').trim().toUpperCase()

  const [estado, setEstado] = useState<Estado>('cargando')
  const [grupo, setGrupo] = useState<GrupoUnido | null>(null)

  const [codigoManual, setCodigoManual] = useState(codigoUrl)
  const [enviando, setEnviando] = useState(false)
  const [errorManual, setErrorManual] = useState<string | null>(null)

  function manejarExito(g: GrupoUnido) {
    setGrupo(g)
    setEstado('exito')
    setTimeout(() => router.replace(hrefHomeGrupo(g.id)), 900)
  }

  useEffect(() => {
    let activo = true

    async function cargar() {
      if (!codigoUrl) { setEstado('invalido'); return }

      const { data: { user } } = await supabase.auth.getUser()
      if (!activo) return

      if (!user) {
        // Sin sesión: la persona tiene que crear cuenta o iniciar sesión
        // primero. Guardamos el código para que sobreviva al correo de
        // confirmación de registro (puede abrirse en otro navegador).
        guardarCodigoInvitacionPendiente(codigoUrl)
        router.replace(`/login?modo=crear&codigo=${encodeURIComponent(codigoUrl)}`)
        return
      }

      const { data, error } = await supabase.rpc('unirse_a_grupo', { p_codigo: codigoUrl })
      if (!activo) return
      if (error || !data) { setEstado('invalido'); return }
      manejarExito(data as GrupoUnido)
    }

    cargar()
    return () => { activo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codigoUrl])

  async function handleReintentar(e: React.FormEvent) {
    e.preventDefault()
    const cod = codigoManual.trim().toUpperCase()
    if (!cod) { setErrorManual('Ingresá el código de invitación.'); return }

    setEnviando(true)
    setErrorManual(null)
    try {
      const { data, error } = await supabase.rpc('unirse_a_grupo', { p_codigo: cod })
      if (error || !data) { setErrorManual('Ese código no es válido.'); return }
      manejarExito(data as GrupoUnido)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <main style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      justifyContent: 'center', alignItems: 'center',
      padding: '40px 0', background: 'var(--color-bg)', overflowX: 'hidden',
    }}>
      <div style={{ width: '100%', maxWidth: 440, padding: '0 24px', boxSizing: 'border-box' }}>

        {estado === 'cargando' && (
          <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--color-text-secondary)', fontFamily: F_BODY }}>
            Verificando el enlace…
          </p>
        )}

        {estado === 'exito' && grupo && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
            <IconoCirculo>🎉</IconoCirculo>
            <div>
              <h2 style={{ margin: 0, fontFamily: F_HEAD, fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--color-text-primary)' }}>
                Ya eres parte de {grupo.nombre}
              </h2>
              <p style={{ margin: '10px 0 0', fontSize: 14, lineHeight: 1.5, color: 'var(--color-text-secondary)', fontFamily: F_BODY }}>
                Te llevamos al grupo…
              </p>
            </div>
          </div>
        )}

        {estado === 'invalido' && (
          <form onSubmit={handleReintentar} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
            <IconoCirculo negativo>⚠️</IconoCirculo>
            <div>
              <h2 style={{ margin: 0, fontFamily: F_HEAD, fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--color-text-primary)' }}>
                Este código ya no es válido
              </h2>
              <p style={{ margin: '10px 0 0', fontSize: 14, lineHeight: 1.5, color: 'var(--color-text-secondary)', fontFamily: F_BODY }}>
                El grupo no existe o el código está mal escrito. Puedes escribirlo de nuevo.
              </p>
            </div>
            <input
              value={codigoManual}
              onChange={e => { setCodigoManual(e.target.value.toUpperCase()); if (errorManual) setErrorManual(null) }}
              placeholder="Ej: A1B2C3"
              maxLength={6}
              style={{
                width: '100%', height: 52, borderRadius: 14, boxSizing: 'border-box',
                border: `1px solid ${errorManual ? 'var(--color-negative)' : 'var(--color-border)'}`,
                background: 'var(--color-surface-white)', textAlign: 'center', outline: 'none',
                fontSize: 17, fontWeight: 600, letterSpacing: '.28em', textTransform: 'uppercase',
                color: errorManual ? 'var(--color-negative)' : 'var(--color-text-primary)',
                fontFamily: F_MONO,
              }}
            />
            {errorManual && (
              <p style={{ margin: 0, fontSize: 12.5, color: 'var(--color-negative)', fontFamily: F_BODY }}>{errorManual}</p>
            )}
            <BotonPrimario type="submit" disabled={enviando}>
              {enviando ? 'Uniéndome…' : 'Unirme al grupo'}
            </BotonPrimario>
          </form>
        )}
      </div>
    </main>
  )
}
