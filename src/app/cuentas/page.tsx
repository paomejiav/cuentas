'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { resolverGrupoActivo, type GrupoOpcion } from '@/lib/grupo-activo'
import { listarCuentasConResumen, ICONO_TIPO, type CuentaResumen, type ResumenGrupo } from '@/lib/cuentas'
import { formatCLP } from '@/lib/format'
import { Avatar } from '@/components/app/Avatar'
import { BottomNav } from '@/components/app/BottomNav'

const F_HEAD = 'var(--font-sora), sans-serif'
const F_BODY = 'var(--font-dm-sans), sans-serif'

function StatusPill({ estado }: { estado: 'pendiente' | 'al-dia' }) {
  const esPendiente = estado === 'pendiente'
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, borderRadius: 100, padding: '4px 10px',
      border: `1px solid ${esPendiente ? 'var(--color-warning-border)' : 'var(--color-positive-border)'}`,
      background: esPendiente ? 'var(--color-warning-tint)' : 'var(--color-positive-tint)',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: esPendiente ? 'var(--color-warning-dot)' : 'var(--color-positive)' }} />
      <span style={{ fontSize: 11, fontWeight: 600, color: esPendiente ? 'var(--color-warning)' : 'var(--color-positive)', fontFamily: F_BODY }}>
        {esPendiente ? 'Pendiente' : 'Al día'}
      </span>
    </div>
  )
}

function AvataresApilados({ integrantes }: { integrantes: CuentaResumen['integrantes'] }) {
  const visibles = integrantes.slice(0, 3)
  const resto = integrantes.length - visibles.length
  return (
    <div style={{ display: 'flex' }}>
      {visibles.map((u, idx) => (
        <div key={u.id} style={{ marginLeft: idx === 0 ? 0 : -9, border: '2px solid var(--color-surface-white)', borderRadius: '50%' }}>
          <Avatar nombre={u.nombre} color={u.avatar_color} size={28} />
        </div>
      ))}
      {resto > 0 && (
        <div style={{
          width: 28, height: 28, borderRadius: '50%', marginLeft: -9,
          border: '2px solid var(--color-surface-white)', background: 'var(--color-card-light)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 700, color: 'var(--color-neutral)', fontFamily: F_HEAD,
        }}>
          +{resto}
        </div>
      )}
    </div>
  )
}

function TarjetaCuenta({ cuenta, href }: { cuenta: CuentaResumen; href: string }) {
  return (
    <Link href={href} style={{
      display: 'block', background: 'var(--color-surface-white)', border: '1px solid var(--color-border)',
      borderRadius: 18, padding: 16, textDecoration: 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 13, background: 'var(--tint-cta)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0,
        }}>
          {cuenta.icono ?? ICONO_TIPO[cuenta.tipo]}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: F_BODY }}>{cuenta.nombre}</div>
          <div style={{ fontSize: 11.5, color: 'var(--color-neutral)', marginTop: 1, fontFamily: F_BODY }}>
            {cuenta.integrantes.length} integrante{cuenta.integrantes.length === 1 ? '' : 's'} · {cuenta.cantidadGastos} gasto{cuenta.cantidadGastos === 1 ? '' : 's'}
          </div>
        </div>
        <StatusPill estado={cuenta.estado} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
        <AvataresApilados integrantes={cuenta.integrantes} />
        <span style={{ fontFamily: F_HEAD, fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)' }}>
          {formatCLP(cuenta.gastoTotal)}
        </span>
      </div>
    </Link>
  )
}

export default function CuentasListadoPage() {
  return (
    <Suspense>
      <CuentasListadoInner />
    </Suspense>
  )
}

