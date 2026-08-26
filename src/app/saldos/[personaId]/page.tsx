'use client'

import { Suspense, use, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { resolverGrupoActivo, type GrupoOpcion } from '@/lib/grupo-activo'
import { SaldosConPersona } from '@/components/app/SaldosConPersona'

export default function SaldosConPersonaGrupoPage({ params }: { params: Promise<{ personaId: string }> }) {
  const { personaId } = use(params)
  return (
    <Suspense>
      <SaldosConPersonaGrupoInner personaId={personaId} />
    </Suspense>
  )
}

function SaldosConPersonaGrupoInner({ personaId }: { personaId: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [fase, setFase] = useState<'cargando' | 'elegir-grupo' | 'ok'>('cargando')
  const [grupos, setGrupos] = useState<GrupoOpcion[]>([])
  const [usuarioId, setUsuarioId] = useState<string | null>(null)
  const [grupoId, setGrupoId] = useState<string | null>(null)

  useEffect(() => {
    let activo = true
    async function cargar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }
      if (!activo) return
      setUsuarioId(user.id)

      const resolucion = await resolverGrupoActivo(user.id, searchParams.get('grupo'))
      if (!activo) return

      if (resolucion.estado === 'sin-grupos') { router.replace('/'); return }
      if (resolucion.estado === 'elegir') {
        setGrupos(resolucion.grupos)
        setFase('elegir-grupo')
        return
      }

      setGrupoId(resolucion.grupoId)
      setFase('ok')
    }
    cargar()
    return () => { activo = false }
  }, [router, searchParams])

  if (fase === 'cargando') {
    return (
      <main style={{ minHeight: '100dvh', background: 'var(--color-bg)' }}>
        <p style={{ padding: 24, fontSize: 13.5, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>Cargando…</p>
      </main>
    )
  }

  if (fase === 'elegir-grupo') {
    return (
      <main style={{ minHeight: '100dvh', background: 'var(--color-bg)' }}>
        <div style={{ maxWidth: 440, margin: '0 auto', padding: '0 18px', paddingTop: 'max(24px, env(safe-area-inset-top, 0px))' }}>
          <h1 style={{ margin: 0, fontFamily: 'var(--font-sora), sans-serif', fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--color-text-primary)' }}>
            ¿En qué grupo?
          </h1>
          <p style={{ margin: '6px 0 20px', fontSize: 13.5, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
            Pertenecés a más de un grupo.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {grupos.map(g => (
              <Link
                key={g.id}
                href={`/saldos/${personaId}?grupo=${g.id}`}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'var(--color-surface-white)', border: '1px solid var(--color-border)',
                  borderRadius: 16, padding: '16px 18px', textDecoration: 'none',
                }}
              >
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>{g.nombre}</span>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="var(--color-cta)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </Link>
            ))}
          </div>
        </div>
      </main>
    )
  }

  return (
    <SaldosConPersona
      usuarioId={usuarioId!}
      personaId={personaId}
      grupoId={grupoId!}
      volverHref={grupoId ? `/?grupo=${grupoId}` : '/'}
    />
  )
}
