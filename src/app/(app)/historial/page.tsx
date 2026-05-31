'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useSession } from '@/lib/session-store'
import {
  obtenerGastos, obtenerGastosEntreDos, obtenerMesesDisponibles,
  formatearMes, formatearFechaCorta,
  type GastoResumen,
} from '@/lib/historial'
import {
  obtenerPagosEntreDos, obtenerTodosPagos, eliminarPago,
  METODO_LABEL, type PagoAnticipado,
} from '@/lib/pagos'
import { formatCLP } from '@/lib/format'
import { Avatar } from '@/components/app/Avatar'
import { BottomNav } from '@/components/app/BottomNav'
import { GastoDetalle } from '@/components/app/GastoDetalle'
import { Toast } from '@/components/app/Toast'
import { CATEGORIA_EMOJI, CATEGORIA_LABEL, type Categoria } from '@/types/database'
import { supabase } from '@/lib/supabase'
import type { Integrante } from '@/types/database'

// ── Tipo unión para la lista combinada ────────────────────────

type ItemHistorial =
  | { tipo: 'gasto'; data: GastoResumen }
  | { tipo: 'pago';  data: PagoAnticipado }

function itemFecha(item: ItemHistorial): string {
  return item.tipo === 'gasto' ? item.data.fecha : item.data.fecha
}
function itemCreadoEn(item: ItemHistorial): string {
  return item.tipo === 'gasto' ? item.data.creado_en : item.data.creado_en
}

