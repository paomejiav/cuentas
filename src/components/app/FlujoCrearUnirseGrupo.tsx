'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { compartirOCopiar } from '@/lib/compartir'

const F_HEAD = 'var(--font-sora), sans-serif'
const F_BODY = 'var(--font-dm-sans), sans-serif'
const F_MONO = 'ui-monospace, Menlo, monospace'

interface GrupoRpc {
  id: string
  nombre: string
  codigo_invitacion: string
  creado_por: string | null
  creado_en: string
}

type Paso = 'crear' | 'unirse' | 'exito'

const SUGERENCIAS = [
  { emoji: '🏖️', label: 'Viaje', prefill: 'Viaje a ' },
  { emoji: '🏠', label: 'Depto', prefill: 'Depto ' },
  { emoji: '🍽️', label: 'Salida', prefill: 'Salida ' },
]

function HeaderConVolver({ titulo, onVolver }: { titulo: string; onVolver: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
      <button
        onClick={onVolver}
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
      <div style={{ fontFamily: F_HEAD, fontSize: 19, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--color-text-primary)' }}>
        {titulo}
      </div>
    </div>
  )
}

function IconBadge({ children, negativo }: { children: React.ReactNode; negativo?: boolean }) {
  return (
    <div style={{
      width: 58, height: 58, borderRadius: 18,
      background: negativo ? 'var(--color-negative-tint)' : 'var(--gradient-cta)',
      border: negativo ? '1px solid var(--color-negative-border)' : 'none',
      boxShadow: negativo ? 'none' : 'var(--shadow-cta)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      {children}
    </div>
  )
}

function CampoInput({
  value, onChange, placeholder, error, mono, autoFocus, maxLength, rightSlot, id, name, onKeyDown,
}: {
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholder?: string
  error?: boolean
  mono?: boolean
  autoFocus?: boolean
  maxLength?: number
  rightSlot?: React.ReactNode
  id?: string
  name?: string
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
}) {
  const [foco, setFoco] = useState(false)
  const activo = foco || error
  const borderColor = error ? 'var(--color-negative)' : (foco ? 'var(--color-cta)' : 'var(--color-border)')
  const halo = error ? '0 0 0 3px rgba(229,53,43,.12)' : '0 0 0 3px rgba(124,107,240,.14)'

  return (
    <div style={{
      height: 52, display: 'flex', alignItems: 'center', gap: 11, padding: '0 15px',
      borderRadius: 14, background: 'var(--color-surface-white)',
      border: `1px solid ${borderColor}`, boxSizing: 'border-box',
      boxShadow: activo ? halo : 'none',
    }}>
      <input
        id={id}
        name={name}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        maxLength={maxLength}
        onFocus={() => setFoco(true)}
        onBlur={() => setFoco(false)}
        style={{
          flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent',
          fontSize: mono ? 17 : 14.5, fontWeight: mono ? 600 : 500,
          letterSpacing: mono ? '.28em' : 'normal', textTransform: mono ? 'uppercase' : 'none',
          color: error ? 'var(--color-negative)' : 'var(--color-text-primary)',
          fontFamily: mono ? F_MONO : F_BODY,
        }}
      />
      {rightSlot}
    </div>
  )
}

function BotonPrimario({ children, onClick, type = 'button', disabled }: {
  children: React.ReactNode
  onClick?: () => void
  type?: 'button' | 'submit'
  disabled?: boolean
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        height: 54, width: '100%', borderRadius: 15, border: 'none',
        background: 'var(--gradient-cta)', boxShadow: 'var(--shadow-cta)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        fontFamily: F_BODY, fontSize: 15.5, fontWeight: 700, color: '#fff',
        cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.55 : 1,
        transition: 'transform 120ms ease, opacity 120ms ease',
      }}
      onPointerDown={e => { if (!disabled) e.currentTarget.style.transform = 'scale(0.97)' }}
      onPointerUp={e => (e.currentTarget.style.transform = 'scale(1)')}
      onPointerLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
    >
      {children}
    </button>
  )
}

function BotonSecundario({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        height: 54, width: '100%', borderRadius: 15,
        background: 'var(--color-surface-white)', border: '1px solid var(--color-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
        fontFamily: F_BODY, fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)',
        cursor: 'pointer',
      }}
      onPointerDown={e => (e.currentTarget.style.transform = 'scale(0.97)')}
      onPointerUp={e => (e.currentTarget.style.transform = 'scale(1)')}
      onPointerLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
    >
      {children}
    </button>
  )
}

interface FlujoCrearUnirseGrupoProps {
  pasoInicial: 'crear' | 'unirse'
  onCerrar: () => void
  onListo: (grupo: { id: string; nombre: string }) => void
}

