'use client'

import { Suspense, useEffect, useState, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { resolverGrupoActivo, type GrupoOpcion } from '@/lib/grupo-activo'
import {
  crearGasto, validarPaso1, validarPaso2, calcularMontosPorPersona,
  listarParticipantesPosibles, listarCuentasActivasGrupo,
  type TipoDivision, type DivisionInput, type CuentaMini,
} from '@/lib/gastos'
import { ICONO_TIPO, listarContactosCompartidos, obtenerUsuarioMini, type UsuarioMini } from '@/lib/cuentas'
import { formatCLP } from '@/lib/format'
import { Avatar } from '@/components/app/Avatar'
import { Toast } from '@/components/app/Toast'
import type { Categoria } from '@/types/database'

// ── Constantes ───────────────────────────────────────────────

const CATEGORIAS: { id: Categoria; emoji: string; label: string }[] = [
  { id: 'super',           emoji: '🛒', label: 'Súper'        },
  { id: 'comida',          emoji: '🍕', label: 'Comida'       },
  { id: 'transporte',      emoji: '🚌', label: 'Transporte'   },
  { id: 'tragos',          emoji: '🍻', label: 'Tragos'       },
  { id: 'regalo',          emoji: '🎁', label: 'Regalo'       },
  { id: 'cumpleanos',      emoji: '🎂', label: 'Cumpleaños'   },
  { id: 'otro',            emoji: '📦', label: 'Otro'         },
]

const TIPOS_DIVISION: { id: TipoDivision; label: string }[] = [
  { id: 'igual',      label: 'Partes iguales' },
  { id: 'exacto',     label: 'Exactos'        },
  { id: 'porcentaje', label: 'Porcentajes'    },
]

const inputBase: React.CSSProperties = {
  background: 'var(--color-surface-white)',
  border: '1px solid var(--color-border)',
  borderRadius: 14,
  height: 52,
  padding: '0 15px',
  fontFamily: 'var(--font-dm-sans), sans-serif',
  fontSize: 14.5,
  fontWeight: 500,
  color: 'var(--color-text-primary)',
  width: '100%',
  outline: 'none',
  boxSizing: 'border-box',
}

function focusInput(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
  e.target.style.borderColor = 'var(--color-cta)'
}
function blurInput(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
  e.target.style.borderColor = 'var(--color-border)'
}

// ── Sub-componentes ──────────────────────────────────────────

function Label({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      style={{
        display: 'block', margin: '0 0 8px',
        fontSize: 11, fontWeight: 700,
        color: 'var(--color-text-muted)',
        fontFamily: 'var(--font-dm-sans), sans-serif',
        textTransform: 'uppercase', letterSpacing: '0.08em',
        cursor: htmlFor ? 'pointer' : 'default',
      }}
    >
      {children}
    </label>
  )
}

function ErrorMsg({ mensaje }: { mensaje: string }) {
  return (
    <p
      role="alert"
      style={{
        margin: '6px 0 0', fontSize: 12,
        color: 'var(--color-negative)',
        fontFamily: 'var(--font-dm-sans), sans-serif',
        display: 'flex', alignItems: 'center', gap: 4,
      }}
    >
      <span aria-hidden="true">⚠</span> {mensaje}
    </p>
  )
}

function Section({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ marginBottom: 22, ...style }}>
      {children}
    </div>
  )
}

function BotonCTA({ onClick, disabled, loading, children }: {
  onClick: () => void; disabled?: boolean; loading?: boolean; children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        width: '100%', height: 54, borderRadius: 15, border: 'none',
        background: (disabled || loading) ? 'var(--color-text-disabled)' : 'var(--gradient-cta)',
        color: 'white', fontSize: 15.5, fontWeight: 700,
        fontFamily: 'var(--font-dm-sans), sans-serif',
        cursor: (disabled || loading) ? 'not-allowed' : 'pointer',
        boxShadow: (disabled || loading) ? 'none' : 'var(--shadow-cta)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        transition: 'transform 120ms ease', marginTop: 8,
      }}
      onPointerDown={e => { if (!disabled && !loading) e.currentTarget.style.transform = 'scale(0.97)' }}
      onPointerUp={e => (e.currentTarget.style.transform = 'scale(1)')}
      onPointerLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
    >
      {loading && <span className="spinner" aria-hidden="true" />}
      {children}
    </button>
  )
}

