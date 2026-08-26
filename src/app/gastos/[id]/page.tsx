'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { DetalleGasto } from '@/components/app/DetalleGasto'

/**
 * Ruta compartida de detalle de gasto — funciona con o sin cuenta_id.
 * Reusa el mismo componente que /cuentas/[id] abre como overlay local;
 * acá simplemente lo montamos como el contenido de la página.
 */
export default function DetalleGastoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [usuarioId, setUsuarioId] = useState<string | null>(null)

  useEffect(() => {
    let activo = true
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!activo) return
      if (!user) { router.replace('/login'); return }
      setUsuarioId(user.id)
    })
    return () => { activo = false }
  }, [router])

  if (!usuarioId) {
    return (
      <main style={{ minHeight: '100dvh', background: 'var(--color-bg)' }}>
        <p style={{ padding: 24, fontSize: 13.5, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>Cargando…</p>
      </main>
    )
  }

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--color-bg)' }}>
      <DetalleGasto
        gastoId={id}
        miId={usuarioId}
        onClose={() => router.back()}
        onEliminado={() => router.replace('/historial')}
        onPagoRegistrado={() => router.back()}
      />
    </main>
  )
}
