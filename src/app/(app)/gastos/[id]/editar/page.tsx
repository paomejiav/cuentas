'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { editarGasto, validarPaso1, validarPaso2, calcularMontosPorPersona, type TipoDivision, type DivisionInput } from '@/lib/gastos'
import { formatCLP } from '@/lib/format'
import { Avatar } from '@/components/app/Avatar'
import { Toast } from '@/components/app/Toast'
import { supabase } from '@/lib/supabase'
import type { Integrante, Categoria, Gasto, Division } from '@/types/database'

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
    <p role="alert" style={{
      margin: '6px 0 0', fontSize: 12, color: 'var(--color-negative)',
      fontFamily: 'var(--font-dm-sans), sans-serif',
      display: 'flex', alignItems: 'center', gap: 4,
    }}>
      <span aria-hidden="true">⚠</span> {mensaje}
    </p>
  )
}

function Section({ children }: { children: React.ReactNode }) {
  return <div style={{ marginBottom: 22 }}>{children}</div>
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

// ── Página principal ─────────────────────────────────────────

export default function EditarGastoPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()

  const [paso, setPaso] = useState<1 | 2>(1)
  const [cargando, setCargando] = useState(true)
  const [integrantes, setIntegrantes] = useState<Integrante[]>([])
  const [guardando, setGuardando] = useState(false)
  const [toast, setToast] = useState<{ mensaje: string; tipo: 'exito' | 'error' } | null>(null)
  const [errores, setErrores] = useState<Record<string, string>>({})

  const [descripcion, setDescripcion] = useState('')
  const [monto, setMonto] = useState(0)
  const [displayMonto, setDisplayMonto] = useState('')
  const [pagadoPor, setPagadoPor] = useState('')
  const [categoria, setCategoria] = useState<Categoria>('otro')
  const [fecha, setFecha] = useState('')
  const [nota, setNota] = useState('')

  const [participantes, setParticipantes] = useState<string[]>([])
  const [tipoDivision, setTipoDivision] = useState<TipoDivision>('exacto')
  const [divisionValues, setDivisionValues] = useState<DivisionInput[]>([])

  function handleMontoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, '')
    const numeric = parseInt(digits || '0', 10)
    setMonto(numeric)
    setDisplayMonto(numeric > 0 ? '$' + numeric.toLocaleString('es-CL') : '')
  }

  // Cargar gasto + divisiones + integrantes del grupo
  useEffect(() => {
    let activo = true
    async function cargar() {
      const { data: gasto } = await supabase.from('gastos').select('*').eq('id', id).single()
      if (!gasto || !activo) { setCargando(false); return }
      const g = gasto as Gasto

      const [{ data: divs }, { data: ints }] = await Promise.all([
        supabase.from('divisiones').select('*').eq('gasto_id', id),
        supabase.from('integrantes').select('*').eq('grupo_id', g.grupo_id).eq('activo', true).order('nombre'),
      ])
      if (!activo) return

      setDescripcion(g.descripcion)
      setMonto(g.monto_total)
      setDisplayMonto('$' + g.monto_total.toLocaleString('es-CL'))
      setPagadoPor(g.pagado_por)
      setCategoria(g.categoria)
      setFecha(g.fecha)
      setNota(g.nota ?? '')

      const divisiones = (divs as Division[]) ?? []
      setParticipantes(divisiones.map(d => d.integrante_id))
      setDivisionValues(divisiones.map(d => ({ integrante_id: d.integrante_id, valor: d.monto_asignado })))
      setIntegrantes((ints as Integrante[]) ?? [])
      setCargando(false)
    }
    cargar()
    return () => { activo = false }
  }, [id])

  const preview = useMemo(() => {
    if (monto <= 0 || participantes.length === 0) return {}
    return calcularMontosPorPersona(monto, tipoDivision, participantes, divisionValues)
  }, [monto, tipoDivision, participantes, divisionValues])

  const sumaValores = divisionValues.reduce((s, d) => s + (d.valor || 0), 0)
  const cuadrado = tipoDivision === 'porcentaje' ? sumaValores === 100 : sumaValores === monto

  function toggleParticipante(pid: string) {
    setParticipantes(prev => {
      const next = prev.includes(pid) ? prev.filter(p => p !== pid) : [...prev, pid]
      setDivisionValues(prevVals => {
        if (prev.includes(pid)) return prevVals.filter(d => d.integrante_id !== pid)
        return [...prevVals, { integrante_id: pid, valor: 0 }]
      })
      return next
    })
  }

  function cambiarTipoDivision(t: TipoDivision) {
    setTipoDivision(t)
    setDivisionValues(participantes.map(pid => ({
      integrante_id: pid,
      valor: t === 'porcentaje' ? Math.round(100 / (participantes.length || 1)) : 0,
    })))
  }

  function setDivisionValor(pid: string, valor: number) {
    setDivisionValues(prev => prev.map(d => d.integrante_id === pid ? { ...d, valor } : d))
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

    const result = await editarGasto(id, {
      descripcion, monto_total: monto, pagado_por: pagadoPor, categoria, fecha, nota,
      tipo_division: tipoDivision, participantes, divisiones: divisionValues,
    })

    setGuardando(false)

    if (!result.ok) {
      setToast({ mensaje: result.error, tipo: 'error' })
      return
    }

    setToast({ mensaje: '¡Cambios guardados! 🎉', tipo: 'exito' })
    setTimeout(() => router.back(), 1200)
  }

  if (cargando) return null

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', paddingBottom: 40 }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>

        <header style={{
          paddingTop: 'max(56px, calc(env(safe-area-inset-top, 0px) + 16px))',
          paddingBottom: 18, paddingLeft: 'var(--page-px)', paddingRight: 'var(--page-px)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <button
            onClick={() => paso === 1 ? router.back() : setPaso(1)}
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
              {paso === 1 ? 'Editar gasto' : 'Cómo se divide'}
            </h1>
            <p style={{ margin: '1px 0 0', fontSize: 12, color: 'var(--color-neutral)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
              {paso === 1 ? 'Paso 1 de 2' : `Paso 2 de 2 · ${formatCLP(monto)} entre ${participantes.length}`}
            </p>
          </div>
        </header>

        <main style={{ padding: '0 var(--page-px)' }}>
          {paso === 1 && (
            <>
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
                      type="text" inputMode="numeric" placeholder="$0" autoComplete="off"
                      value={displayMonto} onChange={handleMontoChange}
                      aria-invalid={!!errores.monto}
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

              <Section>
                <Label htmlFor="input-descripcion">Descripción</Label>
                <input
                  id="input-descripcion" type="text" placeholder="¿En qué se gastó?"
                  value={descripcion} onChange={e => setDescripcion(e.target.value)}
                  aria-invalid={!!errores.descripcion} style={inputBase}
                  onFocus={focusInput} onBlur={blurInput}
                />
                {errores.descripcion && <ErrorMsg mensaje={errores.descripcion} />}
              </Section>

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

              <Section>
                <Label>¿Quién pagó?</Label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
                  {integrantes.map(i => {
                    const activo = pagadoPor === i.id
                    return (
                      <button
                        key={i.id}
                        onClick={() => setPagadoPor(i.id)}
                        style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                          background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
                          WebkitTapHighlightColor: 'transparent',
                        }}
                      >
                        <span style={{ borderRadius: '50%', boxShadow: activo ? '0 0 0 2px #fff, 0 0 0 4px var(--color-cta)' : 'none' }}>
                          <Avatar nombre={i.nombre} color={i.avatar_color} size={48} />
                        </span>
                        <span style={{
                          fontSize: 11, fontWeight: activo ? 700 : 400,
                          color: activo ? 'var(--color-text-primary)' : 'var(--color-neutral)',
                          fontFamily: 'var(--font-dm-sans), sans-serif',
                        }}>
                          {i.nombre}
                        </span>
                      </button>
                    )
                  })}
                </div>
                {errores.pagado_por && <ErrorMsg mensaje={errores.pagado_por} />}
              </Section>

              <Section>
                <Label>Fecha</Label>
                <input
                  type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                  style={inputBase} onFocus={focusInput} onBlur={blurInput}
                />
              </Section>

              <Section>
                <Label>Nota (opcional)</Label>
                <textarea
                  placeholder="Detalles adicionales…" value={nota} onChange={e => setNota(e.target.value)}
                  rows={2}
                  style={{ ...inputBase, height: 'auto', padding: '14px 15px', resize: 'none', lineHeight: 1.5 }}
                  onFocus={focusInput} onBlur={blurInput}
                />
              </Section>

              <BotonCTA onClick={handleSiguiente}>
                Continuar
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M7 4l5 5-5 5" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </BotonCTA>
            </>
          )}

          {paso === 2 && (
            <>
              <div style={{
                display: 'flex', background: 'var(--color-card-light)', borderRadius: 12,
                padding: 4, gap: 3, marginBottom: 16,
              }}>
                {TIPOS_DIVISION.map(t => {
                  const activo = tipoDivision === t.id
                  return (
                    <button
                      key={t.id}
                      onClick={() => cambiarTipoDivision(t.id)}
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

              <Section>
                <Label>Incluir a</Label>
                <div style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 18, padding: '4px 16px' }}>
                  {integrantes.map((i, idx) => {
                    const incluido = participantes.includes(i.id)
                    const montoPreview = preview[i.id] ?? 0
                    return (
                      <button
                        key={i.id}
                        onClick={() => toggleParticipante(i.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                          padding: '13px 0', border: 'none', background: 'transparent',
                          borderBottom: idx === integrantes.length - 1 ? 'none' : '1px solid var(--color-divider)',
                          cursor: 'pointer', textAlign: 'left', opacity: incluido ? 1 : 0.5,
                          WebkitTapHighlightColor: 'transparent',
                        }}
                      >
                        <Avatar nombre={i.nombre} color={i.avatar_color} size={38} />
                        <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
                          {i.nombre}
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

              {tipoDivision !== 'igual' && (
                <Section>
                  <Label>Montos por persona</Label>
                  <div className="division-list">
                    {participantes.map(pid => {
                      const integrante = integrantes.find(i => i.id === pid)
                      if (!integrante) return null
                      const montoPreview = preview[pid] ?? 0
                      const divVal = divisionValues.find(d => d.integrante_id === pid)

                      return (
                        <div key={pid} style={{
                          background: 'var(--color-card)', border: '1px solid var(--color-border)',
                          borderRadius: 16, padding: '12px 14px',
                          display: 'flex', alignItems: 'center', gap: 12,
                        }}>
                          <Avatar nombre={integrante.nombre} color={integrante.avatar_color} size={32} />
                          <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
                            {integrante.nombre}
                          </span>

                          {tipoDivision === 'exacto' && (
                            <div style={{ position: 'relative', width: 110 }}>
                              <span aria-hidden="true" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', fontSize: 14, fontFamily: 'var(--font-dm-sans), sans-serif' }}>$</span>
                              <input
                                type="text" inputMode="numeric" pattern="[0-9]*"
                                aria-label={`Monto para ${integrante.nombre}`}
                                value={divVal?.valor || ''}
                                onChange={e => setDivisionValor(pid, parseFloat(e.target.value) || 0)}
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
                                  aria-label={`Porcentaje para ${integrante.nombre}`}
                                  value={divVal?.valor || ''}
                                  onChange={e => setDivisionValor(pid, parseFloat(e.target.value) || 0)}
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
                {guardando ? 'Guardando…' : 'Guardar cambios'}
              </BotonCTA>
            </>
          )}
        </main>
      </div>

      {toast && <Toast mensaje={toast.mensaje} tipo={toast.tipo} onClose={() => setToast(null)} />}
    </div>
  )
}
