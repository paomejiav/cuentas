'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { obtenerSeleccion, seleccionarGrupo, type Seleccion, type GrupoOpcion } from '@/lib/grupo-activo'
import { listarGruposConIntegrantes, type GrupoParaSheet } from '@/lib/grupo'
import { listarCuentasActivasGrupo, type CuentaMini } from '@/lib/gastos'
import {
  listarContactosCompartidos, limitesMesActualSantiago, fechaHaceMesesSantiago, formatearFechaCortaSantiago,
  type UsuarioMini,
} from '@/lib/cuentas'
import {
  obtenerHistorialGrupo, obtenerHistorialPersonal, formatearEncabezadoFecha,
  type GastoHistorial, type PagoHistorial,
} from '@/lib/historial'
import { CATEGORIA_EMOJI, METODO_LABEL } from '@/types/database'
import { formatCLP } from '@/lib/format'
import { Avatar } from '@/components/app/Avatar'
import { AvatarGrupo } from '@/components/app/AvatarGrupo'
import { ChipGrupo } from '@/components/app/ChipGrupo'
import { SelectorGrupoSheet } from '@/components/app/SelectorGrupoSheet'
import { FlujoCrearUnirseGrupo } from '@/components/app/FlujoCrearUnirseGrupo'
import { BottomNav } from '@/components/app/BottomNav'

const F_HEAD = 'var(--font-sora), sans-serif'
const F_BODY = 'var(--font-dm-sans), sans-serif'

// ── Tipos de filtro ──────────────────────────────────────────

type EjeFecha = 'todo' | 'mes' | '3meses' | 'rango'
type EjeMultiple = 'todas' | Set<string>
const SIN_CUENTA = 'sin-cuenta'

interface FiltroState {
  cuentas: EjeMultiple
  personas: EjeMultiple
  fecha: EjeFecha
  rangoDesde: string
  rangoHasta: string
}

const FILTRO_DEFAULT: FiltroState = { cuentas: 'todas', personas: 'todas', fecha: 'todo', rangoDesde: '', rangoHasta: '' }

// Filtro de TIPO (qué clase de movimiento) — ortogonal al alcance
// (Todo/Personal, ver `Alcance` más abajo). La vieja pestaña "Personal" de
// esta fila desapareció: ahora el alcance personal se elige con el
// segmentado nuevo, que solo aparece con "Todos los grupos".
type TipoFiltro = 'todo' | 'gastos' | 'pagos'

// Solo tiene sentido con selección "todos" — qué universo de movimientos
// mezclar: todo (todos los grupos + personal) o solo lo personal.
type Alcance = 'todo' | 'personal'

interface GrupoTag { id: string; nombre: string }

type Item =
  | { tipo: 'gasto'; fecha: string; creado_en: string; gasto: GastoHistorial; grupoTag: GrupoTag | null }
  | { tipo: 'pago'; fecha: string; creado_en: string; pago: PagoHistorial; grupoTag: GrupoTag | null }

function pasaFiltro(item: Item, filtro: FiltroState, mostrarEjeCuenta: boolean, tipoFiltro: TipoFiltro): boolean {
  if (tipoFiltro === 'gastos' && item.tipo !== 'gasto') return false
  if (tipoFiltro === 'pagos' && item.tipo !== 'pago') return false

  // El eje cuenta no aplica fuera de un grupo puntual (las cuentas
  // pertenecen a un grupo) — se ignora acá aunque filtro.cuentas haya
  // quedado con algo seleccionado de una sesión previa, en vez de esconder
  // todo en silencio.
  if (mostrarEjeCuenta && filtro.cuentas !== 'todas') {
    if (item.tipo === 'pago') return false // los pagos no pertenecen a ninguna cuenta
    const key = item.gasto.cuenta_id ?? SIN_CUENTA
    if (!filtro.cuentas.has(key)) return false
  }

  if (filtro.personas !== 'todas') {
    if (item.tipo === 'gasto') {
      const participa = item.gasto.divisiones.some(d => d.usuario && (filtro.personas as Set<string>).has(d.usuario.id))
      if (!participa) return false
    } else {
      const involucrado = filtro.personas.has(item.pago.de_usuario_id) || filtro.personas.has(item.pago.a_usuario_id)
      if (!involucrado) return false
    }
  }

  if (filtro.fecha !== 'todo') {
    const fecha = item.fecha
    if (filtro.fecha === 'mes') {
      if (fecha < limitesMesActualSantiago().desde) return false
    } else if (filtro.fecha === '3meses') {
      if (fecha < fechaHaceMesesSantiago(3)) return false
    } else if (filtro.fecha === 'rango') {
      if (filtro.rangoDesde && fecha < filtro.rangoDesde) return false
      if (filtro.rangoHasta && fecha > filtro.rangoHasta) return false
    }
  }

  return true
}

