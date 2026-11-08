'use client'

import { use, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { obtenerCuenta } from '@/lib/cuentas'
import { ErrorCarga } from '@/lib/errores-carga'
import { NuevoGastoScreen, type CuentaFija } from '@/components/app/NuevoGastoScreen'
import { EstadoError } from '@/components/app/EstadoError'

export default function GastoNuevoDeCuentaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [estado, setEstado] = useState<'cargando' | 'ok' | 'no-encontrada' | 'error'>('cargando')
  const [errorCarga, setErrorCarga] = useState<ErrorCarga | null>(null)
  const [cuentaFija, setCuentaFija] = useState<CuentaFija | null>(null)

  const cargar = useCallback(() => {
    setEstado('cargando')
    let activo = true
    obtenerCuenta(id).then(c => {
      if (!activo) return
      if (!c) { setEstado('no-encontrada'); return }
      setCuentaFija({ id: c.id, grupoId: c.grupo_id, nombre: c.nombre, icono: c.icono })
      setEstado('ok')
    }).catch(e => {
      if (!activo) return
      setErrorCarga(e instanceof ErrorCarga ? e : new ErrorCarga('inesperado', 'Algo salió mal. Inténtalo de nuevo.', e))
      setEstado('error')
    })
    return () => { activo = false }
  }, [id])

  useEffect(() => cargar(), [cargar])

  if (estado === 'cargando') {
    return (
      <main style={{ minHeight: '100dvh', background: 'var(--color-bg)' }}>
        <p style={{ padding: 24, fontSize: 13.5, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>Cargando…</p>
      </main>
    )
  }

  if (estado === 'error') {
    return (
      <main style={{ minHeight: '100dvh', background: 'var(--color-bg)' }}>
        <div style={{ maxWidth: 440, margin: '0 auto', padding: '0 18px', paddingTop: 'max(20px, env(safe-area-inset-top, 0px))' }}>
          <EstadoError mensaje={errorCarga?.message ?? 'Algo salió mal. Inténtalo de nuevo.'} onReintentar={cargar} />
        </div>
      </main>
    )
  }

  if (estado === 'no-encontrada' || !cuentaFija) {
    return (
      <main style={{
        minHeight: '100dvh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', textAlign: 'center',
        background: 'var(--color-bg)', padding: '0 32px',
      }}>
        <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
          No encontramos esta cuenta, o no tenés acceso.
        </p>
        <Link href="/cuentas" style={{ marginTop: 12, fontSize: 13.5, fontWeight: 700, color: 'var(--color-cta)', fontFamily: 'var(--font-dm-sans), sans-serif', textDecoration: 'none' }}>
          ← Volver a Cuentas
        </Link>
      </main>
    )
  }

  return <NuevoGastoScreen cuentaFija={cuentaFija} />
}
