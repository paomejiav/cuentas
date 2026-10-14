'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { seleccionarGrupo } from '@/lib/grupo-activo'
import { listarGruposConIntegrantes, hrefHomeGrupo } from '@/lib/grupo'
import {
  calcularSaldosGrupo, obtenerResumenGastosGrupo, obtenerGastoMesPorCuenta,
  limitesMesActualSantiago, nombreMesDeFecha,
  type SaldoIntegrante, type ResumenGastosGrupo, type GastoMesPorCuenta,
} from '@/lib/cuentas'
import { formatCLP, formatearTiempoRelativo, capitalizar } from '@/lib/format'
import { Avatar } from '@/components/app/Avatar'
import { colorDeGrupo } from '@/lib/colores-grupo'
import { HeaderGrupoInterno } from '@/components/app/HeaderGrupoInterno'
import { BottomNav } from '@/components/app/BottomNav'

const F_HEAD = 'var(--font-sora), sans-serif'
const F_BODY = 'var(--font-dm-sans), sans-serif'

function sumarPositivos(saldos: SaldoIntegrante[]): number {
  return saldos.filter(s => s.neto > 0).reduce((s, x) => s + x.neto, 0)
}
function sumarNegativos(saldos: SaldoIntegrante[]): number {
  return saldos.filter(s => s.neto < 0).reduce((s, x) => s + Math.abs(x.neto), 0)
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'var(--color-surface-white)', border: '1px solid var(--color-border)',
      borderRadius: 18, padding: '16px 18px', ...style,
    }}>
      {children}
    </div>
  )
}

function FilaAccion({ href, icono, titulo, subtitulo }: { href: string; icono: React.ReactNode; titulo: string; subtitulo: string }) {
  return (
    <Link href={href} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '13px 0', width: '100%', textDecoration: 'none' }}>
      <span style={{
        width: 40, height: 40, borderRadius: 13, background: 'var(--tint-cta)', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icono}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: F_BODY }}>{titulo}</div>
        <div style={{ fontSize: 12, color: 'var(--color-neutral)', marginTop: 1, fontFamily: F_BODY }}>{subtitulo}</div>
      </div>
      <svg width="8" height="14" viewBox="0 0 8 14" fill="none" style={{ flexShrink: 0 }}>
        <path d="M1.5 1.5L6.5 7l-5 5.5" stroke="#C4C7CE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  )
}

/** Barra de dos segmentos (positivo a la derecha en verde, negativo a la izquierda en rojo) con leyenda. */
function BarraTeDebenDebes({ teDeben, debes }: { teDeben: number; debes: number }) {
  const total = teDeben + debes
  const pctTeDeben = total > 0 ? (teDeben / total) * 100 : 0
  const pctDebes = 100 - pctTeDeben
  return (
    <>
      <div style={{ marginTop: 16, height: 12, borderRadius: 8, background: 'var(--color-track)', display: 'flex', overflow: 'hidden' }}>
        {pctDebes > 0 && <div style={{ width: `${pctDebes}%`, background: 'var(--color-negative)' }} />}
        {pctTeDeben > 0 && <div style={{ width: `${pctTeDeben}%`, background: 'var(--color-positive)' }} />}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 11 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-negative)' }} />
          <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontWeight: 500, fontFamily: F_BODY }}>Debes {formatCLP(debes)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-positive)' }} />
          <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontWeight: 500, fontFamily: F_BODY }}>Te deben {formatCLP(teDeben)}</span>
        </div>
      </div>
    </>
  )
}

