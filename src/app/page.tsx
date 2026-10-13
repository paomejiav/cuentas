'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { obtenerSeleccion, seleccionarGrupo, type Seleccion } from '@/lib/grupo-activo'
import { listarGruposConIntegrantes, type GrupoParaSheet } from '@/lib/grupo'
import {
  calcularSaldosGrupo, calcularSaldosPersonal, obtenerResumenGastosGrupo,
  obtenerGastoMesGrupo, obtenerGastoMesPersonal, obtenerGastoMesPorCuenta,
  limitesMesActualSantiago, nombreMesDeFecha, type SaldoIntegrante, type ResumenGastosGrupo, type GastoMesPorCuenta,
} from '@/lib/cuentas'
import { formatCLP, formatCLPConSigno, formatearTiempoRelativo, capitalizar } from '@/lib/format'
import { Avatar } from '@/components/app/Avatar'
import { AvatarGrupo } from '@/components/app/AvatarGrupo'
import { ChipGrupo } from '@/components/app/ChipGrupo'
import { SelectorGrupoSheet } from '@/components/app/SelectorGrupoSheet'
import { colorDeGrupo } from '@/lib/colores-grupo'
import { BottomNav } from '@/components/app/BottomNav'
import { FlujoCrearUnirseGrupo } from '@/components/app/FlujoCrearUnirseGrupo'

const F_HEAD = 'var(--font-sora), sans-serif'
const F_BODY = 'var(--font-dm-sans), sans-serif'

type Fase = 'cargando' | 'vacio' | 'todos' | 'grupo'

const OCULTAR_PRIMEROS_PASOS_KEY = 'bts_primeros_pasos_oculto'

function leerPrimerosPasosOculto(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(OCULTAR_PRIMEROS_PASOS_KEY) === '1'
  } catch {
    return false
  }
}

function guardarPrimerosPasosOculto(): void {
  try {
    window.localStorage.setItem(OCULTAR_PRIMEROS_PASOS_KEY, '1')
  } catch {
    // sin storage disponible: no persiste, pero no rompe nada
  }
}

type DestinoPaso = 'gasto' | 'cuentas' | 'cierre' | 'grupo-home'

interface Paso {
  id: DestinoPaso
  titulo: string
  texto: string
  icono: React.ReactNode
}

const PASOS: Paso[] = [
  {
    id: 'gasto',
    titulo: 'Registrar un gasto',
    texto: 'Toca + y elige quién pagó y cómo se divide.',
    icono: <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="var(--color-cta-dark)" strokeWidth="2.2" strokeLinecap="round" /></svg>,
  },
  {
    id: 'cuentas',
    titulo: 'Cuentas del grupo',
    texto: 'Separa los gastos del hogar, de un viaje o de un evento.',
    icono: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M6 3h9l3 3v15a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="var(--color-cta-dark)" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M8.5 9h7M8.5 13h7M8.5 17h4" stroke="var(--color-cta-dark)" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'cierre',
    titulo: 'Cierre mensual',
    texto: 'Cierra el mes y salda las deudas.',
    icono: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke="var(--color-cta-dark)" strokeWidth="1.6" />
        <path d="M8 12l3 3 5-5" stroke="var(--color-cta-dark)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'grupo-home',
    titulo: 'Saldar directo',
    texto: 'Registra un pago entre dos personas.',
    icono: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M7 7h10M17 7l-3-3M17 7l-3 3" stroke="var(--color-cta-dark)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M17 17H7M7 17l3-3M7 17l3 3" stroke="var(--color-cta-dark)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
]

interface GrupoResumenInicio {
  id: string
  nombre: string
  integrantes: number
  neto: number
  teDeben: number
  debes: number
  gastoMes: number
}

interface PersonalResumen {
  neto: number
  teDeben: number
  debes: number
  gastoMes: number
}

function sumarPositivos(saldos: SaldoIntegrante[]): number {
  return saldos.filter(s => s.neto > 0).reduce((s, x) => s + x.neto, 0)
}
function sumarNegativos(saldos: SaldoIntegrante[]): number {
  return saldos.filter(s => s.neto < 0).reduce((s, x) => s + Math.abs(x.neto), 0)
}

// ── Piezas visuales reutilizadas del sistema Walto ──────────────

function BotonPrimario({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        height: 54, width: '100%', borderRadius: 15, border: 'none',
        background: 'var(--gradient-cta)', boxShadow: 'var(--shadow-cta)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        fontFamily: F_BODY, fontSize: 15.5, fontWeight: 700, color: '#fff', cursor: 'pointer',
      }}
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
        fontFamily: F_BODY, fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)', cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
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

