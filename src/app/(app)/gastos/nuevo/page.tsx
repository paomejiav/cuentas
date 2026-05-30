'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/lib/session-store'
import { crearGasto, validarPaso1, validarPaso2, calcularMontosPorPersona, type TipoDivision, type DivisionInput } from '@/lib/gastos'
import { formatCLP } from '@/lib/format'
import { Avatar } from '@/components/app/Avatar'
import { Toast } from '@/components/app/Toast'
import { supabase } from '@/lib/supabase'
import type { Integrante, Categoria } from '@/types/database'

// ── Constantes ───────────────────────────────────────────────

const CATEGORIAS: { id: Categoria; emoji: string; label: string }[] = [
  { id: 'comida',          emoji: '🍕', label: 'Comida'       },
  { id: 'transporte',      emoji: '🚌', label: 'Transporte'   },
  { id: 'tragos',          emoji: '🍻', label: 'Tragos'       },
  { id: 'entretenimiento', emoji: '🎬', label: 'Entretención' },
  { id: 'regalo',          emoji: '🎁', label: 'Regalo'       },
  { id: 'cumpleanos',      emoji: '🎂', label: 'Cumpleaños'   },
  { id: 'otro',            emoji: '📦', label: 'Otro'         },
]

const TIPOS_DIVISION: { id: TipoDivision; label: string }[] = [
  { id: 'igual',      label: 'Partes iguales' },
  { id: 'exacto',     label: 'Montos exactos' },
  { id: 'porcentaje', label: 'Porcentajes'    },
]

const inputBase: React.CSSProperties = {
  background: 'var(--color-card-light)',
  border: 'none',
  borderRadius: 14,
  height: 52,
  padding: '0 16px',
  fontFamily: 'var(--font-dm-sans), sans-serif',
  fontSize: 15,
  color: 'var(--color-text-primary)',
  width: '100%',
  outline: 'none',
  boxSizing: 'border-box',
}

// ── Sub-componentes ──────────────────────────────────────────

