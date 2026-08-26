'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { resolverGrupoActivo, type GrupoOpcion } from '@/lib/grupo-activo'
import {
  calcularResumenCierre, registrarCierreCompleto, confirmarCancelacionesCadena,
  formatearMesLabel, mesActualStr,
  type ResumenCierre, type TransferenciaSugerida, type CadenaCancelada,
} from '@/lib/cierre'
import type { UsuarioMini } from '@/lib/cuentas'
import { formatCLP } from '@/lib/format'
import { Avatar } from '@/components/app/Avatar'
import { BottomNav } from '@/components/app/BottomNav'
import { Toast } from '@/components/app/Toast'
import { RegistrarPago } from '@/components/app/RegistrarPago'

const F_HEAD = 'var(--font-sora), sans-serif'
const F_BODY = 'var(--font-dm-sans), sans-serif'

type Modo = 'bilateral' | 'completa'

// ── Piezas visuales compartidas ───────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      margin: '0 2px 11px', fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)',
      fontFamily: F_BODY, textTransform: 'uppercase', letterSpacing: '0.08em',
    }}>
      {children}
    </p>
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

function DonutProgreso({ pct }: { pct: number }) {
  const r = 24
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - Math.min(100, Math.max(0, pct)) / 100)
  return (
    <div style={{ position: 'relative', width: 56, height: 56, flexShrink: 0 }}>
      <svg width="56" height="56" viewBox="0 0 56 56">
        <circle cx="28" cy="28" r={r} fill="none" stroke="var(--color-track)" strokeWidth="7" />
        <circle
          cx="28" cy="28" r={r} fill="none" stroke="var(--color-cta)" strokeWidth="7"
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
          transform="rotate(-90 28 28)" style={{ transition: 'stroke-dashoffset 600ms ease' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: F_HEAD, fontSize: 14, fontWeight: 800, color: 'var(--color-cta)',
      }}>
        {Math.round(pct)}%
      </div>
    </div>
  )
}

function EstadoVacio() {
  return (
    <Card style={{ padding: '36px 22px', textAlign: 'center' }}>
      <div style={{ fontSize: 36, marginBottom: 10 }}>✨</div>
      <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: F_BODY }}>
        No hay nada pendiente de saldar
      </p>
      <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--color-text-secondary)', fontFamily: F_BODY, lineHeight: 1.5 }}>
        Cuando alguien registre un gasto nuevo, las deudas van a aparecer acá.
      </p>
    </Card>
  )
}

function EstadoExito({ mes }: { mes: string }) {
  return (
    <Card style={{ padding: '40px 22px', textAlign: 'center' }}>
      <div style={{ fontSize: 40, marginBottom: 10 }}>🎉</div>
      <p style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: F_HEAD }}>
        ¡Todo saldado!
      </p>
      <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--color-text-secondary)', fontFamily: F_BODY }}>
        Quedó registrado el cierre de {formatearMesLabel(mes)}.
      </p>
    </Card>
  )
}

// ── Toggle Bilateral / Completa ───────────────────────────────