function FilaAccion({ href, icono, titulo, subtitulo, onClick }: {
  href?: string; icono: React.ReactNode; titulo: string; subtitulo: string; onClick?: () => void
}) {
  const contenido = (
    <>
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
    </>
  )
  const estilo: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 13, padding: '13px 0', width: '100%', textDecoration: 'none', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer' }
  if (href) return <Link href={href} style={estilo}>{contenido}</Link>
  return <button type="button" onClick={onClick} style={estilo}>{contenido}</button>
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

function ToggleGrafico({ tab, setTab }: { tab: 'saldo' | 'gasto'; setTab: (t: 'saldo' | 'gasto') => void }) {
  const opciones: { id: 'saldo' | 'gasto'; label: string }[] = [
    { id: 'saldo', label: 'Saldo por grupo' },
    { id: 'gasto', label: 'Gasto del mes' },
  ]
  return (
    <div style={{ display: 'flex', gap: 4, background: 'var(--color-card-light)', borderRadius: 14, padding: 4 }}>
      {opciones.map(op => {
        const activo = tab === op.id
        return (
          <button
            key={op.id}
            type="button"
            onClick={() => setTab(op.id)}
            style={{
              flex: 1, height: 40, borderRadius: 11, border: 'none', cursor: 'pointer',
              background: activo ? 'var(--color-surface-white)' : 'transparent',
              boxShadow: activo ? '0 3px 9px -3px rgba(24,34,26,.18)' : 'none',
              fontSize: 13, fontWeight: 700, fontFamily: F_BODY,
              color: activo ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
              transition: 'all 150ms ease',
            }}
          >
            {op.label}
          </button>
        )
      })}
    </div>
  )
}

function FilaSaldoGrafico({ id, nombre, valor, max, esPersonal }: { id: string; nombre: string; valor: number; max: number; esPersonal?: boolean }) {
  const { bg, texto } = esPersonal ? { bg: 'var(--color-icon-bg)', texto: 'var(--color-text-secondary)' } : colorDeGrupo(id)
  const ancho = Math.min(100, (Math.abs(valor) / max) * 100)
  const color = valor > 0 ? 'var(--color-positive)' : valor < 0 ? 'var(--color-negative)' : 'var(--color-text-muted)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 0' }}>
      {esPersonal ? (
        <span style={{ width: 30, height: 30, borderRadius: 10, background: bg, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="3.4" stroke={texto} strokeWidth="1.7" /><path d="M6 19.5c.5-3 3-4.8 6-4.8s5.5 1.8 6 4.8" stroke={texto} strokeWidth="1.7" strokeLinecap="round" /></svg>
        </span>
      ) : (
        <AvatarGrupo grupoId={id} nombre={nombre} size={30} />
      )}
      <div style={{ width: 72, flexShrink: 0, fontSize: 12.5, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: F_BODY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {nombre}
      </div>
      <div style={{ flex: 1, height: 8, borderRadius: 5, background: 'var(--color-track)', position: 'relative', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', top: 0, bottom: 0, background: color, borderRadius: 5,
          width: `${ancho / 2}%`,
          left: valor >= 0 ? '50%' : `${50 - ancho / 2}%`,
        }} />
        <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'var(--color-border)' }} />
      </div>
      <div style={{ width: 78, flexShrink: 0, textAlign: 'right', fontFamily: F_HEAD, fontSize: 12.5, fontWeight: 700, color }}>
        {formatCLPConSigno(valor)}
      </div>
    </div>
  )
}

