'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { resolverGrupoActivo, type GrupoOpcion } from '@/lib/grupo-activo'
import { listarCuentasActivasGrupo, type CuentaMini } from '@/lib/gastos'
import { listarContactosCompartidos, type UsuarioMini } from '@/lib/cuentas'
import {
  obtenerHistorialGrupo, obtenerHistorialPersonal, formatearEncabezadoFecha,
  type GastoHistorial, type PagoHistorial,
} from '@/lib/historial'
import { CATEGORIA_EMOJI, METODO_LABEL } from '@/types/database'
import { formatCLP } from '@/lib/format'
import { Avatar } from '@/components/app/Avatar'
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

// 'personal' no es un filtro de tipo dentro del grupo activo como los otros
// tres — cambia el alcance completo (gastos sin grupo donde participo, ver
// obtenerHistorialPersonal). Igual vive en la misma fila de pills, selección
// única, por eso comparte el tipo con el resto.
type TipoFiltro = 'todo' | 'gastos' | 'pagos' | 'personal'

type Item =
  | { tipo: 'gasto'; fecha: string; creado_en: string; gasto: GastoHistorial }
  | { tipo: 'pago'; fecha: string; creado_en: string; pago: PagoHistorial }

function pasaFiltro(item: Item, filtro: FiltroState, tipoFiltro: TipoFiltro): boolean {
  if (tipoFiltro === 'gastos' && item.tipo !== 'gasto') return false
  if (tipoFiltro === 'pagos' && item.tipo !== 'pago') return false

  // El eje cuenta no aplica en "Personal" (gastos sin grupo, sin cuenta) —
  // se ignora acá aunque filtro.cuentas haya quedado con algo seleccionado
  // de una sesión previa en modo grupo, en vez de esconder todo en silencio.
  if (tipoFiltro !== 'personal' && filtro.cuentas !== 'todas') {
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
    const hoy = new Date()
    if (filtro.fecha === 'mes') {
      const desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().slice(0, 10)
      if (fecha < desde) return false
    } else if (filtro.fecha === '3meses') {
      const d = new Date(hoy)
      d.setMonth(d.getMonth() - 3)
      if (fecha < d.toISOString().slice(0, 10)) return false
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

function fechaCortaEs(fechaISO: string): string {
  return new Date(fechaISO + 'T12:00:00').toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })
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

  const [fase, setFase] = useState<'cargando' | 'elegir-grupo' | 'ok'>('cargando')
  const [grupos, setGrupos] = useState<GrupoOpcion[]>([])
  const [grupoId, setGrupoId] = useState<string | null>(null)
  const [usuarioId, setUsuarioId] = useState<string | null>(null)

  const [cuentas, setCuentas] = useState<CuentaMini[]>([])
  const [personas, setPersonas] = useState<UsuarioMini[]>([])
  const [gastos, setGastos] = useState<GastoHistorial[]>([])
  const [pagos, setPagos] = useState<PagoHistorial[]>([])
  const [cargandoDatos, setCargandoDatos] = useState(true)

  // Datos del tab "Personal" — alcance distinto (sin grupo), se cargan
  // recién cuando el usuario entra ahí por primera vez.
  const [contactos, setContactos] = useState<UsuarioMini[]>([])
  const [gastosPersonal, setGastosPersonal] = useState<GastoHistorial[]>([])
  const [pagosPersonal, setPagosPersonal] = useState<PagoHistorial[]>([])
  const [personalCargado, setPersonalCargado] = useState(false)
  const [cargandoPersonal, setCargandoPersonal] = useState(false)

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

      // Entrada directa al tab Personal (ej. desde "Nuevo gasto personal"):
      // no bloqueamos con el selector de grupo — Personal no depende de cuál
      // esté activo. Igual resolvemos uno en segundo plano (sin preguntar,
      // el primero si hay varios) para que cambiar a Todo/Gastos/Pagos
      // después, en la misma visita, ya tenga con qué trabajar.
      if (params.get('tab') === 'personal') {
        setTipoFiltro('personal')
        setFase('ok')
        const resolucion = await resolverGrupoActivo(user.id, null)
        if (!activo) return
        if (resolucion.estado === 'ok') setGrupoId(resolucion.grupoId)
        else if (resolucion.estado === 'elegir') setGrupoId(resolucion.grupos[0]?.id ?? null)
        return
      }

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
    if (fase !== 'ok' || !grupoId) return
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
  }, [fase, grupoId])

  const enPersonal = tipoFiltro === 'personal'

  // Carga perezosa del tab Personal — recién la primera vez que se entra ahí.
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

  const itemsCombinados = useMemo<Item[]>(() => {
    const gastosFuente = enPersonal ? gastosPersonal : gastos
    const pagosFuente = enPersonal ? pagosPersonal : pagos
    const g: Item[] = gastosFuente.map(x => ({ tipo: 'gasto', fecha: x.fecha, creado_en: x.creado_en, gasto: x }))
    const p: Item[] = pagosFuente.map(x => ({ tipo: 'pago', fecha: x.fecha, creado_en: x.creado_en, pago: x }))
    return [...g, ...p].sort((a, b) => b.fecha.localeCompare(a.fecha) || b.creado_en.localeCompare(a.creado_en))
  }, [enPersonal, gastos, pagos, gastosPersonal, pagosPersonal])

  const itemsFiltrados = useMemo(
    () => itemsCombinados.filter(i => pasaFiltro(i, filtroAplicado, tipoFiltro)),
    [itemsCombinados, filtroAplicado, tipoFiltro]
  )

  const previewCount = useMemo(
    () => itemsCombinados.filter(i => pasaFiltro(i, filtroDraft, tipoFiltro)).length,
    [itemsCombinados, filtroDraft, tipoFiltro]
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
    (!enPersonal && filtroAplicado.cuentas !== 'todas' ? 1 : 0) +
    (filtroAplicado.personas !== 'todas' ? 1 : 0) +
    (filtroAplicado.fecha !== 'todo' ? 1 : 0)

  const countDraft =
    (!enPersonal && filtroDraft.cuentas !== 'todas' ? 1 : 0) +
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

  const personasFiltro = enPersonal ? contactos : personas
  const nombreCuenta = (key: string) => key === SIN_CUENTA ? 'Sin cuenta' : cuentas.find(c => c.id === key)?.nombre ?? '—'
  const nombrePersona = (id: string) => id === usuarioId ? 'Tú' : personasFiltro.find(p => p.id === id)?.nombre ?? '—'
  const labelFecha = (f: FiltroState) => f.fecha === 'mes' ? 'Este mes' : f.fecha === '3meses' ? 'Últimos 3 meses' : f.fecha === 'rango' ? (f.rangoDesde && f.rangoHasta ? `${fechaCortaEs(f.rangoDesde)} – ${fechaCortaEs(f.rangoHasta)}` : 'Rango elegido') : ''

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
                href={`/historial?grupo=${g.id}`}
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

  const miPerfil = personas.find(p => p.id === usuarioId)

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--color-bg)', paddingBottom: 96 }}>
      <div style={{ maxWidth: 440, margin: '0 auto', padding: '0 18px', paddingTop: 'max(20px, env(safe-area-inset-top, 0px))' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontFamily: F_HEAD, fontSize: 23, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--color-text-primary)' }}>
            Historial
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={abrirFiltro}
              aria-label="Filtrar"
              style={{
                position: 'relative', width: 40, height: 40, borderRadius: 12, border: '1px solid var(--color-border)',
                background: 'var(--color-surface-white)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', padding: 0,
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
            <Link href="/perfil" aria-label="Perfil" style={{ display: 'flex', flexShrink: 0 }}>
              <Avatar nombre={miPerfil?.nombre || '?'} color={miPerfil?.avatar_color || '#A8D8B9'} size={42} />
            </Link>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: countActivo > 0 ? 12 : 16, flexWrap: 'wrap' }}>
          <Chip activo={tipoFiltro === 'todo'} onClick={() => setTipoFiltro('todo')}>Todo</Chip>
          <Chip activo={tipoFiltro === 'gastos'} onClick={() => setTipoFiltro('gastos')}>Gastos</Chip>
          <Chip activo={tipoFiltro === 'pagos'} onClick={() => setTipoFiltro('pagos')}>Pagos</Chip>
          <Chip activo={enPersonal} onClick={() => setTipoFiltro('personal')}>Personal</Chip>
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
            {!enPersonal && filtroAplicado.cuentas !== 'todas' && [...filtroAplicado.cuentas].map(k => (
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

        {(enPersonal ? cargandoPersonal : cargandoDatos) ? (
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
                          <div style={{ fontSize: 11.5, color: 'var(--color-neutral)', marginTop: 1, fontFamily: F_BODY }}>
                            {g.pagador?.id === usuarioId ? 'Tú pagaste' : `${g.pagador?.nombre ?? '—'} pagó`}
                            {!enPersonal && ` · ${g.cuenta_nombre ?? 'Sin cuenta'}`}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontFamily: F_HEAD, fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                            {formatCLP(g.monto_total)}
                          </div>
                          {signo && (
                            <div style={{ fontSize: 10.5, fontWeight: 600, marginTop: 1, color: signo === '+' ? 'var(--color-positive)' : 'var(--color-negative)' }}>
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
                        <div style={{ fontSize: 11.5, color: 'var(--color-neutral)', marginTop: 1, fontFamily: F_BODY }}>
                          {METODO_LABEL[p.metodo]}
                        </div>
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
              {!enPersonal && (
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

              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontFamily: F_BODY, marginTop: enPersonal ? 0 : 26 }}>Persona</div>
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
                      !enPersonal && filtroDraft.cuentas !== 'todas' ? [...filtroDraft.cuentas].map(nombreCuenta).join(', ') : null,
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
    </main>
  )
}
