'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { resolverGrupoActivo, type GrupoOpcion } from '@/lib/grupo-activo'
import { obtenerDetalleGrupo, actualizarNombreGrupo, salirDeGrupo, type DetalleGrupo, type IntegranteActivo } from '@/lib/grupo'
import { mesEnMinusculas } from '@/lib/format'
import { Avatar } from '@/components/app/Avatar'
import { BottomNav } from '@/components/app/BottomNav'

const F_HEAD = 'var(--font-sora), sans-serif'
const F_BODY = 'var(--font-dm-sans), sans-serif'
const F_MONO = 'ui-monospace, Menlo, monospace'
const GRIS_EX = '#C7C9D1'

// ── Piezas reutilizadas del lenguaje visual Walto ──────────────────

function BotonVolver({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
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
  )
}

function Tooltip({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      position: 'absolute', bottom: '100%', right: 0, marginBottom: 8,
      background: 'var(--color-text-primary)', color: '#fff', fontSize: 12, fontWeight: 600,
      fontFamily: F_BODY, padding: '8px 12px', borderRadius: 10, whiteSpace: 'nowrap',
      boxShadow: '0 6px 16px rgba(0,0,0,.18)', zIndex: 5,
    }}>
      {children}
    </div>
  )
}

function MenuInerte({ id, tooltipAbierto, onToggle }: { id: string; tooltipAbierto: string | null; onToggle: (id: string | null) => void }) {
  const abierto = tooltipAbierto === id
  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => onToggle(abierto ? null : id)}
        onMouseEnter={() => onToggle(id)}
        onMouseLeave={() => onToggle(null)}
        aria-label="Más opciones"
        style={{
          width: 30, height: 30, borderRadius: '50%', border: 'none', background: 'var(--color-icon-bg)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, flexShrink: 0,
        }}
      >
        <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="4.5" r="1.4" fill="var(--color-text-secondary)" />
          <circle cx="10" cy="10" r="1.4" fill="var(--color-text-secondary)" />
          <circle cx="10" cy="15.5" r="1.4" fill="var(--color-text-secondary)" />
        </svg>
      </button>
      {abierto && <Tooltip>Próximamente</Tooltip>}
    </div>
  )
}

function BotonPrimario({ children, onClick, disabled, type = 'button' }: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  type?: 'button' | 'submit'
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        height: 54, width: '100%', borderRadius: 15, border: 'none',
        background: 'var(--gradient-cta)', boxShadow: 'var(--shadow-cta)',
        color: '#fff', fontSize: 15, fontWeight: 700, fontFamily: F_BODY,
        cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.6 : 1,
      }}
    >
      {children}
    </button>
  )
}

function BotonPeligro({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        height: 54, width: '100%', borderRadius: 15, border: 'none',
        background: disabled ? '#E7E7EE' : 'var(--color-negative)',
        color: disabled ? '#AFAFBC' : '#fff', fontSize: 15, fontWeight: 700, fontFamily: F_BODY,
        cursor: disabled ? 'default' : 'pointer', transition: 'background 150ms ease, color 150ms ease',
      }}
    >
      {children}
    </button>
  )
}

export default function GrupoPage() {
  return (
    <Suspense>
      <GrupoPageInner />
    </Suspense>
  )
}