/**
 * E2–E5 (crear grupo / unirme con código / éxito), extraído de Inicio para
 * reabrirlo como overlay de pantalla completa desde cualquier lugar (el hub
 * de grupos, el selector, el estado sin grupos) sin duplicar la lógica.
 */
export function FlujoCrearUnirseGrupo({ pasoInicial, onCerrar, onListo }: FlujoCrearUnirseGrupoProps) {
  const [paso, setPaso] = useState<Paso>(pasoInicial)
  const [grupoConfirmado, setGrupoConfirmado] = useState<GrupoRpc | null>(null)
  const [compartido, setCompartido] = useState(false)

  const [nombreGrupo, setNombreGrupo] = useState('')
  const [creando, setCreando] = useState(false)
  const [errorCrear, setErrorCrear] = useState<string | null>(null)

  const [codigo, setCodigo] = useState('')
  const [uniendo, setUniendo] = useState(false)
  const [errorUnirse, setErrorUnirse] = useState<string | null>(null)

  function aplicarSugerencia(prefill: string) {
    setNombreGrupo(prefill)
  }

  async function handleCrear(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrorCrear(null)

    const formData = new FormData(e.currentTarget)
    const nombre = ((formData.get('nombre_grupo') as string) || nombreGrupo).trim()
    if (!nombre) { setErrorCrear('Ingresá un nombre para el grupo.'); return }

    setCreando(true)
    try {
      const { data, error } = await supabase.rpc('crear_grupo', { p_nombre: nombre })
      if (error) { setErrorCrear(error.message); return }
      setGrupoConfirmado(data as GrupoRpc)
      setPaso('exito')
    } finally {
      setCreando(false)
    }
  }

  async function handleUnirse(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    const formData = new FormData(e.currentTarget)
    const cod = ((formData.get('codigo') as string) || codigo).trim()
    if (!cod) { setErrorUnirse('Ingresá el código de invitación.'); return }

    setUniendo(true)
    try {
      const { data, error } = await supabase.rpc('unirse_a_grupo', { p_codigo: cod })
      if (error) { setErrorUnirse('Ese código no es válido'); return }
      setErrorUnirse(null)
      setGrupoConfirmado(data as GrupoRpc)
      setPaso('exito')
    } finally {
      setUniendo(false)
    }
  }

  async function pegarCodigo() {
    try {
      const texto = await navigator.clipboard.readText()
      if (texto) setCodigo(texto.trim().toUpperCase().slice(0, 6))
    } catch {
      // sin permiso de portapapeles: no hacemos nada
    }
  }

  async function handleCompartir() {
    if (!grupoConfirmado) return
    const texto = `Sumate a "${grupoConfirmado.nombre}" en Better than Split con el código ${grupoConfirmado.codigo_invitacion}`
    const copiado = await compartirOCopiar({ title: 'Better than Split', text: texto })
    if (copiado) {
      setCompartido(true)
      setTimeout(() => setCompartido(false), 2000)
    }
  }

  function handleIrAlGrupo() {
    if (!grupoConfirmado) return
    onListo({ id: grupoConfirmado.id, nombre: grupoConfirmado.nombre })
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 80, background: 'var(--color-bg)', overflowY: 'auto',
    }}>
      <div style={{
        maxWidth: 440, margin: '0 auto', padding: '0 18px',
        paddingTop: 'max(20px, env(safe-area-inset-top, 0px))',
        paddingBottom: 'max(22px, env(safe-area-inset-bottom))',
        minHeight: '100dvh', boxSizing: 'border-box', display: 'flex', flexDirection: 'column',
      }}>

        {paso === 'crear' && (
          <form onSubmit={handleCrear} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <HeaderConVolver titulo="Crear grupo" onVolver={onCerrar} />

            <IconBadge>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path d="M17 21v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" />
                <circle cx="10" cy="8" r="3.4" stroke="#fff" strokeWidth="1.9" />
              </svg>
            </IconBadge>

            <h2 style={{ fontFamily: F_HEAD, fontSize: 21, fontWeight: 800, letterSpacing: '-0.02em', margin: '16px 0 0', color: 'var(--color-text-primary)' }}>
              ¿Cómo se llama el grupo?
            </h2>
            <p style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--color-text-secondary)', margin: '7px 0 0', fontFamily: F_BODY }}>
              Podés cambiarlo cuando quieras. Ej.: un viaje, un depto o una salida.
            </p>

            <div style={{ marginTop: 22 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 9, fontFamily: F_BODY }}>
                Nombre del grupo
              </div>
              <CampoInput
                id="nombre_grupo"
                name="nombre_grupo"
                value={nombreGrupo}
                onChange={e => setNombreGrupo(e.target.value)}
                placeholder="Ej: Verano en Pichilemu"
                maxLength={40}
                autoFocus
                rightSlot={<span style={{ fontSize: 12, color: 'var(--color-text-disabled)', flexShrink: 0, fontFamily: F_BODY }}>{nombreGrupo.length}/40</span>}
              />
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
              {SUGERENCIAS.map(s => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => aplicarSugerencia(s.prefill)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 100,
                    padding: '5px 12px', fontSize: 11.5, fontWeight: 600, fontFamily: F_BODY,
                    background: 'var(--color-icon-bg)', border: '1px solid var(--color-neutral-border)',
                    color: 'var(--color-text-secondary)', cursor: 'pointer',
                  }}
                >
                  {s.emoji} {s.label}
                </button>
              ))}
            </div>

            {errorCrear && (
              <div style={{ marginTop: 14, borderRadius: 12, padding: '10px 14px', background: 'var(--color-negative-tint)' }}>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--color-negative)', fontFamily: F_BODY, lineHeight: 1.4 }}>{errorCrear}</p>
              </div>
            )}

            <div style={{ marginTop: 'auto', paddingBottom: 22, paddingTop: 22 }}>
              <BotonPrimario type="submit" disabled={creando}>
                <span>{creando ? 'Creando…' : 'Crear grupo'}</span>
              </BotonPrimario>
            </div>
          </form>
        )}

        {paso === 'unirse' && (
          <form onSubmit={handleUnirse} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <HeaderConVolver titulo="Unirme con código" onVolver={onCerrar} />

            <IconBadge negativo={!!errorUnirse}>
              {errorUnirse ? (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <path d="M12 8v5" stroke="var(--color-negative)" strokeWidth="2.2" strokeLinecap="round" />
                  <circle cx="12" cy="16.5" r="1.3" fill="var(--color-negative)" />
                  <circle cx="12" cy="12" r="9" stroke="var(--color-negative)" strokeWidth="1.8" />
                </svg>
              ) : (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="4" width="18" height="16" rx="4" stroke="#fff" strokeWidth="1.9" />
                  <path d="M7.5 9.5h9M7.5 13h9M7.5 16.5h5" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" />
                </svg>
              )}
            </IconBadge>

            {errorUnirse ? (
              <>
                <h2 style={{ fontFamily: F_HEAD, fontSize: 21, fontWeight: 800, letterSpacing: '-0.02em', margin: '16px 0 0', color: 'var(--color-text-primary)' }}>
                  Ese código no es válido
                </h2>
                <p style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--color-text-secondary)', margin: '7px 0 0', fontFamily: F_BODY }}>
                  Revisá que esté completo y sin espacios. Pedile a quien te invitó que lo reenvíe.
                </p>
              </>
            ) : (
              <>
                <h2 style={{ fontFamily: F_HEAD, fontSize: 21, fontWeight: 800, letterSpacing: '-0.02em', margin: '16px 0 0', color: 'var(--color-text-primary)' }}>
                  Pegá el código de invitación
                </h2>
                <p style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--color-text-secondary)', margin: '7px 0 0', fontFamily: F_BODY }}>
                  Te lo comparte alguien que ya está en el grupo. Son 6 caracteres.
                </p>
              </>
            )}

            <div style={{ marginTop: 22 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 9, fontFamily: F_BODY }}>
                Código de invitación
              </div>
              <CampoInput
                id="codigo"
                name="codigo"
                value={codigo}
                onChange={e => { setCodigo(e.target.value.toUpperCase()); if (errorUnirse) setErrorUnirse(null) }}
                placeholder="Ej: A1B2C3"
                mono
                maxLength={6}
                error={!!errorUnirse}
                autoFocus
              />
              {errorUnirse && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 9 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                    <path d="M12 8v5" stroke="var(--color-negative)" strokeWidth="2.2" strokeLinecap="round" />
                    <circle cx="12" cy="16.5" r="1.3" fill="var(--color-negative)" />
                    <circle cx="12" cy="12" r="9" stroke="var(--color-negative)" strokeWidth="1.7" />
                  </svg>
                  <span style={{ fontSize: 12.5, color: 'var(--color-negative)', fontWeight: 600, fontFamily: F_BODY }}>
                    No encontramos ningún grupo con ese código.
                  </span>
                </div>
              )}
            </div>

            {!errorUnirse && (
              <button
                type="button"
                onClick={pegarCodigo}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9, marginTop: 16, padding: '13px 14px',
                  background: 'var(--tint-cta)', border: '1px solid var(--border-cta)', borderRadius: 13,
                  cursor: 'pointer', width: '100%', boxSizing: 'border-box',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                  <rect x="9" y="9" width="12" height="12" rx="2.5" stroke="var(--color-cta-dark)" strokeWidth="1.7" />
                  <path d="M6 15H5a2 2 0 01-2-2V5a2 2 0 012-2h8a2 2 0 012 2v1" stroke="var(--color-cta-dark)" strokeWidth="1.7" />
                </svg>
                <span style={{ fontSize: 12.5, color: 'var(--color-cta-dark)', fontWeight: 600, fontFamily: F_BODY }}>
                  Pegar desde el portapapeles
                </span>
              </button>
            )}

            <div style={{ marginTop: 'auto', paddingBottom: 22, paddingTop: 22, display: 'flex', flexDirection: 'column', gap: 11 }}>
              <BotonPrimario type="submit" disabled={uniendo}>
                <span>{uniendo ? 'Uniéndome…' : errorUnirse ? 'Reintentar' : 'Unirme al grupo'}</span>
              </BotonPrimario>
              {errorUnirse && (
                <button
                  type="button"
                  onClick={() => { setPaso('crear'); setErrorUnirse(null) }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'center', fontSize: 13, fontWeight: 600, color: 'var(--color-cta)', fontFamily: F_BODY }}
                >
                  Mejor creo un grupo nuevo
                </button>
              )}
            </div>
          </form>
        )}

        {paso === 'exito' && grupoConfirmado && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, paddingTop: 8 }}>
            <div style={{
              borderRadius: 24, background: 'var(--gradient-cta)', padding: '34px 24px 28px',
              position: 'relative', overflow: 'hidden', boxShadow: 'var(--shadow-cta)', textAlign: 'center',
            }}>
              <div style={{ position: 'absolute', top: -38, right: -30, width: 150, height: 150, borderRadius: '50%', background: 'rgba(255,255,255,.12)' }} />
              <div style={{ position: 'absolute', bottom: -56, left: -38, width: 170, height: 170, borderRadius: '50%', background: 'rgba(255,255,255,.08)' }} />
              <div style={{ position: 'relative' }}>
                <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', boxShadow: '0 12px 26px -10px rgba(24,34,26,.4)' }}>
                  <svg width="38" height="38" viewBox="0 0 24 24" fill="none">
                    <path d="M6 12.5l3.6 3.6L18 7.5" stroke="var(--color-positive)" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div style={{ fontFamily: F_HEAD, fontSize: 23, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', marginTop: 18 }}>
                  ¡Listo! 🎉
                </div>
                <p style={{ fontSize: 14, lineHeight: 1.5, color: 'rgba(255,255,255,.9)', margin: '8px 0 0', fontFamily: F_BODY }}>
                  Ya sos parte de<br /><b style={{ color: '#fff', fontWeight: 700 }}>{grupoConfirmado.nombre}</b>
                </p>
              </div>
            </div>

            <div style={{ background: 'var(--color-surface-white)', border: '1px solid var(--color-border)', borderRadius: 18, padding: 18, marginTop: 20 }}>
              <div style={{ fontSize: 12.5, color: 'var(--color-neutral)', fontFamily: F_BODY }}>Código de invitación del grupo</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
                <div style={{ flex: 1, border: '1.5px dashed var(--border-cta)', background: 'var(--tint-cta)', borderRadius: 13, padding: '14px 16px', textAlign: 'center', minWidth: 0 }}>
                  <span style={{ fontFamily: F_MONO, fontSize: 24, fontWeight: 700, letterSpacing: '.28em', color: 'var(--color-cta-dark)' }}>
                    {grupoConfirmado.codigo_invitacion}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCompartir}
                  aria-label="Copiar código"
                  style={{
                    width: 52, height: 52, borderRadius: 14, background: 'var(--gradient-cta)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    boxShadow: 'var(--shadow-cta)', border: 'none', cursor: 'pointer', padding: 0,
                  }}
                >
                  {compartido ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M6 12.5l3.6 3.6L18 7.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <rect x="9" y="9" width="12" height="12" rx="2.5" stroke="#fff" strokeWidth="1.8" />
                      <path d="M6 15H5a2 2 0 01-2-2V5a2 2 0 012-2h8a2 2 0 012 2v1" stroke="#fff" strokeWidth="1.8" />
                    </svg>
                  )}
                </button>
              </div>
              <p style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--color-text-muted)', margin: '12px 0 0', fontFamily: F_BODY }}>
                Compartí este código para que más gente se sume al grupo.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 20 }}>
              <BotonPrimario onClick={handleCompartir}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
                  <path d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" />
                  <path d="M12 15V3M8 7l4-4 4 4" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>{compartido ? 'Copiado ✓' : 'Compartir invitación'}</span>
              </BotonPrimario>
              <BotonSecundario onClick={handleIrAlGrupo}>
                <span>Ir al grupo</span>
              </BotonSecundario>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