function FilaGastoGrafico({ id, nombre, valor, max, total, esPersonal }: { id: string; nombre: string; valor: number; max: number; total: number; esPersonal?: boolean }) {
  const { bg, texto } = esPersonal ? { bg: 'var(--color-icon-bg)', texto: 'var(--color-text-secondary)' } : colorDeGrupo(id)
  const ancho = Math.min(100, (valor / max) * 100)
  const pct = total > 0 ? Math.round((valor / total) * 100) : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 0' }}>
      {esPersonal ? (
        <span style={{ width: 30, height: 30, borderRadius: 10, background: bg, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="3.4" stroke={texto} strokeWidth="1.7" /><path d="M6 19.5c.5-3 3-4.8 6-4.8s5.5 1.8 6 4.8" stroke={texto} strokeWidth="1.7" strokeLinecap="round" /></svg>
        </span>
      ) : (
        <AvatarGrupo grupoId={id} nombre={nombre} size={30} />
      )}
      <div style={{ width: 72, flexShrink: 0, fontSize: 12.5, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: F_BODY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {nombre}
      </div>
      <div style={{ flex: 1, height: 8, borderRadius: 5, background: 'var(--color-track)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${ancho}%`, background: 'var(--color-cta)', borderRadius: 5 }} />
      </div>
      <div style={{ width: 78, flexShrink: 0, textAlign: 'right' }}>
        <div style={{ fontFamily: F_HEAD, fontSize: 12.5, fontWeight: 700, color: 'var(--color-text-primary)' }}>{formatCLP(valor)}</div>
        <div style={{ fontSize: 10.5, color: 'var(--color-text-muted)', fontFamily: F_BODY }}>{pct}%</div>
      </div>
    </div>
  )
}

function VerTodo({ total, abierto, onToggle }: { total: number; abierto: boolean; onToggle: () => void }) {
  if (total <= 3) return null
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{ marginTop: 6, background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0', fontSize: 12.5, fontWeight: 600, color: 'var(--color-cta)', fontFamily: F_BODY }}
    >
      {abierto ? 'Ver menos' : `Ver todo · ${total - 3} más`}
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

  const [fase, setFase] = useState<Fase>('cargando')
  const [nombreUsuario, setNombreUsuario] = useState('')
  const [seleccion, setSeleccion] = useState<Seleccion>({ tipo: 'todos' })
  const [grupos, setGrupos] = useState<GrupoParaSheet[]>([])

  // Un solo cálculo del mes actual (America/Santiago) para toda la
  // pantalla — el título "Gasto de {mes}" se arma a partir del mismo
  // `desdeMes` que usan las consultas, así que nunca pueden desalinearse.
  const { desde: desdeMes, hasta: hastaMes } = useMemo(() => limitesMesActualSantiago(), [])
  const mesLabel = useMemo(() => capitalizar(nombreMesDeFecha(desdeMes)), [desdeMes])

  const [flujoAbierto, setFlujoAbierto] = useState<'crear' | 'unirse' | null>(null)
  const [sheetModo, setSheetModo] = useState<{ tipo: 'chip' } | { tipo: 'accion'; destino: DestinoPaso } | null>(null)
  const [primerosPasosAbierto, setPrimerosPasosAbierto] = useState(false)
  const [primerosPasosOculto, setPrimerosPasosOculto] = useState(false)

  // ── Datos de la vista "Todos los grupos" ──
  const [cargandoTodos, setCargandoTodos] = useState(true)
  const [porGrupo, setPorGrupo] = useState<GrupoResumenInicio[]>([])
  const [personal, setPersonal] = useState<PersonalResumen>({ neto: 0, teDeben: 0, debes: 0, gastoMes: 0 })
  const [hayPersonal, setHayPersonal] = useState(false)
  const [graficoTab, setGraficoTab] = useState<'saldo' | 'gasto'>('saldo')
  const [verTodoSaldo, setVerTodoSaldo] = useState(false)
  const [verTodoGasto, setVerTodoGasto] = useState(false)

  // ── Datos de la vista "Un grupo elegido" ──
  const [cargandoGrupo, setCargandoGrupo] = useState(true)
  const [grupoActivo, setGrupoActivo] = useState<{ id: string; nombre: string } | null>(null)
  const [resumenGrupo, setResumenGrupo] = useState<ResumenGastosGrupo>({ saldoTotal: 0, ultimaActividad: null })
  const [saldosPersonas, setSaldosPersonas] = useState<SaldoIntegrante[]>([])
  const [gastoPorCuenta, setGastoPorCuenta] = useState<GastoMesPorCuenta[]>([])
  const [verTodoPersonas, setVerTodoPersonas] = useState(false)

  useEffect(() => {
    setPrimerosPasosOculto(leerPrimerosPasosOculto())
  }, [])

  useEffect(() => {
    let activo = true
    async function cargar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }

      const [{ data: usuario }, { seleccion: sel, grupos: listaGrupos }] = await Promise.all([
        supabase.from('usuarios').select('nombre').eq('id', user.id).single(),
        obtenerSeleccion(user.id, params.get('grupo')),
      ])
      if (!activo) return
      setNombreUsuario(usuario?.nombre ?? '')
      setSeleccion(sel)

      if (listaGrupos.length === 0) {
        setFase('vacio')
        return
      }

      const conIntegrantes = await listarGruposConIntegrantes(user.id)
      if (!activo) return
      setGrupos(conIntegrantes)

      setFase(sel.tipo === 'todos' ? 'todos' : 'grupo')

      if (sel.tipo === 'todos') {
        setCargandoTodos(true)
        const [resultadosPorGrupo, saldosPersonal, gastoMesPersonal] = await Promise.all([
          Promise.all(listaGrupos.map(async g => {
            const [saldos, gastoMes] = await Promise.all([
              calcularSaldosGrupo(g.id, user.id),
              obtenerGastoMesGrupo(g.id, desdeMes, hastaMes),
            ])
            const teDeben = sumarPositivos(saldos)
            const debes = sumarNegativos(saldos)
            return {
              id: g.id, nombre: g.nombre, integrantes: saldos.length + 1,
              neto: teDeben - debes, teDeben, debes, gastoMes,
            } satisfies GrupoResumenInicio
          })),
          calcularSaldosPersonal(user.id),
          obtenerGastoMesPersonal(user.id, desdeMes, hastaMes),
        ])
        if (!activo) return

        const personalTeDeben = sumarPositivos(saldosPersonal)
        const personalDebes = sumarNegativos(saldosPersonal)
        setPorGrupo(resultadosPorGrupo)
        setPersonal({ neto: personalTeDeben - personalDebes, teDeben: personalTeDeben, debes: personalDebes, gastoMes: gastoMesPersonal })
        setHayPersonal(saldosPersonal.length > 0)
        setCargandoTodos(false)
      } else {
        const grupoId = sel.grupoId
        const grupoMeta = listaGrupos.find(g => g.id === grupoId) ?? conIntegrantes.find(g => g.id === grupoId) ?? null
        setCargandoGrupo(true)
        const [{ data: grupoRow }, resumen, saldos, porCuenta] = await Promise.all([
          supabase.from('grupos').select('nombre').eq('id', grupoId).single(),
          obtenerResumenGastosGrupo(grupoId),
          calcularSaldosGrupo(grupoId, user.id),
          obtenerGastoMesPorCuenta(grupoId, desdeMes, hastaMes),
        ])
        if (!activo) return
        setGrupoActivo({ id: grupoId, nombre: grupoRow?.nombre ?? grupoMeta?.nombre ?? '' })
        setResumenGrupo(resumen)
        setSaldosPersonas(saldos)
        setGastoPorCuenta(porCuenta.filter(c => c.monto > 0))
        setCargandoGrupo(false)
      }
    }
    cargar()
    return () => { activo = false }
  }, [router, params])

  const filasSaldo = useMemo(() => {
    const filas = porGrupo.map(g => ({ id: g.id, nombre: g.nombre, valor: g.neto, esPersonal: false }))
    filas.push({ id: 'personal', nombre: 'Personal', valor: personal.neto, esPersonal: true })
    return filas.sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor))
  }, [porGrupo, personal])

  const filasGasto = useMemo(() => {
    const filas = porGrupo.filter(g => g.gastoMes > 0).map(g => ({ id: g.id, nombre: g.nombre, valor: g.gastoMes, esPersonal: false }))
    if (personal.gastoMes > 0) filas.push({ id: 'personal', nombre: 'Personal', valor: personal.gastoMes, esPersonal: true })
    return filas.sort((a, b) => b.valor - a.valor)
  }, [porGrupo, personal])

  const maxAbsSaldo = Math.max(1, ...filasSaldo.map(f => Math.abs(f.valor)))
  const maxGasto = Math.max(1, ...filasGasto.map(f => f.valor))
  const totalGastoMes = filasGasto.reduce((s, f) => s + f.valor, 0)

  const teDebenTotal = porGrupo.reduce((s, g) => s + g.teDeben, 0) + personal.teDeben
  const debesTotal = porGrupo.reduce((s, g) => s + g.debes, 0) + personal.debes
  const saldoTotal = teDebenTotal - debesTotal

  const gruposOrdenGrafico = useMemo(
    () => filasSaldo.filter(f => !f.esPersonal).map(f => porGrupo.find(g => g.id === f.id)!).filter(Boolean),
    [filasSaldo, porGrupo]
  )

  function handleOcultarPrimerosPasos() {
    guardarPrimerosPasosOculto()
    setPrimerosPasosOculto(true)
  }

  function irAGrupo(id: string) {
    seleccionarGrupo(id, { refresh: () => {} })
    router.push(`/?grupo=${id}`)
  }

  function handleListoFlujo(grupo: { id: string; nombre: string }) {
    irAGrupo(grupo.id)
  }

  function handleElegirDesdeSheet(idOTodos: string) {
    seleccionarGrupo(idOTodos, { refresh: () => {} })
    if (sheetModo?.tipo === 'accion') {
      const destino = sheetModo.destino
      setSheetModo(null)
      if (destino === 'cuentas') { router.push(`/cuentas?grupo=${idOTodos}`); return }
      if (destino === 'cierre') { router.push(`/cierre?grupo=${idOTodos}`); return }
      router.push(`/?grupo=${idOTodos}`)
      return
    }
    setSheetModo(null)
    router.push(`/?grupo=${idOTodos}`)
  }

  function handlePaso(destino: DestinoPaso) {
    if (fase === 'vacio') { setFlujoAbierto('crear'); return }

    if (destino === 'gasto') { router.push('/gastos/nuevo'); return }

    if (grupos.length === 1) {
      const id = grupos[0].id
      if (destino === 'cuentas') { router.push(`/cuentas?grupo=${id}`); return }
      if (destino === 'cierre') { router.push(`/cierre?grupo=${id}`); return }
      irAGrupo(id)
      return
    }

    setSheetModo({ tipo: 'accion', destino })
  }

  if (fase === 'cargando') {
    return (
      <main style={{ minHeight: '100dvh', background: 'var(--color-bg)' }}>
        <div style={{ maxWidth: 440, margin: '0 auto', padding: '0 18px', paddingTop: 'max(20px, env(safe-area-inset-top, 0px))' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 24 }}>
            {[80, 180, 220].map((h, i) => <div key={i} className="skeleton" style={{ height: h, borderRadius: 18 }} />)}
          </div>
        </div>
      </main>
    )
  }

  const grupoParaChip = fase === 'grupo' && grupoActivo ? { id: grupoActivo.id, nombre: grupoActivo.nombre } : null

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--color-bg)', overflowX: 'hidden' }}>
      <div style={{
        maxWidth: 440, margin: '0 auto', padding: '0 18px',
        paddingTop: 'max(20px, env(safe-area-inset-top, 0px))',
        paddingBottom: 96, minHeight: '100dvh', boxSizing: 'border-box',
      }}>

        {/* ─── Header ─── */}
        {fase === 'vacio' ? (
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 12.5, color: 'var(--color-neutral)', fontFamily: F_BODY }}>Hola, {nombreUsuario} 👋</div>
            <div style={{ fontFamily: F_HEAD, fontSize: 24, fontWeight: 800, color: 'var(--color-text-primary)', letterSpacing: '-0.02em', marginTop: 2 }}>
              Empecemos
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <ChipGrupo grupo={grupoParaChip} onClick={() => setSheetModo({ tipo: 'chip' })} />
            {fase === 'grupo' && grupoActivo && (
              <Link
                href={`/grupo?grupo=${grupoActivo.id}`}
                aria-label="Ajustes del grupo"
                style={{
                  width: 42, height: 42, borderRadius: '50%', background: 'var(--color-surface-white)',
                  border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
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
            )}
          </div>
        )}

        {fase !== 'vacio' && (
          <div style={{ fontSize: 12.5, color: 'var(--color-neutral)', fontFamily: F_BODY, marginBottom: fase === 'todos' ? 4 : 14 }}>
            Hola, {nombreUsuario} 👋
          </div>
        )}

        {/* ═══════════ BLOQUE A · Todos los grupos ═══════════ */}
        {fase === 'todos' && (
          cargandoTodos ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 10 }}>
              {[140, 220, 180].map((h, i) => <div key={i} className="skeleton" style={{ height: h, borderRadius: 18 }} />)}
            </div>
          ) : (
            <>
              <Card style={{ marginTop: 6 }}>
                <div style={{ fontSize: 12.5, color: 'var(--color-neutral)', fontFamily: F_BODY }}>Saldo total</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 5 }}>
                  <span style={{ fontFamily: F_HEAD, fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--color-text-primary)' }}>
                    {formatCLP(Math.abs(saldoTotal))}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 3, fontFamily: F_BODY }}>
                  Suma tus {grupos.length} grupo{grupos.length === 1 ? '' : 's'}{hayPersonal ? ' y tus gastos personales' : ''}.
                </div>
                <BarraTeDebenDebes teDeben={teDebenTotal} debes={debesTotal} />
              </Card>

              <Card style={{ marginTop: 14 }}>
                <ToggleGrafico tab={graficoTab} setTab={setGraficoTab} />
                {graficoTab === 'saldo' ? (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {(verTodoSaldo ? filasSaldo : filasSaldo.slice(0, 3)).map(f => (
                        <FilaSaldoGrafico key={f.id} id={f.id} nombre={f.nombre} valor={f.valor} max={maxAbsSaldo} esPersonal={f.esPersonal} />
                      ))}
                    </div>
                    <VerTodo total={filasSaldo.length} abierto={verTodoSaldo} onToggle={() => setVerTodoSaldo(v => !v)} />
                  </>
                ) : (
                  <>
                    <div style={{ margin: '14px 0 2px', fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: F_BODY }}>
                      {mesLabel} · {formatCLP(totalGastoMes)}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', marginTop: 6 }}>
                      {(verTodoGasto ? filasGasto : filasGasto.slice(0, 3)).map(f => (
                        <FilaGastoGrafico key={f.id} id={f.id} nombre={f.nombre} valor={f.valor} max={maxGasto} total={totalGastoMes} esPersonal={f.esPersonal} />
                      ))}
                      {filasGasto.length === 0 && (
                        <p style={{ margin: '8px 0 0', fontSize: 12.5, color: 'var(--color-text-secondary)', fontFamily: F_BODY }}>
                          Todavía no hay gastos este mes.
                        </p>
                      )}
                    </div>
                    <VerTodo total={filasGasto.length} abierto={verTodoGasto} onToggle={() => setVerTodoGasto(v => !v)} />
                  </>
                )}
              </Card>

              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '22px 2px 12px' }}>
                <span style={{ fontFamily: F_HEAD, fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--color-text-primary)' }}>
                  Tus grupos
                </span>
                <Link href="/mis-grupos" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-cta)', fontFamily: F_BODY, textDecoration: 'none' }}>
                  Ver todos
                </Link>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {gruposOrdenGrafico.slice(0, 3).map(g => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => irAGrupo(g.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 13, width: '100%', textAlign: 'left',
                      background: 'var(--color-surface-white)', border: '1px solid var(--color-border)',
                      borderRadius: 18, padding: 16, cursor: 'pointer', boxSizing: 'border-box',
                    }}
                  >
                    <AvatarGrupo grupoId={g.id} nombre={g.nombre} size={44} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: F_BODY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {g.nombre}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--color-neutral)', marginTop: 1, fontFamily: F_BODY }}>
                        {g.integrantes} integrante{g.integrantes === 1 ? '' : 's'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{
                        fontFamily: F_HEAD, fontSize: 14, fontWeight: 700,
                        color: g.neto > 0 ? 'var(--color-positive)' : g.neto < 0 ? 'var(--color-negative)' : 'var(--color-text-muted)',
                      }}>
                        {g.neto === 0 ? 'Al día' : formatCLP(Math.abs(g.neto))}
                      </div>
                      {g.neto !== 0 && (
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontFamily: F_BODY }}>
                          {g.neto > 0 ? 'Te deben' : 'Debes'}
                        </div>
                      )}
                    </div>
                    <svg width="8" height="14" viewBox="0 0 8 14" fill="none" style={{ flexShrink: 0 }}>
                      <path d="M1.5 1.5L6.5 7l-5 5.5" stroke="#C4C7CE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                ))}
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

              {!primerosPasosOculto && (
                <div style={{ marginTop: 22 }}>
                  <PrimerosPasosFila abierto={primerosPasosAbierto} onToggle={() => setPrimerosPasosAbierto(v => !v)} onPaso={handlePaso} onOcultar={handleOcultarPrimerosPasos} />
                </div>
              )}
            </>
          )
        )}

        {/* ═══════════ BLOQUE B · Un grupo elegido ═══════════ */}
        {fase === 'grupo' && grupoActivo && (
          cargandoGrupo ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 10 }}>
              {[140, 180, 140, 100].map((h, i) => <div key={i} className="skeleton" style={{ height: h, borderRadius: 18 }} />)}
            </div>
          ) : (
            <>
              {(() => {
                const teDeben = sumarPositivos(saldosPersonas)
                const debes = sumarNegativos(saldosPersonas)
                return (
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
                )
              })()}

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
                      return <Link key={s.usuario.id} href={`/saldos/${s.usuario.id}?grupo=${grupoActivo.id}`} style={{ ...filaStyle, textDecoration: 'none' }}>{contenido}</Link>
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
                  href={`/cuentas?grupo=${grupoActivo.id}`}
                  icono={<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M6 3h9l3 3v15a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="var(--color-cta-dark)" strokeWidth="1.6" strokeLinejoin="round" /><path d="M8.5 9h7M8.5 13h7M8.5 17h4" stroke="var(--color-cta-dark)" strokeWidth="1.6" strokeLinecap="round" /></svg>}
                  titulo="Cuentas"
                  subtitulo="Hogar, viajes, eventos"
                />
                <div style={{ height: 1, background: 'var(--color-divider)' }} />
                <FilaAccion
                  href={`/cierre?grupo=${grupoActivo.id}`}
                  icono={<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="var(--color-cta-dark)" strokeWidth="1.6" /><path d="M8 12l3 3 5-5" stroke="var(--color-cta-dark)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  titulo="Cierre mensual"
                  subtitulo="Cierra el mes y salda las deudas"
                />
              </Card>
            </>
          )
        )}

        {/* ═══════════ BLOQUE D · Sin grupos ═══════════ */}
        {fase === 'vacio' && (
          <>
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
                  Todavía no tienes<br />ningún grupo
                </div>
                <p style={{ fontSize: 13.5, lineHeight: 1.55, color: 'rgba(255,255,255,.86)', margin: '10px 0 0', fontFamily: F_BODY }}>
                  Invita a alguien a un grupo y empiecen a registrar gastos juntos. Nosotros nos encargamos de las cuentas.
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

            <div style={{ padding: '18px 0 4px', textAlign: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--color-neutral)', fontFamily: F_BODY }}>
                Puedes estar en varios grupos a la vez.
              </span>
            </div>

            {!primerosPasosOculto && (
              <div style={{ marginTop: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontFamily: F_HEAD, fontSize: 14.5, fontWeight: 700, color: 'var(--color-text-primary)' }}>Primeros pasos</span>
                  <button
                    type="button"
                    onClick={handleOcultarPrimerosPasos}
                    aria-label="Ocultar primeros pasos"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--color-text-muted)', fontFamily: F_BODY }}
                  >
                    Ocultar ×
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 10, overflowX: 'auto', margin: '0 -18px', padding: '0 18px 4px', WebkitOverflowScrolling: 'touch' }}>
                  {PASOS.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handlePaso(p.id)}
                      style={{
                        flex: '0 0 200px', textAlign: 'left', background: 'var(--color-surface-white)',
                        border: '1px solid var(--color-border)', borderRadius: 16, padding: 14, cursor: 'pointer',
                      }}
                    >
                      <span style={{ width: 34, height: 34, borderRadius: 11, background: 'var(--tint-cta)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {p.icono}
                      </span>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: F_BODY, marginTop: 10 }}>{p.titulo}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--color-text-secondary)', fontFamily: F_BODY, marginTop: 3, lineHeight: 1.4 }}>{p.texto}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <BottomNav sinGrupos={fase === 'vacio'} />

      {flujoAbierto && (
        <FlujoCrearUnirseGrupo
          pasoInicial={flujoAbierto}
          onCerrar={() => setFlujoAbierto(null)}
          onListo={handleListoFlujo}
        />
      )}

      <SelectorGrupoSheet
        abierto={sheetModo !== null}
        onCerrar={() => setSheetModo(null)}
        grupos={grupos}
        seleccionActual={seleccion.tipo === 'grupo' ? seleccion.grupoId : 'todos'}
        permitirTodos={sheetModo?.tipo === 'chip'}
        onElegir={handleElegirDesdeSheet}
        onCrearGrupo={() => { setSheetModo(null); setFlujoAbierto('crear') }}
        onUnirseConCodigo={() => { setSheetModo(null); setFlujoAbierto('unirse') }}
      />
    </main>
  )
}