function GrupoPageInner() {
  const router = useRouter()
  const params = useSearchParams()

  const [fase, setFase] = useState<'cargando' | 'elegir-grupo' | 'ok'>('cargando')
  const [grupos, setGrupos] = useState<GrupoOpcion[]>([])
  const [grupoId, setGrupoId] = useState<string | null>(null)
  const [usuarioId, setUsuarioId] = useState<string | null>(null)
  const [detalle, setDetalle] = useState<DetalleGrupo | null>(null)

  const [editando, setEditando] = useState(false)
  const [nombreDraft, setNombreDraft] = useState('')
  const [guardandoNombre, setGuardandoNombre] = useState(false)
  const [errorNombre, setErrorNombre] = useState<string | null>(null)

  const [copiado, setCopiado] = useState(false)
  const [tooltipAbierto, setTooltipAbierto] = useState<string | null>(null)

  const [vistaSalida, setVistaSalida] = useState<'ver' | 'traspaso'>('ver')
  const [mostrarSheetSalida, setMostrarSheetSalida] = useState(false)
  const [nuevoAdminId, setNuevoAdminId] = useState<string | null>(null)
  const [saliendo, setSaliendo] = useState(false)
  const [errorSalir, setErrorSalir] = useState<string | null>(null)

  useEffect(() => {
    let activo = true
    async function cargar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }
      if (!activo) return
      setUsuarioId(user.id)

      const resolucion = await resolverGrupoActivo(user.id, params.get('grupo'))
      if (!activo) return

      if (resolucion.estado === 'sin-grupos') { router.replace('/'); return }
      if (resolucion.estado === 'elegir') {
        setGrupos(resolucion.grupos)
        setFase('elegir-grupo')
        return
      }

      setGrupoId(resolucion.grupoId)
      setFase('ok')
    }
    cargar()
    return () => { activo = false }
  }, [router, params])

  useEffect(() => {
    if (fase !== 'ok' || !grupoId || !usuarioId) return
    let activo = true
    obtenerDetalleGrupo(grupoId, usuarioId).then(d => {
      if (!activo) return
      setDetalle(d)
      if (d) setNombreDraft(d.nombre)
    })
    return () => { activo = false }
  }, [fase, grupoId, usuarioId])

  function handleToggleTooltip(id: string | null) {
    setTooltipAbierto(id)
  }

  async function handleGuardarNombre() {
    if (!grupoId || !detalle) return
    const nombre = nombreDraft.trim()
    if (!nombre) { setErrorNombre('El nombre no puede estar vacío.'); return }

    setGuardandoNombre(true)
    setErrorNombre(null)
    try {
      const { error } = await actualizarNombreGrupo(grupoId, nombre)
      if (error) { setErrorNombre(error); return }
      setDetalle({ ...detalle, nombre })
      setEditando(false)
    } finally {
      setGuardandoNombre(false)
    }
  }

  async function handleCopiarCodigo() {
    if (!detalle) return
    await navigator.clipboard.writeText(detalle.codigo_invitacion)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  function handleClickSalir() {
    if (!detalle) return
    const hayOtrosActivos = detalle.activos.length > 1
    if (detalle.esUnicaAdminActiva && hayOtrosActivos) {
      setVistaSalida('traspaso')
    } else {
      setErrorSalir(null)
      setMostrarSheetSalida(true)
    }
  }

  async function handleConfirmarSalidaDirecta() {
    if (!grupoId) return
    setSaliendo(true)
    setErrorSalir(null)
    try {
      const { error } = await salirDeGrupo(grupoId)
      if (error) { setErrorSalir(error); return }
      router.replace('/')
    } finally {
      setSaliendo(false)
    }
  }

  async function handleConfirmarTraspaso() {
    if (!grupoId || !nuevoAdminId) return
    setSaliendo(true)
    setErrorSalir(null)
    try {
      const { error } = await salirDeGrupo(grupoId, nuevoAdminId)
      if (error) { setErrorSalir(error); return }
      router.replace('/')
    } finally {
      setSaliendo(false)
    }
  }

  if (fase === 'cargando' || (fase === 'ok' && !detalle)) {
    return (
      <main style={{ minHeight: '100dvh', background: 'var(--color-bg)' }}>
        <p style={{ padding: 24, fontSize: 13.5, color: 'var(--color-text-secondary)', fontFamily: F_BODY }}>Cargando…</p>
      </main>
    )
  }

  if (fase === 'elegir-grupo') {
    return (
      <main style={{ minHeight: '100dvh', background: 'var(--color-bg)' }}>
        <div style={{ maxWidth: 440, margin: '0 auto', padding: '0 18px', paddingTop: 'max(24px, env(safe-area-inset-top, 0px))' }}>
          <h1 style={{ margin: 0, fontFamily: F_HEAD, fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--color-text-primary)' }}>
            ¿Qué grupo querés ver?
          </h1>
          <p style={{ margin: '6px 0 20px', fontSize: 13.5, color: 'var(--color-text-secondary)', fontFamily: F_BODY }}>
            Pertenecés a más de un grupo.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {grupos.map(g => (
              <Link
                key={g.id}
                href={`/grupo?grupo=${g.id}`}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'var(--color-surface-white)', border: '1px solid var(--color-border)',
                  borderRadius: 16, padding: '16px 18px', textDecoration: 'none',
                }}
              >
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: F_BODY }}>{g.nombre}</span>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="var(--color-cta)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </Link>
            ))}
          </div>
        </div>
      </main>
    )
  }

  const d = detalle as DetalleGrupo

  // ─── G5 · Elegí quién va a ser el nuevo admin ───
  if (vistaSalida === 'traspaso') {
    return (
      <main style={{ minHeight: '100dvh', background: 'var(--color-bg)' }}>
        <div style={{ maxWidth: 440, margin: '0 auto', padding: '0 18px', paddingTop: 'max(20px, env(safe-area-inset-top, 0px))', paddingBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <BotonVolver onClick={() => setVistaSalida('ver')} />
            <div style={{ fontFamily: F_HEAD, fontSize: 19, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--color-text-primary)' }}>
              Salir de {d.nombre}
            </div>
          </div>

          <div style={{
            display: 'flex', gap: 10, background: 'var(--color-warning-tint)', border: '1px solid var(--color-warning-border)',
            borderRadius: 14, padding: '13px 14px', marginBottom: 22,
          }}>
            <span style={{ fontSize: 15, flexShrink: 0 }}>⚠️</span>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'var(--color-warning)', fontFamily: F_BODY }}>
              Sos el único admin activo. <b>Antes de salir, alguien tiene que quedar a cargo.</b>
            </p>
          </div>

          <h2 style={{ margin: 0, fontFamily: F_HEAD, fontSize: 20, fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--color-text-primary)' }}>
            Elegí quién va a ser el nuevo admin
          </h2>
          <p style={{ margin: '8px 0 20px', fontSize: 13.5, lineHeight: 1.5, color: 'var(--color-text-secondary)', fontFamily: F_BODY }}>
            Podrá editar el nombre del grupo y administrar integrantes. Después de esto tu salida se confirma.
          </p>

          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 10 }}>
            Integrantes activos · {d.activos.length - 1}
          </div>

          <div style={{ background: 'var(--color-surface-white)', border: '1px solid var(--color-border)', borderRadius: 18, padding: '4px 16px' }}>
            {d.activos.filter(a => a.id !== usuarioId).map((a, idx, arr) => {
              const seleccionado = nuevoAdminId === a.id
              return (
                <button
                  key={a.id}
                  onClick={() => setNuevoAdminId(a.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 13, padding: '13px 0', width: '100%',
                    background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer',
                    borderBottom: idx < arr.length - 1 ? '1px solid var(--color-divider)' : 'none',
                  }}
                >
                  <Avatar nombre={a.nombre} color={a.avatar_color} size={40} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: F_BODY }}>{a.nombre}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--color-neutral)', marginTop: 1, fontFamily: F_BODY }}>Se sumó en {mesEnMinusculas(a.unido_en)}</div>
                  </div>
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                    background: seleccionado ? 'var(--gradient-cta)' : 'transparent',
                    border: seleccionado ? 'none' : '1.5px solid var(--color-border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {seleccionado && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 7" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          <div style={{ marginTop: 14, background: 'var(--color-icon-bg)', borderRadius: 14, padding: '13px 14px' }}>
            <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: 'var(--color-text-secondary)', fontFamily: F_BODY }}>
              Los ex integrantes no aparecen en esta lista: el rol solo puede pasar a alguien activo.
            </p>
          </div>

          {errorSalir && (
            <p style={{ margin: '14px 0 0', fontSize: 13, color: 'var(--color-negative)', fontFamily: F_BODY, textAlign: 'center' }}>{errorSalir}</p>
          )}

          <div style={{ marginTop: 20 }}>
            <BotonPeligro onClick={handleConfirmarTraspaso} disabled={!nuevoAdminId || saliendo}>
              {saliendo ? 'Confirmando…' : 'Confirmar y salir'}
            </BotonPeligro>
            {!nuevoAdminId && (
              <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--color-text-muted)', fontFamily: F_BODY, textAlign: 'center' }}>
                Se habilita al elegir a alguien.
              </p>
            )}
          </div>
        </div>
      </main>
    )
  }

  // ─── G1/G2/G3 · Grupo — vista y edición ───
  return (
    <main style={{ minHeight: '100dvh', background: 'var(--color-bg)', paddingBottom: 96 }}>
      <div style={{ maxWidth: 440, margin: '0 auto', padding: '0 18px', paddingTop: 'max(20px, env(safe-area-inset-top, 0px))' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <BotonVolver onClick={() => router.push('/')} />
          <div style={{ fontFamily: F_HEAD, fontSize: 19, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--color-text-primary)' }}>
            Grupo
          </div>
        </div>

        {/* ─── Card nombre del grupo ─── */}
        {editando ? (
          <div style={{ background: 'var(--color-surface-white)', border: '1px solid var(--color-cta)', borderRadius: 18, padding: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 10 }}>
              Nombre del grupo
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{
                flex: 1, height: 52, display: 'flex', alignItems: 'center', padding: '0 15px', minWidth: 0,
                borderRadius: 14, background: 'var(--color-bg)', border: '1px solid var(--color-cta)', boxSizing: 'border-box',
              }}>
                <input
                  value={nombreDraft}
                  onChange={e => setNombreDraft(e.target.value)}
                  autoFocus
                  maxLength={60}
                  style={{
                    flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent',
                    fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: F_BODY,
                  }}
                />
              </div>
              <button
                onClick={handleGuardarNombre}
                disabled={guardandoNombre}
                style={{
                  padding: '0 20px', borderRadius: 14, border: 'none', background: 'var(--gradient-cta)',
                  color: '#fff', fontSize: 14.5, fontWeight: 700, fontFamily: F_BODY, cursor: 'pointer',
                  opacity: guardandoNombre ? 0.6 : 1, flexShrink: 0,
                }}
              >
                {guardandoNombre ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
            {errorNombre && (
              <p style={{ margin: '10px 0 0', fontSize: 12.5, color: 'var(--color-negative)', fontFamily: F_BODY }}>{errorNombre}</p>
            )}
            <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--color-text-muted)', fontFamily: F_BODY }}>
              Lo ven todos los integrantes. El código no cambia.
            </p>
          </div>
        ) : (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 13,
            background: 'var(--color-surface-white)', border: '1px solid var(--color-border)', borderRadius: 18, padding: 16,
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 13, background: 'var(--tint-cta)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <svg width="19" height="19" viewBox="0 0 20 20" fill="none">
                <path d="M5 3h7l4 4v10a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="var(--color-cta-dark)" strokeWidth="1.5" strokeLinejoin="round" />
                <path d="M7 10h6M7 13.5h6" stroke="var(--color-cta-dark)" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: F_BODY }}>{d.nombre}</div>
              <div style={{ fontSize: 12, color: 'var(--color-neutral)', marginTop: 1, fontFamily: F_BODY }}>
                {d.activos.length} integrante{d.activos.length === 1 ? '' : 's'}
              </div>
            </div>
            {d.soyAdmin && (
              <button
                onClick={() => { setEditando(true); setErrorNombre(null) }}
                aria-label="Editar nombre del grupo"
                style={{
                  width: 34, height: 34, borderRadius: 10, border: 'none', background: 'var(--tint-cta)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
                }}
              >
                <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
                  <path d="M13.5 3.5l3 3L6 17l-4 1 1-4z" stroke="var(--color-cta-dark)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* ─── Código de invitación ─── */}
        <div style={{ marginTop: 20, opacity: editando ? 0.5 : 1, pointerEvents: editando ? 'none' : 'auto', transition: 'opacity 150ms ease' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 10 }}>
            Código de invitación
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, border: '1.5px dashed var(--border-cta)', background: 'var(--tint-cta)', borderRadius: 13, padding: '14px 16px', textAlign: 'center', minWidth: 0 }}>
              <span style={{ fontFamily: F_MONO, fontSize: 22, fontWeight: 700, letterSpacing: '.28em', color: 'var(--color-cta-dark)' }}>
                {d.codigo_invitacion}
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopiarCodigo}
              aria-label="Copiar código"
              style={{
                width: 50, height: 50, borderRadius: 14, background: 'var(--gradient-cta)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                boxShadow: 'var(--shadow-cta)', border: 'none', cursor: 'pointer', padding: 0,
              }}
            >
              {copiado ? (
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none"><path d="M6 12.5l3.6 3.6L18 7.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
              ) : (
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
                  <rect x="9" y="9" width="12" height="12" rx="2.5" stroke="#fff" strokeWidth="1.8" />
                  <path d="M6 15H5a2 2 0 01-2-2V5a2 2 0 012-2h8a2 2 0 012 2v1" stroke="#fff" strokeWidth="1.8" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* ─── Integrantes activos ─── */}
        <div style={{ marginTop: 24, opacity: editando ? 0.5 : 1, pointerEvents: editando ? 'none' : 'auto', transition: 'opacity 150ms ease' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 10 }}>
            Integrantes activos · {d.activos.length}
          </div>
          <div style={{ background: 'var(--color-surface-white)', border: '1px solid var(--color-border)', borderRadius: 18, padding: '4px 16px' }}>
            {d.activos.map((a: IntegranteActivo, idx) => (
              <div
                key={a.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 13, padding: '13px 0',
                  borderBottom: idx < d.activos.length - 1 ? '1px solid var(--color-divider)' : 'none',
                }}
              >
                <Avatar nombre={a.nombre} color={a.avatar_color} size={40} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: F_BODY }}>
                    {a.nombre}{a.id === usuarioId ? ' · vos' : ''}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--color-neutral)', marginTop: 1, fontFamily: F_BODY }}>
                    {a.rol === 'admin' ? 'Admin' : 'Miembro'}
                  </div>
                </div>
                {a.rol === 'admin' ? (
                  <span style={{
                    fontSize: 11.5, fontWeight: 700, color: 'var(--color-cta-dark)', background: 'var(--tint-cta)',
                    borderRadius: 100, padding: '5px 12px', flexShrink: 0, fontFamily: F_BODY,
                  }}>
                    Admin
                  </span>
                ) : (
                  <MenuInerte id={`menu-${a.id}`} tooltipAbierto={tooltipAbierto} onToggle={handleToggleTooltip} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ─── Ya no pertenecen ─── */}
        {d.exIntegrantes.length > 0 && (
          <div style={{ marginTop: 24, opacity: editando ? 0.5 : 1, pointerEvents: editando ? 'none' : 'auto', transition: 'opacity 150ms ease' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 10 }}>
              Ya no pertenecen · {d.exIntegrantes.length}
            </div>
            <div style={{ background: 'var(--color-surface-white)', border: '1px solid var(--color-border)', borderRadius: 18, padding: '4px 16px' }}>
              {d.exIntegrantes.map((ex, idx) => {
                const id = `ex-${ex.id}`
                return (
                  <div
                    key={ex.id}
                    onClick={() => setTooltipAbierto(tooltipAbierto === id ? null : id)}
                    onMouseEnter={() => setTooltipAbierto(id)}
                    onMouseLeave={() => setTooltipAbierto(null)}
                    style={{
                      position: 'relative', display: 'flex', alignItems: 'center', gap: 13, padding: '13px 0', cursor: 'default',
                      borderBottom: idx < d.exIntegrantes.length - 1 ? '1px solid var(--color-divider)' : 'none',
                    }}
                  >
                    <Avatar nombre={ex.nombre} color={GRIS_EX} size={40} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--color-text-muted)', textDecoration: 'line-through', fontFamily: F_BODY }}>
                        {ex.nombre}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--color-text-disabled)', marginTop: 1, fontFamily: F_BODY }}>
                        Salió en {mesEnMinusculas(ex.salio_en)}
                      </div>
                    </div>
                    {tooltipAbierto === id && <Tooltip>Ya no pertenece al grupo</Tooltip>}
                  </div>
                )
              })}
            </div>
            <div style={{ marginTop: 12, background: 'var(--color-icon-bg)', borderRadius: 14, padding: '13px 14px' }}>
              <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: 'var(--color-text-secondary)', fontFamily: F_BODY }}>
                Sus gastos y pagos siguen en el historial y en los cierres pasados. La fila no tiene menú: no se le puede cambiar el rol ni volver a asignar nada.
              </p>
            </div>
          </div>
        )}

        {/* ─── Salir del grupo ─── */}
        {d.activos.some(a => a.id === usuarioId) && !editando && (
          <div style={{ marginTop: 28 }}>
            <button
              onClick={handleClickSalir}
              style={{
                width: '100%', height: 52, borderRadius: 15, border: 'none',
                background: 'var(--color-negative-tint)', color: 'var(--color-negative)',
                fontSize: 14.5, fontWeight: 700, fontFamily: F_BODY, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
                <path d="M7.5 3H4a1 1 0 00-1 1v12a1 1 0 001 1h3.5M11 13l3-3-3-3M14 10H7" stroke="var(--color-negative)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Salir del grupo
            </button>
          </div>
        )}
      </div>

      <BottomNav />

      {/* ─── G4 · Sheet de confirmación simple ─── */}
      {mostrarSheetSalida && (
        <>
          <div
            onClick={() => !saliendo && setMostrarSheetSalida(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(26,26,30,0.45)' }}
          />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 70,
            background: 'var(--color-surface-white)', borderRadius: '24px 24px 0 0',
            paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
          }}>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
              <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--color-border)' }} />
            </div>
            <div style={{ padding: '16px 24px 0', textAlign: 'center' }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%', background: 'var(--color-negative-tint)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
              }}>
                <svg width="26" height="26" viewBox="0 0 20 20" fill="none">
                  <path d="M7.5 3H4a1 1 0 00-1 1v12a1 1 0 001 1h3.5M11 13l3-3-3-3M14 10H7" stroke="var(--color-negative)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h2 style={{ margin: 0, fontFamily: F_HEAD, fontSize: 20, fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--color-text-primary)' }}>
                ¿Seguro que querés salir de {d.nombre}?
              </h2>
              <p style={{ margin: '10px 0 0', fontSize: 13.5, lineHeight: 1.5, color: 'var(--color-text-secondary)', fontFamily: F_BODY }}>
                Dejás de ver los gastos nuevos, pero tu historial queda en el grupo marcado como que ya no pertenecés. Podés volver a entrar con el código <b>{d.codigo_invitacion}</b>.
              </p>
              {errorSalir && (
                <p style={{ margin: '12px 0 0', fontSize: 13, color: 'var(--color-negative)', fontFamily: F_BODY }}>{errorSalir}</p>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, margin: '22px 0 0' }}>
                <BotonPeligro onClick={handleConfirmarSalidaDirecta} disabled={saliendo}>
                  {saliendo ? 'Saliendo…' : 'Sí, salir del grupo'}
                </BotonPeligro>
                <button
                  onClick={() => setMostrarSheetSalida(false)}
                  disabled={saliendo}
                  style={{
                    height: 54, width: '100%', borderRadius: 15, border: '1px solid var(--color-border)',
                    background: 'var(--color-surface-white)', color: 'var(--color-text-primary)',
                    fontSize: 15, fontWeight: 700, fontFamily: F_BODY, cursor: 'pointer',
                  }}
                >
                  Quedarme
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  )
}
