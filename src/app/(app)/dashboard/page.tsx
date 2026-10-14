'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { hrefHomeGrupo } from '@/lib/grupo'

const F_BODY = 'var(--font-dm-sans), sans-serif'

/** /dashboard se retiró — su contenido vive ahora en la home del grupo, dentro de Grupos. */
export default function DashboardPage() {
  return (
    <Suspense>
      <DashboardRedirect />
    </Suspense>
  )
}

function DashboardRedirect() {
  const router = useRouter()
  const params = useSearchParams()

  useEffect(() => {
    const grupoId = params.get('grupo')
    router.replace(grupoId ? hrefHomeGrupo(grupoId) : '/mis-grupos')
  }, [router, params])

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--color-bg)' }}>
      <p style={{ padding: 24, fontSize: 13.5, color: 'var(--color-text-secondary)', fontFamily: F_BODY }}>Cargando…</p>
    </main>
  )
}
