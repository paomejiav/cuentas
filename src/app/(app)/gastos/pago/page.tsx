'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from '@/lib/session-store'
import { registrarPago } from '@/lib/pagos'
import { formatCLP } from '@/lib/format'
import { Avatar } from '@/components/app/Avatar'
import { Toast } from '@/components/app/Toast'
import { supabase } from '@/lib/supabase'
import type { Integrante, MetodoPago } from '@/types/database'

const F = 'var(--font-dm-sans), sans-serif'

const METODOS: { id: MetodoPago; label: string }[] = [
  { id: 'transferencia', label: '🏦 Transferencia' },
  { id: 'efectivo',      label: '💵 Efectivo' },
  { id: 'otro',          label: '📱 Otro' },
]

function inputStyle(focused: boolean): React.CSSProperties {
  return {
    height: 52, width: '100%', boxSizing: 'border-box',
    padding: '0 16px', borderRadius: 14,
    border: `1.5px solid ${focused ? '#00C851' : '#D8D4CE'}`,
    background: '#FFFFFF', fontSize: 16,
    color: 'var(--color-text-primary)',
    fontFamily: F, outline: 'none',
    transition: 'border-color 150ms ease',
  }
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      margin: '0 0 6px', fontSize: 11, fontWeight: 600,
      letterSpacing: '0.07em', textTransform: 'uppercase',
      color: 'var(--color-text-secondary)', fontFamily: F,
    }}>
      {children}
    </p>
  )
}

export default function PagoPage() {
  return (
    <Suspense>
      <PagoInner />
    </Suspense>
  )
}

