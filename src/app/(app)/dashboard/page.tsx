'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSession } from '@/lib/session-store'
import { calcularSaldos, type SaldoPar } from '@/lib/saldos'
import { formatCLP, formatearTiempoRelativo } from '@/lib/format'
import { Avatar } from '@/components/app/Avatar'
import { BottomNav } from '@/components/app/BottomNav'
import { Toast } from '@/components/app/Toast'
import { supabase } from '@/lib/supabase'

// ── Barra rayada (firma visual del rediseño) ──────────────────
function BarraRayada({ pct, color, colorClaro }: { pct: number; color: string; colorClaro: string }) {
  return (
    <div style={{ height: 11, borderRadius: 7, background: 'var(--color-track)', overflow: 'hidden' }}>
      <div
        className="bar-stripe"
        style={{
          width: `${pct}%`, height: '100%', borderRadius: 7,
          background: `repeating-linear-gradient(-45deg, ${color}, ${color} 5px, ${colorClaro} 5px, ${colorClaro} 10px)`,
        }}
      />
    </div>
  )
}

// ── Skeleton fila ─────────────────────────────────────────────
function SkeletonRow() {
  return (
    <div aria-hidden="true" style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '13px 0' }}>
      <div className="skeleton" style={{ width: 42, height: 42, borderRadius: '50%', flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div className="skeleton" style={{ height: 14, width: '38%', borderRadius: 6 }} />
        <div className="skeleton" style={{ height: 11, width: '30%', borderRadius: 6 }} />
      </div>
      <div className="skeleton" style={{ height: 22, width: 76, borderRadius: 100 }} />
    </div>
  )
}

// ── Estado vacío (cero gastos en el grupo) ───────────────────
function EstadoVacio() {
  return (
    <div style={{
      background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 18,
      textAlign: 'center', padding: '40px 24px',
    }}>
      <div style={{ fontSize: 44, marginBottom: 10 }}>🧾</div>
      <p style={{
        margin: 0, fontSize: 17, fontWeight: 700,
        color: 'var(--color-text-primary)',
        fontFamily: 'var(--font-sora), sans-serif',
      }}>
        Todavía no hay gastos
      </p>
      <p style={{
        margin: '8px 0 22px', fontSize: 13.5,
        color: 'var(--color-text-secondary)',
        fontFamily: 'var(--font-dm-sans), sans-serif',
        lineHeight: 1.5,
      }}>
        Agrega el primer gasto del grupo y los saldos aparecerán aquí automáticamente.
      </p>
      <Link
        href="/gastos/nuevo"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          height: 48, padding: '0 24px', borderRadius: 100,
          background: 'var(--gradient-cta)', color: 'white',
          textDecoration: 'none',
          fontSize: 14.5, fontWeight: 700,
          fontFamily: 'var(--font-dm-sans), sans-serif',
          boxShadow: 'var(--shadow-cta)',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <path d="M9 4v10M4 9h10" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        Agregar primer gasto
      </Link>
    </div>
  )
}

// ── Fila de saldo por persona ────────────────────────────────
function FilaSaldo({
  par, esUltima, onClick,
}: {
  par: SaldoPar; esUltima: boolean; onClick: () => void
}) {
  const { neto, integrante } = par

  const pill =
    neto > 0
      ? { label: 'Te debe', color: 'var(--color-positive)', tint: 'var(--color-positive-tint)', border: 'var(--color-positive-border)' }
      : neto < 0
      ? { label: 'Le debes', color: 'var(--color-negative)', tint: 'var(--color-negative-tint)', border: 'var(--color-negative-border)' }
      : { label: 'Al día', color: 'var(--color-neutral)', tint: 'var(--color-neutral-tint)', border: 'var(--color-neutral-border)' }

  return (
    <button
      onClick={onClick}
      className="row-lift"
      aria-label={`${integrante.nombre}: ${pill.label} ${formatCLP(Math.abs(neto))}`}
      style={{
        display: 'flex', alignItems: 'center', gap: 13, width: '100%',
        padding: '13px 0', border: 'none', background: 'transparent',
        cursor: 'pointer', textAlign: 'left',
        borderBottom: esUltima ? 'none' : '1px solid var(--color-divider)',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <Avatar nombre={integrante.nombre} color={integrante.avatar_color} size={42} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          margin: 0, fontSize: 14.5, fontWeight: 700,
          color: 'var(--color-text-primary)',
          fontFamily: 'var(--font-dm-sans), sans-serif',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {integrante.nombre}
        </p>
        <p style={{
          margin: '1px 0 0', fontSize: 11.5,
          color: 'var(--color-text-muted)',
          fontFamily: 'var(--font-dm-sans), sans-serif',
        }}>
          {formatCLP(Math.abs(neto))}
        </p>
      </div>

      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0,
        border: `1px solid ${pill.border}`, background: pill.tint,
        borderRadius: 100, padding: '4px 10px',
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: pill.color, flexShrink: 0 }} />
        <span style={{ fontSize: 11.5, fontWeight: 600, color: pill.color, fontFamily: 'var(--font-dm-sans), sans-serif' }}>
          {pill.label}
        </span>
      </div>
    </button>
  )
}

