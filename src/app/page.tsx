'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { listarGruposActivos, type GrupoNombre } from '@/lib/grupo'
import { calcularSaldosGrupo } from '@/lib/cuentas'
import { formatCLP } from '@/lib/format'
import { BottomNav } from '@/components/app/BottomNav'
import { FlujoCrearUnirseGrupo } from '@/components/app/FlujoCrearUnirseGrupo'
import { seleccionarGrupo } from '@/lib/grupo-activo'

const F_HEAD = 'var(--font-sora), sans-serif'
const F_BODY = 'var(--font-dm-sans), sans-serif'

type Vista = 'cargando' | 'grupos' | 'vacio' | 'link-invalido'

interface GrupoConResumen extends GrupoNombre {
  integrantes: number
  netoUsuario: number
}

// ── Piezas visuales reutilizadas del sistema Walto (tokens --color-*, --font-*) ──

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
  const [usuarioId, setUsuarioId] = useState<string | null>(null)
  const [grupos, setGrupos] = useState<GrupoNombre[]>([])
  const [gruposConResumen, setGruposConResumen] = useState<GrupoConResumen[]>([])
  const [cargandoResumenes, setCargandoResumenes] = useState(true)
  const [flujoAbierto, setFlujoAbierto] = useState<'crear' | 'unirse' | null>(null)

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
        supabase.from('usuarios').select('nombre').eq('id', user.id).single(),
        listarGruposActivos(user.id),
      ])

      if (!activo) return
      setUsuarioId(user.id)
      setNombreUsuario(usuario?.nombre ?? '')

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

  function handleListoFlujo(grupo: { id: string; nombre: string }) {
    seleccionarGrupo(grupo.id, { refresh: () => {} })
    router.push(`/dashboard?grupo=${grupo.id}`)
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
              <BotonPrimario onClick={() => setFlujoAbierto('crear')}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" /></svg>
                <span>Crear grupo</span>
              </BotonPrimario>
              <BotonSecundario onClick={() => setFlujoAbierto('unirse')}>
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
            <div style={{ marginBottom: 22 }}>
              <div style={{ fontSize: 12.5, color: 'var(--color-neutral)', fontFamily: F_BODY }}>
                Hola, {nombreUsuario} 👋
              </div>
              <div style={{ fontFamily: F_HEAD, fontSize: 24, fontWeight: 800, color: 'var(--color-text-primary)', letterSpacing: '-0.02em', marginTop: 2 }}>
                Empecemos
              </div>
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
              <BotonPrimario onClick={() => setFlujoAbierto('crear')}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" /></svg>
                <span>Crear grupo</span>
              </BotonPrimario>
              <BotonSecundario onClick={() => setFlujoAbierto('unirse')}>
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
      </div>

      {vista === 'grupos' && <BottomNav />}
      {vista === 'vacio' && <BottomNav sinGrupos />}

      {flujoAbierto && (
        <FlujoCrearUnirseGrupo
          pasoInicial={flujoAbierto}
          onCerrar={() => setFlujoAbierto(null)}
          onListo={handleListoFlujo}
        />
      )}
    </main>
  )
}
