'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  obtenerCuenta, obtenerMiembrosCuenta, calcularSaldoCuenta, listarGastosCuenta, calcularSaldosCuenta,
  listarMiembrosGrupoParaCuenta, ICONO_TIPO, LABEL_TIPO,
  type CuentaDetalle, type MiembroCuenta, type SaldoCuenta, type GastoDeCuenta, type SaldoIntegrante, type MiembroGrupoMini,
} from '@/lib/cuentas'
import { CATEGORIA_EMOJI } from '@/types/database'
import type { Categoria } from '@/types/database'
import { formatCLP } from '@/lib/format'
import { Avatar } from '@/components/app/Avatar'
import { DetalleGasto } from '@/components/app/DetalleGasto'

const F_HEAD = 'var(--font-sora), sans-serif'
const F_BODY = 'var(--font-dm-sans), sans-serif'

type Tab = 'gastos' | 'saldos'

export default function DetalleCuentaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  const [estado, setEstado] = useState<'cargando' | 'ok' | 'no-encontrada'>('cargando')
  const [usuarioId, setUsuarioId] = useState<string | null>(null)
  const [cuenta, setCuenta] = useState<CuentaDetalle | null>(null)
  const [miembros, setMiembros] = useState<MiembroCuenta[]>([])
  const [saldo, setSaldo] = useState<SaldoCuenta>({ gastoTotal: 0, tuParte: 0, tuSaldo: 0 })
  const [gastos, setGastos] = useState<GastoDeCuenta[]>([])
  const [saldosIntegrantes, setSaldosIntegrantes] = useState<SaldoIntegrante[]>([])
  const [tab, setTab] = useState<Tab>('gastos')

  const [mostrarAgregar, setMostrarAgregar] = useState(false)
  const [disponibles, setDisponibles] = useState<MiembroGrupoMini[]>([])
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set())
  const [agregando, setAgregando] = useState(false)

  const [gastoAbierto, setGastoAbierto] = useState<string | null>(null)

  async function cargarTodo(cuentaId: string, uid: string) {
    const c = await obtenerCuenta(cuentaId)
    if (!c) { setEstado('no-encontrada'); return }

    const [miembrosCuenta, saldoCuenta, gastosCuenta] = await Promise.all([
      obtenerMiembrosCuenta(cuentaId),
      calcularSaldoCuenta(cuentaId, uid),
      listarGastosCuenta(cuentaId),
    ])
    const saldosPorIntegrante = await calcularSaldosCuenta(cuentaId, uid, miembrosCuenta)

    setCuenta(c)
    setMiembros(miembrosCuenta)
    setSaldo(saldoCuenta)
    setGastos(gastosCuenta)
    setSaldosIntegrantes(saldosPorIntegrante)
    setEstado('ok')
  }

  useEffect(() => {
    let activo = true

    async function cargar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }
      if (!activo) return
      setUsuarioId(user.id)
      await cargarTodo(id, user.id)
    }

    cargar()
    return () => { activo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, router])

  async function abrirAgregar() {
    if (!cuenta || !usuarioId) return
    const lista = await listarMiembrosGrupoParaCuenta(cuenta.grupo_id, cuenta.id, usuarioId)
    setDisponibles(lista.filter(m => !m.yaEsMiembroCuenta))
    setSeleccionados(new Set())
    setMostrarAgregar(true)
  }

  function toggleSeleccionado(idm: string) {
    setSeleccionados(prev => {
      const next = new Set(prev)
      if (next.has(idm)) next.delete(idm)
      else next.add(idm)
      return next
    })
  }

  async function confirmarAgregar() {
    if (!cuenta || seleccionados.size === 0) return
    setAgregando(true)
    try {
      for (const idm of seleccionados) {
        await supabase.rpc('agregar_miembro_cuenta', { p_cuenta_id: cuenta.id, p_usuario_id: idm })
      }
      setMostrarAgregar(false)
      if (usuarioId) await cargarTodo(cuenta.id, usuarioId)
    } finally {
      setAgregando(false)
    }
  }

  if (estado === 'cargando') {
    return (
      <main style={{ minHeight: '100dvh', background: 'var(--color-bg)' }}>
        <p style={{ padding: 24, fontSize: 13.5, color: 'var(--color-text-secondary)', fontFamily: F_BODY }}>Cargando…</p>
      </main>
    )
  }

  if (estado === 'no-encontrada' || !cuenta) {
    return (
      <main style={{ minHeight: '100dvh', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
        <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', fontFamily: F_BODY }}>No encontramos esta cuenta, o no tenés acceso.</p>
        <Link href="/cuentas" style={{ marginTop: 12, fontSize: 13.5, fontWeight: 700, color: 'var(--color-cta)', fontFamily: F_BODY, textDecoration: 'none' }}>← Volver a Cuentas</Link>
      </main>
    )
  }

  const esAdmin = miembros.find(m => m.id === usuarioId)?.rol === 'admin'
  const alDia = saldo.tuSaldo >= 0

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
            onClick={() => router.push('/cuentas')}
            aria-label="Volver"
            style={{
              width: 42, height: 42, borderRadius: 13, background: 'var(--color-surface-white)',
              border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0, padding: 0,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M11 4l-5 5 5 5" stroke="var(--color-text-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: 'var(--tint-cta)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
              {cuenta.icono ?? ICONO_TIPO[cuenta.tipo]}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: F_HEAD, fontSize: 17, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {cuenta.nombre}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--color-neutral)', fontFamily: F_BODY }}>{LABEL_TIPO[cuenta.tipo]}</div>
            </div>
          </div>
        </div>

        <div style={{
          borderRadius: 18, padding: 18, background: 'var(--gradient-cta)', color: '#fff',
          boxShadow: 'var(--shadow-cta)',
        }}>
          <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.8)', fontFamily: F_BODY }}>Tu saldo en esta cuenta</div>
          <div style={{ fontFamily: F_HEAD, fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', marginTop: 4 }}>
            {alDia ? formatCLP(0) : `−${formatCLP(Math.abs(saldo.tuSaldo))}`}
          </div>
          <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.85)', marginTop: 3, fontFamily: F_BODY }}>
            {alDia ? 'Estás al día' : 'Le debés al grupo'}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <div style={{ flex: 1, background: 'rgba(255,255,255,.16)', borderRadius: 12, padding: '10px 12px' }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.8)', fontFamily: F_BODY }}>Gasto total</div>
              <div style={{ fontFamily: F_HEAD, fontSize: 16, fontWeight: 700, marginTop: 2 }}>{formatCLP(saldo.gastoTotal)}</div>
            </div>
            <div style={{ flex: 1, background: 'rgba(255,255,255,.16)', borderRadius: 12, padding: '10px 12px' }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.8)', fontFamily: F_BODY }}>Tu parte</div>
              <div style={{ fontFamily: F_HEAD, fontSize: 16, fontWeight: 700, marginTop: 2 }}>{formatCLP(saldo.tuParte)}</div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '18px 2px 12px' }}>
          <div style={{ display: 'flex' }}>
            {miembros.slice(0, 4).map((m, idx) => (
              <div key={m.id} style={{ marginLeft: idx === 0 ? 0 : -8 }}>
                <Avatar nombre={m.nombre} color={m.avatar_color} size={32} />
              </div>
            ))}
          </div>
          <span style={{ fontSize: 12.5, color: 'var(--color-text-secondary)', marginLeft: 8, fontWeight: 500, fontFamily: F_BODY }}>
            {miembros.length} integrante{miembros.length === 1 ? '' : 's'}
          </span>
          <div style={{ flex: 1 }} />
          {esAdmin && (
            <button
              onClick={abrirAgregar}
              aria-label="Agregar integrante"
              style={{
                width: 32, height: 32, borderRadius: '50%', border: '1.6px dashed var(--color-border)',
                background: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="var(--color-neutral)" strokeWidth="1.8" strokeLinecap="round" /></svg>
            </button>
          )}
        </div>

        {mostrarAgregar && (
          <div style={{ background: 'var(--color-surface-white)', border: '1px solid var(--color-border)', borderRadius: 16, padding: 14, marginBottom: 12 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: F_BODY, marginBottom: 8 }}>
              Agregar del grupo
            </div>
            {disponibles.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-secondary)', fontFamily: F_BODY }}>
                Todos los del grupo ya son parte de esta cuenta.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {disponibles.map(m => {
                  const marcado = seleccionados.has(m.id)
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleSeleccionado(m.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px',
                        border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left',
                      }}
                    >
                      <Avatar nombre={m.nombre} color={m.avatar_color} size={30} />
                      <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: F_BODY }}>{m.nombre}</span>
                      <span style={{
                        width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                        background: marcado ? 'var(--gradient-cta)' : 'var(--color-icon-bg)',
                        border: marcado ? 'none' : '1px solid var(--color-border)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {marcado && <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2.5 6l2.5 2.5L9.5 3" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button
                type="button"
                onClick={() => setMostrarAgregar(false)}
                style={{ flex: 1, height: 38, borderRadius: 11, border: '1px solid var(--color-border)', background: 'var(--color-surface-white)', color: 'var(--color-text-primary)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: F_BODY }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarAgregar}
                disabled={seleccionados.size === 0 || agregando}
                style={{
                  flex: 1, height: 38, borderRadius: 11, border: 'none', background: 'var(--gradient-cta)',
                  color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: F_BODY,
                  opacity: seleccionados.size === 0 || agregando ? 0.5 : 1,
                }}
              >
                {agregando ? 'Agregando…' : 'Agregar'}
              </button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', background: 'var(--color-card-light)', borderRadius: 11, padding: 4, gap: 3, marginBottom: 12 }}>
          <button
            onClick={() => setTab('gastos')}
            style={{
              flex: 1, textAlign: 'center', fontSize: 12.5, fontWeight: 700, borderRadius: 8, padding: '8px 0', border: 'none', cursor: 'pointer',
              color: tab === 'gastos' ? '#fff' : 'var(--color-text-secondary)',
              background: tab === 'gastos' ? 'var(--color-cta)' : 'transparent',
            }}
          >
            Gastos
          </button>
          <button
            onClick={() => setTab('saldos')}
            style={{
              flex: 1, textAlign: 'center', fontSize: 12.5, fontWeight: 700, borderRadius: 8, padding: '8px 0', border: 'none', cursor: 'pointer',
              color: tab === 'saldos' ? '#fff' : 'var(--color-text-secondary)',
              background: tab === 'saldos' ? 'var(--color-cta)' : 'transparent',
            }}
          >
            Saldos
          </button>
        </div>

        {tab === 'gastos' && (
          gastos.length === 0 ? (
            <div style={{ background: 'var(--color-surface-white)', border: '1px solid var(--color-border)', borderRadius: 18, padding: '28px 18px', textAlign: 'center' }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>🧾</div>
              <p style={{ margin: 0, fontSize: 13.5, color: 'var(--color-text-secondary)', fontFamily: F_BODY }}>Todavía no hay gastos en esta cuenta.</p>
            </div>
          ) : (
            <div style={{ background: 'var(--color-surface-white)', border: '1px solid var(--color-border)', borderRadius: 18, padding: '4px 16px' }}>
              {gastos.map((g, idx) => (
                <button
                  key={g.id}
                  onClick={() => setGastoAbierto(g.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '13px 0', width: '100%',
                    border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left',
                    borderBottom: idx < gastos.length - 1 ? '1px solid var(--color-divider)' : 'none',
                  }}
                >
                  <div style={{ width: 38, height: 38, borderRadius: 12, background: 'var(--tint-cta)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                    {CATEGORIA_EMOJI[g.categoria as Categoria] ?? '📦'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: F_BODY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {g.descripcion}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--color-neutral)', marginTop: 1, fontFamily: F_BODY }}>
                      {g.pagador?.nombre ?? '—'} · {new Date(g.fecha).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}
                    </div>
                  </div>
                  <span style={{ fontFamily: F_HEAD, fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)', flexShrink: 0 }}>
                    {formatCLP(g.monto_total)}
                  </span>
                </button>
              ))}
            </div>
          )
        )}

        {tab === 'saldos' && (
          saldosIntegrantes.length === 0 ? (
            <div style={{ background: 'var(--color-surface-white)', border: '1px solid var(--color-border)', borderRadius: 18, padding: '28px 18px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 13.5, color: 'var(--color-text-secondary)', fontFamily: F_BODY }}>No hay otros integrantes en esta cuenta.</p>
            </div>
          ) : (
            <div style={{ background: 'var(--color-surface-white)', border: '1px solid var(--color-border)', borderRadius: 18, padding: '4px 16px' }}>
              {saldosIntegrantes.map((s, idx) => {
                const fila = (
                  <>
                    <Avatar nombre={s.usuario.nombre} color={s.usuario.avatar_color} size={36} />
                    <div style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: F_BODY }}>
                      {s.usuario.nombre}
                    </div>
                    {s.neto === 0 ? (
                      <span style={{ fontSize: 12.5, color: 'var(--color-text-muted)', fontFamily: F_BODY }}>Sin deudas</span>
                    ) : (
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontFamily: F_HEAD, fontSize: 14, fontWeight: 700, color: s.neto > 0 ? 'var(--color-positive)' : 'var(--color-negative)' }}>
                          {formatCLP(Math.abs(s.neto))}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontFamily: F_BODY }}>
                          {s.neto > 0 ? 'te debe' : 'le debés'}
                        </div>
                      </div>
                    )}
                  </>
                )
                const estilo: React.CSSProperties = {
                  display: 'flex', alignItems: 'center', gap: 12, padding: '13px 0',
                  borderBottom: idx < saldosIntegrantes.length - 1 ? '1px solid var(--color-divider)' : 'none',
                }
                if (s.neto < 0) {
                  return (
                    <Link key={s.usuario.id} href={`/cuentas/${cuenta.id}/saldos/${s.usuario.id}`} style={{ ...estilo, textDecoration: 'none' }}>
                      {fila}
                    </Link>
                  )
                }
                return <div key={s.usuario.id} style={estilo}>{fila}</div>
              })}
            </div>
          )
        )}

        <div style={{ flex: 1 }} />

        <div style={{ paddingTop: 16 }}>
          <Link
            href={`/cuentas/${cuenta.id}/gastos/nuevo`}
            style={{
              height: 54, borderRadius: 15, border: 'none', background: 'var(--gradient-cta)', boxShadow: 'var(--shadow-cta)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, textDecoration: 'none',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 4v10M4 9h10" stroke="#fff" strokeWidth="2" strokeLinecap="round" /></svg>
            <span style={{ fontSize: 15.5, fontWeight: 700, color: '#fff', fontFamily: F_BODY }}>Agregar gasto</span>
          </Link>
        </div>
      </div>

      {gastoAbierto && usuarioId && (
        <DetalleGasto
          gastoId={gastoAbierto}
          miId={usuarioId}
          onClose={() => setGastoAbierto(null)}
          onEliminado={() => { setGastoAbierto(null); cargarTodo(cuenta.id, usuarioId) }}
          onPagoRegistrado={() => { setGastoAbierto(null); cargarTodo(cuenta.id, usuarioId) }}
        />
      )}
    </main>
  )
}