function efectoGasto(gasto: GastoHistorial, usuarioId: string): { signo: '+' | '-' | null; monto: number } {
  const miDivision = gasto.divisiones.find(d => d.usuario?.id === usuarioId)
  if (gasto.pagado_por === usuarioId) {
    return { signo: '+', monto: gasto.monto_total - (miDivision?.monto_asignado ?? 0) }
  }
  if (miDivision) {
    return { signo: '-', monto: miDivision.monto_asignado }
  }
  return { signo: null, monto: 0 }
}

function efectoPago(pago: PagoHistorial, usuarioId: string): { signo: '+' | '-' | null; monto: number } {
  if (pago.a_usuario_id === usuarioId) return { signo: '+', monto: pago.monto }
  if (pago.de_usuario_id === usuarioId) return { signo: '-', monto: pago.monto }
  return { signo: null, monto: 0 }
}

// ── Piezas visuales ──────────────────────────────────────────

function Chip({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '7px 14px', borderRadius: 100,
        border: activo ? 'none' : '1px solid var(--color-border)',
        background: activo ? 'var(--color-cta)' : 'var(--color-surface-white)',
        color: activo ? 'white' : 'var(--color-text-secondary)',
        fontSize: 12.5, fontWeight: activo ? 600 : 500,
        fontFamily: F_BODY, cursor: 'pointer', whiteSpace: 'nowrap',
        transition: 'all 150ms ease', WebkitTapHighlightColor: 'transparent',
      }}
    >
      {children}
    </button>
  )
}

/** Etiqueta chica por fila, solo en "Todos los grupos": inicial+color del grupo, o "Personal" en gris. */
function TagGrupoHistorial({ grupoTag }: { grupoTag: GrupoTag | null }) {
  if (!grupoTag) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <span style={{ width: 14, height: 14, borderRadius: 5, background: 'var(--color-icon-bg)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="3.4" stroke="var(--color-text-secondary)" strokeWidth="2" /><path d="M6 19.5c.5-3 3-4.8 6-4.8s5.5 1.8 6 4.8" stroke="var(--color-text-secondary)" strokeWidth="2" strokeLinecap="round" /></svg>
        </span>
        <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--color-text-muted)', fontFamily: F_BODY }}>Personal</span>
      </span>
    )
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <AvatarGrupo grupoId={grupoTag.id} nombre={grupoTag.nombre} size={14} />
      <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--color-text-muted)', fontFamily: F_BODY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 90 }}>
        {grupoTag.nombre}
      </span>
    </span>
  )
}