function ToggleModo({
  modo, setModo, countBilateral, countCompleta, deshabilitado,
}: {
  modo: Modo
  setModo: (m: Modo) => void
  countBilateral: number
  countCompleta: number
  deshabilitado: boolean
}) {
  const opciones: { id: Modo; label: string; count: number }[] = [
    { id: 'bilateral', label: 'Bilateral', count: countBilateral },
    { id: 'completa', label: 'Completa', count: countCompleta },
  ]
  return (
    <div style={{ display: 'flex', gap: 4, background: 'var(--color-card-light)', borderRadius: 14, padding: 4 }}>
      {opciones.map(op => {
        const activo = modo === op.id
        return (
          <button
            key={op.id}
            onClick={() => !deshabilitado && setModo(op.id)}
            disabled={deshabilitado}
            style={{
              flex: 1, height: 46, borderRadius: 11, border: 'none',
              cursor: deshabilitado ? 'default' : 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              background: activo ? 'var(--color-surface-white)' : 'transparent',
              boxShadow: activo ? '0 3px 9px -3px rgba(24,34,26,.18)' : 'none',
              opacity: deshabilitado && !activo ? 0.5 : 1,
              transition: 'all 150ms ease',
            }}
          >
            <span style={{
              fontSize: 13.5, fontWeight: 700, fontFamily: F_BODY,
              color: activo ? (op.id === 'completa' ? 'var(--color-cta-dark)' : 'var(--color-text-primary)') : 'var(--color-text-muted)',
            }}>
              {op.label}
            </span>
            <span style={{ fontSize: 10, marginTop: 1, fontFamily: F_BODY, color: activo ? 'var(--color-text-muted)' : 'var(--color-text-disabled)' }}>
              {op.count} transferencia{op.count === 1 ? '' : 's'}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ── Fila de transferencia ("A transferir" / "Transferencias sugeridas") ──

function TransferenciaCard({
  t, usuarioId, onAccionar,
}: {
  t: TransferenciaSugerida
  usuarioId: string
  onAccionar: (t: TransferenciaSugerida) => void
}) {
  // Rol del usuario logueado en ESTA transferencia puntual: define el botón.
  // Si no participa (transferencia entre otras dos personas del grupo), queda
  // igual de activo — cualquier miembro puede registrarla — con el estilo
  // neutro de "Marcar como saldado", ya que "Registrar pago" implicaría que
  // la plata sale de la cuenta de quien mira la pantalla.
  const soyElDeudor = usuarioId === t.de.id
  const label = soyElDeudor ? 'Registrar pago' : 'Marcar como saldado'
  const primario = soyElDeudor

  return (
    <div style={{
      background: 'var(--color-surface-white)', border: '1px solid var(--color-border)',
      borderRadius: 18, padding: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Avatar nombre={t.de.nombre} color={t.de.avatar_color} size={38} />
        <svg width="26" height="16" viewBox="0 0 26 16" fill="none" style={{ flexShrink: 0 }}>
          <path d="M2 8h20m0 0l-5-5m5 5l-5 5" stroke="var(--color-text-disabled)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <Avatar nombre={t.a.nombre} color={t.a.avatar_color} size={38} />
        <div style={{ flex: 1, marginLeft: 4, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-secondary)', fontFamily: F_BODY }}>
            <b style={{ color: 'var(--color-text-primary)' }}>{t.de.id === usuarioId ? 'Tú' : t.de.nombre}</b> le paga a{' '}
            <b style={{ color: 'var(--color-text-primary)' }}>{t.a.id === usuarioId ? 'Tú' : t.a.nombre}</b>
          </p>
          <p style={{ margin: '1px 0 0', fontFamily: F_HEAD, fontSize: 16, fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--color-text-primary)' }}>
            {formatCLP(t.monto)}
          </p>
        </div>
      </div>

      <button
        onClick={() => onAccionar(t)}
        style={{
          width: '100%', height: 44, borderRadius: 12, border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          marginTop: 14, cursor: 'pointer',
          background: primario ? 'var(--gradient-cta)' : 'var(--tint-cta)',
          boxShadow: primario ? 'var(--shadow-cta)' : 'none',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
          <path
            d="M4 10l4 4 8-9"
            stroke={primario ? '#fff' : 'var(--color-cta-dark)'}
            strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
          />
        </svg>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: primario ? '#fff' : 'var(--color-cta-dark)', fontFamily: F_BODY }}>
          {label}
        </span>
      </button>
    </div>
  )
}

// ── Cadenas canceladas ─────────────────────────────────────────

function ListaConY({ items }: { items: React.ReactNode[] }) {
  return (
    <>
      {items.map((item, i) => (
        <span key={i}>
          {i > 0 && (i === items.length - 1 ? ' y ' : ', ')}
          {item}
        </span>
      ))}
    </>
  )
}

function Fuerte({ children }: { children: React.ReactNode }) {
  return <b style={{ color: 'var(--color-text-primary)' }}>{children}</b>
}

function tituloCadena(cadena: CadenaCancelada, usuarioId: string): React.ReactNode {
  const soyParte = cadena.participantes.some(p => p.id === usuarioId)
  const otros = cadena.participantes.filter(p => p.id !== usuarioId)
  const items: React.ReactNode[] = otros.map(p => <Fuerte key={p.id}>{p.nombre}</Fuerte>)
  if (soyParte) items.push(<Fuerte key="vos">vos</Fuerte>)
  return <>Cuentas entre <ListaConY items={items} /> saldadas</>
}

function subtituloCadena(cadena: CadenaCancelada): string {
  if (cadena.montosIguales) {
    const n = cadena.aristas.length
    return `${n} deuda${n === 1 ? '' : 's'} de ${formatCLP(cadena.aristas[0].monto)} se anulan entre sí`
  }
  return `${formatCLP(cadena.montoTotalCancelado)} en deudas cruzadas se cancelan`
}

function fraseArista(arista: { de: UsuarioMini; a: UsuarioMini; monto: number }, usuarioId: string): React.ReactNode {
  const monto = <Fuerte>{formatCLP(arista.monto)}</Fuerte>
  if (arista.de.id === usuarioId) return <>le debías {monto} a <Fuerte>{arista.a.nombre}</Fuerte></>
  if (arista.a.id === usuarioId) return <><Fuerte>{arista.de.nombre}</Fuerte> te debía {monto}</>
  return <><Fuerte>{arista.de.nombre}</Fuerte> le debía {monto} a <Fuerte>{arista.a.nombre}</Fuerte></>
}

function CadenaRow({ cadena, usuarioId, expandida, onToggle }: {
  cadena: CadenaCancelada
  usuarioId: string
  expandida: boolean
  onToggle: () => void
}) {
  return (
    <div style={{
      background: 'var(--color-bg)', border: '1.5px dashed var(--color-border)', borderRadius: 18,
      padding: expandida ? '11px 14px 14px' : '11px 14px',
    }}>
      <button
        onClick={onToggle}
        style={{
          background: 'none', border: 'none', padding: 0, margin: 0, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 11, width: '100%', textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', flexShrink: 0 }}>
          {cadena.participantes.map((p, i) => (
            <div key={p.id} style={{ marginLeft: i === 0 ? 0 : -10, borderRadius: '50%', boxShadow: '0 0 0 2.5px var(--color-bg)' }}>
              <Avatar nombre={p.nombre} color={p.avatar_color} size={30} />
            </div>
          ))}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--color-text-secondary)', fontFamily: F_BODY, lineHeight: 1.4 }}>
            {tituloCadena(cadena, usuarioId)}
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--color-text-disabled)', fontFamily: F_BODY }}>
            {subtituloCadena(cadena)}
          </p>
        </div>
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0, transform: expandida ? 'rotate(180deg)' : 'none', transition: 'transform 150ms ease' }}>
          <path d="M6 8l4 4 4-4" stroke="var(--color-text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {expandida && (
        <div style={{ background: 'var(--color-surface-white)', border: '1px solid var(--color-border)', borderRadius: 14, padding: 14, marginTop: 12 }}>
          <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: F_BODY }}>
            La cadena se cierra sobre sí misma
          </p>
          <div style={{ marginTop: 12 }}>
            {cadena.aristas.map((a, i) => (
              <div key={i}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <Avatar nombre={a.de.nombre} color={a.de.avatar_color} size={26} />
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: F_BODY, flex: 1 }}>
                    {fraseArista(a, usuarioId)}
                  </p>
                </div>
                {i < cadena.aristas.length - 1 && (
                  <div style={{ width: 1.5, height: 12, background: 'var(--color-divider)', marginLeft: 12.5 }} />
                )}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 13, paddingTop: 12, borderTop: '1px solid var(--color-divider)' }}>
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
              <circle cx="10" cy="10" r="8.5" stroke="var(--color-positive)" strokeWidth="1.6" />
              <path d="M6 10.3l2.7 2.7L14 7.6" stroke="var(--color-positive)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.5, color: 'var(--color-text-secondary)', fontFamily: F_BODY }}>
              La plata vuelve al mismo lugar, así que las {cadena.aristas.length} deudas se anulan entre sí. <Fuerte>Nadie transfiere nada</Fuerte> y ninguna queda pendiente.
            </p>
          </div>
          <Link
            href={`/historial?personas=${cadena.participantes.map(p => p.id).join(',')}`}
            style={{
              height: 38, borderRadius: 11, background: 'var(--color-icon-bg)', border: '1px solid var(--color-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 12, textDecoration: 'none',
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', fontFamily: F_BODY }}>
              Ver los gastos de esta cadena
            </span>
          </Link>
        </div>
      )}
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────

export default function CierrePage() {
  return (
    <Suspense>
      <CierreInner />
    </Suspense>
  )
}

function CierreInner() {
  const router = useRouter()
  const params = useSearchParams()

  const [fase, setFase] = useState<'cargando' | 'elegir-grupo' | 'ok'>('cargando')
  const [grupos, setGrupos] = useState<GrupoOpcion[]>([])
  const [grupoId, setGrupoId] = useState<string | null>(null)
  const [usuarioId, setUsuarioId] = useState<string | null>(null)

  const [resumen, setResumen] = useState<ResumenCierre | null>(null)
  const [cargandoDatos, setCargandoDatos] = useState(true)
  const [totalInicial, setTotalInicial] = useState<number | null>(null)
  const [exito, setExito] = useState(false)

  const [modo, setModoState] = useState<Modo>('bilateral')
  const [procesandoCadenas, setProcesandoCadenas] = useState(false)
  const [cadenaExpandida, setCadenaExpandida] = useState<string | null>(null)
  // "Recibo" de las cadenas que se acaban de cancelar en ESTE toggle a
  // Completa — separado de `resumen.completa.cadenas` (que siempre refleja
  // el estado LIVE en la base) justamente para no confundir "qué mostrar" con
  // "qué falta escribir": si se usara `resumen` para ambas cosas, alternar
  // Bilateral↔Completa reprocesaría (y duplicaría) las mismas cancelaciones
  // cada vez, porque el recibo nunca las dejaría ver como ya resueltas.
  const [cadenasRecibo, setCadenasRecibo] = useState<CadenaCancelada[] | null>(null)

  const [pagando, setPagando] = useState<TransferenciaSugerida | null>(null)
  const [toast, setToast] = useState<{ mensaje: string; tipo: 'exito' | 'error' } | null>(null)

  useEffect(() => {
    let activo = true
    async function cargar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }
      if (!activo) return
      setUsuarioId(user.id)

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

  const cargarResumen = useCallback(async () => {
    if (!grupoId) return
    setCargandoDatos(true)
    const r = await calcularResumenCierre(grupoId)
    setResumen(r)
    setTotalInicial(prev => (prev === null && r.hayPendientes ? r.totalPeriodo : prev))
    setCargandoDatos(false)
  }, [grupoId])

  useEffect(() => {
    if (fase !== 'ok' || !grupoId) return
    cargarResumen()
  }, [fase, grupoId, cargarResumen])

  // Revisa si con lo que acaba de pasar (un pago individual o una tanda de
  // cancelaciones de cadena) ya no queda nada pendiente en el grupo — de ser
  // así, dispara el cierre automático del período.
  async function revisarCompletitud(r: ResumenCierre) {
    if (r.hayPendientes || !grupoId) return
    const total = totalInicial ?? r.totalPeriodo
    const res = await registrarCierreCompleto(grupoId, total)
    if (!res.ok) { setToast({ mensaje: res.error, tipo: 'error' }); return }
    setExito(true)
  }

  async function handlePagoConfirmado() {
    setPagando(null)
    if (!grupoId) return

    const r = await calcularResumenCierre(grupoId)
    setResumen(r)

    if (!r.hayPendientes) {
      await revisarCompletitud(r)
    } else {
      setToast({ mensaje: 'Transferencia saldada ✓', tipo: 'exito' })
    }
  }

  // Cambiar a "Completa" dispara automáticamente el guardado de las cadenas
  // detectadas en ESE momento (solo al tocar el toggle, no en cada
  // re-render). Es idempotente: una vez saldadas, esas divisiones dejan de
  // ser saldado=false y el algoritmo simplemente no las vuelve a ver — si no
  // hay cadenas nuevas, no se escribe nada.
  async function setModo(nuevoModo: Modo) {
    setCadenaExpandida(null)

    if (nuevoModo === 'bilateral') {
      setModoState('bilateral')
      return
    }

    setModoState('completa')

    // `resumen.completa.cadenas` siempre refleja lo que hay LIVE en la base
    // en este instante — si ya está vacío (porque una pasada anterior ya las
    // escribió, o porque nunca hubo cadenas) no hay nada que procesar: se
    // limpia el recibo viejo y listo, sin volver a escribir nada.
    if (!resumen || resumen.completa.cadenas.length === 0 || !grupoId) {
      setCadenasRecibo(null)
      return
    }

    setProcesandoCadenas(true)
    const cadenasAConfirmar = resumen.completa.cadenas
    const res = await confirmarCancelacionesCadena(grupoId, cadenasAConfirmar)

    if (!res.ok) {
      setProcesandoCadenas(false)
      setToast({ mensaje: res.error, tipo: 'error' })
      return
    }

    // Recarga limpia (sin pisar nada): esas divisiones ya son saldado=true,
    // así que `r2.completa.cadenas` va a venir vacío — el recibo de lo que
    // se acaba de cancelar se guarda aparte, solo para esta vista.
    const r2 = await calcularResumenCierre(grupoId)
    setResumen(r2)
    setCadenasRecibo(cadenasAConfirmar)
    setTotalInicial(prev => (prev === null && r2.hayPendientes ? r2.totalPeriodo : prev))
    setProcesandoCadenas(false)

    await revisarCompletitud(r2)
  }

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
            ¿Qué grupo querés cerrar?
          </h1>
          <p style={{ margin: '6px 0 20px', fontSize: 13.5, color: 'var(--color-text-secondary)', fontFamily: F_BODY }}>
            Pertenecés a más de un grupo.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {grupos.map(g => (
              <Link
                key={g.id}
                href={`/cierre?grupo=${g.id}`}
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

  const pct = resumen && resumen.totalPeriodo > 0 ? (resumen.saldadoPeriodo / resumen.totalPeriodo) * 100 : 0
  const listaActiva = resumen ? (modo === 'bilateral' ? resumen.bilateral.transferencias : resumen.completa.transferencias) : []
  const cadenasVisibles = modo === 'completa' ? (cadenasRecibo ?? []) : []
  const totalAristasCanceladas = cadenasVisibles.reduce((s, c) => s + c.aristas.length, 0)

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--color-bg)', paddingBottom: 96 }}>
      <div style={{ maxWidth: 440, margin: '0 auto', padding: '0 18px', paddingTop: 'max(20px, env(safe-area-inset-top, 0px))' }}>

        <div style={{ fontFamily: F_HEAD, fontSize: 23, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--color-text-primary)', marginBottom: 14 }}>
          Cierre de cuentas
        </div>

        {!cargandoDatos && resumen && resumen.hayPendientes && !exito && (
          <>
            <ToggleModo
              modo={modo}
              setModo={setModo}
              countBilateral={resumen.bilateral.transferencias.length}
              countCompleta={resumen.completa.transferencias.length}
              deshabilitado={procesandoCadenas}
            />

            {modo === 'bilateral' ? (
              <p style={{ margin: '10px 2px 0', fontSize: 12, lineHeight: 1.5, color: 'var(--color-text-secondary)', fontFamily: F_BODY }}>
                Cada transferencia corresponde a una deuda directa entre dos personas. Nada se cancela solo.
              </p>
            ) : procesandoCadenas ? (
              <p style={{ margin: '10px 2px 0', fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: F_BODY }}>
                Cancelando cadenas…
              </p>
            ) : cadenasVisibles.length > 0 && (
              <div style={{ display: 'flex', gap: 9, marginTop: 11, padding: '10px 12px', background: 'var(--color-warning-tint)', border: '1px solid var(--color-warning-border)', borderRadius: 13 }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                  <path d="M12 8.5v5" stroke="var(--color-warning)" strokeWidth="2.1" strokeLinecap="round" />
                  <circle cx="12" cy="16.8" r="1.2" fill="var(--color-warning)" />
                  <circle cx="12" cy="12" r="9" stroke="var(--color-warning)" strokeWidth="1.7" />
                </svg>
                <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.5, color: 'var(--color-warning)', fontFamily: F_BODY }}>
                  <b>{totalAristasCanceladas} deuda{totalAristasCanceladas === 1 ? '' : 's'} se saldan sin que se mueva plata</b>: forman una cadena cerrada.
                </p>
              </div>
            )}
          </>
        )}

        {cargandoDatos ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
            {[92, 140, 140].map((h, i) => (
              <div key={i} className="skeleton" style={{ height: h, borderRadius: 18 }} />
            ))}
          </div>
        ) : exito ? (
          <div style={{ marginTop: 14 }}><EstadoExito mes={mesActualStr()} /></div>
        ) : !resumen || !resumen.hayPendientes ? (
          <div style={{ marginTop: 14 }}><EstadoVacio /></div>
        ) : (
          <>
            <Card style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14, margin: '16px 0 20px' }}>
              <DonutProgreso pct={pct} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--color-neutral)', fontFamily: F_BODY }}>
                  Saldado del período
                </p>
                <p style={{ margin: '2px 0 0', fontFamily: F_HEAD, fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--color-text-primary)' }}>
                  {formatCLP(resumen.saldadoPeriodo)}
                </p>
                <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--color-text-muted)', fontFamily: F_BODY }}>
                  de {formatCLP(resumen.totalPeriodo)} total
                </p>
              </div>
            </Card>

            <SectionTitle>{modo === 'bilateral' ? 'Transferencias sugeridas' : 'A transferir'} · {listaActiva.length}</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {listaActiva.map(t => (
                <TransferenciaCard key={t.id} t={t} usuarioId={usuarioId!} onAccionar={setPagando} />
              ))}
            </div>

            {modo === 'completa' && cadenasVisibles.length > 0 && (
              <>
                <div style={{ marginTop: 22 }}>
                  <SectionTitle>
                    Canceladas en cadena · {totalAristasCanceladas}{' '}
                    <span style={{ fontWeight: 600, letterSpacing: 0, textTransform: 'none', color: 'var(--color-text-disabled)' }}>
                      — sin plata de por medio
                    </span>
                  </SectionTitle>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {cadenasVisibles.map(c => (
                    <CadenaRow
                      key={c.id}
                      cadena={c}
                      usuarioId={usuarioId!}
                      expandida={cadenaExpandida === c.id}
                      onToggle={() => setCadenaExpandida(prev => (prev === c.id ? null : c.id))}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      <BottomNav />

      {pagando && (
        <RegistrarPago
          divisiones={pagando.divisiones}
          contraparte={pagando.a}
          miId={pagando.de.id}
          onCerrar={() => setPagando(null)}
          onConfirmado={handlePagoConfirmado}
        />
      )}

      {toast && (
        <Toast mensaje={toast.mensaje} tipo={toast.tipo} onClose={() => setToast(null)} />
      )}
    </main>
  )
}
