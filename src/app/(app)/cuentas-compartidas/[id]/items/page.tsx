'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  obtenerCuentaCompartida,
  listarItems,
  crearItem,
  editarItem,
  eliminarItem,
  validarItem,
  calcularTotalItem,
  type DatosItem,
} from '@/lib/cuentas-compartidas'
import { formatCLP } from '@/lib/format'
import { Toast } from '@/components/app/Toast'
import type { CuentaCompartida, CuentaCompartidaItem } from '@/types/database'

// ── Estilos compartidos ─────────────────────────────────────

const inputBase: React.CSSProperties = {
  background: 'var(--color-card-light)',
  border: 'none',
  borderRadius: 12,
  height: 44,
  padding: '0 12px',
  fontFamily: 'var(--font-dm-sans), sans-serif',
  fontSize: 14,
  color: 'var(--color-text-primary)',
  width: '100%',
  outline: 'none',
  boxSizing: 'border-box',
}

function focusInput(e: React.FocusEvent<HTMLInputElement>) {
  e.target.style.outline = '2px solid var(--color-cta)'
  e.target.style.background = 'white'
}
function blurInput(e: React.FocusEvent<HTMLInputElement>) {
  e.target.style.outline = 'none'
  e.target.style.background = 'var(--color-card-light)'
}

function digitsOnly(value: string): number {
  const digits = value.replace(/\D/g, '')
  return parseInt(digits || '0', 10)
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      display: 'block', margin: '0 0 6px',
      fontSize: 11, fontWeight: 600,
      color: 'var(--color-text-secondary)',
      fontFamily: 'var(--font-dm-sans), sans-serif',
      textTransform: 'uppercase', letterSpacing: '0.07em',
    }}>
      {children}
    </span>
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

// ── Fila de item (vista + edición inline) ───────────────────

