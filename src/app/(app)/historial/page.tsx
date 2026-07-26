'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from '@/lib/session-store'
import {
  obtenerGastos, obtenerGastosEntreDos, obtenerPagos, obtenerPagosEntreDos, obtenerMesesDisponibles,
  formatearMes, formatearFechaCorta,
  type GastoResumen, type PagoResumen,
} from '@/lib/historial'
import { formatCLP } from '@/lib/format'
import { Avatar } from '@/components/app/Avatar'
import { BottomNav } from '@/components/app/BottomNav'
import { GastoDetalle } from '@/components/app/GastoDetalle'
import { CATEGORIA_EMOJI, CATEGORIA_LABEL, type Categoria } from '@/types/database'
import { supabase } from '@/lib/supabase'
import type { Integrante } from '@/types/database'

const CATEGORIA_TINT: Record<Categoria, string> = {
  super:           'var(--tint-cta)',
  comida:          '#FEF0E5',
  transporte:      '#E6F6FD',
  regalo:          'var(--tint-cta)',
  cumpleanos:      '#FEF0E5',
  tragos:          'var(--tint-cta)',
  entretenimiento: '#E6F6FD',
  otro:            'var(--color-icon-bg)',
}

// ── Skeleton ─────────────────────────────────────────────────

function SkeletonItem() {
  return (
    <div aria-hidden="true" style={{
      background: 'var(--color-card)', border: '1px solid var(--color-border)',
      borderRadius: 18, padding: '13px 16px',
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div className="skeleton" style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0 }} />
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
  gasto, miId, esUltimo, onClick,
}: {
  gasto: GastoResumen; miId: string; esUltimo: boolean; onClick: () => void
}) {
  const yoPague = gasto.pagador?.id === miId
  const participo = gasto.mi_division > 0

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, width: '100%',
        padding: '13px 0', border: 'none', background: 'transparent',
        borderBottom: esUltimo ? 'none' : '1px solid var(--color-divider)',
        cursor: 'pointer', textAlign: 'left',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <div style={{
        width: 40, height: 40, borderRadius: 12,
        background: CATEGORIA_TINT[gasto.categoria] ?? 'var(--color-icon-bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 17, flexShrink: 0,
      }}>
        {CATEGORIA_EMOJI[gasto.categoria] ?? '📦'}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          margin: 0, fontSize: 13.5, fontWeight: 700, color: 'var(--color-text-primary)',
          fontFamily: 'var(--font-dm-sans), sans-serif',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {gasto.descripcion}
        </p>
        <p style={{ margin: '1px 0 0', fontSize: 11.5, color: 'var(--color-text-muted)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
          {yoPague ? 'Pagaste tú' : `${gasto.pagador?.nombre} pagó`}
        </p>
      </div>

      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <p style={{ margin: 0, fontFamily: 'var(--font-sora), sans-serif', fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)' }}>
          {formatCLP(gasto.monto_total)}
        </p>
        {participo && (
          <p style={{
            margin: '1px 0 0', fontSize: 10.5, fontWeight: 600,
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

// ── Ítem de pago ────────────────────────────────────────────

function PagoItem({
  pago, miId, esUltimo, esMod2, otraNombre,
}: {
  pago: PagoResumen; miId: string; esUltimo: boolean; esMod2: boolean; otraNombre?: string
}) {
  const meLoPagaron = pago.a?.id === miId
  const yoPague = pago.de?.id === miId

  const titulo = esMod2
    ? (meLoPagaron ? `${otraNombre} te pagó` : `Le pagaste a ${otraNombre}`)
    : meLoPagaron
    ? `${pago.de?.nombre} te pagó`
    : yoPague
    ? `Le pagaste a ${pago.a?.nombre}`
    : `${pago.de?.nombre} le pagó a ${pago.a?.nombre}`

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, width: '100%',
      padding: '13px 0',
      borderBottom: esUltimo ? 'none' : '1px solid var(--color-divider)',
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 12, background: 'var(--color-positive-tint)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
          <path d="M4 12l5 5 11-11" stroke="var(--color-positive)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          margin: 0, fontSize: 13.5, fontWeight: 700, color: 'var(--color-text-primary)',
          fontFamily: 'var(--font-dm-sans), sans-serif',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {titulo}
        </p>
        <p style={{ margin: '1px 0 0', fontSize: 11.5, color: 'var(--color-text-muted)', fontFamily: 'var(--font-dm-sans), sans-serif', textTransform: 'capitalize' }}>
          {pago.metodo} · {formatearFechaCorta(pago.fecha)}
        </p>
      </div>

      <span style={{
        fontFamily: 'var(--font-sora), sans-serif', fontSize: 14, fontWeight: 700,
        color: meLoPagaron ? 'var(--color-positive)' : 'var(--color-text-primary)',
      }}>
        {meLoPagaron ? '+' : ''}{formatCLP(pago.monto)}
      </span>
    </div>
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
        border: activo ? 'none' : '1px solid var(--color-border)',
        background: activo ? 'var(--color-cta)' : 'var(--color-surface-white)',
        color: activo ? 'white' : 'var(--color-text-secondary)',
        fontSize: 12.5, fontWeight: activo ? 600 : 500,
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
  const [tipoFiltro, setTipoFiltro] = useState<'todo' | 'gastos' | 'pagos'>('todo')

  // Datos
  const [gastos, setGastos] = useState<GastoResumen[]>([])
  const [pagos, setPagos] = useState<PagoResumen[]>([])
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
  const cargarDatos = useCallback(async (reset = true) => {
    if (!sesion) return
    if (reset) setCargando(true)
    else setCargandoMas(true)

    if (esModo2 && personaId) {
      const [gastosData, pagosData] = await Promise.all([
        obtenerGastosEntreDos(sesion.grupo_id, sesion.integrante_id, personaId),
        obtenerPagosEntreDos(sesion.grupo_id, sesion.integrante_id, personaId),
      ])
      setGastos(gastosData)
      setPagos(pagosData)
      setHayMas(false)
      // Calcular saldo neto entre los dos (gastos + pagos)
      let neto = 0
      for (const g of gastosData) {
        const yoPague = g.pagador?.id === sesion.integrante_id
        const miDiv = g.mi_division
        const suDiv = g.divisiones.find(d => d.integrante?.id === personaId)?.monto_asignado ?? 0
        if (yoPague) neto += suDiv       // otro me debe su parte
        else neto -= miDiv               // yo le debo mi parte
      }
      for (const p of pagosData) {
        if (p.a?.id === sesion.integrante_id) neto -= p.monto  // me pagaron → baja lo que me deben
        else if (p.de?.id === sesion.integrante_id) neto += p.monto // yo pagué → baja lo que debo
      }
      setSaldoNeto(Math.round(neto))
    } else {
      const cursorG = reset ? undefined : gastos[gastos.length - 1]?.creado_en
      const cursorP = reset ? undefined : pagos[pagos.length - 1]?.creado_en

      const [gastosRes, pagosRes] = await Promise.all([
        tipoFiltro !== 'pagos'
          ? obtenerGastos({
              grupoId: sesion.grupo_id, miId: sesion.integrante_id,
              mes: mesFiltro || undefined, categoria: categoriaFiltro || undefined,
              personaId: personaFiltro || undefined, cursor: cursorG,
            })
          : Promise.resolve({ gastos: [] as GastoResumen[], hayMas: false }),
        tipoFiltro !== 'gastos'
          ? obtenerPagos({
              grupoId: sesion.grupo_id, mes: mesFiltro || undefined,
              personaId: personaFiltro || undefined, cursor: cursorP,
            })
          : Promise.resolve({ pagos: [] as PagoResumen[], hayMas: false }),
      ])

      setGastos(prev => reset ? gastosRes.gastos : [...prev, ...gastosRes.gastos])
      setPagos(prev => reset ? pagosRes.pagos : [...prev, ...pagosRes.pagos])
      setHayMas(gastosRes.hayMas || pagosRes.hayMas)
    }

    if (reset) setCargando(false)
    else setCargandoMas(false)
  }, [sesion, esModo2, personaId, mesFiltro, categoriaFiltro, personaFiltro, tipoFiltro, gastos, pagos])

  useEffect(() => {
    if (!sesionLoading && !sesion) { router.replace('/login'); return }
    if (sesion) cargarDatos(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sesion, sesionLoading, mesFiltro, categoriaFiltro, personaFiltro, tipoFiltro, personaId])

  const items = useMemo(() => {
    type Item = { tipo: 'gasto'; fecha: string; creadoEn: string; gasto: GastoResumen } | { tipo: 'pago'; fecha: string; creadoEn: string; pago: PagoResumen }
    const g: Item[] = tipoFiltro !== 'pagos' ? gastos.map(d => ({ tipo: 'gasto' as const, fecha: d.fecha, creadoEn: d.creado_en, gasto: d })) : []
    const p: Item[] = tipoFiltro !== 'gastos' ? pagos.map(d => ({ tipo: 'pago' as const, fecha: d.fecha, creadoEn: d.creado_en, pago: d })) : []
    return [...g, ...p].sort((a, b) => {
      if (a.fecha !== b.fecha) return b.fecha.localeCompare(a.fecha)
      return b.creadoEn.localeCompare(a.creadoEn)
    })
  }, [gastos, pagos, tipoFiltro])

  function handleEliminado() {
    cargarDatos(true)
  }

  if (sesionLoading || !sesion) return null

  // ── RENDER ─────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', paddingBottom: 96 }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>

      {/* Header */}
      <header style={{ padding: '56px var(--page-px) 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
        {esModo2 && (
          <button
            onClick={() => router.back()}
            aria-label="Volver"
            style={{
              background: 'var(--color-surface-white)', border: '1px solid var(--color-border)',
              borderRadius: 13, width: 42, height: 42, padding: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M11 4l-5 5 5 5" stroke="var(--color-text-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          {esModo2 && (
            <p style={{
              margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-dm-sans), sans-serif',
              textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>
              Gastos compartidos
            </p>
          )}
          <h1 style={{
            margin: esModo2 ? '2px 0 0' : 0, fontSize: esModo2 ? 24 : 23, fontWeight: 700,
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-sora), sans-serif', letterSpacing: '-0.01em',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {esModo2 ? `Tú y ${otraPersona?.nombre ?? '…'}` : 'Historial'}
          </h1>
        </div>

        {esModo2 && otraPersona && (
          <Avatar nombre={otraPersona.nombre} color={otraPersona.avatar_color} size={40} />
        )}
      </header>

      <main style={{ padding: '0 var(--page-px)' }}>

        {/* ── MODO 2: saldo neto destacado ── */}
        {esModo2 && !cargando && (
          <div style={{
            background: 'var(--color-card)', border: '1px solid var(--color-border)',
            borderRadius: 18, padding: '18px 20px', marginBottom: 16,
            textAlign: 'center',
          }}>
            <p style={{
              margin: 0, fontSize: 11, fontWeight: 700,
              color: 'var(--color-text-muted)',
              fontFamily: 'var(--font-dm-sans), sans-serif',
              textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>
              Saldo actual entre ustedes
            </p>
            <p style={{
              margin: '6px 0 0', fontSize: 26, fontWeight: 800,
              fontFamily: 'var(--font-sora), sans-serif', letterSpacing: '-0.02em',
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
          <div style={{ marginBottom: 18 }}>
            {/* Filtro por tipo */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <Chip activo={tipoFiltro === 'todo'} onClick={() => setTipoFiltro('todo')}>Todo</Chip>
              <Chip activo={tipoFiltro === 'gastos'} onClick={() => setTipoFiltro('gastos')}>Gastos</Chip>
              <Chip activo={tipoFiltro === 'pagos'} onClick={() => setTipoFiltro('pagos')}>Pagos</Chip>
            </div>

            {/* Filtro por mes */}
            {meses.length > 0 && (
              <div className="scroll-x-hidden" style={{ display: 'flex', gap: 8, paddingBottom: 8, marginBottom: 4 }}>
                <Chip activo={!mesFiltro} onClick={() => setMesFiltro('')}>Todos</Chip>
                {meses.slice(0, 6).map(m => (
                  <Chip key={m} activo={mesFiltro === m} onClick={() => setMesFiltro(mesFiltro === m ? '' : m)}>
                    {formatearMes(m)}
                  </Chip>
                ))}
              </div>
            )}

            {/* Filtro por categoría (no aplica a pagos) */}
            {tipoFiltro !== 'pagos' && (
              <div className="scroll-x-hidden" style={{ display: 'flex', gap: 8, paddingBottom: 8, marginBottom: 4 }}>
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
            )}

            {/* Filtro por persona */}
            {integrantes.length > 0 && (
              <div className="scroll-x-hidden" style={{ display: 'flex', gap: 8, paddingBottom: 4 }}>
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

        {/* ── Lista mezclada de gastos y pagos ── */}
        {cargando ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Array.from({ length: 5 }).map((_, i) => <SkeletonItem key={i} />)}
          </div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 20px' }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>
              {esModo2 ? '🤝' : (mesFiltro || categoriaFiltro || personaFiltro) ? '🔍' : '🧾'}
            </div>
            <p style={{
              margin: 0, fontSize: 16, fontWeight: 700,
              color: 'var(--color-text-primary)',
              fontFamily: 'var(--font-sora), sans-serif',
            }}>
              {esModo2
                ? 'Sin actividad compartida'
                : (mesFiltro || categoriaFiltro || personaFiltro)
                ? 'Sin movimientos para este período'
                : 'Todavía no hay movimientos'}
            </p>
            <p style={{
              margin: '8px 0 0', fontSize: 13,
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-dm-sans), sans-serif',
              lineHeight: 1.5,
            }}>
              {esModo2
                ? 'Aún no tienen gastos ni pagos activos juntas'
                : (mesFiltro || categoriaFiltro || personaFiltro)
                ? 'Probá cambiando o quitando los filtros'
                : 'Usa el botón + para agregar el primer gasto del grupo'}
            </p>
          </div>
        ) : (
          <div style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 18, padding: '4px 16px' }}>
            {items.map((item, i) => item.tipo === 'gasto' ? (
              <GastoItem
                key={`g-${item.gasto.id}`}
                gasto={item.gasto}
                miId={sesion.integrante_id}
                esUltimo={i === items.length - 1}
                onClick={() => setGastoDetalle(item.gasto)}
              />
            ) : (
              <PagoItem
                key={`p-${item.pago.id}`}
                pago={item.pago}
                miId={sesion.integrante_id}
                esUltimo={i === items.length - 1}
                esMod2={esModo2}
                otraNombre={otraPersona?.nombre}
              />
            ))}
          </div>
        )}

        {/* Cargar más */}
        {hayMas && !cargando && (
          <button
            onClick={() => cargarDatos(false)}
            disabled={cargandoMas}
            style={{
              width: '100%', marginTop: 12, height: 46,
              borderRadius: 100, border: '1px solid var(--color-border)',
              background: 'var(--color-surface-white)',
              color: 'var(--color-text-secondary)',
              fontSize: 13.5, fontWeight: 600,
              fontFamily: 'var(--font-dm-sans), sans-serif',
              cursor: 'pointer',
            }}
          >
            {cargandoMas ? 'Cargando…' : 'Cargar más'}
          </button>
        )}

        {/* Total visible */}
        {!cargando && items.length > 0 && !esModo2 && (
          <p style={{
            margin: '20px 0 0', textAlign: 'center', fontSize: 12,
            color: 'var(--color-text-disabled)',
            fontFamily: 'var(--font-dm-sans), sans-serif',
          }}>
            {tipoFiltro === 'pagos'
              ? `${pagos.length} pago${pagos.length !== 1 ? 's' : ''} · Total ${formatCLP(pagos.reduce((s, p) => s + p.monto, 0))}`
              : tipoFiltro === 'gastos'
              ? `${gastos.length} gasto${gastos.length !== 1 ? 's' : ''} · Total ${formatCLP(gastos.reduce((s, g) => s + g.monto_total, 0))}`
              : `${items.length} movimiento${items.length !== 1 ? 's' : ''}`}
          </p>
        )}
      </main>

      </div>{/* end max-width wrapper */}

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