function PagoInner() {
  const router = useRouter()
  const params = useSearchParams()
  const { sesion, loading: sesionLoading } = useSession()

  // URL params: ?otro=ID&saldo=SIGNED_AMOUNT
  // saldo: positivo = otro me debe · negativo = yo le debo
  const otroId   = params.get('otro') ?? ''
  const saldoUrl = Number(params.get('saldo') ?? '0')

  const [otro, setOtro] = useState<Integrante | null>(null)

  // Quién paga: el deudor por defecto
  // saldo < 0 → yo le debo → yo pago → de=miId
  // saldo > 0 → otro me debe → otro paga → de=otroId
  const miId = sesion?.integrante_id ?? ''
  const [deId, setDeId] = useState<string>('')   // se inicializa en useEffect

  // Monto: valor absoluto del saldo
  const saldoAbs = Math.abs(saldoUrl)
  const [displayMonto, setDisplayMonto] = useState('')
  const [monto, setMonto] = useState(0)

  const [montoFocused, setMontoFocused] = useState(false)
  const [notaFocused,  setNotaFocused]  = useState(false)
  const [metodo,  setMetodo]  = useState<MetodoPago>('transferencia')
  const [fecha,   setFecha]   = useState(new Date().toISOString().slice(0, 10))
  const [nota,    setNota]    = useState('')
  const [loading, setLoading] = useState(false)
  const [toast,   setToast]   = useState<{ mensaje: string; tipo: 'exito' | 'error' } | null>(null)

  // Cargar integrante "otro"
  useEffect(() => {
    if (!otroId) return
    supabase
      .from('integrantes')
      .select('*')
      .eq('id', otroId)
      .single()
      .then(({ data }) => { if (data) setOtro(data as Integrante) })
  }, [otroId])

  // Inicializar deudor y monto
  useEffect(() => {
    if (!miId) return
    setDeId(saldoUrl < 0 ? miId : otroId)
    if (saldoAbs > 0) {
      setMonto(saldoAbs)
      setDisplayMonto(saldoAbs.toLocaleString('es-CL'))
    }
  }, [miId, otroId, saldoUrl, saldoAbs])

  if (sesionLoading || !sesion) return null
  if (!otro) return null

  const aId = deId === miId ? otroId : miId

  const dePersn  = deId === miId ? sesion  : { nombre: otro.nombre, avatar_color: otro.avatar_color }
  const aPersn   = deId === miId ? { nombre: otro.nombre, avatar_color: otro.avatar_color } : sesion

  function handleMontoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/\D/g, '')
    if (!raw) { setMonto(0); setDisplayMonto(''); return }
    const n = parseInt(raw, 10)
    setMonto(n)
    setDisplayMonto(n.toLocaleString('es-CL'))
  }

  const montoInvalido = monto < 1 || monto > saldoAbs

  async function handleConfirmar() {
    if (!sesion || montoInvalido) return
    setLoading(true)
    const result = await registrarPago({
      grupo_id:         sesion.grupo_id,
      de_integrante_id: deId,
      a_integrante_id:  aId,
      monto,
      fecha,
      metodo,
    })
    setLoading(false)

    if (!result.ok) {
      setToast({ mensaje: result.error, tipo: 'error' })
      return
    }

    setToast({ mensaje: 'Pago registrado ✓', tipo: 'exito' })
    setTimeout(() => router.replace(`/historial?persona=${otroId}`), 1800)
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--color-bg)', paddingBottom: 40 }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>

        {/* Header */}
        <header style={{
          padding: '56px var(--page-px) 20px',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
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
          <div>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', fontFamily: F, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Saldar deuda
            </p>
            <h1 style={{ margin: '2px 0 0', fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-lora), serif', color: 'var(--color-text-primary)' }}>
              Registrar pago
            </h1>
          </div>
        </header>

        <div style={{ padding: '0 var(--page-px)', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Indicador de dirección */}
          <div style={{
            background: 'var(--color-card)',
            borderRadius: 20, padding: '20px 18px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16,
          }}>
            <div style={{ textAlign: 'center' }}>
              <Avatar nombre={dePersn.nombre} color={dePersn.avatar_color} size={48} />
              <p style={{ margin: '8px 0 0', fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: F }}>
                {dePersn.nombre}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--color-text-secondary)', fontFamily: F }}>paga</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <svg width="32" height="16" viewBox="0 0 32 16" fill="none">
                <path d="M2 8h24M20 3l6 5-6 5" stroke="var(--color-cta)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--color-cta)', fontFamily: F }}>
                {formatCLP(monto || saldoAbs)}
              </p>
            </div>

            <div style={{ textAlign: 'center' }}>
              <Avatar nombre={aPersn.nombre} color={aPersn.avatar_color} size={48} />
              <p style={{ margin: '8px 0 0', fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: F }}>
                {aPersn.nombre}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--color-text-secondary)', fontFamily: F }}>recibe</p>
            </div>
          </div>

          {/* Monto */}
          <div>
            <Label>Monto a pagar</Label>
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
                fontSize: 16, color: 'var(--color-text-secondary)', fontFamily: F, pointerEvents: 'none',
              }}>$</span>
              <input
                type="text"
                inputMode="numeric"
                placeholder={saldoAbs.toLocaleString('es-CL')}
                value={displayMonto}
                onChange={handleMontoChange}
                onFocus={() => setMontoFocused(true)}
                onBlur={() => setMontoFocused(false)}
                style={{ ...inputStyle(montoFocused), paddingLeft: 28 }}
              />
            </div>
            {monto > saldoAbs && (
              <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--color-negative)', fontFamily: F }}>
                No puede superar el saldo pendiente de {formatCLP(saldoAbs)}
              </p>
            )}
            <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--color-text-disabled)', fontFamily: F }}>
              Saldo pendiente: {formatCLP(saldoAbs)}
            </p>
          </div>

          {/* ¿Quién paga? */}
          <div>
            <Label>¿Quién registra el pago?</Label>
            <div style={{ display: 'flex', gap: 10 }}>
              {[
                { id: miId,  nombre: sesion.nombre,     color: sesion.avatar_color },
                { id: otroId, nombre: otro.nombre,      color: otro.avatar_color },
              ].map(p => {
                const activo = deId === p.id
                return (
                  <button
                    key={p.id}
                    onClick={() => setDeId(p.id)}
                    style={{
                      flex: 1, height: 64, borderRadius: 16, cursor: 'pointer',
                      border: activo ? '2px solid var(--color-cta)' : '2px solid var(--color-border)',
                      background: activo ? 'white' : 'var(--color-card)',
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '0 14px',
                      transition: 'all 150ms ease',
                      WebkitTapHighlightColor: 'transparent',
                    }}
                  >
                    <Avatar nombre={p.nombre} color={p.color} size={32} />
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: F }}>
                      {p.id === miId ? 'Yo' : p.nombre}
                    </span>
                    {activo && (
                      <div style={{
                        marginLeft: 'auto', width: 18, height: 18, borderRadius: '50%',
                        background: 'var(--color-cta)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Método */}
          <div>
            <Label>Método de pago</Label>
            <div style={{ display: 'flex', gap: 8 }}>
              {METODOS.map(m => {
                const activo = metodo === m.id
                return (
                  <button
                    key={m.id}
                    onClick={() => setMetodo(m.id)}
                    style={{
                      flex: 1, height: 44, borderRadius: 100, cursor: 'pointer',
                      border: activo ? '2px solid var(--color-cta)' : '2px solid var(--color-border)',
                      background: activo ? 'white' : 'var(--color-card)',
                      fontSize: 12, fontWeight: activo ? 600 : 400,
                      color: activo ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                      fontFamily: F,
                      transition: 'all 150ms ease',
                      WebkitTapHighlightColor: 'transparent',
                    }}
                  >
                    {m.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Fecha */}
          <div>
            <Label>Fecha</Label>
            <input
              type="date"
              value={fecha}
              onChange={e => setFecha(e.target.value)}
              style={{
                height: 52, width: '100%', boxSizing: 'border-box',
                padding: '0 16px', borderRadius: 14,
                border: '1.5px solid #D8D4CE',
                background: '#FFFFFF', fontSize: 15,
                color: 'var(--color-text-primary)',
                fontFamily: F, outline: 'none',
              }}
            />
          </div>

          {/* Nota */}
          <div>
            <Label>Nota (opcional)</Label>
            <textarea
              placeholder="Ej: Transfer de mayo"
              value={nota}
              onChange={e => setNota(e.target.value)}
              onFocus={() => setNotaFocused(true)}
              onBlur={() => setNotaFocused(false)}
              rows={2}
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '12px 16px', borderRadius: 14,
                border: `1.5px solid ${notaFocused ? '#00C851' : '#D8D4CE'}`,
                background: '#FFFFFF', fontSize: 15,
                color: 'var(--color-text-primary)',
                fontFamily: F, outline: 'none', resize: 'none',
                lineHeight: 1.5,
                transition: 'border-color 150ms ease',
              }}
            />
          </div>

          {/* Botón confirmar */}
          <button
            onClick={handleConfirmar}
            disabled={montoInvalido || loading}
            style={{
              height: 56, width: '100%', borderRadius: 100, border: 'none',
              background: (montoInvalido || loading) ? 'var(--color-text-disabled)' : 'var(--color-cta)',
              color: 'white', fontSize: 16, fontWeight: 600,
              fontFamily: F, cursor: (montoInvalido || loading) ? 'not-allowed' : 'pointer',
              transition: 'transform 120ms ease',
              marginTop: 4,
            }}
            onPointerDown={e => { if (!montoInvalido && !loading) e.currentTarget.style.transform = 'scale(0.97)' }}
            onPointerUp={e => (e.currentTarget.style.transform = 'scale(1)')}
            onPointerLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
          >
            {loading ? 'Registrando…' : 'Confirmar pago 💸'}
          </button>

        </div>
      </div>

      {toast && (
        <Toast mensaje={toast.mensaje} tipo={toast.tipo} onClose={() => setToast(null)} />
      )}
    </div>
  )
}
