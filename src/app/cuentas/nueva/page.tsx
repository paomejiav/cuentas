'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { resolverGrupoActivo } from '@/lib/grupo-activo'
import { listarMiembrosGrupoParaCuenta, ICONO_TIPO, LABEL_TIPO, type TipoCuenta, type MiembroGrupoMini } from '@/lib/cuentas'
import { Avatar } from '@/components/app/Avatar'

const F_HEAD = 'var(--font-sora), sans-serif'
const F_BODY = 'var(--font-dm-sans), sans-serif'

const TIPOS: TipoCuenta[] = ['hogar', 'viaje', 'evento']

export default function NuevaCuentaPage() {
  return (
    <Suspense>
      <NuevaCuentaInner />
    </Suspense>
  )
}

function NuevaCuentaInner() {
  const router = useRouter()
  const params = useSearchParams()

  const [cargando, setCargando] = useState(true)
  const [grupoId, setGrupoId] = useState<string | null>(null)
  const [miembros, setMiembros] = useState<MiembroGrupoMini[]>([])

  const [nombre, setNombre] = useState('')
  const [tipo, setTipo] = useState<TipoCuenta>('hogar')
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set())
  const [creando, setCreando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let activo = true

    async function cargar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }

      const resolucion = await resolverGrupoActivo(user.id, params.get('grupo'))
      if (!activo) return

      if (resolucion.estado === 'sin-grupos') { router.replace('/'); return }
      if (resolucion.estado === 'elegir') { router.replace('/cuentas'); return }

      const lista = await listarMiembrosGrupoParaCuenta(resolucion.grupoId, null, user.id)
      if (!activo) return
      setGrupoId(resolucion.grupoId)
      setMiembros(lista)
      setCargando(false)
    }

    cargar()
    return () => { activo = false }
  }, [router, params])

  function toggleMiembro(id: string) {
    setSeleccionados(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleCrear(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const formData = new FormData(e.currentTarget)
    const nombreFinal = ((formData.get('nombre') as string) || nombre).trim()
    if (!nombreFinal) { setError('Ingresá un nombre para la cuenta.'); return }
    if (!grupoId) return

    setCreando(true)
    try {
      const { data, error: rpcError } = await supabase.rpc('crear_cuenta', {
        p_grupo_id: grupoId,
        p_nombre: nombreFinal,
        p_tipo: tipo,
        p_icono: ICONO_TIPO[tipo],
        p_integrantes: Array.from(seleccionados),
      })
      if (rpcError) { setError(rpcError.message); return }
      router.push(`/cuentas/${data.id}`)
    } catch {
      setError('Error de conexión. Verificá tu internet e intentá de nuevo.')
    } finally {
      setCreando(false)
    }
  }

  if (cargando) {
    return (
      <main style={{ minHeight: '100dvh', background: 'var(--color-bg)' }}>
        <p style={{ padding: 24, fontSize: 13.5, color: 'var(--color-text-secondary)', fontFamily: F_BODY }}>Cargando…</p>
      </main>
    )
  }

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--color-bg)' }}>
      <form onSubmit={handleCrear} style={{
        maxWidth: 440, margin: '0 auto', padding: '0 18px',
        paddingTop: 'max(20px, env(safe-area-inset-top, 0px))',
        paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
        minHeight: '100dvh', boxSizing: 'border-box', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Volver"
            style={{
              width: 42, height: 42, borderRadius: 13, background: 'var(--color-surface-white)',
              border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0, padding: 0,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none"><path d="M14 4L4 14M4 4l10 10" stroke="var(--color-text-primary)" strokeWidth="1.8" strokeLinecap="round" /></svg>
          </button>
          <div style={{ fontFamily: F_HEAD, fontSize: 19, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--color-text-primary)' }}>
            Nueva cuenta
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 22 }}>
          <div style={{
            width: 76, height: 76, borderRadius: 22, background: 'var(--tint-cta)', border: '1px solid var(--border-cta)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34,
          }}>
            {ICONO_TIPO[tipo]}
          </div>
          <span style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 10, fontFamily: F_BODY }}>
            El ícono sigue al tipo que elijas
          </span>
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--color-text-muted)', margin: '0 2px 8px', fontFamily: F_BODY }}>
          Nombre de la cuenta
        </div>
        <input
          name="nombre"
          value={nombre}
          onChange={e => setNombre(e.target.value)}
          placeholder="Ej: Depto Ñuñoa"
          autoFocus
          maxLength={40}
          style={{
            height: 52, boxSizing: 'border-box', padding: '0 15px', borderRadius: 14, border: 'none',
            background: 'var(--color-surface-white)', fontSize: 14.5, fontWeight: 500,
            color: 'var(--color-text-primary)', fontFamily: F_BODY, outline: 'none',
          }}
        />

        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--color-text-muted)', margin: '18px 2px 10px', fontFamily: F_BODY }}>
          Tipo
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {TIPOS.map(t => {
            const activo = t === tipo
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTipo(t)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 100,
                  padding: '8px 14px', fontSize: 13, fontWeight: activo ? 600 : 500,
                  background: activo ? 'var(--tint-cta)' : 'var(--color-surface-white)',
                  border: `1px solid ${activo ? 'var(--border-cta)' : 'var(--color-border)'}`,
                  color: activo ? 'var(--color-cta-dark)' : 'var(--color-text-secondary)',
                  cursor: 'pointer', fontFamily: F_BODY,
                }}
              >
                {ICONO_TIPO[t]} {LABEL_TIPO[t]}
              </button>
            )
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '22px 2px 10px' }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontFamily: F_BODY }}>Integrantes</span>
          <span style={{ fontSize: 12, color: 'var(--color-text-muted)', fontFamily: F_BODY }}>{seleccionados.size} agregado{seleccionados.size === 1 ? '' : 's'}</span>
        </div>

        <div style={{ background: 'var(--color-surface-white)', border: '1px solid var(--color-border)', borderRadius: 18, padding: '4px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: miembros.length ? '1px solid var(--color-divider)' : 'none' }}>
            <div style={{ opacity: 0.9 }}>
              <Avatar nombre="Tú" color="#EDEDF1" size={36} />
            </div>
            <div style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: F_BODY }}>Vos (admin)</div>
            <span style={{ fontSize: 11.5, color: 'var(--color-text-muted)', fontFamily: F_BODY }}>Siempre incluido</span>
          </div>
          {miembros.length === 0 && (
            <p style={{ margin: 0, padding: '14px 0', fontSize: 13, color: 'var(--color-text-secondary)', fontFamily: F_BODY }}>
              No hay más integrantes en este grupo todavía.
            </p>
          )}
          {miembros.map((m, idx) => {
            const marcado = seleccionados.has(m.id)
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => toggleMiembro(m.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', width: '100%',
                  border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left',
                  borderBottom: idx < miembros.length - 1 ? '1px solid var(--color-divider)' : 'none',
                }}
              >
                <Avatar nombre={m.nombre} color={m.avatar_color} size={36} />
                <div style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: F_BODY }}>{m.nombre}</div>
                <span style={{
                  width: 22, height: 22, borderRadius: 7, flexShrink: 0,
                  background: marcado ? 'var(--gradient-cta)' : 'var(--color-icon-bg)',
                  border: marcado ? 'none' : '1px solid var(--color-border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {marcado && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6l2.5 2.5L9.5 3" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                </span>
              </button>
            )
          })}
        </div>

        <button
          type="button"
          disabled
          title="Disponible después de crear la cuenta"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 12,
            height: 46, borderRadius: 15, background: 'var(--color-surface-white)', border: '1px solid var(--color-border)',
            cursor: 'not-allowed', opacity: 0.55,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 18 18" fill="none"><path d="M13 6a2 2 0 10-1.9-2.6L7 5.6a2 2 0 100 2.8l4.1 2.2A2 2 0 1013 10" stroke="var(--color-text-secondary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <span style={{ fontSize: 13.5, color: 'var(--color-text-secondary)', fontFamily: F_BODY }}>Enlace — disponible después de crear</span>
        </button>

        {error && (
          <div style={{ marginTop: 14, borderRadius: 12, padding: '10px 14px', background: 'var(--color-negative-tint)' }}>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--color-negative)', fontFamily: F_BODY, lineHeight: 1.4 }}>{error}</p>
          </div>
        )}

        <div style={{ flex: 1 }} />

        <div style={{ paddingTop: 20 }}>
          <button
            type="submit"
            disabled={creando}
            style={{
              height: 54, width: '100%', borderRadius: 15, border: 'none',
              background: 'var(--gradient-cta)', boxShadow: 'var(--shadow-cta)',
              color: '#fff', fontSize: 15.5, fontWeight: 700, fontFamily: F_BODY,
              cursor: creando ? 'default' : 'pointer', opacity: creando ? 0.6 : 1,
            }}
          >
            {creando ? 'Creando…' : 'Crear cuenta'}
          </button>
        </div>
      </form>
    </main>
  )
}