function combinarYOrdenar(gastos: GastoResumen[], pagos: PagoAnticipado[]): ItemHistorial[] {
  const lista: ItemHistorial[] = [
    ...gastos.map(g => ({ tipo: 'gasto' as const, data: g })),
    ...pagos.map(p => ({ tipo: 'pago' as const, data: p })),
  ]
  return lista.sort((a, b) => {
    const fDiff = itemFecha(b).localeCompare(itemFecha(a))
    if (fDiff !== 0) return fDiff
    return itemCreadoEn(b).localeCompare(itemCreadoEn(a))
  })
}

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
  const yoPague  = gasto.pagador?.id === miId
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
      <div style={{
        width: 36, height: 36, borderRadius: 8,
        background: 'var(--color-card-light)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, flexShrink: 0,
      }}>
        {CATEGORIA_EMOJI[gasto.categoria] ?? '📦'}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          margin: 0, fontSize: 14, fontWeight: 600,
          color: 'var(--color-text-primary)',
          fontFamily: 'var(--font-dm-sans), sans-serif',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {gasto.descripcion}
        </p>
        <p style={{
          margin: '3px 0 0', fontSize: 12,
          color: 'var(--color-text-secondary)',
          fontFamily: 'var(--font-dm-sans), sans-serif',
        }}>
          {yoPague ? 'Pagaste tú' : `Pagó ${gasto.pagador?.nombre}`}
          {' · '}{formatearFechaCorta(gasto.fecha)}
        </p>
      </div>

      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <p style={{
          margin: 0, fontSize: 14, fontWeight: 700,
          color: 'var(--color-text-primary)',
          fontFamily: 'var(--font-dm-sans), sans-serif',
        }}>
          {formatCLP(gasto.monto_total)}
        </p>
        {participo && (
          <p style={{
            margin: '2px 0 0', fontSize: 12, fontWeight: 600,
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

// ── Ítem de pago anticipado ───────────────────────────────────

function PagoItem({
  pago,
  miId,
  esAdmin,
  onEliminar,
  esModo2,
}: {
  pago: PagoAnticipado
  miId: string
  esAdmin: boolean
  onEliminar: (id: string) => void
  esModo2: boolean
}) {
  const [confirmando, setConfirmando] = useState(false)
  const puedeEliminar = pago.de_integrante_id === miId || pago.a_integrante_id === miId || esAdmin

  const texto = esModo2
    ? `${pago.de.nombre} pagó ${formatCLP(pago.monto)} · ${METODO_LABEL[pago.metodo]} · ${formatearFechaCorta(pago.fecha)}`
    : `${pago.de.nombre} → ${pago.a.nombre} · ${formatCLP(pago.monto)} · ${METODO_LABEL[pago.metodo]}`

  return (
    <div style={{
      background: '#F0FAF4',
      borderRadius: 18, padding: '13px 16px',
      display: 'flex', alignItems: 'center', gap: 13,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 8,
        background: '#D4F0E0',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, flexShrink: 0,
      }}>
        💸
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          margin: 0, fontSize: 14, fontWeight: 600,
          color: 'var(--color-text-primary)',
          fontFamily: 'var(--font-dm-sans), sans-serif',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {formatCLP(pago.monto)}
        </p>
        <p style={{
          margin: '3px 0 0', fontSize: 12,
          color: 'var(--color-text-secondary)',
          fontFamily: 'var(--font-dm-sans), sans-serif',
        }}>
          {texto}
        </p>
      </div>

      {puedeEliminar && !confirmando && (
        <button
          onClick={() => setConfirmando(true)}
          style={{
            background: 'transparent', border: 'none',
            padding: '6px', borderRadius: 8, cursor: 'pointer',
            color: 'var(--color-text-disabled)',
            display: 'flex', alignItems: 'center',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 4h12M5 4V3a1 1 0 011-1h4a1 1 0 011 1v1M6 7v5M10 7v5M3 4l1 9a1 1 0 001 1h6a1 1 0 001-1l1-9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}

      {confirmando && (
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button
            onClick={() => onEliminar(pago.id)}
            style={{
              height: 32, padding: '0 12px', borderRadius: 8, border: 'none',
              background: 'var(--color-negative)', color: 'white',
              fontSize: 12, fontWeight: 600,
              fontFamily: 'var(--font-dm-sans), sans-serif',
              cursor: 'pointer',
            }}
          >
            Eliminar
          </button>
          <button
            onClick={() => setConfirmando(false)}
            style={{
              height: 32, padding: '0 12px', borderRadius: 8, border: 'none',
              background: 'var(--color-card)',
              color: 'var(--color-text-secondary)',
              fontSize: 12, fontWeight: 600,
              fontFamily: 'var(--font-dm-sans), sans-serif',
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
        </div>
      )}
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

  const [otraPersona, setOtraPersona] = useState<Integrante | null>(null)
  const [integrantes, setIntegrantes] = useState<Integrante[]>([])
  const [meses, setMeses] = useState<string[]>([])

  const [mesFiltro,       setMesFiltro]       = useState<string>('')
  const [categoriaFiltro, setCategoriaFiltro] = useState<Categoria | ''>('')
  const [personaFiltro,   setPersonaFiltro]   = useState<string>('')

  const [items,        setItems]        = useState<ItemHistorial[]>([])
  const [cargando,     setCargando]     = useState(true)
  const [hayMas,       setHayMas]       = useState(false)
  const [cargandoMas,  setCargandoMas]  = useState(false)

  const [gastoDetalle, setGastoDetalle] = useState<GastoResumen | null>(null)
  const [saldoNeto,    setSaldoNeto]    = useState(0)
  const [toast, setToast] = useState<{ mensaje: string; tipo: 'exito' | 'error' } | null>(null)

  const esModo2 = Boolean(personaId)

  // Datos auxiliares
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

  // Integrante del modo 2
  useEffect(() => {
    if (!personaId || !sesion) return
    supabase
      .from('integrantes')
      .select('*')
      .eq('id', personaId)
      .single()
      .then(({ data }) => { if (data) setOtraPersona(data as Integrante) })
  }, [personaId, sesion])

  // Carga principal
  const cargarItems = useCallback(async (reset = true) => {
    if (!sesion) return
    if (reset) setCargando(true)
    else setCargandoMas(true)

    if (esModo2 && personaId) {
      const [gastos, pagos] = await Promise.all([
        obtenerGastosEntreDos(sesion.grupo_id, sesion.integrante_id, personaId),
        obtenerPagosEntreDos(sesion.grupo_id, sesion.integrante_id, personaId),
      ])

      // Saldo neto: gastos − pagos
      let neto = 0
      for (const g of gastos) {
        const yoPague = g.pagador?.id === sesion.integrante_id
        const suDiv   = g.divisiones.find(d => d.integrante?.id === personaId)?.monto_asignado ?? 0
        if (yoPague) neto += suDiv
        else         neto -= g.mi_division
      }
      // Descontar pagos anticipados
      for (const p of pagos) {
        if (p.de_integrante_id === sesion.integrante_id) neto += p.monto  // yo pagué → mi deuda se reduce
        else                                              neto -= p.monto  // otro me pagó → su deuda se reduce
      }
      setSaldoNeto(Math.round(neto))
      setItems(combinarYOrdenar(gastos, pagos))
      setHayMas(false)

    } else {
      const rawGastos = reset ? [] : items.filter(i => i.tipo === 'gasto').map(i => i.data as GastoResumen)
      const cursor    = reset ? undefined : rawGastos[rawGastos.length - 1]?.creado_en
      const [{ gastos: nuevos, hayMas: mas }, pagos] = await Promise.all([
        obtenerGastos({
          grupoId:   sesion.grupo_id,
          miId:      sesion.integrante_id,
          mes:       mesFiltro || undefined,
          categoria: categoriaFiltro || undefined,
          personaId: personaFiltro || undefined,
          cursor,
        }),
        reset ? obtenerTodosPagos(sesion.grupo_id) : Promise.resolve([]),
      ])

      setHayMas(mas)

      if (reset) {
        setItems(combinarYOrdenar(nuevos, pagos))
      } else {
        setItems(prev => {
          const prevPagos = prev.filter(i => i.tipo === 'pago').map(i => i.data as PagoAnticipado)
          const prevGastos = prev.filter(i => i.tipo === 'gasto').map(i => i.data as GastoResumen)
          return combinarYOrdenar([...prevGastos, ...nuevos], prevPagos)
        })
      }
    }

    if (reset) setCargando(false)
    else setCargandoMas(false)
  }, [sesion, esModo2, personaId, mesFiltro, categoriaFiltro, personaFiltro]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!sesionLoading && !sesion) { router.replace('/login'); return }
    if (sesion) cargarItems(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sesion, sesionLoading, mesFiltro, categoriaFiltro, personaFiltro, personaId])

  async function handleEliminarPago(pagoId: string) {
    const result = await eliminarPago(pagoId)
    if (!result.ok) {
      setToast({ mensaje: result.error, tipo: 'error' })
      return
    }
    setToast({ mensaje: 'Pago eliminado', tipo: 'exito' })
    cargarItems(true)
  }

  if (sesionLoading || !sesion) return null

  const gastosCount = items.filter(i => i.tipo === 'gasto').length
  const totalGastos = items.filter(i => i.tipo === 'gasto').reduce((s, i) => s + (i.data as GastoResumen).monto_total, 0)

  // ── RENDER ─────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', paddingBottom: 80 }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>

      {/* Header */}
      <header style={{ padding: '56px var(--page-px) 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
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

      <main style={{ padding: '0 var(--page-px)' }}>

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
            {meses.length > 0 && (
              <div style={{
                display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8,
                scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' as const, marginBottom: 8,
              }}>
                <Chip activo={!mesFiltro} onClick={() => setMesFiltro('')}>Todos</Chip>
                {meses.slice(0, 6).map(m => (
                  <Chip key={m} activo={mesFiltro === m} onClick={() => setMesFiltro(mesFiltro === m ? '' : m)}>
                    {formatearMes(m)}
                  </Chip>
                ))}
              </div>
            )}

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

            {integrantes.length > 0 && (
              <div style={{
                display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4,
                scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' as const,
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

        {/* ── Lista combinada ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {cargando
            ? Array.from({ length: 5 }).map((_, i) => <SkeletonItem key={i} />)
            : items.length === 0
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
                    ? 'Sin movimientos entre ustedes'
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
                    ? 'Aún no tienen gastos ni pagos activos juntas'
                    : (mesFiltro || categoriaFiltro || personaFiltro)
                    ? 'Probá cambiando o quitando los filtros'
                    : 'Usa el botón + para agregar el primer gasto del grupo'}
                </p>
              </div>
            )
            : items.map(item =>
                item.tipo === 'gasto' ? (
                  <GastoItem
                    key={`g-${item.data.id}`}
                    gasto={item.data}
                    miId={sesion.integrante_id}
                    onClick={() => setGastoDetalle(item.data)}
                  />
                ) : (
                  <PagoItem
                    key={`p-${item.data.id}`}
                    pago={item.data}
                    miId={sesion.integrante_id}
                    esAdmin={sesion.es_admin}
                    onEliminar={handleEliminarPago}
                    esModo2={esModo2}
                  />
                )
              )
          }
        </div>

        {/* Cargar más */}
        {hayMas && !cargando && (
          <button
            onClick={() => cargarItems(false)}
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
        {!cargando && items.length > 0 && !esModo2 && (
          <p style={{
            margin: '20px 0 0', textAlign: 'center', fontSize: 12,
            color: 'var(--color-text-disabled)',
            fontFamily: 'var(--font-dm-sans), sans-serif',
          }}>
            {gastosCount} gasto{gastosCount !== 1 ? 's' : ''} ·{' '}
            Total {formatCLP(totalGastos)}
          </p>
        )}
      </main>

      {/* ── FAB nuevo gasto ── */}
      {!esModo2 && (
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
      )}

      {/* ── Botón "Registrar pago" fijo en modo 2 ── */}
      {esModo2 && !cargando && saldoNeto !== 0 && personaId && (
        <div style={{
          position: 'fixed', bottom: 72, left: 0, right: 0,
          padding: '0 16px',
          zIndex: 50,
          maxWidth: 640, margin: '0 auto',
          pointerEvents: 'none',
        }}>
          <Link
            href={`/gastos/pago?otro=${personaId}&saldo=${saldoNeto}`}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              height: 52, borderRadius: 100,
              background: 'var(--color-cta)',
              color: 'white',
              fontSize: 15, fontWeight: 700,
              fontFamily: 'var(--font-dm-sans), sans-serif',
              textDecoration: 'none',
              boxShadow: '0 4px 20px rgba(0, 200, 81, 0.4)',
              transition: 'transform 120ms ease',
              pointerEvents: 'auto',
            }}
            onPointerDown={e => (e.currentTarget.style.transform = 'scale(0.97)')}
            onPointerUp={e => (e.currentTarget.style.transform = 'scale(1)')}
            onPointerLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
          >
            💸 Registrar pago
          </Link>
        </div>
      )}

      </div>{/* end max-width wrapper */}

      <BottomNav />

      {gastoDetalle && (
        <GastoDetalle
          gasto={gastoDetalle}
          miId={sesion.integrante_id}
          onClose={() => setGastoDetalle(null)}
          onEliminado={() => cargarItems(true)}
        />
      )}

      {toast && (
        <Toast mensaje={toast.mensaje} tipo={toast.tipo} onClose={() => setToast(null)} />
      )}
    </div>
  )
}