function ItemRow({
  item, soloLectura, onGuardar, onEliminar,
}: {
  item: CuentaCompartidaItem
  soloLectura: boolean
  onGuardar: (itemId: string, datos: DatosItem) => Promise<boolean>
  onEliminar: (itemId: string) => Promise<void>
}) {
  const [editando, setEditando] = useState(false)
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [eliminando, setEliminando] = useState(false)
  const [descripcion, setDescripcion] = useState(item.descripcion)
  const [precio, setPrecio] = useState(item.precio_unitario)
  const [cantidad, setCantidad] = useState(item.cantidad)
  const [errores, setErrores] = useState<Record<string, string>>({})

  function empezarEdicion() {
    setDescripcion(item.descripcion)
    setPrecio(item.precio_unitario)
    setCantidad(item.cantidad)
    setErrores({})
    setEditando(true)
  }

  async function guardar() {
    const datos: DatosItem = { descripcion, precio_unitario: precio, cantidad }
    const errs = validarItem(datos)
    if (errs.length > 0) {
      const map: Record<string, string> = {}
      errs.forEach(e => { map[e.campo] = e.mensaje })
      setErrores(map)
      return
    }
    setGuardando(true)
    const ok = await onGuardar(item.id, datos)
    setGuardando(false)
    if (ok) setEditando(false)
  }

  async function eliminar() {
    setEliminando(true)
    await onEliminar(item.id)
    setEliminando(false)
  }

  if (editando) {
    return (
      <div style={{ background: 'var(--color-card)', borderRadius: 16, padding: 14 }}>
        <div style={{ marginBottom: 10 }}>
          <input
            value={descripcion}
            onChange={e => setDescripcion(e.target.value)}
            placeholder="Descripción"
            style={inputBase}
            onFocus={focusInput}
            onBlur={blurInput}
          />
          {errores.descripcion && <ErrorMsg mensaje={errores.descripcion} />}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
          <div>
            <Label>Precio unit.</Label>
            <input
              inputMode="numeric"
              value={precio > 0 ? '$' + precio.toLocaleString('es-CL') : ''}
              onChange={e => setPrecio(digitsOnly(e.target.value))}
              placeholder="$0"
              style={inputBase}
              onFocus={focusInput}
              onBlur={blurInput}
            />
            {errores.precio_unitario && <ErrorMsg mensaje={errores.precio_unitario} />}
          </div>
          <div>
            <Label>Cantidad</Label>
            <input
              inputMode="numeric"
              value={cantidad > 0 ? String(cantidad) : ''}
              onChange={e => setCantidad(digitsOnly(e.target.value))}
              placeholder="0"
              style={inputBase}
              onFocus={focusInput}
              onBlur={blurInput}
            />
            {errores.cantidad && <ErrorMsg mensaje={errores.cantidad} />}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <Label>Total</Label>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
            {formatCLP(calcularTotalItem(precio, cantidad))}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setEditando(false)}
            disabled={guardando}
            style={{
              flex: 1, height: 40, borderRadius: 100, border: 'none',
              background: 'var(--color-card-light)', color: 'var(--color-text-primary)',
              fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-dm-sans), sans-serif',
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={guardando}
            style={{
              flex: 1, height: 40, borderRadius: 100, border: 'none',
              background: 'var(--color-cta)', color: 'white',
              fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-dm-sans), sans-serif',
              cursor: guardando ? 'not-allowed' : 'pointer', opacity: guardando ? 0.7 : 1,
            }}
          >
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--color-card)', borderRadius: 16, padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-dm-sans), sans-serif',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {item.descripcion}
          </p>
          <p style={{
            margin: '2px 0 0', fontSize: 12, color: 'var(--color-text-secondary)',
            fontFamily: 'var(--font-dm-sans), sans-serif',
          }}>
            {formatCLP(item.precio_unitario)} × {item.cantidad}
          </p>
        </div>

        <span style={{
          fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)',
          fontFamily: 'var(--font-dm-sans), sans-serif', flexShrink: 0,
        }}>
          {formatCLP(item.total)}
        </span>

        {!soloLectura && !confirmandoEliminar && (
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            <button
              onClick={empezarEdicion}
              aria-label={`Editar ${item.descripcion}`}
              style={{
                width: 30, height: 30, borderRadius: 8, border: 'none',
                background: 'var(--color-card-light)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M9.5 1.5l3 3L4 13H1v-3l8.5-8.5z" stroke="var(--color-text-secondary)" strokeWidth="1.3" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              onClick={() => setConfirmandoEliminar(true)}
              aria-label={`Eliminar ${item.descripcion}`}
              style={{
                width: 30, height: 30, borderRadius: 8, border: 'none',
                background: 'var(--color-card-light)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 3.5h10M5.5 3.5V2h3v1.5M3.5 3.5l.6 8.5a1 1 0 001 .9h3.8a1 1 0 001-.9l.6-8.5" stroke="var(--color-negative)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {confirmandoEliminar && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--color-border)' }}>
          <span style={{ flex: 1, fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
            ¿Eliminar este item?
          </span>
          <button
            onClick={() => setConfirmandoEliminar(false)}
            style={{
              height: 32, padding: '0 12px', borderRadius: 100, border: 'none',
              background: 'var(--color-card-light)', color: 'var(--color-text-primary)',
              fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-dm-sans), sans-serif', cursor: 'pointer',
            }}
          >
            No
          </button>
          <button
            onClick={eliminar}
            disabled={eliminando}
            style={{
              height: 32, padding: '0 12px', borderRadius: 100, border: 'none',
              background: 'var(--color-negative)', color: 'white',
              fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-dm-sans), sans-serif',
              cursor: eliminando ? 'not-allowed' : 'pointer', opacity: eliminando ? 0.7 : 1,
            }}
          >
            {eliminando ? 'Eliminando…' : 'Sí, eliminar'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Página principal ─────────────────────────────────────────

export default function ItemsCuentaCompartidaPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()

  const [cuenta, setCuenta] = useState<CuentaCompartida | null>(null)
  const [cargandoCuenta, setCargandoCuenta] = useState(true)
  const [items, setItems] = useState<CuentaCompartidaItem[]>([])
  const [cargandoItems, setCargandoItems] = useState(true)
  const [zoomAbierto, setZoomAbierto] = useState(false)
  const [toast, setToast] = useState<{ mensaje: string; tipo: 'exito' | 'error' } | null>(null)

  // Formulario "agregar item"
  const [descripcion, setDescripcion] = useState('')
  const [precio, setPrecio] = useState(0)
  const [cantidad, setCantidad] = useState(1)
  const [erroresForm, setErroresForm] = useState<Record<string, string>>({})
  const [agregando, setAgregando] = useState(false)

  const [continuando, setContinuando] = useState(false)

  const soloLectura = cuenta?.estado === 'cerrada'

  const cargar = useCallback(async () => {
    setCargandoCuenta(true)
    setCargandoItems(true)
    const [cuentaData, itemsData] = await Promise.all([
      obtenerCuentaCompartida(id),
      listarItems(id),
    ])
    setCuenta(cuentaData)
    setItems(itemsData)
    setCargandoCuenta(false)
    setCargandoItems(false)
  }, [id])

  useEffect(() => { cargar() }, [cargar])

  async function handleAgregar() {
    const datos: DatosItem = { descripcion, precio_unitario: precio, cantidad }
    const errs = validarItem(datos)
    if (errs.length > 0) {
      const map: Record<string, string> = {}
      errs.forEach(e => { map[e.campo] = e.mensaje })
      setErroresForm(map)
      return
    }
    setErroresForm({})
    setAgregando(true)
    const result = await crearItem(id, datos)
    setAgregando(false)

    if (!result.ok) {
      setToast({ mensaje: result.error, tipo: 'error' })
      return
    }

    setItems(prev => [...prev, result.item])
    setDescripcion('')
    setPrecio(0)
    setCantidad(1)
  }

  async function handleGuardarEdicion(itemId: string, datos: DatosItem): Promise<boolean> {
    const result = await editarItem(itemId, datos)
    if (!result.ok) {
      setToast({ mensaje: result.error, tipo: 'error' })
      return false
    }
    setItems(prev => prev.map(it =>
      it.id === itemId
        ? { ...it, ...datos, total: calcularTotalItem(datos.precio_unitario, datos.cantidad) }
        : it
    ))
    return true
  }

  async function handleEliminar(itemId: string) {
    const result = await eliminarItem(itemId)
    if (!result.ok) {
      setToast({ mensaje: result.error, tipo: 'error' })
      return
    }
    setItems(prev => prev.filter(it => it.id !== itemId))
  }

  function handleContinuar() {
    if (items.length === 0) {
      setToast({ mensaje: 'Agregá al menos un item antes de continuar.', tipo: 'error' })
      return
    }
    setContinuando(true)
    router.push(`/cuentas-compartidas/${id}/asignacion`)
  }

  const subtotal = items.reduce((s, it) => s + it.total, 0)
  const totalPreview = calcularTotalItem(precio, cantidad)

  const fechaFormateada = cuenta
    ? new Date(cuenta.fecha + 'T12:00:00').toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })
    : ''

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
              {cargandoCuenta ? 'Cargando…' : fechaFormateada}
              {soloLectura && ' · Cerrada'}
            </p>
            <h1 style={{
              margin: '2px 0 0', fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)',
              fontFamily: 'var(--font-lora), serif',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {cargandoCuenta ? 'Cargar items' : (cuenta?.nombre ?? 'Cuenta no encontrada')}
            </h1>
          </div>
        </header>

        {!cargandoCuenta && !cuenta && (
          <main style={{ padding: '0 var(--page-px)' }}>
            <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
              No se encontró esta cuenta compartida.
            </p>
          </main>
        )}

        {(cargandoCuenta || cuenta) && (
          <main
            className="cc-items-layout"
            style={{ padding: '0 var(--page-px)' }}
          >
            {/* Foto de la boleta */}
            {cuenta?.foto_boleta_url && (
              <div className="cc-items-foto">
                <button
                  onClick={() => setZoomAbierto(true)}
                  aria-label="Ampliar foto de la boleta"
                  style={{
                    border: 'none', padding: 0, borderRadius: 20, overflow: 'hidden',
                    cursor: 'zoom-in', width: '100%', display: 'block', background: 'var(--color-card)',
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={cuenta.foto_boleta_url}
                    alt="Foto de la boleta"
                    style={{ width: '100%', maxHeight: 420, objectFit: 'contain', display: 'block' }}
                  />
                </button>
              </div>
            )}

            <div className="cc-items-form">
              {/* Formulario agregar item */}
              {!soloLectura && (
                <div style={{ background: 'var(--color-card)', borderRadius: 20, padding: 16, marginBottom: 20 }}>
                  <p style={{
                    margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)',
                    fontFamily: 'var(--font-dm-sans), sans-serif',
                  }}>
                    Agregar item
                  </p>

                  <div style={{ marginBottom: 10 }}>
                    <input
                      value={descripcion}
                      onChange={e => setDescripcion(e.target.value)}
                      placeholder="¿Qué se pidió?"
                      aria-invalid={!!erroresForm.descripcion}
                      style={inputBase}
                      onFocus={focusInput}
                      onBlur={blurInput}
                    />
                    {erroresForm.descripcion && <ErrorMsg mensaje={erroresForm.descripcion} />}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                    <div>
                      <Label>Precio unit.</Label>
                      <input
                        inputMode="numeric"
                        value={precio > 0 ? '$' + precio.toLocaleString('es-CL') : ''}
                        onChange={e => setPrecio(digitsOnly(e.target.value))}
                        placeholder="$0"
                        aria-invalid={!!erroresForm.precio_unitario}
                        style={inputBase}
                        onFocus={focusInput}
                        onBlur={blurInput}
                      />
                      {erroresForm.precio_unitario && <ErrorMsg mensaje={erroresForm.precio_unitario} />}
                    </div>
                    <div>
                      <Label>Cantidad</Label>
                      <input
                        inputMode="numeric"
                        value={cantidad > 0 ? String(cantidad) : ''}
                        onChange={e => setCantidad(digitsOnly(e.target.value))}
                        placeholder="1"
                        aria-invalid={!!erroresForm.cantidad}
                        style={inputBase}
                        onFocus={focusInput}
                        onBlur={blurInput}
                      />
                      {erroresForm.cantidad && <ErrorMsg mensaje={erroresForm.cantidad} />}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <Label>Total</Label>
                    <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
                      {formatCLP(totalPreview)}
                    </span>
                  </div>

                  <button
                    onClick={handleAgregar}
                    disabled={agregando}
                    style={{
                      width: '100%', height: 44, borderRadius: 100, border: 'none',
                      background: 'var(--color-cta)', color: 'white',
                      fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-dm-sans), sans-serif',
                      cursor: agregando ? 'not-allowed' : 'pointer', opacity: agregando ? 0.7 : 1,
                    }}
                  >
                    {agregando ? 'Agregando…' : '+ Agregar item'}
                  </button>
                </div>
              )}

              {/* Lista de items */}
              <div style={{ marginBottom: 20 }}>
                <p style={{
                  margin: '0 0 10px 4px', fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)',
                  fontFamily: 'var(--font-dm-sans), sans-serif',
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                }}>
                  Items cargados {items.length > 0 && `(${items.length})`}
                </p>

                {cargandoItems ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[64, 64].map((h, i) => (
                      <div key={i} className="skeleton" style={{ height: h, borderRadius: 16 }} />
                    ))}
                  </div>
                ) : items.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '28px 12px', background: 'var(--color-card)', borderRadius: 16 }}>
                    <p style={{
                      margin: 0, fontSize: 13, color: 'var(--color-text-secondary)',
                      fontFamily: 'var(--font-dm-sans), sans-serif',
                    }}>
                      Todavía no hay items cargados.
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {items.map(item => (
                      <ItemRow
                        key={item.id}
                        item={item}
                        soloLectura={!!soloLectura}
                        onGuardar={handleGuardarEdicion}
                        onEliminar={handleEliminar}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Subtotal */}
              <div style={{
                background: 'var(--color-card)', borderRadius: 20, padding: '16px 18px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20,
              }}>
                <span style={{
                  fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)',
                  fontFamily: 'var(--font-dm-sans), sans-serif', textTransform: 'uppercase', letterSpacing: '0.07em',
                }}>
                  Subtotal
                </span>
                <span style={{
                  fontSize: 24, fontWeight: 700, color: 'var(--color-text-primary)',
                  fontFamily: 'var(--font-lora), serif',
                }}>
                  {formatCLP(subtotal)}
                </span>
              </div>

              {/* CTA Continuar */}
              <button
                onClick={handleContinuar}
                disabled={continuando || cargandoItems}
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
            </div>
          </main>
        )}
      </div>

      {/* Lightbox de la foto */}
      {zoomAbierto && cuenta?.foto_boleta_url && (
        <div
          onClick={() => setZoomAbierto(false)}
          role="button"
          aria-label="Cerrar foto ampliada"
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(28,43,26,0.92)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20, cursor: 'zoom-out',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cuenta.foto_boleta_url}
            alt="Foto de la boleta ampliada"
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8 }}
          />
        </div>
      )}

      {toast && (
        <Toast mensaje={toast.mensaje} tipo={toast.tipo} onClose={() => setToast(null)} />
      )}
    </div>
  )
}