export default function GrupoHomePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: grupoId } = use(params)
  const router = useRouter()

  const [fase, setFase] = useState<'cargando' | 'ok'>('cargando')
  const [grupoNombre, setGrupoNombre] = useState('')
  const [resumenGrupo, setResumenGrupo] = useState<ResumenGastosGrupo>({ saldoTotal: 0, ultimaActividad: null })
  const [saldosPersonas, setSaldosPersonas] = useState<SaldoIntegrante[]>([])
  const [gastoPorCuenta, setGastoPorCuenta] = useState<GastoMesPorCuenta[]>([])
  const [verTodoPersonas, setVerTodoPersonas] = useState(false)

  useEffect(() => {
    let activo = true
    async function cargar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }

      // La home depende del id de la ruta, no de la cookie — valida que
      // siga siendo un grupo activo del usuario antes de mostrar nada.
      const gruposActivos = await listarGruposConIntegrantes(user.id)
      if (!activo) return
      const grupo = gruposActivos.find(g => g.id === grupoId)
      if (!grupo) { router.replace('/mis-grupos'); return }

      // Abrir la home de un grupo lo deja elegido globalmente, así
      // Historial y el "+" lo siguen (sin forzar un refresh visual: ya
      // estamos renderizando esta pantalla con los datos correctos).
      seleccionarGrupo(grupoId, { refresh: () => {} })

      const { desde, hasta } = limitesMesActualSantiago()
      const [resumen, saldos, porCuenta] = await Promise.all([
        obtenerResumenGastosGrupo(grupoId),
        calcularSaldosGrupo(grupoId, user.id),
        obtenerGastoMesPorCuenta(grupoId, desde, hasta),
      ])
      if (!activo) return
      setGrupoNombre(grupo.nombre)
      setResumenGrupo(resumen)
      setSaldosPersonas(saldos)
      setGastoPorCuenta(porCuenta.filter(c => c.monto > 0))
      setFase('ok')
    }
    cargar()
    return () => { activo = false }
  }, [router, grupoId])

  const mesLabel = capitalizar(nombreMesDeFecha(limitesMesActualSantiago().desde))

  if (fase === 'cargando') {
    return (
      <main style={{ minHeight: '100dvh', background: 'var(--color-bg)' }}>
        <div style={{ maxWidth: 440, margin: '0 auto', padding: '0 18px', paddingTop: 'max(20px, env(safe-area-inset-top, 0px))' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 10 }}>
            {[140, 180, 140, 100].map((h, i) => <div key={i} className="skeleton" style={{ height: h, borderRadius: 18 }} />)}
          </div>
        </div>
      </main>
    )
  }

  const teDeben = sumarPositivos(saldosPersonas)
  const debes = sumarNegativos(saldosPersonas)

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--color-bg)', paddingBottom: 96 }}>
      <div style={{ maxWidth: 440, margin: '0 auto', padding: '0 18px', paddingTop: 'max(20px, env(safe-area-inset-top, 0px))' }}>

        <HeaderGrupoInterno
          grupoId={grupoId}
          grupoNombre={grupoNombre}
          rutaBase={hrefHomeGrupo(grupoId)}
          volverHref="/mis-grupos"
          engranaje
          onElegirGrupo={id => router.push(hrefHomeGrupo(id))}
        />

        <Card style={{ marginTop: 6 }}>
          <div style={{ fontSize: 12.5, color: 'var(--color-neutral)', fontFamily: F_BODY }}>Saldo total del grupo</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 5 }}>
            <span style={{ fontFamily: F_HEAD, fontSize: 32, fontWeight: 800, color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}>
              {formatCLP(resumenGrupo.saldoTotal)}
            </span>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-muted)' }}>CLP</span>
          </div>
          {resumenGrupo.ultimaActividad && (
            <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginTop: 4, fontFamily: F_BODY }}>
              Última act. {formatearTiempoRelativo(resumenGrupo.ultimaActividad)}
            </div>
          )}
          <BarraTeDebenDebes teDeben={teDeben} debes={debes} />
        </Card>

        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '22px 2px 12px' }}>
          <span style={{ fontFamily: F_HEAD, fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--color-text-primary)' }}>
            Saldos por persona
          </span>
          {saldosPersonas.length > 3 && (
            <button
              type="button"
              onClick={() => setVerTodoPersonas(v => !v)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: 'var(--color-cta)', fontFamily: F_BODY }}
            >
              {verTodoPersonas ? 'Ver menos' : 'Ver todo'}
            </button>
          )}
        </div>

        {saldosPersonas.length === 0 ? (
          <Card style={{ padding: '28px 18px', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 13.5, color: 'var(--color-text-secondary)', fontFamily: F_BODY }}>
              No hay más integrantes en este grupo todavía.
            </p>
          </Card>
        ) : (
          <Card style={{ padding: '4px 16px' }}>
            {(verTodoPersonas ? saldosPersonas : saldosPersonas.slice(0, 3)).map((s, idx, arr) => {
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
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, borderRadius: 100, padding: '4px 10px', border: `1px solid ${pill.border}`, background: pill.tint, flexShrink: 0 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: pill.dot }} />
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: pill.texto, fontFamily: F_BODY }}>{pill.label}</span>
                  </div>
                </>
              )
              const filaStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 13, padding: '13px 0', borderBottom: idx < arr.length - 1 ? '1px solid var(--color-divider)' : 'none' }
              if (estado === 'le-debes') {
                return <Link key={s.usuario.id} href={`/saldos/${s.usuario.id}?grupo=${grupoId}`} style={{ ...filaStyle, textDecoration: 'none' }}>{contenido}</Link>
              }
              return <div key={s.usuario.id} style={filaStyle}>{contenido}</div>
            })}
          </Card>
        )}

        {gastoPorCuenta.length > 0 && (
          <Card style={{ marginTop: 20 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: F_BODY }}>
              Gasto de {mesLabel.toLowerCase()} por cuenta
            </div>
            <div style={{ fontFamily: F_HEAD, fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--color-text-primary)', marginTop: 4 }}>
              {formatCLP(gastoPorCuenta.reduce((s, c) => s + c.monto, 0))}
            </div>
            <div style={{ marginTop: 14, height: 12, borderRadius: 8, background: 'var(--color-track)', display: 'flex', overflow: 'hidden' }}>
              {gastoPorCuenta.map(c => {
                const total = gastoPorCuenta.reduce((s, x) => s + x.monto, 0)
                const { bg } = c.cuentaId ? colorDeGrupo(c.cuentaId) : { bg: '#D9D9DE' }
                return <div key={c.cuentaId ?? 'general'} style={{ width: `${(c.monto / total) * 100}%`, background: bg }} />
              })}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', marginTop: 12 }}>
              {gastoPorCuenta.map(c => {
                const total = gastoPorCuenta.reduce((s, x) => s + x.monto, 0)
                const pct = total > 0 ? Math.round((c.monto / total) * 100) : 0
                const { texto } = c.cuentaId ? colorDeGrupo(c.cuentaId) : { texto: '#6B7280' }
                return (
                  <div key={c.cuentaId ?? 'general'} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0' }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: texto, flexShrink: 0 }} />
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: F_BODY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.nombre}
                    </span>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: F_HEAD, flexShrink: 0 }}>{formatCLP(c.monto)}</span>
                    <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontFamily: F_BODY, flexShrink: 0, width: 34, textAlign: 'right' }}>{pct}%</span>
                  </div>
                )
              })}
            </div>
          </Card>
        )}

        <Card style={{ marginTop: 20, padding: '4px 16px' }}>
          <FilaAccion
            href={`/cuentas?grupo=${grupoId}`}
            icono={<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M6 3h9l3 3v15a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="var(--color-cta-dark)" strokeWidth="1.6" strokeLinejoin="round" /><path d="M8.5 9h7M8.5 13h7M8.5 17h4" stroke="var(--color-cta-dark)" strokeWidth="1.6" strokeLinecap="round" /></svg>}
            titulo="Cuentas"
            subtitulo="Hogar, viajes, eventos"
          />
          <div style={{ height: 1, background: 'var(--color-divider)' }} />
          <FilaAccion
            href={`/cierre?grupo=${grupoId}`}
            icono={<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="var(--color-cta-dark)" strokeWidth="1.6" /><path d="M8 12l3 3 5-5" stroke="var(--color-cta-dark)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            titulo="Cierre mensual"
            subtitulo="Cierra el mes y salda las deudas"
          />
        </Card>
      </div>

      <BottomNav />
    </main>
  )
}