function Label({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      style={{
        display: 'block', margin: '0 0 8px',
        fontSize: 12, fontWeight: 600,
        color: 'var(--color-text-secondary)',
        fontFamily: 'var(--font-dm-sans), sans-serif',
        textTransform: 'uppercase', letterSpacing: '0.07em',
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
    <div style={{ marginBottom: 24, ...style }}>
      {children}
    </div>
  )
}

// ── Página principal ─────────────────────────────────────────

export default function NuevoGastoPage() {
  const router = useRouter()
  const { sesion, loading: sesionLoading } = useSession()

  // Estado de la UI
  const [paso, setPaso] = useState<1 | 2>(1)
  const [integrantes, setIntegrantes] = useState<Integrante[]>([])
  const [cargandoIntegrantes, setCargandoIntegrantes] = useState(true)
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

  // Cargar integrantes al montar
  useEffect(() => {
    if (!sesion) return
    supabase
      .from('integrantes')
      .select('*')
      .eq('grupo_id', sesion.grupo_id)
      .eq('activo', true)
      .order('nombre')
      .then(({ data }) => {
        if (data) {
          setIntegrantes(data as Integrante[])
          setParticipantes(data.map(i => i.id))
          setPagadoPor(sesion.integrante_id)
          setDivisionValues(data.map(i => ({ integrante_id: i.id, valor: 0 })))
        }
        setCargandoIntegrantes(false)
      })
  }, [sesion])

  // Recalcular divisionValues al cambiar participantes o tipo
  useEffect(() => {
    setDivisionValues(
      participantes.map(id => ({ integrante_id: id, valor: tipoDivision === 'porcentaje' ? Math.round(100 / participantes.length) : 0 }))
    )
  }, [participantes, tipoDivision])

  // Preview de montos en tiempo real
  const preview = useMemo(() => {
    if (monto <= 0 || participantes.length === 0) return {}
    return calcularMontosPorPersona(monto, tipoDivision, participantes, divisionValues)
  }, [monto, tipoDivision, participantes, divisionValues])

  // Suma de valores para mostrar en tiempo real
  const sumaValores = divisionValues.reduce((s, d) => s + (d.valor || 0), 0)

  function toggleParticipante(id: string) {
    setParticipantes(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    )
  }

  function setDivisionValor(id: string, valor: number) {
    setDivisionValues(prev => prev.map(d => d.integrante_id === id ? { ...d, valor } : d))
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

    const result = await crearGasto({
      grupo_id:     sesion!.grupo_id,
      descripcion,
      monto_total:  monto,
      pagado_por:   pagadoPor,
      categoria,
      fecha,
      nota,
      creado_por:   sesion!.integrante_id,
      tipo_division: tipoDivision,
      participantes,
      divisiones:   divisionValues,
    })

    setGuardando(false)

    if (!result.ok) {
      setToast({ mensaje: result.error, tipo: 'error' })
      return
    }

    setToast({ mensaje: '¡Gasto guardado! 🎉', tipo: 'exito' })
    setTimeout(() => router.replace('/dashboard'), 1400)
  }

  if (sesionLoading || !sesion) return null

  // ── RENDER ────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', paddingBottom: 40 }}>

      <div style={{ maxWidth: 640, margin: '0 auto' }}>
      {/* Header */}
      <header style={{
        paddingTop: 'max(56px, calc(env(safe-area-inset-top, 0px) + 16px))',
        paddingBottom: 20,
        paddingLeft: 'var(--page-px)',
        paddingRight: 'var(--page-px)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <button
          onClick={() => paso === 1 ? router.back() : setPaso(1)}
          style={{
            background: 'var(--color-card)',
            border: 'none',
            borderRadius: 12,
            width: 40,
            height: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M11 4L6 9l5 5" stroke="var(--color-text-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <div style={{ flex: 1 }}>
          <p style={{
            margin: 0,
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--color-text-secondary)',
            fontFamily: 'var(--font-dm-sans), sans-serif',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}>
            Paso {paso} de 2
          </p>
          <h1 style={{
            margin: '2px 0 0',
            fontSize: 22,
            fontWeight: 700,
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-lora), serif',
          }}>
            {paso === 1 ? 'Nuevo gasto' : '¿Cómo se divide?'}
          </h1>
        </div>

        {/* Indicador de pasos */}
        <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
          {[1, 2].map(n => (
            <div key={n} style={{
              width: n === paso ? 20 : 8,
              height: 8,
              borderRadius: 4,
              background: n === paso ? 'var(--color-cta)' : 'var(--color-border)',
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
              <Label htmlFor="input-monto">Monto total</Label>
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
                    ...inputBase, height: 64,
                    fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-lora), serif',
                    textAlign: 'center',
                  }}
                  onFocus={e => { e.target.style.outline = '2px solid var(--color-cta)'; e.target.style.background = 'white' }}
                  onBlur={e => { e.target.style.outline = 'none'; e.target.style.background = 'var(--color-card-light)' }}
                />
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
                onFocus={e => { e.target.style.outline = '2px solid var(--color-cta)'; e.target.style.background = 'white' }}
                onBlur={e => { e.target.style.outline = 'none'; e.target.style.background = 'var(--color-card-light)' }}
              />
              {errores.descripcion && <ErrorMsg mensaje={errores.descripcion} />}
            </Section>

            {/* ¿Quién pagó? */}
            <Section>
              <Label>¿Quién pagó?</Label>
              {cargandoIntegrantes ? (
                <div style={{ height: 52, background: 'var(--color-card)', borderRadius: 14 }} />
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {integrantes.map(i => {
                    const activo = pagadoPor === i.id
                    return (
                      <button
                        key={i.id}
                        onClick={() => setPagadoPor(i.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          height: 40,
                          padding: '0 12px 0 8px',
                          borderRadius: 20,
                          border: activo ? '2px solid var(--color-cta)' : '2px solid transparent',
                          background: activo ? 'white' : 'var(--color-card-light)',
                          cursor: 'pointer',
                          transition: 'all 150ms ease',
                          WebkitTapHighlightColor: 'transparent',
                        }}
                      >
                        <Avatar nombre={i.nombre} color={i.avatar_color} size={28} />
                        <span style={{
                          fontSize: 14,
                          fontWeight: activo ? 600 : 400,
                          color: 'var(--color-text-primary)',
                          fontFamily: 'var(--font-dm-sans), sans-serif',
                          whiteSpace: 'nowrap',
                        }}>
                          {i.nombre}{i.id === sesion.integrante_id ? ' (tú)' : ''}
                        </span>
                        {activo && <span style={{ fontSize: 14, marginLeft: 2 }}>✓</span>}
                      </button>
                    )
                  })}
                </div>
              )}
              {errores.pagado_por && <ErrorMsg mensaje={errores.pagado_por} />}
            </Section>

            {/* Categoría */}
            <Section>
              <Label>Categoría</Label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {CATEGORIAS.map(c => {
                  const activo = categoria === c.id
                  return (
                    <button
                      key={c.id}
                      onClick={() => setCategoria(c.id)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                        padding: '10px 4px',
                        borderRadius: 14,
                        border: activo ? '2px solid var(--color-cta)' : '2px solid transparent',
                        background: activo ? 'white' : 'var(--color-card-light)',
                        cursor: 'pointer',
                        transition: 'all 150ms ease',
                        WebkitTapHighlightColor: 'transparent',
                      }}
                    >
                      <span style={{ fontSize: 24 }}>{c.emoji}</span>
                      <span style={{
                        fontSize: 10,
                        fontWeight: activo ? 600 : 400,
                        color: activo ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                        fontFamily: 'var(--font-dm-sans), sans-serif',
                        textAlign: 'center',
                        lineHeight: 1.2,
                      }}>
                        {c.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </Section>

            {/* Fecha */}
            <Section>
              <Label>Fecha</Label>
              <input
                type="date"
                value={fecha}
                onChange={e => setFecha(e.target.value)}
                style={inputBase}
                onFocus={e => { e.target.style.outline = '2px solid var(--color-cta)'; e.target.style.background = 'white' }}
                onBlur={e => { e.target.style.outline = 'none'; e.target.style.background = 'var(--color-card-light)' }}
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
                  padding: '14px 16px',
                  resize: 'none',
                  lineHeight: 1.5,
                }}
                onFocus={e => { e.target.style.outline = '2px solid var(--color-cta)'; e.target.style.background = 'white' }}
                onBlur={e => { e.target.style.outline = 'none'; e.target.style.background = 'var(--color-card-light)' }}
              />
            </Section>

            {/* CTA Siguiente */}
            <button
              onClick={handleSiguiente}
              style={{
                width: '100%',
                height: 56,
                borderRadius: 100,
                background: 'var(--color-cta)',
                color: 'white',
                border: 'none',
                fontSize: 16,
                fontWeight: 600,
                fontFamily: 'var(--font-dm-sans), sans-serif',
                cursor: 'pointer',
                transition: 'transform 120ms ease',
                marginTop: 8,
              }}
              onPointerDown={e => (e.currentTarget.style.transform = 'scale(0.97)')}
              onPointerUp={e => (e.currentTarget.style.transform = 'scale(1)')}
              onPointerLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
            >
              Siguiente →
            </button>
          </>
        )}

        {/* ════════════════════════════════════════ PASO 2 */}
        {paso === 2 && (
          <>
            {/* Resumen del monto */}
            <div style={{
              background: 'var(--color-card)',
              borderRadius: 20,
              padding: '14px 18px',
              marginBottom: 24,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
                  {descripcion || 'Sin descripción'}
                </p>
                <p style={{
                  margin: '2px 0 0',
                  fontSize: 22,
                  fontWeight: 700,
                  color: 'var(--color-text-primary)',
                  fontFamily: 'var(--font-lora), serif',
                }}>
                  {formatCLP(monto)}
                </p>
              </div>
              <span style={{ fontSize: 28 }}>
                {CATEGORIAS.find(c => c.id === categoria)?.emoji}
              </span>
            </div>

            {/* Participantes */}
            <Section>
              <Label>¿Quiénes participan?</Label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {integrantes.map(i => {
                  const activo = participantes.includes(i.id)
                  return (
                    <button
                      key={i.id}
                      onClick={() => toggleParticipante(i.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 14px 8px 10px',
                        borderRadius: 100,
                        border: activo ? '2px solid var(--color-cta)' : '2px solid var(--color-border)',
                        background: activo ? 'white' : 'var(--color-card-light)',
                        cursor: 'pointer',
                        transition: 'all 150ms ease',
                        WebkitTapHighlightColor: 'transparent',
                      }}
                    >
                      <Avatar nombre={i.nombre} color={i.avatar_color} size={28} />
                      <span style={{
                        fontSize: 13,
                        fontWeight: activo ? 600 : 400,
                        color: activo ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                        fontFamily: 'var(--font-dm-sans), sans-serif',
                      }}>
                        {i.nombre}
                      </span>
                    </button>
                  )
                })}
              </div>
              {errores.participantes && <ErrorMsg mensaje={errores.participantes} />}
            </Section>

            {/* Tipo de división */}
            <Section>
              <Label>Tipo de división</Label>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 8,
                background: 'var(--color-card-light)',
                borderRadius: 16,
                padding: 4,
              }}>
                {TIPOS_DIVISION.map(t => {
                  const activo = tipoDivision === t.id
                  return (
                    <button
                      key={t.id}
                      onClick={() => setTipoDivision(t.id)}
                      style={{
                        padding: '10px 4px',
                        borderRadius: 12,
                        border: 'none',
                        background: activo ? 'white' : 'transparent',
                        color: activo ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                        fontSize: 12,
                        fontWeight: activo ? 600 : 400,
                        fontFamily: 'var(--font-dm-sans), sans-serif',
                        cursor: 'pointer',
                        transition: 'all 150ms ease',
                        boxShadow: activo ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                        WebkitTapHighlightColor: 'transparent',
                      }}
                    >
                      {t.label}
                    </button>
                  )
                })}
              </div>
            </Section>

            {/* Preview / inputs de división */}
            <Section>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                <Label>División</Label>
                {tipoDivision !== 'igual' && (
                  <span style={{ fontSize: 12, color: sumaValores === (tipoDivision === 'porcentaje' ? 100 : monto) ? 'var(--color-positive)' : 'var(--color-negative)', fontFamily: 'var(--font-dm-sans), sans-serif', fontWeight: 600 }}>
                    {tipoDivision === 'porcentaje'
                      ? `${sumaValores.toFixed(0)}% / 100%`
                      : `${formatCLP(sumaValores)} / ${formatCLP(monto)}`}
                  </span>
                )}
              </div>

              <div className="division-list">
                {participantes.map(id => {
                  const integrante = integrantes.find(i => i.id === id)
                  if (!integrante) return null
                  const montoPreview = preview[id] ?? 0
                  const divVal = divisionValues.find(d => d.integrante_id === id)

                  return (
                    <div key={id} style={{
                      background: 'var(--color-card)',
                      borderRadius: 16,
                      padding: '12px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                    }}>
                      <Avatar nombre={integrante.nombre} color={integrante.avatar_color} size={36} />

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
                          {integrante.nombre}
                        </p>
                        {tipoDivision === 'igual' && (
                          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
                            {formatCLP(montoPreview)}
                          </p>
                        )}
                      </div>

                      {tipoDivision === 'exacto' && (
                        <div style={{ position: 'relative', width: 110 }}>
                          <span aria-hidden="true" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-secondary)', fontSize: 14, fontFamily: 'var(--font-dm-sans), sans-serif' }}>$</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            aria-label={`Monto para ${integrante.nombre}`}
                            value={divVal?.valor || ''}
                            onChange={e => setDivisionValor(id, parseFloat(e.target.value) || 0)}
                            placeholder="0"
                            style={{
                              ...inputBase,
                              height: 40,
                              paddingLeft: 22,
                              paddingRight: 8,
                              fontSize: 14,
                              fontWeight: 600,
                              borderRadius: 10,
                              width: '100%',
                              textAlign: 'right',
                            }}
                            onFocus={e => { e.target.style.outline = '2px solid var(--color-cta)'; e.target.style.background = 'white' }}
                            onBlur={e => { e.target.style.outline = 'none'; e.target.style.background = 'var(--color-card-light)' }}
                          />
                        </div>
                      )}

                      {tipoDivision === 'porcentaje' && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, width: 90 }}>
                          <div style={{ position: 'relative', width: '100%' }}>
                            <input
                              type="text"
                              inputMode="decimal"
                              aria-label={`Porcentaje para ${integrante.nombre}`}
                              value={divVal?.valor || ''}
                              onChange={e => setDivisionValor(id, parseFloat(e.target.value) || 0)}
                              placeholder="0"
                              style={{
                                ...inputBase,
                                height: 40,
                                paddingRight: 22,
                                paddingLeft: 8,
                                fontSize: 14,
                                fontWeight: 600,
                                borderRadius: 10,
                                width: '100%',
                                textAlign: 'right',
                              }}
                              onFocus={e => { e.target.style.outline = '2px solid var(--color-cta)'; e.target.style.background = 'white' }}
                              onBlur={e => { e.target.style.outline = 'none'; e.target.style.background = 'var(--color-card-light)' }}
                            />
                            <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-secondary)', fontSize: 13, pointerEvents: 'none' }}>%</span>
                          </div>
                          <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
                            {formatCLP(montoPreview)}
                          </span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              {errores.divisiones && <ErrorMsg mensaje={errores.divisiones} />}
            </Section>

            {/* CTA Guardar */}
            <button
              onClick={handleGuardar}
              disabled={guardando}
              aria-busy={guardando}
              style={{
                width: '100%', height: 56, borderRadius: 100,
                background: guardando ? 'var(--color-cta-dark)' : 'var(--color-cta)',
                color: 'white', border: 'none',
                fontSize: 16, fontWeight: 600,
                fontFamily: 'var(--font-dm-sans), sans-serif',
                cursor: guardando ? 'not-allowed' : 'pointer',
                transition: 'all 120ms ease', marginTop: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              }}
              onPointerDown={e => { if (!guardando) e.currentTarget.style.transform = 'scale(0.97)' }}
              onPointerUp={e => (e.currentTarget.style.transform = 'scale(1)')}
              onPointerLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
            >
              {guardando && <span className="spinner" aria-hidden="true" />}
              {guardando ? 'Guardando…' : 'Guardar gasto ✓'}
            </button>
          </>
        )}
      </main>

      </div>{/* end max-width wrapper */}

      {/* Toast */}
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
