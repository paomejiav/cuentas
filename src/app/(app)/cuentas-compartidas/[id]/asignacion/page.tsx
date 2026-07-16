'use client'

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  obtenerCuentaCompartida,
  listarItems,
  listarParticipantes,
  listarConsumoPorItems,
  guardarConsumo,
  dividirEquitativamente,
  actualizarPropina,
  redondear2,
  type ParticipanteDetalle,
} from '@/lib/cuentas-compartidas'
import { formatCLP } from '@/lib/format'
import { Avatar } from '@/components/app/Avatar'
import { Toast } from '@/components/app/Toast'
import type { CuentaCompartida, CuentaCompartidaItem } from '@/types/database'

// ── Helpers de celda ─────────────────────────────────────────

type Matriz = Record<string, Record<string, string>> // itemId -> integranteId -> valor crudo (texto)

function parseCelda(raw: string | undefined): number {
  if (!raw) return 0
  const n = parseFloat(raw.replace(',', '.'))
  return isNaN(n) || n < 0 ? 0 : n
}

function formatCelda(n: number): string {
  return n === 0 ? '' : String(redondear2(n))
}

function filtrarEntrada(value: string): string {
  // Permite dígitos y como máximo un separador decimal con hasta 2 decimales
  const limpio = value.replace(',', '.')
  if (!/^\d*\.?\d{0,2}$/.test(limpio)) return value.slice(0, -1).replace(',', '.')
  return limpio
}

// ── Estilos de la tabla ──────────────────────────────────────

const celdaBase: React.CSSProperties = {
  padding: '8px 6px',
  borderBottom: '1px solid var(--color-border)',
  textAlign: 'center',
  fontFamily: 'var(--font-dm-sans), sans-serif',
  fontSize: 13,
  minWidth: 80,
}

const celdaSticky: React.CSSProperties = {
  position: 'sticky',
  left: 0,
  background: 'var(--color-surface-white)',
  zIndex: 1,
  padding: '10px 12px',
  borderBottom: '1px solid var(--color-border)',
  borderRight: '1px solid var(--color-border)',
  textAlign: 'left',
  minWidth: 160,
  maxWidth: 200,
}