function CuentasListadoInner() {
  const router = useRouter()
  const params = useSearchParams()

  const [estado, setEstado] = useState<'cargando' | 'elegir-grupo' | 'ok'>('cargando')
  const [grupos, setGrupos] = useState<GrupoOpcion[]>([])
  const [grupoNombre, setGrupoNombre] = useState('')
  const [nombreUsuario, setNombreUsuario] = useState('')
  const [avatarColor, setAvatarColor] = useState('#A8D8B9')
  const [cuentas, setCuentas] = useState<CuentaResumen[]>([])
  const [resumen, setResumen] = useState<ResumenGrupo>({ tuParteTotal: 0, pagado: 0, pendiente: 0 })

  useEffect(() => {
    let activo = true

    async function cargar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }

      const resolucion = await resolverGrupoActivo(user.id, params.get('grupo'))
      if (!activo) return

      if (resolucion.estado === 'sin-grupos') { router.replace('/'); return }
      if (resolucion.estado === 'elegir') {
        setGrupos(resolucion.grupos)
        setEstado('elegir-grupo')
        return
      }

      const [{ data: usuario }, { data: grupo }, { cuentas: listaCuentas, resumen: resumenGrupo }] = await Promise.all([
        supabase.from('usuarios').select('nombre, avatar_color').eq('id', user.id).single(),
        supabase.from('grupos').select('nombre').eq('id', resolucion.grupoId).single(),
        listarCuentasConResumen(resolucion.grupoId, user.id),
      ])

      if (!activo) return
      setNombreUsuario(usuario?.nombre ?? '')
      setAvatarColor(usuario?.avatar_color ?? '#A8D8B9')
      setGrupoNombre(grupo?.nombre ?? '')
      setCuentas(listaCuentas)
      setResumen(resumenGrupo)
      setEstado('ok')
    }

    cargar()
    return () => { activo = false }
  }, [router, params])

  if (estado === 'cargando') {
    return (
      <main style={{ minHeight: '100dvh', background: 'var(--color-bg)' }}>
        <p style={{ padding: 24, fontSize: 13.5, color: 'var(--color-text-secondary)', fontFamily: F_BODY }}>Cargando…</p>
      </main>
    )
  }

  if (estado === 'elegir-grupo') {
    return (
      <main style={{ minHeight: '100dvh', background: 'var(--color-bg)' }}>
        <div style={{ maxWidth: 440, margin: '0 auto', padding: '0 18px', paddingTop: 'max(24px, env(safe-area-inset-top, 0px))' }}>
          <h1 style={{ margin: 0, fontFamily: F_HEAD, fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--color-text-primary)' }}>
            ¿Qué grupo querés ver?
          </h1>
          <p style={{ margin: '6px 0 20px', fontSize: 13.5, color: 'var(--color-text-secondary)', fontFamily: F_BODY }}>
            Pertenecés a más de un grupo.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {grupos.map(g => (
              <Link
                key={g.id}
                href={`/cuentas?grupo=${g.id}`}
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

  const pctPagado = resumen.tuParteTotal > 0 ? (resumen.pagado / resumen.tuParteTotal) * 100 : 0
  const pctPendiente = 100 - pctPagado
  const nuevaHref = params.get('grupo') ? `/cuentas/nueva?grupo=${params.get('grupo')}` : '/cuentas/nueva'

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--color-bg)', paddingBottom: 96 }}>
      <div style={{ maxWidth: 440, margin: '0 auto', padding: '0 18px', paddingTop: 'max(20px, env(safe-area-inset-top, 0px))' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 12.5, color: 'var(--color-neutral)', fontFamily: F_BODY }}>{grupoNombre}</div>
            <div style={{ fontFamily: F_HEAD, fontSize: 23, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--color-text-primary)', marginTop: 2 }}>
              Cuentas compartidas
            </div>
          </div>
          <Avatar nombre={nombreUsuario || '?'} color={avatarColor} size={42} />
        </div>

        {cuentas.length > 0 && (
          <div style={{ background: 'var(--color-surface-white)', border: '1px solid var(--color-border)', borderRadius: 18, padding: 18 }}>
            <div style={{ fontSize: 12.5, color: 'var(--color-neutral)', fontFamily: F_BODY }}>Tu parte en cuentas activas</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 5 }}>
              <span style={{ fontFamily: F_HEAD, fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--color-text-primary)' }}>
                {formatCLP(resumen.tuParteTotal)}
              </span>
            </div>
            {resumen.tuParteTotal > 0 && (
              <>
                <div style={{ marginTop: 16, height: 12, borderRadius: 8, background: 'var(--color-track)', display: 'flex', overflow: 'hidden' }}>
                  {pctPagado > 0 && <div style={{ width: `${pctPagado}%`, background: 'repeating-linear-gradient(-45deg, #8B7CF0, #8B7CF0 5px, #A79BF5 5px, #A79BF5 10px)' }} />}
                  {pctPendiente > 0 && <div style={{ width: `${pctPendiente}%`, background: 'repeating-linear-gradient(-45deg, var(--color-warning-dot), var(--color-warning-dot) 5px, #F6C463 5px, #F6C463 10px)' }} />}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 11 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#8B7CF0' }} />
                    <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontWeight: 500, fontFamily: F_BODY }}>Pagado {formatCLP(resumen.pagado)}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-warning-dot)' }} />
                    <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontWeight: 500, fontFamily: F_BODY }}>Pendiente {formatCLP(resumen.pendiente)}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '22px 2px 12px' }}>
          <span style={{ fontFamily: F_HEAD, fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--color-text-primary)' }}>Tus cuentas</span>
          <Link href={nuevaHref} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 600, color: 'var(--color-cta)', textDecoration: 'none', fontFamily: F_BODY }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="var(--color-cta)" strokeWidth="1.8" strokeLinecap="round" /></svg>
            Nueva
          </Link>
        </div>

        {cuentas.length === 0 ? (
          <div style={{ background: 'var(--color-surface-white)', border: '1px solid var(--color-border)', borderRadius: 18, padding: '32px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🗂️</div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: F_BODY }}>Todavía no hay cuentas</p>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--color-text-secondary)', fontFamily: F_BODY }}>Creá la primera para empezar a repartir gastos.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {cuentas.map(c => (
              <TarjetaCuenta key={c.id} cuenta={c} href={`/cuentas/${c.id}`} />
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </main>
  )
}
