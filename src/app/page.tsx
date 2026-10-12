'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Avatar } from '@/components/app/Avatar'
import { listarGruposActivos, type GrupoNombre } from '@/lib/grupo'
import { calcularSaldosGrupo } from '@/lib/cuentas'
import { formatCLP } from '@/lib/format'
import { compartirOCopiar } from '@/lib/compartir'
import { BottomNav } from '@/components/app/BottomNav'

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

type Vista = 'cargando' | 'grupos' | 'vacio' | 'crear' | 'unirse' | 'exito' | 'link-invalido'

interface GrupoConResumen extends GrupoNombre {
  integrantes: number
  netoUsuario: number
}

const SUGERENCIAS = [
  { emoji: '🏖️', label: 'Viaje', prefill: 'Viaje a ' },
  { emoji: '🏠', label: 'Depto', prefill: 'Depto ' },
  { emoji: '🍽️', label: 'Salida', prefill: 'Salida ' },
]

// ── Piezas visuales reutilizadas del sistema Walto (tokens --color-*, --font-*) ──

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

// ── Nav inferior: solo Inicio activo, el resto atenuado e inerte (a propósito, ── */
// ── ninguna otra pantalla del modelo nuevo existe todavía) ──
function NavInerte({ fabActivo }: { fabActivo: boolean }) {
  const item = (path: React.ReactNode, label: string) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1, opacity: 0.4 }}>
      {path}
      <span style={{ fontSize: 10, color: 'var(--color-text-disabled)', fontFamily: F_BODY }}>{label}</span>
    </div>
  )

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, height: 76,
      background: 'var(--color-surface-white)', borderTop: '1px solid var(--color-border)',
      zIndex: 40, paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      <div style={{
        maxWidth: 640, margin: '0 auto', height: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '0 12px',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" stroke="var(--color-cta)" strokeWidth="2" strokeLinejoin="round" />
            <path d="M9 21V12h6v9" stroke="var(--color-cta)" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-cta)', fontFamily: F_BODY }}>Inicio</span>
        </div>

        {item(
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="4" width="18" height="17" rx="3" stroke="var(--color-text-disabled)" strokeWidth="1.5" />
            <path d="M7 9h10M7 13h7" stroke="var(--color-text-disabled)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>,
          'Historial'
        )}

        <div
          aria-hidden="true"
          style={{
            width: 52, height: 52, borderRadius: 16, marginTop: -26, flexShrink: 0,
            background: fabActivo ? 'var(--gradient-cta)' : 'var(--color-text-disabled)',
            boxShadow: fabActivo ? 'var(--shadow-fab)' : 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </div>

        {item(
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="var(--color-text-disabled)" strokeWidth="1.5" />
            <path d="M8 12l3 3 5-5" stroke="var(--color-text-disabled)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>,
          'Cierre'
        )}

        {item(
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M6 3h9l3 3v15a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="var(--color-text-disabled)" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M8.5 9h7M8.5 13h7M8.5 17h4" stroke="var(--color-text-disabled)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>,
          'Cuentas'
        )}
      </div>
    </nav>
  )
}

export default function InicioPage() {
  return (
    <Suspense>
      <InicioPageInner />
    </Suspense>
  )
}

function InicioPageInner() {
  const router = useRouter()
  const params = useSearchParams()

  const [vista, setVista] = useState<Vista>('cargando')
  const [nombreUsuario, setNombreUsuario] = useState('')
  const [avatarColor, setAvatarColor] = useState('#A8D8B9')
  const [usuarioId, setUsuarioId] = useState<string | null>(null)
  const [grupos, setGrupos] = useState<GrupoNombre[]>([])
  const [gruposConResumen, setGruposConResumen] = useState<GrupoConResumen[]>([])
  const [cargandoResumenes, setCargandoResumenes] = useState(true)
  const [grupoConfirmado, setGrupoConfirmado] = useState<GrupoRpc | null>(null)
  const [compartido, setCompartido] = useState(false)

  // ── Crear grupo ──
  const [nombreGrupo, setNombreGrupo] = useState('')
  const [creando, setCreando] = useState(false)
  const [errorCrear, setErrorCrear] = useState<string | null>(null)

  // ── Unirme con código ──
  const [codigo, setCodigo] = useState('')
  const [uniendo, setUniendo] = useState(false)
  const [errorUnirse, setErrorUnirse] = useState<string | null>(null)

  useEffect(() => {
    let activo = true
    let timeoutSignup: ReturnType<typeof setTimeout> | undefined

    async function cargar() {
      // Link de confirmación de registro (plantilla "Confirm signup" en
      // Supabase, apunta acá con ?token_hash=&type=signup) — canjeamos el
      // token nosotros mismos, en vez de depender del intercambio PKCE
      // automático, que falla si el link se abre en un navegador o
      // dispositivo distinto al que hizo el registro.
      const tokenHash = params.get('token_hash')
      const tipoParam = params.get('type')
      if (tokenHash && tipoParam === 'signup') {
        // Resguardo: si verifyOtp se cuelga sin resolver nunca (red
        // inestable, navegador in-app que ahorca el fetch sin rechazarlo),
        // no dejamos la pantalla en "Cargando…" para siempre — mismo
        // patrón que ya usamos en /reset-password.
        timeoutSignup = setTimeout(() => {
          if (activo) setVista(prev => (prev === 'cargando' ? 'link-invalido' : prev))
        }, 8000)

        try {
          const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'signup' })
          if (!activo) return
          if (error) { setVista('link-invalido'); return }
          // Limpiamos los params para que un refresh no vuelva a canjear el
          // mismo token_hash (ya usado). El cambio de `params` dispara este
          // mismo efecto de nuevo, esta vez sin token_hash, y sigue directo
          // por el flujo normal de acá abajo con la sesión ya creada.
          router.replace('/')
        } catch {
          if (activo) setVista('link-invalido')
        } finally {
          clearTimeout(timeoutSignup)
        }
        return
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }

      const [{ data: usuario }, listaGrupos] = await Promise.all([
        supabase.from('usuarios').select('nombre, avatar_color').eq('id', user.id).single(),
        listarGruposActivos(user.id),
      ])

      if (!activo) return
      setUsuarioId(user.id)
      setNombreUsuario(usuario?.nombre ?? '')
      setAvatarColor(usuario?.avatar_color ?? '#A8D8B9')

      if (listaGrupos.length === 0) { setVista('vacio'); return }

      setGrupos(listaGrupos)
      setVista('grupos')
    }

    cargar()
    return () => { activo = false; clearTimeout(timeoutSignup) }
  }, [router, params])

  // ── Resumen (integrantes + saldo neto) de cada grupo, en paralelo ──
  useEffect(() => {
    if (vista !== 'grupos' || grupos.length === 0 || !usuarioId) return
    let activo = true

    async function cargarResumenes() {
      setCargandoResumenes(true)
      const resultados = await Promise.all(
        grupos.map(async g => {
          // calcularSaldosGrupo excluye al propio usuario (devuelve "el saldo
          // de los demás respecto a mí") — por eso el conteo total es +1, y
          // mi propio neto es la suma directa de los ajenos: si alguien me
          // debe (neto > 0) eso suma a mi favor; si yo le debo a alguien
          // (neto < 0) resta — sin necesidad de buscarme a mí mismo ahí.
          const saldos = await calcularSaldosGrupo(g.id, usuarioId!)
          return {
            ...g,
            integrantes: saldos.length + 1,
            netoUsuario: saldos.reduce((suma, s) => suma + s.neto, 0),
          }
        })
      )
      if (!activo) return
      setGruposConResumen(resultados)
      setCargandoResumenes(false)
    }

    cargarResumenes()
    return () => { activo = false }
  }, [vista, grupos, usuarioId])

  function volver() {
    setVista(grupos.length > 0 ? 'grupos' : 'vacio')
    setErrorCrear(null)
    setErrorUnirse(null)
  }

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
      setVista('exito')
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
      setVista('exito')
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
    router.push(`/dashboard?grupo=${grupoConfirmado.id}`)
  }

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--color-bg)', overflowX: 'hidden' }}>
      <div style={{
        maxWidth: 440, margin: '0 auto', padding: '0 18px',
        paddingTop: 'max(20px, env(safe-area-inset-top, 0px))',
        paddingBottom: 96, minHeight: '100dvh', boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column',
      }}>

        {vista === 'cargando' && (
          <p style={{ fontSize: 13.5, color: 'var(--color-text-secondary)', fontFamily: F_BODY, marginTop: 24 }}>
            Cargando…
          </p>
        )}

        {/* ─── Link de confirmación de registro vencido/ya usado ─── */}
        {vista === 'link-invalido' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center', paddingTop: 40 }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%', background: 'var(--color-surface-white)',
              border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
            }}>
              ⚠️
            </div>
            <div>
              <h2 style={{ margin: 0, fontFamily: F_HEAD, fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--color-text-primary)' }}>
                Este link ya no es válido
              </h2>
              <p style={{ margin: '10px 0 0', fontSize: 14, lineHeight: 1.5, color: 'var(--color-text-secondary)', fontFamily: F_BODY }}>
                Puede haber expirado o ya haberse usado. Volvé a intentar el registro desde el login.
              </p>
            </div>
            <BotonPrimario onClick={() => router.replace('/login')}>
              Volver al login
            </BotonPrimario>
          </div>
        )}

        {/* ─── Vista general: tus grupos ─── */}
        {vista === 'grupos' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div>
                <div style={{ fontSize: 12.5, color: 'var(--color-neutral)', fontFamily: F_BODY }}>
                  Hola, {nombreUsuario} 👋
                </div>
                <div style={{ fontFamily: F_HEAD, fontSize: 24, fontWeight: 800, color: 'var(--color-text-primary)', letterSpacing: '-0.02em', marginTop: 2 }}>
                  Tus grupos
                </div>
              </div>
              <Link href="/perfil" aria-label="Perfil" style={{ display: 'flex', flexShrink: 0 }}>
                <Avatar nombre={nombreUsuario || '?'} color={avatarColor} size={42} />
              </Link>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {grupos.map(g => {
                const resumen = gruposConResumen.find(r => r.id === g.id)
                return (
                  <Link
                    key={g.id}
                    href={`/dashboard?grupo=${g.id}`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 13,
                      background: 'var(--color-surface-white)', border: '1px solid var(--color-border)',
                      borderRadius: 18, padding: 16, textDecoration: 'none',
                    }}
                  >
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
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: F_BODY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {g.nombre}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--color-neutral)', marginTop: 1, fontFamily: F_BODY }}>
                        {resumen ? `${resumen.integrantes} integrante${resumen.integrantes === 1 ? '' : 's'}` : (cargandoResumenes ? 'Cargando…' : '—')}
                      </div>
                    </div>
                    {resumen && (
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{
                          fontFamily: F_HEAD, fontSize: 14, fontWeight: 700,
                          color: resumen.netoUsuario > 0 ? 'var(--color-positive)' : resumen.netoUsuario < 0 ? 'var(--color-negative)' : 'var(--color-text-muted)',
                        }}>
                          {resumen.netoUsuario === 0 ? 'Al día' : formatCLP(Math.abs(resumen.netoUsuario))}
                        </div>
                        {resumen.netoUsuario !== 0 && (
                          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontFamily: F_BODY }}>
                            {resumen.netoUsuario > 0 ? 'te deben' : 'debés'}
                          </div>
                        )}
                      </div>
                    )}
                  </Link>
                )
              })}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 20 }}>
              <BotonPrimario onClick={() => setVista('crear')}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" /></svg>
                <span>Crear grupo</span>
              </BotonPrimario>
              <BotonSecundario onClick={() => { setVista('unirse'); setErrorUnirse(null) }}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
                  <path d="M9 12l2 2 4-4" stroke="var(--color-cta)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <rect x="3" y="4" width="18" height="16" rx="4" stroke="var(--color-text-disabled)" strokeWidth="1.6" />
                </svg>
                <span>Unirme con código</span>
              </BotonSecundario>
            </div>
          </>
        )}

        {/* ─── E1 · Estado vacío ─── */}
        {vista === 'vacio' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
              <div>
                <div style={{ fontSize: 12.5, color: 'var(--color-neutral)', fontFamily: F_BODY }}>
                  Hola, {nombreUsuario} 👋
                </div>
                <div style={{ fontFamily: F_HEAD, fontSize: 24, fontWeight: 800, color: 'var(--color-text-primary)', letterSpacing: '-0.02em', marginTop: 2 }}>
                  Empecemos
                </div>
              </div>
              <Avatar nombre={nombreUsuario || '?'} color={avatarColor} size={42} />
            </div>

            <div style={{
              borderRadius: 24, background: 'var(--gradient-cta)', padding: '30px 24px 26px',
              position: 'relative', overflow: 'hidden', boxShadow: 'var(--shadow-cta)',
            }}>
              <div style={{ position: 'absolute', top: -38, right: -30, width: 150, height: 150, borderRadius: '50%', background: 'rgba(255,255,255,.12)' }} />
              <div style={{ position: 'absolute', bottom: -56, left: -38, width: 170, height: 170, borderRadius: '50%', background: 'rgba(255,255,255,.08)' }} />
              <div style={{ position: 'relative' }}>
                <div style={{ width: 64, height: 64, borderRadius: 20, background: 'rgba(255,255,255,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                    <path d="M16 19v-1a4 4 0 00-4-4H6a4 4 0 00-4 4v1" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
                    <circle cx="9" cy="7" r="3.2" stroke="#fff" strokeWidth="1.8" />
                    <path d="M20 8v6M23 11h-6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </div>
                <div style={{ fontFamily: F_HEAD, fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1.2, marginTop: 18 }}>
                  Todavía no tenés<br />ningún grupo
                </div>
                <p style={{ fontSize: 13.5, lineHeight: 1.55, color: 'rgba(255,255,255,.86)', margin: '10px 0 0', fontFamily: F_BODY }}>
                  Invitá a alguien a un grupo y empiecen a registrar gastos juntos. Nosotros nos encargamos de las cuentas.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 22 }}>
              <BotonPrimario onClick={() => setVista('crear')}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" /></svg>
                <span>Crear grupo</span>
              </BotonPrimario>
              <BotonSecundario onClick={() => { setVista('unirse'); setErrorUnirse(null) }}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
                  <path d="M9 12l2 2 4-4" stroke="var(--color-cta)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <rect x="3" y="4" width="18" height="16" rx="4" stroke="var(--color-text-disabled)" strokeWidth="1.6" />
                </svg>
                <span>Unirme con código</span>
              </BotonSecundario>
            </div>

            <div style={{ marginTop: 'auto', padding: '20px 0 22px', textAlign: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--color-neutral)', fontFamily: F_BODY }}>
                Podés estar en varios grupos a la vez.
              </span>
            </div>
          </>
        )}

        {/* ─── E2 · Crear grupo ─── */}
        {vista === 'crear' && (
          <form onSubmit={handleCrear} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <HeaderConVolver titulo="Crear grupo" onVolver={volver} />

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

        {/* ─── E3 / E5 · Unirme con código ─── */}
        {vista === 'unirse' && (
          <form onSubmit={handleUnirse} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <HeaderConVolver titulo="Unirme con código" onVolver={volver} />

            <IconBadge negativo={!!errorUnirse}>
              {errorUnirse ? (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <path d="M12 8v5" stroke="var(--color-negative)" strokeWidth="2.2" strokeLinecap="round" />
                  <circle cx="12" cy="16.5" r="1.3" fill="var(--color-negative)" />
                  <circle cx="12" cy="12" r="9" stroke="var(--color-negative)" strokeWidth="1.8" />
                </svg>
              ) : (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <rect x="3" y="4" width="18" height="16" rx="4" stroke="#fff" strokeWidth="1.9" />
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
                  onClick={() => { setVista('crear'); setErrorUnirse(null) }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'center', fontSize: 13, fontWeight: 600, color: 'var(--color-cta)', fontFamily: F_BODY }}
                >
                  Mejor creo un grupo nuevo
                </button>
              )}
            </div>
          </form>
        )}

        {/* ─── E4 · Éxito ─── */}
        {vista === 'exito' && grupoConfirmado && (
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

      {vista === 'grupos' && <BottomNav />}
      {(vista === 'vacio' || vista === 'crear' || vista === 'unirse' || vista === 'exito') && (
        <NavInerte fabActivo={vista === 'exito'} />
      )}
    </main>
  )
}
