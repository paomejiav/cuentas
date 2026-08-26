'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { obtenerCuenta } from '@/lib/cuentas'
import { NuevoGastoScreen, type CuentaFija } from '@/components/app/NuevoGastoScreen'

export default function GastoNuevoDeCuentaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [estado, setEstado] = useState<'cargando' | 'ok' | 'no-encontrada'>('cargando')
  const [cuentaFija, setCuentaFija] = useState<CuentaFija | null>(null)

  useEffect(() => {
    let activo = true
    obtenerCuenta(id).then(c => {
      if (!activo) return
      if (!c) { setEstado('no-encontrada'); return }
      setCuentaFija({ id: c.id, grupoId: c.grupo_id, nombre: c.nombre, icono: c.icono })
      setEstado('ok')
    })
    return () => { activo = false }
  }, [id])

  if (estado === 'cargando') {
    return (
      <main style={{ minHeight: '100dvh', background: 'var(--color-bg)' }}>
        <p style={{ padding: 24, fontSize: 13.5, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>Cargando…</p>
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