// ── Tipos ────────────────────────────────────────────────────

export interface CuentaFija {
  id: string
  grupoId: string
  nombre: string
  icono: string | null
}

interface Props {
  /** Si viene de /cuentas/[id]/gastos/nuevo: la cuenta ya está fija, no editable. */
  cuentaFija?: CuentaFija
  /**
   * Gasto aislado, sin grupo — entre "vos" y contactos compartidos (unión de
   * miembros de todos tus grupos), no acotado al grupo activo. Sin selector
   * de cuenta. Mutuamente excluyente con cuentaFija.
   */
  personal?: boolean
}

// ── Componente ───────────────────────────────────────────────

export function NuevoGastoScreen(props: Props) {
  return (
    <Suspense>
      <NuevoGastoScreenInner {...props} />
    </Suspense>
  )
}

function NuevoGastoScreenInner({ cuentaFija, personal }: Props) {
  const router = useRouter()
  const params = useSearchParams()

  const [fase, setFase] = useState<'cargando' | 'elegir-grupo' | 'listo'>('cargando')
  const [grupos, setGrupos] = useState<GrupoOpcion[]>([])
  const [grupoId, setGrupoId] = useState<string | null>(null)
  const [usuarioId, setUsuarioId] = useState<string | null>(null)

  const [cuentasDisponibles, setCuentasDisponibles] = useState<CuentaMini[]>([])
  const [cuentaSeleccionadaId, setCuentaSeleccionadaId] = useState<string | null>(null) // null = sin cuenta

  const [paso, setPaso] = useState<1 | 2>(1)
  const [personas, setPersonas] = useState<UsuarioMini[]>([])
  const [cargandoPersonas, setCargandoPersonas] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [toast, setToast] = useState<{ mensaje: string; tipo: 'exito' | 'error' } | null>(null)
  const [errores, setErrores] = useState<Record<string, string>>({})

  // Paso 1 — datos del gasto
  const [descripcion, setDescripcion] = useState('')
  const [monto, setMonto] = useState(0)
  const [displayMonto, setDisplayMonto] = useState('')
  const [pagadoPor, setPagadoPor] = useState('')
  const [categoria, setCategoria] = useState<Categoria>('comida')
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10))
  const [nota, setNota] = useState('')

  // Paso 2 — división
  const [participantes, setParticipantes] = useState<string[]>([])
  const [tipoDivision, setTipoDivision] = useState<TipoDivision>('igual')
  const [divisionValues, setDivisionValues] = useState<DivisionInput[]>([])

  function handleMontoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, '')
    const numeric = parseInt(digits || '0', 10)
    setMonto(numeric)
    setDisplayMonto(numeric > 0 ? '$' + numeric.toLocaleString('es-CL') : '')
  }

  // ── Resolver usuario + grupo (+ cuentas del grupo si no hay cuenta fija) ──
  useEffect(() => {
    let activo = true

    async function iniciar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }
      if (!activo) return
      setUsuarioId(user.id)

      if (personal) {
        // Gasto aislado: no hay grupo que resolver — participantes salen de
        // los contactos compartidos, no de grupo_miembros/cuenta_miembros.
        setFase('listo')
        return
      }

      if (cuentaFija) {
        setGrupoId(cuentaFija.grupoId)
        setCuentaSeleccionadaId(cuentaFija.id)
        setFase('listo')
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
      const cuentas = await listarCuentasActivasGrupo(resolucion.grupoId)
      if (!activo) return
      setCuentasDisponibles(cuentas)
      setFase('listo')
    }

    iniciar()
    return () => { activo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cuentaFija?.id, personal])

  // ── Cargar personas posibles: cuenta_miembros / grupo_miembros, o —en modo
  // personal— vos + contactos compartidos de todos tus grupos ──
  useEffect(() => {
    if (fase !== 'listo') return
    if (!personal && !grupoId) return
    if (!usuarioId) return
    let activo = true
    setCargandoPersonas(true)

    const cargarLista = personal
      ? Promise.all([obtenerUsuarioMini(usuarioId), listarContactosCompartidos(usuarioId)])
          .then(([yo, contactos]) => (yo ? [yo, ...contactos] : contactos))
      : listarParticipantesPosibles({ cuentaId: cuentaSeleccionadaId, grupoId: grupoId! })

    cargarLista.then(lista => {
      if (!activo) return
      setPersonas(lista)
      setParticipantes(lista.map(p => p.id))
      setDivisionValues(lista.map(p => ({ usuario_id: p.id, valor: 0 })))
      setPagadoPor(prev => {
        if (prev && lista.some(p => p.id === prev)) return prev
        if (usuarioId && lista.some(p => p.id === usuarioId)) return usuarioId
        return lista[0]?.id ?? ''
      })
      setCargandoPersonas(false)
    })

    return () => { activo = false }
  }, [fase, grupoId, cuentaSeleccionadaId, usuarioId, personal])

  // Recalcular divisionValues al cambiar participantes o tipo
  useEffect(() => {
    setDivisionValues(
      participantes.map(id => ({ usuario_id: id, valor: tipoDivision === 'porcentaje' ? Math.round(100 / participantes.length) : 0 }))
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participantes, tipoDivision])

  const preview = useMemo(() => {
    if (monto <= 0 || participantes.length === 0) return {}
    return calcularMontosPorPersona(monto, tipoDivision, participantes, divisionValues)
  }, [monto, tipoDivision, participantes, divisionValues])

  const sumaValores = divisionValues.reduce((s, d) => s + (d.valor || 0), 0)
  const cuadrado = tipoDivision === 'porcentaje' ? sumaValores === 100 : sumaValores === monto

  function toggleParticipante(id: string) {
    setParticipantes(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    )
  }

  function setDivisionValor(id: string, valor: number) {
    setDivisionValues(prev => prev.map(d => d.usuario_id === id ? { ...d, valor } : d))
  }

  function handleSiguiente() {
    const errs = validarPaso1({ descripcion, monto_total: monto, pagado_por: pagadoPor })
    if (errs.length > 0) {
      const map: Record<string, string> = {}
      errs.forEach(e => { map[e.campo] = e.mensaje })
      setErrores(map)
      return
    }
    setErrores({})
    setPaso(2)
    window.scrollTo(0, 0)
  }

  function resetearParaOtroGasto() {
    setDescripcion('')
    setMonto(0)
    setDisplayMonto('')
    setCategoria('comida')
    setFecha(new Date().toISOString().slice(0, 10))
    setNota('')
    setTipoDivision('igual')
    setParticipantes(personas.map(p => p.id))
    setPagadoPor(usuarioId && personas.some(p => p.id === usuarioId) ? usuarioId : (personas[0]?.id ?? ''))
    setPaso(1)
    window.scrollTo(0, 0)
  }

  async function handleGuardar() {
    const errs = validarPaso2(monto, tipoDivision, participantes, divisionValues)
    if (errs.length > 0) {
      const map: Record<string, string> = {}
      errs.forEach(e => { map[e.campo] = e.mensaje })
      setErrores(map)
      return
    }
    setErrores({})
    setGuardando(true)

    const cuentaIdFinal = cuentaFija ? cuentaFija.id : cuentaSeleccionadaId

    const result = await crearGasto({
      grupo_id:      personal ? null : grupoId!,
      cuenta_id:     personal ? null : cuentaIdFinal,
      descripcion,
      monto_total:   monto,
      pagado_por:    pagadoPor,
      categoria,
      fecha,
      nota,
      creado_por:    usuarioId!,
      tipo_division: tipoDivision,
      participantes,
      divisiones:    divisionValues,
    })

    setGuardando(false)

    if (!result.ok) {
      setToast({ mensaje: result.error, tipo: 'error' })
      return
    }

    setToast({ mensaje: '¡Gasto guardado! 🎉', tipo: 'exito' })

    if (personal) {
      setTimeout(() => router.push('/historial?tab=personal'), 1400)
    } else if (cuentaIdFinal) {
      setTimeout(() => router.push(`/cuentas/${cuentaIdFinal}`), 1400)
    } else {
      // Gasto suelto (sin cuenta, pero dentro de un grupo): no hay todavía
      // una pantalla que lo liste, así que nos quedamos en el formulario
      // listo para cargar el siguiente.
      setTimeout(resetearParaOtroGasto, 1000)
    }
  }

  function volver() {
    if (paso === 2) { setPaso(1); return }
    if (cuentaFija) { router.push(`/cuentas/${cuentaFija.id}`); return }
    router.back()
  }

  // ── RENDER ────────────────────────────────────────────────

  if (fase === 'cargando') {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
        <p style={{ padding: 24, fontSize: 13.5, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>Cargando…</p>
      </div>
    )
  }

  if (fase === 'elegir-grupo') {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
        <div style={{ maxWidth: 440, margin: '0 auto', padding: '0 18px', paddingTop: 'max(24px, env(safe-area-inset-top, 0px))' }}>
          <h1 style={{ margin: 0, fontFamily: 'var(--font-sora), sans-serif', fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--color-text-primary)' }}>
            ¿En qué grupo va este gasto?
          </h1>
          <p style={{ margin: '6px 0 20px', fontSize: 13.5, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
            Pertenecés a más de un grupo.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {grupos.map(g => (
              <Link
                key={g.id}
                href={`/gastos/nuevo?grupo=${g.id}`}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'var(--color-surface-white)', border: '1px solid var(--color-border)',
                  borderRadius: 16, padding: '16px 18px', textDecoration: 'none',
                }}
              >
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>{g.nombre}</span>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="var(--color-cta)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </Link>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (personal && !cargandoPersonas && personas.length <= 1) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
        <div style={{ maxWidth: 440, margin: '0 auto', padding: '0 18px', paddingTop: 'max(24px, env(safe-area-inset-top, 0px))' }}>
          <button
            onClick={() => router.back()}
            aria-label="Volver"
            style={{
              background: 'var(--color-surface-white)', border: '1px solid var(--color-border)',
              borderRadius: 13, width: 42, height: 42, padding: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M11 4l-5 5 5 5" stroke="var(--color-text-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div style={{ textAlign: 'center', marginTop: 70 }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🤝</div>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
              Todavía no compartís un grupo con nadie
            </p>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-dm-sans), sans-serif', lineHeight: 1.5 }}>
              Para armar un gasto entre ustedes, primero necesitás compartir al menos un grupo con esa persona.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', paddingBottom: 40 }}>

      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <header style={{
          paddingTop: 'max(56px, calc(env(safe-area-inset-top, 0px) + 16px))',
          paddingBottom: 18,
          paddingLeft: 'var(--page-px)',
          paddingRight: 'var(--page-px)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <button
            onClick={volver}
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

          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{
              margin: 0, fontSize: 19, fontWeight: 700, color: 'var(--color-text-primary)',
              fontFamily: 'var(--font-sora), sans-serif', letterSpacing: '-0.01em',
            }}>
              {paso === 1 ? 'Nuevo gasto' : 'Cómo se divide'}
            </h1>
            <p style={{ margin: '1px 0 0', fontSize: 12, color: 'var(--color-neutral)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
              {paso === 1
                ? (cuentaFija ? `${cuentaFija.icono ?? ''} ${cuentaFija.nombre}` : 'Paso 1 de 2 · ¿Cuánto y qué?')
                : `Paso 2 de 2 · ${formatCLP(monto)} entre ${participantes.length}`}
            </p>
          </div>

          <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
            {[1, 2].map(n => (
              <span key={n} style={{
                width: n === paso ? 22 : 10, height: 5, borderRadius: 3,
                background: n <= paso ? 'var(--color-cta)' : '#DEDEE6',
                transition: 'width 250ms ease, background 250ms ease',
              }} />
            ))}
          </div>
        </header>

        <main style={{ padding: '0 var(--page-px)' }}>

          {/* ════════════════════════════════════════ PASO 1 */}
          {paso === 1 && (
            <>
              {/* Monto — prominente */}
              <Section>
                <div style={{
                  background: 'var(--color-surface-white)', border: '1px solid var(--color-border)',
                  borderRadius: 18, padding: '22px 20px', textAlign: 'center',
                }}>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--color-neutral)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
                    ¿Cuánto fue?
                  </p>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 6, marginTop: 8 }}>
                    <input
                      id="input-monto"
                      type="text"
                      inputMode="numeric"
                      placeholder="$0"
                      autoComplete="off"
                      value={displayMonto}
                      onChange={handleMontoChange}
                      aria-invalid={!!errores.monto}
                      aria-describedby={errores.monto ? 'error-monto' : undefined}
                      style={{
                        border: 'none', outline: 'none', background: 'transparent',
                        fontFamily: 'var(--font-sora), sans-serif', fontSize: 40, fontWeight: 800,
                        letterSpacing: '-0.03em', color: 'var(--color-text-primary)',
                        textAlign: 'center', width: '100%', padding: 0,
                      }}
                    />
                    {monto > 0 && <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-muted)', flexShrink: 0 }}>CLP</span>}
                  </div>
                </div>
                {errores.monto && <ErrorMsg mensaje={errores.monto} />}
              </Section>

              {/* Descripción */}
              <Section>
                <Label htmlFor="input-descripcion">Descripción</Label>
                <input
                  id="input-descripcion"
                  type="text"
                  placeholder="¿En qué se gastó?"
                  value={descripcion}
                  onChange={e => setDescripcion(e.target.value)}
                  aria-invalid={!!errores.descripcion}
                  style={inputBase}
                  onFocus={focusInput}
                  onBlur={blurInput}
                />
                {errores.descripcion && <ErrorMsg mensaje={errores.descripcion} />}
              </Section>

              {/* Categoría */}
              <Section>
                <Label>Categoría</Label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {CATEGORIAS.map(c => {
                    const activo = categoria === c.id
                    return (
                      <button
                        key={c.id}
                        onClick={() => setCategoria(c.id)}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          padding: '8px 13px', borderRadius: 100,
                          background: activo ? 'var(--tint-cta)' : 'var(--color-surface-white)',
                          border: activo ? '1px solid var(--border-cta)' : '1px solid var(--color-border)',
                          color: activo ? 'var(--color-cta-dark)' : 'var(--color-text-secondary)',
                          fontSize: 13, fontWeight: activo ? 600 : 500,
                          fontFamily: 'var(--font-dm-sans), sans-serif',
                          cursor: 'pointer', transition: 'all 150ms ease',
                          WebkitTapHighlightColor: 'transparent',
                        }}
                      >
                        <span>{c.emoji}</span> {c.label}
                      </button>
                    )
                  })}
                </div>
              </Section>

              {/* ¿A qué cuenta pertenece? — solo si no vino ya fija ni es un gasto aislado */}
              {!cuentaFija && !personal && (
                <Section>
                  <Label>¿A qué cuenta pertenece?</Label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <button
                      onClick={() => setCuentaSeleccionadaId(null)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '8px 13px', borderRadius: 100,
                        background: cuentaSeleccionadaId === null ? 'var(--tint-cta)' : 'var(--color-surface-white)',
                        border: cuentaSeleccionadaId === null ? '1px solid var(--border-cta)' : '1px solid var(--color-border)',
                        color: cuentaSeleccionadaId === null ? 'var(--color-cta-dark)' : 'var(--color-text-secondary)',
                        fontSize: 13, fontWeight: cuentaSeleccionadaId === null ? 600 : 500,
                        fontFamily: 'var(--font-dm-sans), sans-serif',
                        cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
                      }}
                    >
                      Sin cuenta (gasto suelto)
                    </button>
                    {cuentasDisponibles.map(c => {
                      const activo = cuentaSeleccionadaId === c.id
                      return (
                        <button
                          key={c.id}
                          onClick={() => setCuentaSeleccionadaId(c.id)}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            padding: '8px 13px', borderRadius: 100,
                            background: activo ? 'var(--tint-cta)' : 'var(--color-surface-white)',
                            border: activo ? '1px solid var(--border-cta)' : '1px solid var(--color-border)',
                            color: activo ? 'var(--color-cta-dark)' : 'var(--color-text-secondary)',
                            fontSize: 13, fontWeight: activo ? 600 : 500,
                            fontFamily: 'var(--font-dm-sans), sans-serif',
                            cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
                          }}
                        >
                          <span>{c.icono ?? ICONO_TIPO[c.tipo as keyof typeof ICONO_TIPO] ?? '🗂️'}</span> {c.nombre}
                        </button>
                      )
                    })}
                  </div>
                </Section>
              )}

              {/* ¿Quién pagó? */}
              <Section>
                <Label>¿Quién pagó?</Label>
                {cargandoPersonas ? (
                  <div className="skeleton" style={{ height: 48, borderRadius: 14 }} />
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
                    {personas.map(p => {
                      const activo = pagadoPor === p.id
                      return (
                        <button
                          key={p.id}
                          onClick={() => setPagadoPor(p.id)}
                          style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                            background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
                            WebkitTapHighlightColor: 'transparent',
                          }}
                        >
                          <span style={{ borderRadius: '50%', boxShadow: activo ? '0 0 0 2px #fff, 0 0 0 4px var(--color-cta)' : 'none' }}>
                            <Avatar nombre={p.nombre} color={p.avatar_color} size={48} />
                          </span>
                          <span style={{
                            fontSize: 11, fontWeight: activo ? 700 : 400,
                            color: activo ? 'var(--color-text-primary)' : 'var(--color-neutral)',
                            fontFamily: 'var(--font-dm-sans), sans-serif',
                          }}>
                            {p.id === usuarioId ? 'Tú' : p.nombre}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
                {errores.pagado_por && <ErrorMsg mensaje={errores.pagado_por} />}
              </Section>

              {/* Fecha */}
              <Section>
                <Label>Fecha</Label>
                <input
                  type="date"
                  value={fecha}
                  onChange={e => setFecha(e.target.value)}
                  style={inputBase}
                  onFocus={focusInput}
                  onBlur={blurInput}
                />
              </Section>

              {/* Nota */}
              <Section>
                <Label>Nota (opcional)</Label>
                <textarea
                  placeholder="Detalles adicionales…"
                  value={nota}
                  onChange={e => setNota(e.target.value)}
                  rows={2}
                  style={{
                    ...inputBase,
                    height: 'auto',
                    padding: '14px 15px',
                    resize: 'none',
                    lineHeight: 1.5,
                  }}
                  onFocus={focusInput}
                  onBlur={blurInput}
                />
              </Section>

              <BotonCTA onClick={handleSiguiente}>
                Continuar
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M7 4l5 5-5 5" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </BotonCTA>
            </>
          )}

          {/* ════════════════════════════════════════ PASO 2 */}
          {paso === 2 && (
            <>
              {/* Segmentado tipo de división */}
              <div style={{
                display: 'flex', background: 'var(--color-card-light)', borderRadius: 12,
                padding: 4, gap: 3, marginBottom: 16,
              }}>
                {TIPOS_DIVISION.map(t => {
                  const activo = tipoDivision === t.id
                  return (
                    <button
                      key={t.id}
                      onClick={() => setTipoDivision(t.id)}
                      style={{
                        flex: 1, textAlign: 'center', padding: '9px 0', borderRadius: 9, border: 'none',
                        background: activo ? 'var(--color-cta)' : 'transparent',
                        color: activo ? 'white' : 'var(--color-text-secondary)',
                        fontSize: 12.5, fontWeight: activo ? 700 : 600,
                        fontFamily: 'var(--font-dm-sans), sans-serif',
                        cursor: 'pointer', transition: 'all 150ms ease',
                        boxShadow: activo ? '0 2px 6px -1px rgba(124,107,240,.4)' : 'none',
                        WebkitTapHighlightColor: 'transparent',
                      }}
                    >
                      {t.label}
                    </button>
                  )
                })}
              </div>

              {/* Incluir a */}
              <Section>
                <Label>Incluir a</Label>
                <div style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 18, padding: '4px 16px' }}>
                  {personas.map((p, idx) => {
                    const incluido = participantes.includes(p.id)
                    const montoPreview = preview[p.id] ?? 0
                    return (
                      <button
                        key={p.id}
                        onClick={() => toggleParticipante(p.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                          padding: '13px 0', border: 'none', background: 'transparent',
                          borderBottom: idx === personas.length - 1 ? 'none' : '1px solid var(--color-divider)',
                          cursor: 'pointer', textAlign: 'left', opacity: incluido ? 1 : 0.5,
                          WebkitTapHighlightColor: 'transparent',
                        }}
                      >
                        <Avatar nombre={p.nombre} color={p.avatar_color} size={38} />
                        <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
                          {p.nombre}
                        </span>
                        {incluido ? (
                          <span style={{ fontFamily: 'var(--font-sora), sans-serif', fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                            {formatCLP(montoPreview)}
                          </span>
                        ) : (
                          <span style={{ fontSize: 12.5, color: 'var(--color-text-muted)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
                            No incluida
                          </span>
                        )}
                        <span style={{
                          width: 24, height: 24, borderRadius: 8, marginLeft: 12, flexShrink: 0,
                          background: incluido ? 'var(--color-cta)' : 'transparent',
                          border: incluido ? 'none' : '1.6px solid #D6D6DE',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {incluido && (
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                              <path d="M3 7l3 3 5-6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </span>
                      </button>
                    )
                  })}
                </div>
                {errores.participantes && <ErrorMsg mensaje={errores.participantes} />}
              </Section>

              {/* Inputs de división — exactos/porcentajes */}
              {tipoDivision !== 'igual' && (
                <Section>
                  <Label>Montos por persona</Label>
                  <div className="division-list">
                    {participantes.map(id => {
                      const persona = personas.find(p => p.id === id)
                      if (!persona) return null
                      const montoPreview = preview[id] ?? 0
                      const divVal = divisionValues.find(d => d.usuario_id === id)

                      return (
                        <div key={id} style={{
                          background: 'var(--color-card)', border: '1px solid var(--color-border)',
                          borderRadius: 16, padding: '12px 14px',
                          display: 'flex', alignItems: 'center', gap: 12,
                        }}>
                          <Avatar nombre={persona.nombre} color={persona.avatar_color} size={32} />
                          <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
                            {persona.nombre}
                          </span>

                          {tipoDivision === 'exacto' && (
                            <div style={{ position: 'relative', width: 110 }}>
                              <span aria-hidden="true" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', fontSize: 14, fontFamily: 'var(--font-dm-sans), sans-serif' }}>$</span>
                              <input
                                type="text" inputMode="numeric" pattern="[0-9]*"
                                aria-label={`Monto para ${persona.nombre}`}
                                value={divVal?.valor || ''}
                                onChange={e => setDivisionValor(id, parseFloat(e.target.value) || 0)}
                                placeholder="0"
                                style={{ ...inputBase, height: 38, paddingLeft: 22, paddingRight: 8, fontSize: 14, fontWeight: 600, borderRadius: 10, textAlign: 'right' }}
                                onFocus={focusInput} onBlur={blurInput}
                              />
                            </div>
                          )}

                          {tipoDivision === 'porcentaje' && (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, width: 90 }}>
                              <div style={{ position: 'relative', width: '100%' }}>
                                <input
                                  type="text" inputMode="decimal"
                                  aria-label={`Porcentaje para ${persona.nombre}`}
                                  value={divVal?.valor || ''}
                                  onChange={e => setDivisionValor(id, parseFloat(e.target.value) || 0)}
                                  placeholder="0"
                                  style={{ ...inputBase, height: 38, paddingRight: 22, paddingLeft: 8, fontSize: 14, fontWeight: 600, borderRadius: 10, textAlign: 'right' }}
                                  onFocus={focusInput} onBlur={blurInput}
                                />
                                <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', fontSize: 13, pointerEvents: 'none' }}>%</span>
                              </div>
                              <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
                                {formatCLP(montoPreview)}
                              </span>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </Section>
              )}

              {/* Banner de cuadre */}
              <div style={{
                marginBottom: 16, borderRadius: 14, padding: '14px 16px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: cuadrado ? 'var(--tint-cta)' : 'var(--color-negative-tint)',
                border: `1px solid ${cuadrado ? 'var(--border-cta)' : 'var(--color-negative-border)'}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  {cuadrado ? (
                    <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8" stroke="var(--color-positive)" strokeWidth="1.6" /><path d="M6.5 10l2.4 2.4L14 7.5" stroke="var(--color-positive)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8" stroke="var(--color-negative)" strokeWidth="1.6" /><path d="M10 6v5M10 13.5v.1" stroke="var(--color-negative)" strokeWidth="1.8" strokeLinecap="round" /></svg>
                  )}
                  <span style={{ fontSize: 13, fontWeight: 600, color: cuadrado ? '#4C3FB0' : 'var(--color-negative)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
                    {cuadrado ? 'Todo cuadra' : 'No cuadra'}
                  </span>
                </div>
                <span style={{ fontFamily: 'var(--font-sora), sans-serif', fontSize: 15, fontWeight: 700, color: cuadrado ? '#4C3FB0' : 'var(--color-negative)' }}>
                  {tipoDivision === 'porcentaje'
                    ? `${sumaValores.toFixed(0)}% / 100%`
                    : `${formatCLP(sumaValores)} / ${formatCLP(monto)}`}
                </span>
              </div>
              {errores.divisiones && <ErrorMsg mensaje={errores.divisiones} />}

              <BotonCTA onClick={handleGuardar} loading={guardando}>
                {!guardando && (
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M4 10l4 4 8-9" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                )}
                {guardando ? 'Guardando…' : 'Guardar gasto'}
              </BotonCTA>
            </>
          )}
        </main>
      </div>

      {toast && (
        <Toast
          mensaje={toast.mensaje}
          tipo={toast.tipo}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}