function SegmentadoAlcance({ alcance, setAlcance }: { alcance: Alcance; setAlcance: (a: Alcance) => void }) {
  const opciones: { id: Alcance; label: string }[] = [{ id: 'todo', label: 'Todo' }, { id: 'personal', label: 'Personal' }]
  return (
    <div style={{ display: 'flex', gap: 4, background: 'var(--color-card-light)', borderRadius: 12, padding: 4, marginBottom: 14 }}>
      {opciones.map(op => {
        const activo = alcance === op.id
        return (
          <button
            key={op.id}
            onClick={() => setAlcance(op.id)}
            style={{
              flex: 1, height: 38, borderRadius: 9, border: 'none', cursor: 'pointer',
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

  const [fase, setFase] = useState<'cargando' | 'ok'>('cargando')
  const [seleccion, setSeleccion] = useState<Seleccion>({ tipo: 'todos' })
  const [gruposActivos, setGruposActivos] = useState<GrupoOpcion[]>([])
  const [gruposParaSheet, setGruposParaSheet] = useState<GrupoParaSheet[]>([])
  const [usuarioId, setUsuarioId] = useState<string | null>(null)

  const grupoId = seleccion.tipo === 'grupo' ? seleccion.grupoId : null
  const grupoNombre = grupoId ? (gruposActivos.find(g => g.id === grupoId)?.nombre ?? '') : ''

  const [sheetAbierto, setSheetAbierto] = useState(false)
  const [flujoAbierto, setFlujoAbierto] = useState<'crear' | 'unirse' | null>(null)

  const [cuentas, setCuentas] = useState<CuentaMini[]>([])
  const [personas, setPersonas] = useState<UsuarioMini[]>([])
  const [gastos, setGastos] = useState<GastoHistorial[]>([])
  const [pagos, setPagos] = useState<PagoHistorial[]>([])
  const [cargandoDatos, setCargandoDatos] = useState(true)

  // Alcance "personal" — tanto el de la vista Personal de "Todos los
  // grupos" como la entrada directa ?tab=personal, mismos datos y misma
  // lógica de siempre (gastos aislados sin grupo donde participo).
  const [alcance, setAlcance] = useState<Alcance>('todo')
  const [contactos, setContactos] = useState<UsuarioMini[]>([])
  const [gastosPersonal, setGastosPersonal] = useState<GastoHistorial[]>([])
  const [pagosPersonal, setPagosPersonal] = useState<PagoHistorial[]>([])
  const [personalCargado, setPersonalCargado] = useState(false)
  const [cargandoPersonal, setCargandoPersonal] = useState(false)

  // "Todos los grupos" + alcance "todo" — movimientos de todos los grupos
  // activos mezclados con lo personal, cada uno con su etiqueta de origen.
  const [itemsMixtos, setItemsMixtos] = useState<Item[]>([])
  const [mixtoCargado, setMixtoCargado] = useState(false)
  const [cargandoMixto, setCargandoMixto] = useState(false)

  const [tipoFiltro, setTipoFiltro] = useState<TipoFiltro>('todo')
  const [mostrarFiltro, setMostrarFiltro] = useState(false)
  const [filtroAplicado, setFiltroAplicado] = useState<FiltroState>(FILTRO_DEFAULT)
  const [filtroDraft, setFiltroDraft] = useState<FiltroState>(FILTRO_DEFAULT)

  useEffect(() => {
    let activo = true
    async function cargar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }
      if (!activo) return
      setUsuarioId(user.id)

      // Entrada directa a la vista Personal (ej. desde "Nuevo gasto
      // personal"): fuerza selección "todos" + alcance personal, sin
      // bloquear con nada del lado de grupos.
      if (params.get('tab') === 'personal') {
        setSeleccion({ tipo: 'todos' })
        setAlcance('personal')
        setFase('ok')
        const [{ grupos: listaGrupos }, conIntegrantes] = await Promise.all([
          obtenerSeleccion(user.id, null),
          listarGruposConIntegrantes(user.id),
        ])
        if (!activo) return
        setGruposActivos(listaGrupos)
        setGruposParaSheet(conIntegrantes)
        return
      }

      const [{ seleccion: sel, grupos: listaGrupos }, conIntegrantes] = await Promise.all([
        obtenerSeleccion(user.id, params.get('grupo')),
        listarGruposConIntegrantes(user.id),
      ])
      if (!activo) return

      if (listaGrupos.length === 0) { router.replace('/'); return }
      setGruposParaSheet(conIntegrantes)

      setGruposActivos(listaGrupos)
      setSeleccion(sel)
      setFase('ok')
    }
    cargar()
    return () => { activo = false }
  }, [router, params])

  useEffect(() => {
    if (fase !== 'ok' || seleccion.tipo !== 'grupo') return
    const grupoId = seleccion.grupoId
    let activo = true
    async function cargarDatos() {
      setCargandoDatos(true)
      const [listaCuentas, { data: miembros }, historial] = await Promise.all([
        listarCuentasActivasGrupo(grupoId!),
        supabase.from('grupo_miembros').select('usuarios ( id, nombre, avatar_color )').eq('grupo_id', grupoId!),
        obtenerHistorialGrupo(grupoId!),
      ])
      if (!activo) return
      const listaPersonas = ((miembros ?? []) as unknown as { usuarios: UsuarioMini | null }[]).map(f => f.usuarios).filter((u): u is UsuarioMini => !!u)
      setCuentas(listaCuentas)
      setPersonas(listaPersonas)
      setGastos(historial.gastos)
      setPagos(historial.pagos)
      setCargandoDatos(false)

      // Preselección de personas vía ?personas=id1,id2 (ej. desde "Ver los
      // gastos de esta cadena" en Cierre) — solo en la carga inicial, para no
      // pisar un filtro que el usuario ya haya tocado a mano.
      const personasParam = params.get('personas')
      if (personasParam) {
        const idsValidos = new Set(
          personasParam.split(',').filter(id => listaPersonas.some(p => p.id === id))
        )
        if (idsValidos.size > 0) {
          const filtroInicial: FiltroState = { ...FILTRO_DEFAULT, personas: idsValidos }
          setFiltroAplicado(filtroInicial)
          setFiltroDraft(filtroInicial)
        }
      }
    }
    cargarDatos()
    return () => { activo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase, seleccion])

  const esTodos = seleccion.tipo === 'todos'
  const enPersonal = esTodos && alcance === 'personal'
  const enMixto = esTodos && alcance === 'todo'
  const mostrarEjeCuenta = !esTodos // las cuentas pertenecen a un grupo

  // Carga perezosa de lo personal — recién la primera vez que se entra ahí
  // (vista Personal del segmentado, o ?tab=personal).
  useEffect(() => {
    if (!enPersonal || personalCargado || !usuarioId) return
    let activo = true
    setCargandoPersonal(true)
    Promise.all([obtenerHistorialPersonal(usuarioId), listarContactosCompartidos(usuarioId)]).then(([historial, listaContactos]) => {
      if (!activo) return
      setGastosPersonal(historial.gastos)
      setPagosPersonal(historial.pagos)
      setContactos(listaContactos)
      setPersonalCargado(true)
      setCargandoPersonal(false)
    })
    return () => { activo = false }
  }, [enPersonal, personalCargado, usuarioId])

  // "Todos los grupos" + alcance "todo" — un gasto/pago por cada grupo
  // activo en paralelo, más lo personal, mezclados y etiquetados por origen.
  useEffect(() => {
    if (!enMixto || mixtoCargado || !usuarioId) return
    let activo = true
    setCargandoMixto(true)
    Promise.all([
      Promise.all(gruposActivos.map(g => obtenerHistorialGrupo(g.id).then(h => ({ g, h })))),
      obtenerHistorialPersonal(usuarioId),
      listarContactosCompartidos(usuarioId),
    ]).then(([porGrupo, personalHist, listaContactos]) => {
      if (!activo) return
      const items: Item[] = []
      for (const { g, h } of porGrupo) {
        for (const x of h.gastos) items.push({ tipo: 'gasto', fecha: x.fecha, creado_en: x.creado_en, gasto: x, grupoTag: { id: g.id, nombre: g.nombre } })
        for (const x of h.pagos) items.push({ tipo: 'pago', fecha: x.fecha, creado_en: x.creado_en, pago: x, grupoTag: { id: g.id, nombre: g.nombre } })
      }
      for (const x of personalHist.gastos) items.push({ tipo: 'gasto', fecha: x.fecha, creado_en: x.creado_en, gasto: x, grupoTag: null })
      for (const x of personalHist.pagos) items.push({ tipo: 'pago', fecha: x.fecha, creado_en: x.creado_en, pago: x, grupoTag: null })
      setItemsMixtos(items)
      setContactos(listaContactos)
      setMixtoCargado(true)
      setCargandoMixto(false)
    })
    return () => { activo = false }
  }, [enMixto, mixtoCargado, usuarioId, gruposActivos])

  const itemsCombinados = useMemo<Item[]>(() => {
    if (enMixto) return [...itemsMixtos].sort((a, b) => b.fecha.localeCompare(a.fecha) || b.creado_en.localeCompare(a.creado_en))
    const gastosFuente = enPersonal ? gastosPersonal : gastos
    const pagosFuente = enPersonal ? pagosPersonal : pagos
    const g: Item[] = gastosFuente.map(x => ({ tipo: 'gasto', fecha: x.fecha, creado_en: x.creado_en, gasto: x, grupoTag: null }))
    const p: Item[] = pagosFuente.map(x => ({ tipo: 'pago', fecha: x.fecha, creado_en: x.creado_en, pago: x, grupoTag: null }))
    return [...g, ...p].sort((a, b) => b.fecha.localeCompare(a.fecha) || b.creado_en.localeCompare(a.creado_en))
  }, [enMixto, itemsMixtos, enPersonal, gastos, pagos, gastosPersonal, pagosPersonal])

  const itemsFiltrados = useMemo(
    () => itemsCombinados.filter(i => pasaFiltro(i, filtroAplicado, mostrarEjeCuenta, tipoFiltro)),
    [itemsCombinados, filtroAplicado, mostrarEjeCuenta, tipoFiltro]
  )

  const previewCount = useMemo(
    () => itemsCombinados.filter(i => pasaFiltro(i, filtroDraft, mostrarEjeCuenta, tipoFiltro)).length,
    [itemsCombinados, filtroDraft, mostrarEjeCuenta, tipoFiltro]
  )

  const agrupadoPorFecha = useMemo(() => {
    const mapa = new Map<string, Item[]>()
    for (const item of itemsFiltrados) {
      const lista = mapa.get(item.fecha) ?? []
      lista.push(item)
      mapa.set(item.fecha, lista)
    }
    return Array.from(mapa.entries())
  }, [itemsFiltrados])

  const countActivo =
    (mostrarEjeCuenta && filtroAplicado.cuentas !== 'todas' ? 1 : 0) +
    (filtroAplicado.personas !== 'todas' ? 1 : 0) +
    (filtroAplicado.fecha !== 'todo' ? 1 : 0)

  const countDraft =
    (mostrarEjeCuenta && filtroDraft.cuentas !== 'todas' ? 1 : 0) +
    (filtroDraft.personas !== 'todas' ? 1 : 0) +
    (filtroDraft.fecha !== 'todo' ? 1 : 0)

  const draftEsDefault = countDraft === 0

  const totalSubconjunto = itemsFiltrados.reduce((s, i) => s + (i.tipo === 'gasto' ? i.gasto.monto_total : i.pago.monto), 0)

  function abrirFiltro() {
    setFiltroDraft(filtroAplicado)
    setMostrarFiltro(true)
  }

  function toggleCuenta(key: string) {
    setFiltroDraft(prev => {
      if (prev.cuentas === 'todas') return { ...prev, cuentas: new Set([key]) }
      const next = new Set(prev.cuentas)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return { ...prev, cuentas: next.size === 0 ? 'todas' : next }
    })
  }

  function togglePersona(id: string) {
    setFiltroDraft(prev => {
      if (prev.personas === 'todas') return { ...prev, personas: new Set([id]) }
      const next = new Set(prev.personas)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { ...prev, personas: next.size === 0 ? 'todas' : next }
    })
  }

  function quitarCuenta(key: string) {
    setFiltroAplicado(prev => {
      if (prev.cuentas === 'todas') return prev
      const next = new Set(prev.cuentas)
      next.delete(key)
      return { ...prev, cuentas: next.size === 0 ? 'todas' : next }
    })
  }

  function quitarPersona(id: string) {
    setFiltroAplicado(prev => {
      if (prev.personas === 'todas') return prev
      const next = new Set(prev.personas)
      next.delete(id)
      return { ...prev, personas: next.size === 0 ? 'todas' : next }
    })
  }

  function quitarFecha() {
    setFiltroAplicado(prev => ({ ...prev, fecha: 'todo', rangoDesde: '', rangoHasta: '' }))
  }

  const personasFiltro = (enPersonal || enMixto) ? contactos : personas
  const nombreCuenta = (key: string) => key === SIN_CUENTA ? 'Sin cuenta' : cuentas.find(c => c.id === key)?.nombre ?? '—'
  const nombrePersona = (id: string) => id === usuarioId ? 'Tú' : personasFiltro.find(p => p.id === id)?.nombre ?? '—'
  const labelFecha = (f: FiltroState) => f.fecha === 'mes' ? 'Este mes' : f.fecha === '3meses' ? 'Últimos 3 meses' : f.fecha === 'rango' ? (f.rangoDesde && f.rangoHasta ? `${formatearFechaCortaSantiago(f.rangoDesde)} – ${formatearFechaCortaSantiago(f.rangoHasta)}` : 'Rango elegido') : ''

  if (fase === 'cargando') {
    return (
      <main style={{ minHeight: '100dvh', background: 'var(--color-bg)' }}>
        <p style={{ padding: 24, fontSize: 13.5, color: 'var(--color-text-secondary)', fontFamily: F_BODY }}>Cargando…</p>
      </main>
    )
  }

  function handleElegirDesdeSheet(idOTodos: string) {
    seleccionarGrupo(idOTodos, { refresh: () => {} })
    setSheetAbierto(false)
    router.push(`/historial?grupo=${idOTodos}`)
  }

  function handleListoFlujoGrupo(grupo: { id: string; nombre: string }) {
    setFlujoAbierto(null)
    seleccionarGrupo(grupo.id, { refresh: () => {} })
    router.push(`/historial?grupo=${grupo.id}`)
  }

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--color-bg)', paddingBottom: 96 }}>
      <div style={{ maxWidth: 440, margin: '0 auto', padding: '0 18px', paddingTop: 'max(20px, env(safe-area-inset-top, 0px))' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <ChipGrupo grupo={grupoId ? { id: grupoId, nombre: grupoNombre } : null} onClick={() => setSheetAbierto(true)} />
          <button
            onClick={abrirFiltro}
            aria-label="Filtrar"
            style={{
              position: 'relative', width: 40, height: 40, borderRadius: 12, border: '1px solid var(--color-border)',
              background: 'var(--color-surface-white)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', padding: 0, flexShrink: 0,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <path d="M3 5h14M6 10h8M9 15h2" stroke="var(--color-text-secondary)" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            {countActivo > 0 && (
              <span style={{
                position: 'absolute', top: -5, right: -5, minWidth: 18, height: 18, borderRadius: 100,
                background: 'var(--color-cta)', color: '#fff', fontSize: 10.5, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--color-bg)',
                fontFamily: F_BODY, padding: '0 2px',
              }}>
                {countActivo}
              </span>
            )}
          </button>
        </div>

        <div style={{ fontFamily: F_HEAD, fontSize: 23, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--color-text-primary)', marginBottom: 16 }}>
          Historial
        </div>

        {esTodos && <SegmentadoAlcance alcance={alcance} setAlcance={setAlcance} />}

        <div style={{ display: 'flex', gap: 8, marginBottom: countActivo > 0 ? 12 : 16, flexWrap: 'wrap' }}>
          <Chip activo={tipoFiltro === 'todo'} onClick={() => setTipoFiltro('todo')}>Todo</Chip>
          <Chip activo={tipoFiltro === 'gastos'} onClick={() => setTipoFiltro('gastos')}>Gastos</Chip>
          <Chip activo={tipoFiltro === 'pagos'} onClick={() => setTipoFiltro('pagos')}>Pagos</Chip>
        </div>

        {enPersonal && (
          <Link
            href="/gastos/nuevo?personal=1"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 100, marginBottom: 16,
              background: 'var(--tint-cta)', border: '1px solid var(--border-cta)',
              color: 'var(--color-cta-dark)', fontSize: 12.5, fontWeight: 600,
              fontFamily: F_BODY, textDecoration: 'none', WebkitTapHighlightColor: 'transparent',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="var(--color-cta-dark)" strokeWidth="2.2" strokeLinecap="round" /></svg>
            Nuevo gasto personal
          </Link>
        )}

        {countActivo > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 16 }}>
            {mostrarEjeCuenta && filtroAplicado.cuentas !== 'todas' && [...filtroAplicado.cuentas].map(k => (
              <span key={k} onClick={() => quitarCuenta(k)} style={{
                display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                background: 'var(--tint-cta)', border: '1px solid var(--border-cta)', color: 'var(--color-cta-dark)',
                borderRadius: 100, padding: '7px 10px 7px 12px', fontSize: 12.5, fontWeight: 600, fontFamily: F_BODY,
              }}>
                {nombreCuenta(k)}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="var(--color-cta)" strokeWidth="2.6" strokeLinecap="round" /></svg>
              </span>
            ))}
            {filtroAplicado.personas !== 'todas' && [...filtroAplicado.personas].map(id => (
              <span key={id} onClick={() => quitarPersona(id)} style={{
                display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                background: 'var(--tint-cta)', border: '1px solid var(--border-cta)', color: 'var(--color-cta-dark)',
                borderRadius: 100, padding: '7px 10px 7px 12px', fontSize: 12.5, fontWeight: 600, fontFamily: F_BODY,
              }}>
                {nombrePersona(id)}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="var(--color-cta)" strokeWidth="2.6" strokeLinecap="round" /></svg>
              </span>
            ))}
            {filtroAplicado.fecha !== 'todo' && (
              <span onClick={quitarFecha} style={{
                display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                background: 'var(--tint-cta)', border: '1px solid var(--border-cta)', color: 'var(--color-cta-dark)',
                borderRadius: 100, padding: '7px 10px 7px 12px', fontSize: 12.5, fontWeight: 600, fontFamily: F_BODY,
              }}>
                {labelFecha(filtroAplicado)}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="var(--color-cta)" strokeWidth="2.6" strokeLinecap="round" /></svg>
              </span>
            )}
            <span onClick={() => setFiltroAplicado(FILTRO_DEFAULT)} style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)', padding: '0 4px', cursor: 'pointer', fontFamily: F_BODY }}>
              Limpiar
            </span>
          </div>
        )}

        {countActivo > 0 && (
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '0 2px 12px' }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontFamily: F_BODY }}>
              {itemsFiltrados.length} movimiento{itemsFiltrados.length === 1 ? '' : 's'}
            </span>
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)', fontFamily: F_BODY }}>
              Total <b style={{ color: 'var(--color-text-primary)', fontFamily: F_HEAD }}>{formatCLP(totalSubconjunto)}</b>
            </span>
          </div>
        )}

        {(enPersonal ? cargandoPersonal : enMixto ? cargandoMixto : cargandoDatos) ? (
          <p style={{ fontSize: 13.5, color: 'var(--color-text-secondary)', fontFamily: F_BODY }}>Cargando…</p>
        ) : itemsFiltrados.length === 0 ? (
          <div style={{ background: 'var(--color-surface-white)', border: '1px solid var(--color-border)', borderRadius: 18, padding: '32px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🧾</div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: F_BODY }}>Sin movimientos</p>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--color-text-secondary)', fontFamily: F_BODY }}>No hay nada que coincida con este filtro todavía.</p>
          </div>
        ) : (
          agrupadoPorFecha.map(([fecha, items]) => (
            <div key={fecha} style={{ marginBottom: 20 }}>
              <p style={{ margin: '0 2px 12px', fontSize: 11, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontFamily: F_BODY }}>
                {formatearEncabezadoFecha(fecha)}
              </p>
              <div style={{ background: 'var(--color-surface-white)', border: '1px solid var(--color-border)', borderRadius: 18, padding: '4px 16px' }}>
                {items.map((item, idx) => {
                  const borderBottom = idx < items.length - 1 ? '1px solid var(--color-divider)' : 'none'

                  if (item.tipo === 'gasto') {
                    const g = item.gasto
                    const { signo, monto } = efectoGasto(g, usuarioId!)
                    const colorEfecto = signo === '+' ? 'var(--color-positive)' : signo === '-' ? 'var(--color-negative)' : 'var(--color-neutral)'
                    return (
                      <Link key={g.id} href={`/gastos/${g.id}`} style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '13px 0',
                        borderBottom, textDecoration: 'none',
                      }}>
                        <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--tint-cta)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>
                          {CATEGORIA_EMOJI[g.categoria] ?? '📦'}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: F_BODY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {g.descripcion}
                          </div>
                          {enMixto ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
                              <TagGrupoHistorial grupoTag={item.grupoTag} />
                              <span style={{ fontSize: 11.5, fontWeight: 600, color: colorEfecto, fontFamily: F_BODY }}>
                                {g.pagador?.id === usuarioId ? 'Pagaste tú' : `Pagó ${g.pagador?.nombre ?? '—'}`} · {signo ?? ''}{formatCLP(monto)}
                              </span>
                            </div>
                          ) : (
                            <div style={{ fontSize: 11.5, color: 'var(--color-neutral)', marginTop: 1, fontFamily: F_BODY }}>
                              {g.pagador?.id === usuarioId ? 'Pagaste tú' : `Pagó ${g.pagador?.nombre ?? '—'}`}
                              {mostrarEjeCuenta && ` · ${g.cuenta_nombre ?? 'Sin cuenta'}`}
                            </div>
                          )}
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontFamily: F_HEAD, fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                            {formatCLP(g.monto_total)}
                          </div>
                          {!enMixto && signo && (
                            <div style={{ fontSize: 10.5, fontWeight: 600, marginTop: 1, color: colorEfecto }}>
                              {signo}{formatCLP(monto)}
                            </div>
                          )}
                        </div>
                      </Link>
                    )
                  }

                  const p = item.pago
                  const { signo, monto } = efectoPago(p, usuarioId!)
                  const label = p.a_usuario_id === usuarioId
                    ? `${p.de?.nombre ?? '—'} te pagó`
                    : p.de_usuario_id === usuarioId
                    ? `Le pagaste a ${p.a?.nombre ?? '—'}`
                    : `${p.de?.nombre ?? '—'} le pagó a ${p.a?.nombre ?? '—'}`
                  const iconTint = signo === '+' ? 'var(--color-positive-tint)' : signo === '-' ? 'var(--color-negative-tint)' : 'var(--color-icon-bg)'
                  const iconColor = signo === '+' ? 'var(--color-positive)' : signo === '-' ? 'var(--color-negative)' : 'var(--color-neutral)'
                  return (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 0', borderBottom }}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: iconTint, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="19" height="19" viewBox="0 0 24 24" fill="none"><path d="M4 12l5 5 11-11" stroke={iconColor} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: F_BODY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {label}
                        </div>
                        {enMixto ? (
                          <div style={{ marginTop: 3 }}><TagGrupoHistorial grupoTag={item.grupoTag} /></div>
                        ) : (
                          <div style={{ fontSize: 11.5, color: 'var(--color-neutral)', marginTop: 1, fontFamily: F_BODY }}>
                            {METODO_LABEL[p.metodo]}
                          </div>
                        )}
                      </div>
                      <span style={{ fontFamily: F_HEAD, fontSize: 14, fontWeight: 700, color: signo ? iconColor : 'var(--color-text-primary)', flexShrink: 0 }}>
                        {signo ? `${signo}${formatCLP(monto)}` : formatCLP(p.monto)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>

      <BottomNav />

      {mostrarFiltro && (
        <>
          <div onClick={() => setMostrarFiltro(false)} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(20,20,26,.42)' }} />
          <div style={{
            position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 90,
            background: 'var(--color-surface-white)', borderRadius: '26px 26px 0 0',
            maxHeight: '88vh', display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ width: 38, height: 4, borderRadius: 100, background: 'var(--color-border)', margin: '12px auto 0' }} />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <div style={{ fontFamily: F_HEAD, fontSize: 19, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--color-text-primary)' }}>Filtrar</div>
                {countDraft > 0 && (
                  <span style={{ background: 'var(--tint-cta)', color: 'var(--color-cta-dark)', borderRadius: 100, padding: '3px 9px', fontSize: 11.5, fontWeight: 700, fontFamily: F_BODY }}>
                    {countDraft}
                  </span>
                )}
              </div>
              <button
                onClick={() => setMostrarFiltro(false)}
                aria-label="Cerrar"
                style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--color-icon-bg)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="var(--color-text-secondary)" strokeWidth="2.2" strokeLinecap="round" /></svg>
              </button>
            </div>

            <div style={{ padding: '22px 20px 0', flex: 1, overflowY: 'auto' }}>
              {mostrarEjeCuenta && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontFamily: F_BODY }}>Cuenta</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 11 }}>
                    <Chip activo={filtroDraft.cuentas === 'todas'} onClick={() => setFiltroDraft(prev => ({ ...prev, cuentas: 'todas' }))}>Todas</Chip>
                    {cuentas.map(c => (
                      <Chip key={c.id} activo={filtroDraft.cuentas !== 'todas' && filtroDraft.cuentas.has(c.id)} onClick={() => toggleCuenta(c.id)}>
                        {c.icono ?? '🗂️'} {c.nombre}
                      </Chip>
                    ))}
                    <Chip activo={filtroDraft.cuentas !== 'todas' && filtroDraft.cuentas.has(SIN_CUENTA)} onClick={() => toggleCuenta(SIN_CUENTA)}>
                      🗂️ Sin cuenta
                    </Chip>
                  </div>
                </>
              )}

              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontFamily: F_BODY, marginTop: mostrarEjeCuenta ? 26 : 0 }}>Persona</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 11 }}>
                <Chip activo={filtroDraft.personas === 'todas'} onClick={() => setFiltroDraft(prev => ({ ...prev, personas: 'todas' }))}>Todas</Chip>
                {personasFiltro.map(p => (
                  <Chip key={p.id} activo={filtroDraft.personas !== 'todas' && filtroDraft.personas.has(p.id)} onClick={() => togglePersona(p.id)}>
                    <Avatar nombre={p.nombre} color={p.avatar_color} size={20} />
                    {p.id === usuarioId ? `${p.nombre} (vos)` : p.nombre}
                  </Chip>
                ))}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginTop: 10, fontFamily: F_BODY }}>
                Filtra por quién participa en el gasto.
              </div>

              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontFamily: F_BODY, marginTop: 26 }}>Fecha</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 11 }}>
                <Chip activo={filtroDraft.fecha === 'todo'} onClick={() => setFiltroDraft(prev => ({ ...prev, fecha: 'todo' }))}>Todo el tiempo</Chip>
                <Chip activo={filtroDraft.fecha === 'mes'} onClick={() => setFiltroDraft(prev => ({ ...prev, fecha: 'mes' }))}>Este mes</Chip>
                <Chip activo={filtroDraft.fecha === '3meses'} onClick={() => setFiltroDraft(prev => ({ ...prev, fecha: '3meses' }))}>Últimos 3 meses</Chip>
                <Chip activo={filtroDraft.fecha === 'rango'} onClick={() => setFiltroDraft(prev => ({ ...prev, fecha: 'rango' }))}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="16" rx="3" stroke={filtroDraft.fecha === 'rango' ? '#fff' : 'var(--color-text-secondary)'} strokeWidth="1.7" /><path d="M8 3v4M16 3v4M3 10h18" stroke={filtroDraft.fecha === 'rango' ? '#fff' : 'var(--color-text-secondary)'} strokeWidth="1.7" strokeLinecap="round" /></svg>
                  Elegir rango
                </Chip>
              </div>

              {filtroDraft.fecha === 'rango' && (
                <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                  <input
                    type="date" value={filtroDraft.rangoDesde}
                    onChange={e => setFiltroDraft(prev => ({ ...prev, rangoDesde: e.target.value }))}
                    style={{ flex: 1, height: 44, borderRadius: 12, border: '1px solid var(--color-border)', background: 'var(--color-surface-white)', padding: '0 10px', fontSize: 13, fontFamily: F_BODY, color: 'var(--color-text-primary)', outline: 'none' }}
                  />
                  <input
                    type="date" value={filtroDraft.rangoHasta}
                    onChange={e => setFiltroDraft(prev => ({ ...prev, rangoHasta: e.target.value }))}
                    style={{ flex: 1, height: 44, borderRadius: 12, border: '1px solid var(--color-border)', background: 'var(--color-surface-white)', padding: '0 10px', fontSize: 13, fontFamily: F_BODY, color: 'var(--color-text-primary)', outline: 'none' }}
                  />
                </div>
              )}

              {countDraft > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, padding: '12px 14px', background: 'var(--tint-cta)', border: '1px solid var(--border-cta)', borderRadius: 13 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="9" stroke="var(--color-cta)" strokeWidth="1.7" /><path d="M12 11v5" stroke="var(--color-cta)" strokeWidth="2" strokeLinecap="round" /><circle cx="12" cy="7.8" r="1.1" fill="var(--color-cta)" /></svg>
                  <span style={{ fontSize: 12, color: 'var(--color-cta-dark)', fontWeight: 600, fontFamily: F_BODY }}>
                    {[
                      filtroDraft.fecha !== 'todo' ? labelFecha(filtroDraft) : null,
                      mostrarEjeCuenta && filtroDraft.cuentas !== 'todas' ? [...filtroDraft.cuentas].map(nombreCuenta).join(', ') : null,
                      filtroDraft.personas !== 'todas' ? `incluye a ${[...filtroDraft.personas].map(nombrePersona).join(', ')}` : null,
                    ].filter(Boolean).join(' · ')}
                  </span>
                </div>
              )}
            </div>

            <div style={{ padding: '16px 20px max(20px, env(safe-area-inset-bottom))', display: 'flex', gap: 11, alignItems: 'center' }}>
              <button
                onClick={() => setFiltroDraft(FILTRO_DEFAULT)}
                disabled={draftEsDefault}
                style={{
                  flex: 'none', height: 54, padding: '0 20px', borderRadius: 15,
                  background: draftEsDefault ? 'var(--color-icon-bg)' : 'var(--color-surface-white)',
                  border: draftEsDefault ? '1px solid var(--color-border)' : '1px solid var(--color-border)',
                  cursor: draftEsDefault ? 'default' : 'pointer',
                }}
              >
                <span style={{ fontSize: 14.5, fontWeight: 700, color: draftEsDefault ? 'var(--color-text-disabled)' : 'var(--color-text-primary)', fontFamily: F_BODY }}>
                  Limpiar
                </span>
              </button>
              <button
                onClick={() => { setFiltroAplicado(filtroDraft); setMostrarFiltro(false) }}
                style={{
                  flex: 1, height: 54, borderRadius: 15, border: 'none', background: 'var(--gradient-cta)',
                  boxShadow: 'var(--shadow-cta)', cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: 15.5, fontWeight: 700, color: '#fff', fontFamily: F_BODY }}>
                  Ver {previewCount} movimiento{previewCount === 1 ? '' : 's'}
                </span>
              </button>
            </div>
          </div>
        </>
      )}

      <SelectorGrupoSheet
        abierto={sheetAbierto}
        onCerrar={() => setSheetAbierto(false)}
        grupos={gruposParaSheet}
        seleccionActual={grupoId ?? 'todos'}
        permitirTodos
        onElegir={handleElegirDesdeSheet}
        onCrearGrupo={() => { setSheetAbierto(false); setFlujoAbierto('crear') }}
        onUnirseConCodigo={() => { setSheetAbierto(false); setFlujoAbierto('unirse') }}
      />

      {flujoAbierto && (
        <FlujoCrearUnirseGrupo
          pasoInicial={flujoAbierto}
          onCerrar={() => setFlujoAbierto(null)}
          onListo={handleListoFlujoGrupo}
        />
      )}
    </main>
  )
}