function PrimerosPasosFila({ abierto, onToggle, onPaso, onOcultar }: {
  abierto: boolean
  onToggle: () => void
  onPaso: (destino: DestinoPaso) => void
  onOcultar: () => void
}) {
  return (
    <div style={{ background: 'var(--color-surface-white)', border: '1px solid var(--color-border)', borderRadius: 18, overflow: 'hidden' }}>
      <button
        type="button"
        onClick={onToggle}
        style={{ display: 'flex', alignItems: 'center', gap: 13, width: '100%', padding: 16, background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer' }}
      >
        <span style={{ width: 36, height: 36, borderRadius: 11, background: 'var(--tint-cta)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
            <path d="M5 17V3" stroke="var(--color-cta-dark)" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M5 4h9l-2.5 3.5L14 11H5" stroke="var(--color-cta-dark)" strokeWidth="1.6" strokeLinejoin="round" />
          </svg>
        </span>
        <span style={{ flex: 1, fontSize: 14.5, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: F_BODY }}>Primeros pasos</span>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--color-cta-dark)', background: 'var(--tint-cta)', borderRadius: 100, padding: '3px 9px', flexShrink: 0, fontFamily: F_BODY }}>
          {PASOS.length}
        </span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0, transform: abierto ? 'rotate(180deg)' : 'none', transition: 'transform 150ms ease' }}>
          <path d="M3 4.5L6 7.5l3-3" stroke="#6B7280" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {abierto && (
        <div style={{ padding: '0 16px 6px' }}>
          <div style={{ height: 1, background: 'var(--color-divider)', margin: '0 0 4px' }} />
          {PASOS.map(p => (
            <FilaAccion
              key={p.id}
              icono={p.icono}
              titulo={p.titulo}
              subtitulo={p.texto}
              onClick={() => onPaso(p.id)}
            />
          ))}
          <button
            type="button"
            onClick={onOcultar}
            style={{ width: '100%', textAlign: 'center', padding: '10px 0 4px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: 'var(--color-text-muted)', fontFamily: F_BODY }}
          >
            Ocultar primeros pasos
          </button>
        </div>
      )}
    </div>
  )
}
