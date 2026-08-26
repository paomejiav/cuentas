'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { listarDivisionesPendientesConPersona, type DivisionASaldar } from '@/lib/pagos'
import type { UsuarioMini } from '@/lib/cuentas'
import { formatCLP } from '@/lib/format'
import { Avatar } from '@/components/app/Avatar'
import { RegistrarPago } from '@/components/app/RegistrarPago'

const F_HEAD = 'var(--font-sora), sans-serif'
const F_BODY = 'var(--font-dm-sans), sans-serif'

interface Props {
  usuarioId: string
  personaId: string
  /** Uno de los dos según el origen — nunca ambos. */
  grupoId?: string
  cuentaId?: string
  volverHref: string
}

function fechaCorta(fechaISO: string): string {
  return new Date(fechaISO + 'T12:00:00').toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })
}

export function SaldosConPersona({ usuarioId, personaId, grupoId, cuentaId, volverHref }: Props) {
  const router = useRouter()

  const [cargando, setCargando] = useState(true)
  const [persona, setPersona] = useState<UsuarioMini | null>(null)
  const [divisiones, setDivisiones] = useState<DivisionASaldar[]>([])
  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(new Set())
  const [mostrarPago, setMostrarPago] = useState(false)

  async function cargar() {
    setCargando(true)
    const [{ data: personaData }, lista] = await Promise.all([
      supabase.from('usuarios').select('id, nombre, avatar_color').eq('id', personaId).single(),
      listarDivisionesPendientesConPersona({ usuarioId, contraparteId: personaId, grupoId, cuentaId }),
    ])
    setPersona((personaData as UsuarioMini) ?? null)
    setDivisiones(lista)
    setSeleccionadas(new Set(lista.map(d => d.division_id)))
    setCargando(false)
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuarioId, personaId, grupoId, cuentaId])

  function toggle(id: string) {
    setSeleccionadas(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const divisionesSeleccionadas = divisiones.filter(d => seleccionadas.has(d.division_id))
  const total = divisionesSeleccionadas.reduce((s, d) => s + d.monto_asignado, 0)

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--color-bg)' }}>
      <div style={{
        maxWidth: 440, margin: '0 auto', padding: '0 18px',
        paddingTop: 'max(20px, env(safe-area-inset-top, 0px))',
        paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
        minHeight: '100dvh', boxSizing: 'border-box', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <button
            onClick={() => router.push(volverHref)}
            aria-label="Volver"
            style={{
              width: 42, height: 42, borderRadius: 13, background: 'var(--color-surface-white)',
              border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0, padding: 0,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M11 4l-5 5 5 5" stroke="var(--color-text-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
            {persona && <Avatar nombre={persona.nombre} color={persona.avatar_color} size={38} />}
            <div style={{ fontFamily: F_HEAD, fontSize: 19, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--color-text-primary)' }}>
              Saldos con {persona?.nombre ?? '…'}
            </div>
          </div>
        </div>

        {cargando ? (
          <p style={{ fontSize: 13.5, color: 'var(--color-text-secondary)', fontFamily: F_BODY }}>Cargando…</p>
        ) : divisiones.length === 0 ? (
          <div style={{ background: 'var(--color-surface-white)', border: '1px solid var(--color-border)', borderRadius: 18, padding: '32px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: F_BODY }}>
              Estás al día con {persona?.nombre}
            </p>
          </div>
        ) : (
          <>
            <p style={{
              margin: '0 2px 10px', fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)',
              fontFamily: F_BODY, textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>
              Gastos pendientes · {divisiones.length}
            </p>
            <div style={{ background: 'var(--color-surface-white)', border: '1px solid var(--color-border)', borderRadius: 18, padding: '4px 16px' }}>
              {divisiones.map((d, idx) => {
                const marcado = seleccionadas.has(d.division_id)
                return (
                  <button
                    key={d.division_id}
                    onClick={() => toggle(d.division_id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '13px 0', width: '100%',
                      border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left',
                      borderBottom: idx < divisiones.length - 1 ? '1px solid var(--color-divider)' : 'none',
                    }}
                  >
                    <div style={{
                      width: 38, height: 38, borderRadius: 12, background: 'var(--tint-cta)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0,
                    }}>
                      🧾
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: F_BODY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {d.descripcion}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--color-neutral)', marginTop: 1, fontFamily: F_BODY }}>
                        {fechaCorta(d.fecha)}
                      </div>
                    </div>
                    <span style={{ fontFamily: F_HEAD, fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)', flexShrink: 0 }}>
                      {formatCLP(d.monto_asignado)}
                    </span>
                    <span style={{
                      width: 22, height: 22, borderRadius: 7, marginLeft: 12, flexShrink: 0,
                      background: marcado ? 'var(--gradient-cta)' : 'var(--color-icon-bg)',
                      border: marcado ? 'none' : '1px solid var(--color-border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {marcado && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6l2.5 2.5L9.5 3" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                    </span>
                  </button>
                )
              })}
            </div>
          </>
        )}

        <div style={{ flex: 1 }} />

        {divisiones.length > 0 && (
          <div style={{ paddingTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10, padding: '0 2px' }}>
              <span style={{ fontSize: 13, color: 'var(--color-text-secondary)', fontFamily: F_BODY }}>Total seleccionado</span>
              <span style={{ fontFamily: F_HEAD, fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)' }}>{formatCLP(total)}</span>
            </div>
            <button
              onClick={() => setMostrarPago(true)}
              disabled={divisionesSeleccionadas.length === 0}
              style={{
                height: 54, width: '100%', borderRadius: 15, border: 'none',
                background: 'var(--gradient-cta)', boxShadow: 'var(--shadow-cta)',
                color: '#fff', fontSize: 15.5, fontWeight: 700, fontFamily: F_BODY,
                cursor: divisionesSeleccionadas.length === 0 ? 'default' : 'pointer',
                opacity: divisionesSeleccionadas.length === 0 ? 0.5 : 1,
              }}
            >
              Registrar pago
            </button>
          </div>
        )}
      </div>

      {mostrarPago && persona && (
        <RegistrarPago
          miId={usuarioId}
          contraparte={persona}
          divisiones={divisionesSeleccionadas}
          onCerrar={() => setMostrarPago(false)}
          onConfirmado={() => {
            setMostrarPago(false)
            cargar()
          }}
        />
      )}
    </main>
  )
}
