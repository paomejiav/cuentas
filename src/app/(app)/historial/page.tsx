'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useSession } from '@/lib/session-store'
import {
  obtenerGastos, obtenerGastosEntreDos, obtenerMesesDisponibles,
  formatearMes, formatearFechaCorta,
  type GastoResumen,
} from '@/lib/historial'
import { formatCLP } from '@/lib/format'
import { Avatar } from '@/components/app/Avatar'
import { BottomNav } from '@/components/app/BottomNav'
import { GastoDetalle } from '@/components/app/GastoDetalle'
import { CATEGORIA_EMOJI, CATEGORIA_LABEL, type Categoria } from '@/types/database'
import { supabase } from '@/lib/supabase'
import type { Integrante } from '@/types/database'

// ── Skeleton ─────────────────────────────────────────────────

function SkeletonItem() {
  return (
    <div aria-hidden="true" style={{
      background: 'var(--color-card)',
      borderRadius: 18, padding: '14px 16px',
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div className="skeleton" style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
        <div className="skeleton" style={{ height: 14, width: '48%', borderRadius: 6 }} />
        <div className="skeleton" style={{ height: 12, width: '33%', borderRadius: 6 }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-end' }}>
        <div className="skeleton" style={{ height: 14, width: 55, borderRadius: 6 }} />
        <div className="skeleton" style={{ height: 12, width: 38, borderRadius: 6 }} />
      </div>
    </div>
  )
}

// ── Ítem de gasto ─────────────────────────────────────────────

function GastoItem({
  gasto,
  miId,
  onClick,
}: {
  gasto: GastoResumen
  miId: string
  onClick: () => void
}) {
  const yoPague = gasto.pagador?.id === miId
  const participo = gasto.mi_division > 0

  return (
    <button
      onClick={onClick}
      style={{
        background: 'var(--color-card)',
        borderRadius: 18,
        padding: '13px 16px',
        border: 'none',
        width: '100%',
        display: 'flex', alignItems: 'center', gap: 13,
        cursor: 'pointer', textAlign: 'left',
        transition: 'transform 120ms ease',
        WebkitTapHighlightColor: 'transparent',
      }}
      onPointerDown={e => (e.currentTarget.style.transform = 'scale(0.97)')}
      onPointerUp={e => (e.currentTarget.style.transform = 'scale(1)')}
      onPointerLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
    >
      {/* Emoji categoría */}
      <div style={{
        width: 44, height: 44,
        borderRadius: 12,
        background: 'var(--color-card-light)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22, flexShrink: 0,
      }}>
        {CATEGORIA_EMOJI[gasto.categoria] ?? '📦'}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          margin: 0,
          fontSize: 14, fontWeight: 600,
          color: 'var(--color-text-primary)',
          fontFamily: 'var(--font-dm-sans), sans-serif',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {gasto.descripcion}
        </p>
        <p style={{
          margin: '3px 0 0',
          fontSize: 12,
          color: 'var(--color-text-secondary)',
          fontFamily: 'var(--font-dm-sans), sans-serif',
        }}>
          {yoPague ? 'Pagaste tú' : `Pagó ${gasto.pagador?.nombre}`}
          {' · '}{formatearFechaCorta(gasto.fecha)}
        </p>
      </div>

      {/* Montos */}
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <p style={{
          margin: 0,
          fontSize: 14, fontWeight: 700,
          color: 'var(--color-text-primary)',
          fontFamily: 'var(--font-dm-sans), sans-serif',
        }}>
          {formatCLP(gasto.monto_total)}
        </p>
        {participo && (
          <p style={{
            margin: '2px 0 0',
            fontSize: 12, fontWeight: 600,
            color: yoPague ? 'var(--color-positive)' : 'var(--color-negative)',
            fontFamily: 'var(--font-dm-sans), sans-serif',
          }}>
            {yoPague ? '+' : '−'}{formatCLP(gasto.mi_division)}
          </p>
        )}
      </div>
    </button>
  )
}

// ── Chips de filtro ───────────────────────────────────────────

function Chip({
  activo, onClick, children,
}: {
  activo: boolean; onClick: () => void; children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '7px 14px',
        borderRadius: 100,
        border: activo ? '2px solid var(--color-cta)' : '2px solid var(--color-border)',
        background: activo ? 'white' : 'var(--color-card-light)',
        color: activo ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
        fontSize: 13, fontWeight: activo ? 600 : 400,
        fontFamily: 'var(--font-dm-sans), sans-serif',
        cursor: 'pointer', whiteSpace: 'nowrap',
        transition: 'all 150ms ease',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {children}
    </button>
  )
}

// ── Página ────────────────────────────────────────────────────

export default function HistorialPage() {
  return (
    <Suspense>
      <HistorialInner />
    </Suspense>
  )
}

function HistorialInner() {
  const router = useRouter()
  const params = useSearchParams()
  const { sesion, loading: sesionLoading } = useSession()

  const personaId = params.get('persona')

  // Integrante del "modo 2"
  const [otraPersona, setOtraPersona] = useState<Integrante | null>(null)
  // Lista de integrantes para el filtro
  const [integrantes, setIntegrantes] = useState<Integrante[]>([])
  // Meses disponibles
  const [meses, setMeses] = useState<string[]>([])

  // Filtros
  const [mesFiltro, setMesFiltro] = useState<string>('')
  const [categoriaFiltro, setCategoriaFiltro] = useState<Categoria | ''>('')
  const [personaFiltro, setPersonaFiltro] = useState<string>('')

  // Datos
  const [gastos, setGastos] = useState<GastoResumen[]>([])
  const [cargando, setCargando] = useState(true)
  const [hayMas, setHayMas] = useState(false)
  const [cargandoMas, setCargandoMas] = useState(false)

  // Detalle
  const [gastoDetalle, setGastoDetalle] = useState<GastoResumen | null>(null)

  // Saldo neto en modo 2
  const [saldoNeto, setSaldoNeto] = useState(0)

  const esModo2 = Boolean(personaId)

  // Cargar datos auxiliares
  useEffect(() => {
    if (!sesion) return
    Promise.all([
      supabase.from('integrantes').select('*').eq('grupo_id', sesion.grupo_id).eq('activo', true).order('nombre'),
      obtenerMesesDisponibles(sesion.grupo_id),
    ]).then(([{ data: ints }, mesesData]) => {
      if (ints) setIntegrantes(ints as Integrante[])
      setMeses(mesesData)
    })
  }, [sesion])

  // Cargar integrante del modo 2
  useEffect(() => {
    if (!personaId || !sesion) return
    supabase
      .from('integrantes')
      .select('*')
      .eq('id', personaId)
      .single()
      .then(({ data }) => { if (data) setOtraPersona(data as Integrante) })
  }, [personaId, sesion])

  // Función de carga
  const cargarGastos = useCallback(async (reset = true) => {
    if (!sesion) return
    if (reset) setCargando(true)
    else setCargandoMas(true)

    if (esModo2 && personaId) {
      const data = await obtenerGastosEntreDos(sesion.grupo_id, sesion.integrante_id, personaId)
      setGastos(data)
      setHayMas(false)
      // Calcular saldo neto entre los dos
      let neto = 0
      for (const g of data) {
        const yoPague = g.pagador?.id === sesion.integrante_id
        const miDiv = g.mi_division
        const suDiv = g.divisiones.find(d => d.integrante?.id === personaId)?.monto_asignado ?? 0
        if (yoPague) neto += suDiv       // otro me debe su parte
        else neto -= miDiv               // yo le debo mi parte
      }
      setSaldoNeto(Math.round(neto))
    } else {
      const cursor = reset ? undefined : gastos[gastos.length - 1]?.creado_en
      const { gastos: nuevos, hayMas: mas } = await obtenerGastos({
        grupoId: sesion.grupo_id,
        miId: sesion.integrante_id,
        mes: mesFiltro || undefined,
        categoria: categoriaFiltro || undefined,
        personaId: personaFiltro || undefined,
        cursor,
      })
      setGastos(prev => reset ? nuevos : [...prev, ...nuevos])
      setHayMas(mas)
    }

    if (reset) setCargando(false)
    else setCargandoMas(false)
  }, [sesion, esModo2, personaId, mesFiltro, categoriaFiltro, personaFiltro, gastos])

  useEffect(() => {
    if (!sesionLoading && !sesion) { router.replace('/login'); return }
    if (sesion) cargarGastos(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sesion, sesionLoading, mesFiltro, categoriaFiltro, personaFiltro, personaId])

  function handleEliminado() {
    cargarGastos(true)
  }

  if (sesionLoading || !sesion) return null

  // ── RENDER ─────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', paddingBottom: 80 }}>

      {/* Header */}
      <header style={{ padding: '56px 20px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        {esModo2 && (
          <button
            onClick={() => router.back()}
            style={{
              background: 'var(--color-card)', border: 'none', borderRadius: 12,
              width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M11 4L6 9l5 5" stroke="var(--color-text-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            margin: 0, fontSize: 12, fontWeight: 600,
            color: 'var(--color-text-secondary)',
            fontFamily: 'var(--font-dm-sans), sans-serif',
            textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>
            {esModo2 ? 'Gastos compartidos' : 'Historial'}
          </p>
          <h1 style={{
            margin: '2px 0 0', fontSize: 24, fontWeight: 700,
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-lora), serif',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {esModo2 ? `Tú y ${otraPersona?.nombre ?? '…'}` : 'Todos los gastos'}
          </h1>
        </div>

        {esModo2 && otraPersona && (
          <Avatar nombre={otraPersona.nombre} color={otraPersona.avatar_color} size={40} />
        )}
      </header>

      <main style={{ padding: '0 16px' }}>

        {/* ── MODO 2: saldo neto destacado ── */}
        {esModo2 && !cargando && (
          <div style={{
            background: 'var(--color-card)',
            borderRadius: 20, padding: '18px 20px', marginBottom: 16,
            textAlign: 'center',
          }}>
            <p style={{
              margin: 0, fontSize: 11, fontWeight: 600,
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-dm-sans), sans-serif',
              textTransform: 'uppercase', letterSpacing: '0.07em',
            }}>
              Saldo actual entre ustedes
            </p>
            <p style={{
              margin: '6px 0 0', fontSize: 32, fontWeight: 700,
              fontFamily: 'var(--font-lora), serif',
              color: saldoNeto === 0
                ? 'var(--color-text-secondary)'
                : saldoNeto > 0
                ? 'var(--color-positive)'
                : 'var(--color-negative)',
            }}>
              {saldoNeto === 0
                ? 'Sin deudas ✓'
                : saldoNeto > 0
                ? `${otraPersona?.nombre} te debe ${formatCLP(saldoNeto)}`
                : `Le debes ${formatCLP(-saldoNeto)} a ${otraPersona?.nombre}`}
            </p>
          </div>
        )}

        {/* ── MODO 1: filtros ── */}
        {!esModo2 && (
          <div style={{ marginBottom: 16 }}>
            {/* Filtro por mes */}
            {meses.length > 0 && (
              <div style={{
                display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8,
                scrollbarWidth: 'none', marginBottom: 8,
              }}>
                <Chip activo={!mesFiltro} onClick={() => setMesFiltro('')}>Todos</Chip>
                {meses.slice(0, 6).map(m => (
                  <Chip key={m} activo={mesFiltro === m} onClick={() => setMesFiltro(mesFiltro === m ? '' : m)}>
                    {formatearMes(m)}
                  </Chip>
                ))}
              </div>
            )}

            {/* Filtro por categoría */}
            <div style={{
              display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8,
              scrollbarWidth: 'none', marginBottom: 8,
            }}>
              <Chip activo={!categoriaFiltro} onClick={() => setCategoriaFiltro('')}>🗂 Todas</Chip>
              {(Object.keys(CATEGORIA_EMOJI) as Categoria[]).map(cat => (
                <Chip
                  key={cat}
                  activo={categoriaFiltro === cat}
                  onClick={() => setCategoriaFiltro(categoriaFiltro === cat ? '' : cat)}
                >
                  {CATEGORIA_EMOJI[cat]} {CATEGORIA_LABEL[cat]}
                </Chip>
              ))}
            </div>

            {/* Filtro por persona */}
            {integrantes.length > 0 && (
              <div style={{
                display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4,
                scrollbarWidth: 'none',
              }}>
                <Chip activo={!personaFiltro} onClick={() => setPersonaFiltro('')}>Todas</Chip>
                {integrantes.map(i => (
                  <Chip
                    key={i.id}
                    activo={personaFiltro === i.id}
                    onClick={() => setPersonaFiltro(personaFiltro === i.id ? '' : i.id)}
                  >
                    {i.id === sesion.integrante_id ? 'Yo' : i.nombre}
                  </Chip>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Lista de gastos ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {cargando
            ? Array.from({ length: 5 }).map((_, i) => <SkeletonItem key={i} />)
            : gastos.length === 0
            ? (
              <div style={{ textAlign: 'center', padding: '48px 20px' }}>
                <div style={{ fontSize: 44, marginBottom: 12 }}>
                  {esModo2 ? '🤝' : (mesFiltro || categoriaFiltro || personaFiltro) ? '🔍' : '🧾'}
                </div>
                <p style={{
                  margin: 0, fontSize: 16, fontWeight: 700,
                  color: 'var(--color-text-primary)',
                  fontFamily: 'var(--font-lora), serif',
                }}>
                  {esModo2
                    ? 'Sin gastos compartidos'
                    : (mesFiltro || categoriaFiltro || personaFiltro)
                    ? 'Sin gastos para este período'
                    : 'Todavía no hay gastos'}
                </p>
                <p style={{
                  margin: '8px 0 0', fontSize: 13,
                  color: 'var(--color-text-secondary)',
                  fontFamily: 'var(--font-dm-sans), sans-serif',
                  lineHeight: 1.5,
                }}>
                  {esModo2
                    ? 'Aún no tienen gastos activos juntas'
                    : (mesFiltro || categoriaFiltro || personaFiltro)
                    ? 'Probá cambiando o quitando los filtros'
                    : 'Usa el botón + para agregar el primer gasto del grupo'}
                </p>
              </div>
            )
            : gastos.map(g => (
              <GastoItem
                key={g.id}
                gasto={g}
                miId={sesion.integrante_id}
                onClick={() => setGastoDetalle(g)}
              />
            ))
          }
        </div>

        {/* Cargar más */}
        {hayMas && !cargando && (
          <button
            onClick={() => cargarGastos(false)}
            disabled={cargandoMas}
            style={{
              width: '100%', marginTop: 12, height: 48,
              borderRadius: 100, border: 'none',
              background: 'var(--color-card)',
              color: 'var(--color-text-secondary)',
              fontSize: 14, fontWeight: 600,
              fontFamily: 'var(--font-dm-sans), sans-serif',
              cursor: 'pointer',
            }}
          >
            {cargandoMas ? 'Cargando…' : 'Cargar más'}
          </button>
        )}

        {/* Total visible */}
        {!cargando && gastos.length > 0 && !esModo2 && (
          <p style={{
            margin: '20px 0 0', textAlign: 'center', fontSize: 12,
            color: 'var(--color-text-disabled)',
            fontFamily: 'var(--font-dm-sans), sans-serif',
          }}>
            {gastos.length} gasto{gastos.length !== 1 ? 's' : ''} ·{' '}
            Total {formatCLP(gastos.reduce((s, g) => s + g.monto_total, 0))}
          </p>
        )}
      </main>

      {/* FAB */}
      <Link
        href="/gastos/nuevo"
        aria-label="Agregar nuevo gasto"
        style={{
          position: 'fixed', bottom: 80, right: 20,
          width: 56, height: 56, borderRadius: 18,
          background: 'var(--color-cta)',
          boxShadow: '0 4px 16px rgba(0, 200, 81, 0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          textDecoration: 'none', zIndex: 50,
          transition: 'transform 120ms ease',
        }}
        onPointerDown={e => (e.currentTarget.style.transform = 'scale(0.93)')}
        onPointerUp={e => (e.currentTarget.style.transform = 'scale(1)')}
        onPointerLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </Link>

      <BottomNav />

      {/* Bottom sheet detalle */}
      {gastoDetalle && (
        <GastoDetalle
          gasto={gastoDetalle}
          miId={sesion.integrante_id}
          onClose={() => setGastoDetalle(null)}
          onEliminado={handleEliminado}
        />
      )}
    </div>
  )
}