// ── Página principal ─────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter()
  const { sesion, loading: sesionLoading, cerrarSesion } = useSession()
  const [saldos, setSaldos] = useState<SaldoPar[]>([])
  const [cargando, setCargando] = useState(true)
  const [tieneGastos, setTieneGastos] = useState(true)
  const [ultimaActividad, setUltimaActividad] = useState<string | null>(null)
  const [toast, setToast] = useState<{ mensaje: string; tipo: 'exito' | 'error' } | null>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const cargarSaldos = useCallback(async () => {
    if (!sesion) return
    setCargando(true)
    try {
      const resultado = await calcularSaldos(sesion.grupo_id, sesion.integrante_id)
      setSaldos(resultado)

      // Verificar si hay algún gasto (para el estado vacío)
      const { count } = await supabase
        .from('gastos')
        .select('id', { count: 'exact', head: true })
        .eq('grupo_id', sesion.grupo_id)
        .is('mes_cierre', null)
      setTieneGastos((count ?? 0) > 0)

      // Gasto activo más reciente, para "Última actividad"
      const { data: ultimo } = await supabase
        .from('gastos')
        .select('creado_en')
        .eq('grupo_id', sesion.grupo_id)
        .is('mes_cierre', null)
        .order('creado_en', { ascending: false })
        .limit(1)
        .maybeSingle()
      setUltimaActividad(ultimo?.creado_en ?? null)
    } catch {
      setToast({ mensaje: 'Sin conexión. Intenta de nuevo.', tipo: 'error' })
    } finally {
      setCargando(false)
    }
  }, [sesion])

  // Suscripción Realtime — escucha inserciones en gastos del grupo
  useEffect(() => {
    if (!sesion) return

    const channel = supabase
      .channel(`gastos-grupo-${sesion.grupo_id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'gastos',
          filter: `grupo_id=eq.${sesion.grupo_id}`,
        },
        payload => {
          const nuevoGasto = payload.new as { creado_por: string; descripcion: string }
          // Si no fui yo quien lo creó, mostrar notificación
          if (nuevoGasto.creado_por !== sesion.integrante_id) {
            supabase
              .from('integrantes')
              .select('nombre')
              .eq('id', nuevoGasto.creado_por)
              .single()
              .then(({ data }) => {
                const quien = data?.nombre ?? 'Alguien'
                setToast({
                  mensaje: `${quien} agregó "${nuevoGasto.descripcion}"`,
                  tipo: 'exito',
                })
              })
          }
          cargarSaldos()
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'gastos', filter: `grupo_id=eq.${sesion.grupo_id}` },
        () => cargarSaldos()
      )
      .subscribe()

    channelRef.current = channel
    return () => { supabase.removeChannel(channel) }
  }, [sesion, cargarSaldos])

  useEffect(() => {
    if (!sesionLoading && !sesion) { router.replace('/login'); return }
    if (sesion) cargarSaldos()
  }, [sesion, sesionLoading, router, cargarSaldos])

  function handleCerrarSesion() {
    if (channelRef.current) supabase.removeChannel(channelRef.current)
    cerrarSesion()
    router.replace('/login')
  }

  if (sesionLoading || !sesion) return null

  const totalTeDeben = saldos.filter(s => s.neto > 0).reduce((acc, s) => acc + s.neto, 0)
  const totalDebes = saldos.filter(s => s.neto < 0).reduce((acc, s) => acc + Math.abs(s.neto), 0)
  const saldoNeto = totalTeDeben - totalDebes
  const maxBarra = Math.max(totalTeDeben, totalDebes, 1)
  const pctTeDeben = totalTeDeben > 0 ? Math.max(4, (totalTeDeben / maxBarra) * 100) : 0
  const pctDebes = totalDebes > 0 ? Math.max(4, (totalDebes / maxBarra) * 100) : 0
  const todoAlDia = tieneGastos && totalTeDeben === 0 && totalDebes === 0

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', paddingBottom: 96 }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>

      {/* ── HEADER ── */}
      <header style={{
        paddingTop: 'max(56px, calc(env(safe-area-inset-top, 0px) + 16px))',
        paddingBottom: 18,
        paddingLeft: 'var(--page-px)',
        paddingRight: 'var(--page-px)',
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', gap: 12,
      }}>
        <div style={{ minWidth: 0 }}>
          <p style={{
            margin: 0, fontSize: 12.5,
            color: 'var(--color-neutral)',
            fontFamily: 'var(--font-dm-sans), sans-serif',
          }}>
            Hola, {sesion.nombre.split(' ')[0]} 👋
          </p>
          <h1 style={{
            margin: '2px 0 0', fontSize: 24, fontWeight: 800,
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-sora), sans-serif',
            letterSpacing: '-0.02em',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            Tus cuentas
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
          {/* Campana — decorativa hasta que exista la pantalla de novedades */}
          <div
            aria-hidden="true"
            style={{
              width: 42, height: 42, borderRadius: '50%',
              background: 'var(--color-surface-white)', border: '1px solid var(--color-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <path d="M10 3a4 4 0 00-4 4c0 3-1.2 4.3-1.8 4.9-.3.3-.1.8.3.8h11c.4 0 .6-.5.3-.8C15.2 11.3 14 10 14 7a4 4 0 00-4-4zM8.5 15.5a1.5 1.5 0 003 0" stroke="var(--color-text-secondary)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <button
            onClick={handleCerrarSesion}
            aria-label="Cerrar sesión"
            style={{
              width: 42, height: 42, borderRadius: '50%', padding: 0,
              background: 'var(--color-surface-white)', border: '1px solid var(--color-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M7 3H4a1 1 0 00-1 1v10a1 1 0 001 1h3M11 12l3-3-3-3M14 9H7"
                stroke="var(--color-text-secondary)"
                strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <Avatar
            nombre={sesion.nombre}
            color={sesion.avatar_color}
            size={42}
            aria-label={`Avatar de ${sesion.nombre}`}
          />
        </div>
      </header>

      {/* ── CONTENIDO ── */}
      <main style={{ padding: '0 var(--page-px)' }}>

        {cargando && (
          <div style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 18, padding: '18px 18px 20px' }}>
            <div className="skeleton" style={{ height: 12, width: 140, borderRadius: 6, marginBottom: 10 }} />
            <div className="skeleton" style={{ height: 32, width: 170, borderRadius: 8, marginBottom: 18 }} />
            <div className="skeleton" style={{ height: 58, borderRadius: 12, marginBottom: 10 }} />
            <div className="skeleton" style={{ height: 58, borderRadius: 12 }} />
          </div>
        )}

        {!cargando && tieneGastos && !todoAlDia && (
          <div style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 18, padding: '18px 18px 20px' }}>
            <p style={{ margin: 0, fontSize: 12.5, color: 'var(--color-neutral)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
              Saldo total del grupo
            </p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 5 }}>
              <span style={{
                fontFamily: 'var(--font-sora), sans-serif', fontSize: 32, fontWeight: 800,
                color: 'var(--color-text-primary)', letterSpacing: '-0.02em',
              }}>
                {formatCLP(Math.abs(saldoNeto))}
              </span>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-muted)' }}>CLP</span>
            </div>
            {ultimaActividad && (
              <p style={{ margin: '4px 0 0', fontSize: 11.5, color: 'var(--color-text-muted)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
                Última act. {formatearTiempoRelativo(ultimaActividad)}
              </p>
            )}

            {totalTeDeben > 0 && (
              <div style={{ marginTop: 16, border: '1px solid var(--color-divider)', borderRadius: 12, padding: '12px 13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>Te deben</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'var(--font-sora), sans-serif' }}>
                    {formatCLP(totalTeDeben)}
                  </span>
                </div>
                <div style={{ marginTop: 8 }}>
                  <BarraRayada pct={pctTeDeben} color="#47C6F4" colorClaro="#6FD3F7" />
                </div>
              </div>
            )}

            {totalDebes > 0 && (
              <div style={{ marginTop: totalTeDeben > 0 ? 10 : 16, border: '1px solid var(--color-divider)', borderRadius: 12, padding: '12px 13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>Debes</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'var(--font-sora), sans-serif' }}>
                    {formatCLP(totalDebes)}
                  </span>
                </div>
                <div style={{ marginTop: 8 }}>
                  <BarraRayada pct={pctDebes} color="#F2B33D" colorClaro="#F6C463" />
                </div>
              </div>
            )}
          </div>
        )}

        {!cargando && todoAlDia && (
          <div style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 18, padding: 22, textAlign: 'center' }}>
            <div style={{ fontSize: 30, marginBottom: 6 }}>🎉</div>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
              ¡Todo al día!
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
              Sin deudas pendientes entre el grupo
            </p>
          </div>
        )}

        {!cargando && !tieneGastos && <EstadoVacio />}

        {tieneGastos && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '22px 2px 12px' }}>
              <span style={{
                fontFamily: 'var(--font-sora), sans-serif', fontSize: 16, fontWeight: 700,
                letterSpacing: '-0.01em', color: 'var(--color-text-primary)',
              }}>
                Saldos por persona
              </span>
              <Link href="/historial" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-cta)' }}>
                Ver todo
              </Link>
            </div>

            <div
              role="list"
              aria-label="Saldos con cada integrante"
              style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 18, padding: '4px 16px' }}
            >
              {cargando
                ? Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)
                : saldos.map((par, i) => (
                    <div role="listitem" key={par.integrante.id}>
                      <FilaSaldo
                        par={par}
                        esUltima={i === saldos.length - 1}
                        onClick={() => router.push(`/historial?persona=${par.integrante.id}`)}
                      />
                    </div>
                  ))
              }
            </div>
          </>
        )}
      </main>

      </div>{/* end max-width wrapper */}

      <BottomNav />

      {toast && (
        <Toast mensaje={toast.mensaje} tipo={toast.tipo} onClose={() => setToast(null)} />
      )}
    </div>
  )
}
