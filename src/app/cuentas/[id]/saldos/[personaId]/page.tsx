'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { SaldosConPersona } from '@/components/app/SaldosConPersona'

export default function SaldosConPersonaCuentaPage({ params }: { params: Promise<{ id: string; personaId: string }> }) {
  const { id, personaId } = use(params)
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
    <SaldosConPersona
      usuarioId={usuarioId}
      personaId={personaId}
      cuentaId={id}
      volverHref={`/cuentas/${id}`}
    />
  )
}
