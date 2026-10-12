'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { resolverGrupoActivo, type GrupoOpcion } from '@/lib/grupo-activo'
import { calcularSaldosGrupo, obtenerResumenGastosGrupo, type SaldoIntegrante, type ResumenGastosGrupo } from '@/lib/cuentas'
import { formatCLP, formatearTiempoRelativo } from '@/lib/format'
import { Avatar } from '@/components/app/Avatar'
import { BottomNav } from '@/components/app/BottomNav'

const F_HEAD = 'var(--font-sora), sans-serif'
const F_BODY = 'var(--font-dm-sans), sans-serif'

export default function DashboardPage() {
  return (
    <Suspense>
      <DashboardPageInner />
    </Suspense>
  )
}

function DashboardPageInner() {
  const router = useRouter()
  const params = useSearchParams()

  const [fase, setFase] = useState<'cargando' | 'elegir-grupo' | 'ok'>('cargando')
  const [grupos, setGrupos] = useState<GrupoOpcion[]>([])
  const [grupoId, setGrupoId] = useState<string | null>(null)
  const [usuarioId, setUsuarioId] = useState<string | null>(null)
  const [nombreUsuario, setNombreUsuario] = useState('')
  const [avatarColor, setAvatarColor] = useState('#A8D8B9')
  const [grupoNombre, setGrupoNombre] = useState('')
  const [cargandoDashboard, setCargandoDashboard] = useState(true)
  const [resumenGrupo, setResumenGrupo] = useState<ResumenGastosGrupo>({ saldoTotal: 0, ultimaActividad: null })
  const [saldosPersonas, setSaldosPersonas] = useState<SaldoIntegrante[]>([])

  useEffect(() => {
    let activo = true
    async function cargar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }

      const [{ data: usuario }, resolucion] = await Promise.all([
        supabase.from('usuarios').select('nombre, avatar_color').eq('id', user.id).single(),
        resolverGrupoActivo(user.id, params.get('grupo')),
      ])
      if (!activo) return
      setUsuarioId(user.id)
      setNombreUsuario(usuario?.nombre ?? '')
      setAvatarColor(usuario?.avatar_color ?? '#A8D8B9')

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
    async function cargarDashboard() {
      setCargandoDashboard(true)
      const [{ data: grupo }, resumen, saldos] = await Promise.all([
        supabase.from('grupos').select('nombre').eq('id', grupoId!).single(),
        obtenerResumenGastosGrupo(grupoId!),
        calcularSaldosGrupo(grupoId!, usuarioId!),
      ])
      if (!activo) return
      setGrupoNombre(grupo?.nombre ?? '')
      setResumenGrupo(resumen)
      setSaldosPersonas(saldos)
      setCargandoDashboard(false)
    }
    cargarDashboard()
    return () => { activo = false }
  }, [fase, grupoId, usuarioId])

  if (fase === 'cargando') {
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
                href={`/dashboard?grupo=${g.id}`}
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

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--color-bg)', paddingBottom: 96 }}>
      <div style={{ maxWidth: 440, margin: '0 auto', padding: '0 18px', paddingTop: 'max(20px, env(safe-area-inset-top, 0px))' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 12.5, color: 'var(--color-neutral)', fontFamily: F_BODY }}>
              Hola, {nombreUsuario} 👋
            </div>
            <div style={{ fontFamily: F_HEAD, fontSize: 24, fontWeight: 800, color: 'var(--color-text-primary)', letterSpacing: '-0.02em', marginTop: 2 }}>
              {grupoNombre || 'Tus cuentas'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 9, alignItems: 'center' }}>
            <div
              aria-hidden="true"
              title="Novedades (todavía sin conectar)"
              style={{
                width: 42, height: 42, borderRadius: '50%', background: 'var(--color-surface-white)',
                border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <path d="M10 3a4 4 0 00-4 4c0 3-1.2 4.3-1.8 4.9-.3.3-.1.8.3.8h11c.4 0 .6-.5.3-.8C15.2 11.3 14 10 14 7a4 4 0 00-4-4zM8.5 15.5a1.5 1.5 0 003 0" stroke="var(--color-text-secondary)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <Link
              href={`/grupo${grupoId ? `?grupo=${grupoId}` : ''}`}
              aria-label="Grupo"
              style={{
                width: 42, height: 42, borderRadius: '50%', background: 'var(--color-surface-white)',
                border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="3" stroke="var(--color-text-secondary)" strokeWidth="1.5" />
                <path
                  d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"
                  stroke="var(--color-text-secondary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                />
              </svg>
            </Link>
            <Link href="/perfil" aria-label="Perfil" style={{ display: 'flex', flexShrink: 0 }}>
              <Avatar nombre={nombreUsuario || '?'} color={avatarColor} size={42} />
            </Link>
          </div>
        </div>

        {cargandoDashboard ? (
          <p style={{ fontSize: 13.5, color: 'var(--color-text-secondary)', fontFamily: F_BODY }}>Cargando…</p>
        ) : (
          <>
            {(() => {
              const teDeben = saldosPersonas.filter(s => s.neto > 0).reduce((s, p) => s + p.neto, 0)
              const debes = saldosPersonas.filter(s => s.neto < 0).reduce((s, p) => s + Math.abs(p.neto), 0)
              return (
                <div style={{ background: 'var(--color-surface-white)', border: '1px solid var(--color-border)', borderRadius: 18, padding: '18px 18px 20px' }}>
                  <div style={{ fontSize: 12.5, color: 'var(--color-neutral)', fontFamily: F_BODY }}>Saldo total del grupo</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 5 }}>
                    <span style={{ fontFamily: F_HEAD, fontSize: 32, fontWeight: 800, color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}>
                      {formatCLP(resumenGrupo.saldoTotal)}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-muted)' }}>CLP</span>
                  </div>
                  {resumenGrupo.ultimaActividad && (
                    <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginTop: 4, fontFamily: F_BODY }}>
                      Última actividad {formatearTiempoRelativo(resumenGrupo.ultimaActividad)}
                    </div>
                  )}

                  <div style={{ marginTop: 16, border: '1px solid var(--color-divider)', borderRadius: 12, padding: '12px 13px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: F_BODY }}>Te deben</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: F_HEAD }}>{formatCLP(teDeben)}</span>
                    </div>
                  </div>
                  <div style={{ marginTop: 10, border: '1px solid var(--color-divider)', borderRadius: 12, padding: '12px 13px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: F_BODY }}>Debes</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: F_HEAD }}>{formatCLP(debes)}</span>
                    </div>
                  </div>
                </div>
              )
            })()}

            <div style={{ margin: '22px 2px 12px' }}>
              <span style={{ fontFamily: F_HEAD, fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--color-text-primary)' }}>
                Saldos por persona
              </span>
            </div>

            {saldosPersonas.length === 0 ? (
              <div style={{ background: 'var(--color-surface-white)', border: '1px solid var(--color-border)', borderRadius: 18, padding: '28px 18px', textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: 13.5, color: 'var(--color-text-secondary)', fontFamily: F_BODY }}>
                  No hay más integrantes en este grupo todavía.
                </p>
              </div>
            ) : (
              <div style={{ background: 'var(--color-surface-white)', border: '1px solid var(--color-border)', borderRadius: 18, padding: '4px 16px' }}>
                {saldosPersonas.map((s, idx) => {
                  const estado = s.neto > 0 ? 'te-debe' : s.neto < 0 ? 'le-debes' : 'al-dia'
                  const pill = {
                    'te-debe': { tint: 'var(--color-positive-tint)', border: 'var(--color-positive-border)', dot: 'var(--color-positive)', texto: 'var(--color-positive)', label: 'Te debe' },
                    'le-debes': { tint: 'var(--color-negative-tint)', border: 'var(--color-negative-border)', dot: 'var(--color-negative)', texto: 'var(--color-negative)', label: 'Le debes' },
                    'al-dia': { tint: 'var(--color-neutral-tint)', border: 'var(--color-neutral-border)', dot: 'var(--color-neutral-dot)', texto: 'var(--color-neutral)', label: 'Al día' },
                  }[estado]
                  const contenido = (
                    <>
                      <Avatar nombre={s.usuario.nombre} color={s.usuario.avatar_color} size={42} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: F_BODY }}>{s.usuario.nombre}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--color-neutral)', marginTop: 1, fontFamily: F_BODY }}>{formatCLP(Math.abs(s.neto))}</div>
                      </div>
                      <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5, borderRadius: 100, padding: '4px 10px',
                        border: `1px solid ${pill.border}`, background: pill.tint, flexShrink: 0,
                      }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: pill.dot }} />
                        <span style={{ fontSize: 11.5, fontWeight: 600, color: pill.texto, fontFamily: F_BODY }}>{pill.label}</span>
                      </div>
                    </>
                  )
                  const filaStyle: React.CSSProperties = {
                    display: 'flex', alignItems: 'center', gap: 13, padding: '13px 0',
                    borderBottom: idx < saldosPersonas.length - 1 ? '1px solid var(--color-divider)' : 'none',
                  }
                  if (estado === 'le-debes') {
                    return (
                      <Link key={s.usuario.id} href={`/saldos/${s.usuario.id}${grupoId ? `?grupo=${grupoId}` : ''}`} style={{ ...filaStyle, textDecoration: 'none' }}>
                        {contenido}
                      </Link>
                    )
                  }
                  return <div key={s.usuario.id} style={filaStyle}>{contenido}</div>
                })}
              </div>
            )}
          </>
        )}
      </div>

      <BottomNav />
    </main>
  )
}