const inputPropina: React.CSSProperties = {
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

const inputCelda: React.CSSProperties = {
  width: 56,
  height: 34,
  border: 'none',
  borderRadius: 8,
  background: 'var(--color-card-light)',
  textAlign: 'center',
  fontSize: 13,
  fontFamily: 'var(--font-dm-sans), sans-serif',
  color: 'var(--color-text-primary)',
  outline: 'none',
}

// ── Página principal ─────────────────────────────────────────

export default function AsignacionCuentaCompartidaPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()

  const [cuenta, setCuenta] = useState<CuentaCompartida | null>(null)
  const [items, setItems] = useState<CuentaCompartidaItem[]>([])
  const [participantes, setParticipantes] = useState<ParticipanteDetalle[]>([])
  const [matriz, setMatriz] = useState<Matriz>({})
  const [cargando, setCargando] = useState(true)
  const [repartiendoItemId, setRepartiendoItemId] = useState<string | null>(null)
  const [continuando, setContinuando] = useState(false)
  const [toast, setToast] = useState<{ mensaje: string; tipo: 'exito' | 'error' } | null>(null)

  const [propinaDisplay, setPropinaDisplay] = useState('')
  const propinaTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const soloLectura = cuenta?.estado === 'cerrada'

  const cargar = useCallback(async () => {
    setCargando(true)
    const cuentaData = await obtenerCuentaCompartida(id)
    const [itemsData, participantesData] = await Promise.all([
      listarItems(id),
      listarParticipantes(id),
    ])
    const consumoData = await listarConsumoPorItems(itemsData.map(i => i.id))

    const nuevaMatriz: Matriz = {}
    itemsData.forEach(item => { nuevaMatriz[item.id] = {} })
    consumoData.forEach(c => {
      if (!nuevaMatriz[c.item_id]) nuevaMatriz[c.item_id] = {}
      nuevaMatriz[c.item_id][c.integrante_id] = formatCelda(c.cantidad_asignada)
    })

    setCuenta(cuentaData)
    setItems(itemsData)
    setParticipantes(participantesData)
    setMatriz(nuevaMatriz)

    const valorInicial = cuentaData?.monto_propina ?? 0
    setPropinaDisplay(valorInicial > 0 ? '$' + valorInicial.toLocaleString('es-CL') : '')

    setCargando(false)
  }, [id])

  useEffect(() => { cargar() }, [cargar])

  useEffect(() => {
    return () => {
      if (propinaTimeoutRef.current) clearTimeout(propinaTimeoutRef.current)
    }
  }, [])

  function handlePropinaChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (soloLectura) return
    const digits = e.target.value.replace(/\D/g, '')
    const numeric = parseInt(digits || '0', 10)
    setPropinaDisplay(numeric > 0 ? '$' + numeric.toLocaleString('es-CL') : '')

    if (propinaTimeoutRef.current) clearTimeout(propinaTimeoutRef.current)
    propinaTimeoutRef.current = setTimeout(async () => {
      const result = await actualizarPropina(id, numeric)
      if (!result.ok) setToast({ mensaje: result.error, tipo: 'error' })
    }, 600)
  }

  function handleCambioCelda(itemId: string, integranteId: string, value: string) {
    const filtrado = filtrarEntrada(value)
    setMatriz(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], [integranteId]: filtrado },
    }))
  }

  async function handleGuardarCelda(itemId: string, integranteId: string) {
    const valor = parseCelda(matriz[itemId]?.[integranteId])
    setMatriz(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], [integranteId]: formatCelda(valor) },
    }))
    const result = await guardarConsumo(itemId, integranteId, valor)
    if (!result.ok) setToast({ mensaje: result.error, tipo: 'error' })
  }

  async function handleDividir(item: CuentaCompartidaItem) {
    setRepartiendoItemId(item.id)
    const integranteIds = participantes.map(p => p.integrante.id)
    const result = await dividirEquitativamente(item.id, item.cantidad, integranteIds)
    setRepartiendoItemId(null)

    if (!result.ok) {
      setToast({ mensaje: result.error, tipo: 'error' })
      return
    }

    setMatriz(prev => ({
      ...prev,
      [item.id]: Object.fromEntries(integranteIds.map(iid => [iid, formatCelda(result.porPersona)])),
    }))
  }

  function handleContinuar() {
    setContinuando(true)
    router.push(`/cuentas-compartidas/${id}/exentos`)
  }

  // ── Cálculos derivados ──────────────────────────────────────

  const cuadrePorItem = useMemo(() => {
    const mapa: Record<string, number> = {}
    items.forEach(item => {
      const asignado = participantes.reduce(
        (s, p) => s + parseCelda(matriz[item.id]?.[p.integrante.id]), 0
      )
      mapa[item.id] = redondear2(item.cantidad - asignado)
    })
    return mapa
  }, [items, participantes, matriz])

  const totalPorPersona = useMemo(() => {
    const mapa: Record<string, number> = {}
    participantes.forEach(p => {
      const total = items.reduce((s, item) => {
        const cant = parseCelda(matriz[item.id]?.[p.integrante.id])
        return s + cant * item.precio_unitario
      }, 0)
      mapa[p.integrante.id] = total
    })
    return mapa
  }, [items, participantes, matriz])

  // ── RENDER ────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', paddingBottom: 40 }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>

        {/* Header */}
        <header style={{
          paddingTop: 'max(56px, calc(env(safe-area-inset-top, 0px) + 16px))',
          paddingBottom: 20,
          paddingLeft: 'var(--page-px)',
          paddingRight: 'var(--page-px)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <button
            onClick={() => router.back()}
            aria-label="Volver"
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

          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-dm-sans), sans-serif',
              textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>
              {cargando ? 'Cargando…' : (cuenta?.nombre ?? 'Cuenta no encontrada')}
              {soloLectura && ' · Cerrada'}
            </p>
            <h1 style={{
              margin: '2px 0 0', fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)',
              fontFamily: 'var(--font-lora), serif',
            }}>
              Asignar consumo
            </h1>
          </div>
        </header>

        <main style={{ padding: '0 var(--page-px)' }}>

          {cargando && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[120, 200].map((h, i) => (
                <div key={i} className="skeleton" style={{ height: h, borderRadius: 16 }} />
              ))}
            </div>
          )}

          {!cargando && !cuenta && (
            <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
              No se encontró esta cuenta compartida.
            </p>
          )}

          {!cargando && cuenta && items.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 12px', background: 'var(--color-card)', borderRadius: 16 }}>
              <p style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
                Todavía no hay items cargados en esta cuenta.
              </p>
              <button
                onClick={() => router.push(`/cuentas-compartidas/${id}/items`)}
                style={{
                  height: 40, padding: '0 20px', borderRadius: 100, border: 'none',
                  background: 'var(--color-cta)', color: 'white',
                  fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-dm-sans), sans-serif', cursor: 'pointer',
                }}
              >
                Cargar items
              </button>
            </div>
          )}

          {!cargando && cuenta && items.length > 0 && (
            <>
              <p style={{
                margin: '0 0 10px 2px', fontSize: 12, color: 'var(--color-text-secondary)',
                fontFamily: 'var(--font-dm-sans), sans-serif',
              }}>
                Toca una celda para indicar cuánto de cada item consumió cada persona · desliza para ver a todos →
              </p>

              <div style={{
                overflowX: 'auto', WebkitOverflowScrolling: 'touch',
                borderRadius: 16, background: 'var(--color-surface-white)',
                marginBottom: 20,
              }}>
                <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ ...celdaSticky, zIndex: 2, background: 'var(--color-card)' }}>
                        <span style={{
                          fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)',
                          fontFamily: 'var(--font-dm-sans), sans-serif',
                          textTransform: 'uppercase', letterSpacing: '0.06em',
                        }}>
                          Item
                        </span>
                      </th>
                      {participantes.map(p => (
                        <th key={p.id} style={{ ...celdaBase, background: 'var(--color-card)' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                            <Avatar nombre={p.integrante.nombre} color={p.integrante.avatar_color} size={22} />
                            <span style={{
                              fontSize: 10, fontWeight: 600, color: 'var(--color-text-primary)',
                              fontFamily: 'var(--font-dm-sans), sans-serif',
                              maxWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {p.integrante.nombre}
                            </span>
                          </div>
                        </th>
                      ))}
                      <th style={{ ...celdaBase, background: 'var(--color-card)', minWidth: 70 }}>
                        <span style={{
                          fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)',
                          fontFamily: 'var(--font-dm-sans), sans-serif',
                          textTransform: 'uppercase', letterSpacing: '0.06em',
                        }}>
                          Cuadre
                        </span>
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {items.map(item => {
                      const cuadre = cuadrePorItem[item.id] ?? 0
                      const cuadrado = Math.abs(cuadre) <= 0.01
                      return (
                        <tr key={item.id}>
                          <td style={celdaSticky}>
                            <p style={{
                              margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)',
                              fontFamily: 'var(--font-dm-sans), sans-serif',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {item.descripcion}
                            </p>
                            <p style={{
                              margin: '2px 0 6px', fontSize: 11, color: 'var(--color-text-secondary)',
                              fontFamily: 'var(--font-dm-sans), sans-serif',
                            }}>
                              {item.cantidad} uds · {formatCLP(item.precio_unitario)}
                            </p>
                            {!soloLectura && (
                              <button
                                onClick={() => handleDividir(item)}
                                disabled={repartiendoItemId === item.id}
                                style={{
                                  height: 26, padding: '0 10px', borderRadius: 100, border: 'none',
                                  background: 'var(--color-card-light)', color: 'var(--color-text-primary)',
                                  fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-dm-sans), sans-serif',
                                  cursor: repartiendoItemId === item.id ? 'not-allowed' : 'pointer',
                                  opacity: repartiendoItemId === item.id ? 0.6 : 1,
                                }}
                              >
                                {repartiendoItemId === item.id ? 'Repartiendo…' : '⚡ Dividir parejo'}
                              </button>
                            )}
                          </td>

                          {participantes.map(p => (
                            <td key={p.id} style={celdaBase}>
                              <input
                                inputMode="decimal"
                                value={matriz[item.id]?.[p.integrante.id] ?? ''}
                                onChange={e => handleCambioCelda(item.id, p.integrante.id, e.target.value)}
                                onBlur={() => handleGuardarCelda(item.id, p.integrante.id)}
                                disabled={soloLectura}
                                placeholder="–"
                                aria-label={`${item.descripcion} · ${p.integrante.nombre}`}
                                style={{ ...inputCelda, opacity: soloLectura ? 0.7 : 1 }}
                                onFocus={e => { e.target.style.outline = '2px solid var(--color-cta)' }}
                                onBlurCapture={e => { e.target.style.outline = 'none' }}
                              />
                            </td>
                          ))}

                          <td style={{ ...celdaBase, minWidth: 70 }}>
                            <span style={{
                              fontSize: 12, fontWeight: 600,
                              color: cuadrado ? 'var(--color-positive)' : 'var(--color-negative)',
                              fontFamily: 'var(--font-dm-sans), sans-serif',
                            }}>
                              {cuadrado ? '✓' : (cuadre > 0 ? `falta ${cuadre}` : `sobra ${Math.abs(cuadre)}`)}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>

                  <tfoot>
                    <tr>
                      <td style={{ ...celdaSticky, background: 'var(--color-card-light)' }}>
                        <span style={{
                          fontSize: 12, fontWeight: 700, color: 'var(--color-text-primary)',
                          fontFamily: 'var(--font-dm-sans), sans-serif',
                        }}>
                          Total consumido
                        </span>
                      </td>
                      {participantes.map(p => (
                        <td key={p.id} style={{ ...celdaBase, background: 'var(--color-card-light)' }}>
                          <span style={{
                            fontSize: 12, fontWeight: 700, color: 'var(--color-text-primary)',
                            fontFamily: 'var(--font-dm-sans), sans-serif',
                          }}>
                            {formatCLP(totalPorPersona[p.integrante.id] ?? 0)}
                          </span>
                        </td>
                      ))}
                      <td style={{ ...celdaBase, background: 'var(--color-card-light)' }} />
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Propina — separada del resto con espaciado + línea divisoria */}
              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 20, marginBottom: 24 }}>
                <label
                  htmlFor="input-propina"
                  style={{
                    display: 'block', margin: '0 0 8px',
                    fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)',
                    fontFamily: 'var(--font-dm-sans), sans-serif',
                    textTransform: 'uppercase', letterSpacing: '0.07em',
                  }}
                >
                  Propina total (opcional)
                </label>
                <input
                  id="input-propina"
                  type="text"
                  inputMode="numeric"
                  placeholder="$0"
                  autoComplete="off"
                  value={propinaDisplay}
                  onChange={handlePropinaChange}
                  disabled={soloLectura}
                  style={{ ...inputPropina, opacity: soloLectura ? 0.7 : 1 }}
                  onFocus={e => { if (!soloLectura) { e.target.style.outline = '2px solid var(--color-cta)'; e.target.style.background = 'white' } }}
                  onBlur={e => { e.target.style.outline = 'none'; e.target.style.background = 'var(--color-card-light)' }}
                />
              </div>

              {/* CTA Continuar */}
              <button
                onClick={handleContinuar}
                disabled={continuando}
                style={{
                  width: '100%', height: 56, borderRadius: 100, border: 'none',
                  background: continuando ? 'var(--color-cta-dark)' : 'var(--color-cta)',
                  color: 'white', fontSize: 16, fontWeight: 600,
                  fontFamily: 'var(--font-dm-sans), sans-serif',
                  cursor: continuando ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                }}
              >
                {continuando && <span className="spinner" aria-hidden="true" />}
                {continuando ? 'Cargando…' : 'Continuar →'}
              </button>
            </>
          )}
        </main>
      </div>

      {toast && (
        <Toast mensaje={toast.mensaje} tipo={toast.tipo} onClose={() => setToast(null)} />
      )}
    </div>
  )
}
