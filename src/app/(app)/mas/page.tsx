'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { listarGruposActivos } from '@/lib/grupo'
import { BottomNav } from '@/components/app/BottomNav'

const F_HEAD = 'var(--font-sora), sans-serif'
const F_BODY = 'var(--font-dm-sans), sans-serif'

export default function MasPage() {
  const router = useRouter()
  const [cargando, setCargando] = useState(true)
  const [sinGrupos, setSinGrupos] = useState(false)

  useEffect(() => {
    let activo = true
    async function cargar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }
      const grupos = await listarGruposActivos(user.id)
      if (!activo) return
      setSinGrupos(grupos.length === 0)
      setCargando(false)
    }
    cargar()
    return () => { activo = false }
  }, [router])

  if (cargando) {
    return (
      <main style={{ minHeight: '100dvh', background: 'var(--color-bg)' }}>
        <p style={{ padding: 24, fontSize: 13.5, color: 'var(--color-text-secondary)', fontFamily: F_BODY }}>Cargando…</p>
      </main>
    )
  }

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--color-bg)', paddingBottom: 96 }}>
      <div style={{ maxWidth: 440, margin: '0 auto', padding: '0 18px', paddingTop: 'max(20px, env(safe-area-inset-top, 0px))' }}>
        <div style={{ fontFamily: F_HEAD, fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--color-text-primary)', margin: '4px 0 20px' }}>
          Más
        </div>

        <button
          type="button"
          onClick={() => router.push('/perfil')}
          style={{
            display: 'flex', alignItems: 'center', gap: 13, width: '100%', textAlign: 'left',
            background: 'var(--color-surface-white)', border: '1px solid var(--color-border)',
            borderRadius: 18, padding: 15, cursor: 'pointer', boxSizing: 'border-box',
          }}
        >
          <span style={{
            width: 44, height: 44, borderRadius: 14, background: 'var(--color-icon-bg)', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M16 19v-1a4 4 0 00-4-4H6a4 4 0 00-4 4v1" stroke="var(--color-text-secondary)" strokeWidth="1.8" strokeLinecap="round" />
              <circle cx="9" cy="7" r="3.2" stroke="var(--color-text-secondary)" strokeWidth="1.8" />
            </svg>
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: F_BODY }}>Perfil</div>
            <div style={{ fontSize: 12.5, color: 'var(--color-neutral)', marginTop: 1, fontFamily: F_BODY }}>Cuenta y ajustes</div>
          </div>
          <svg width="8" height="14" viewBox="0 0 8 14" fill="none" style={{ flexShrink: 0 }}>
            <path d="M1.5 1.5L6.5 7l-5 5.5" stroke="#C4C7CE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <BottomNav sinGrupos={sinGrupos} />
    </main>
  )
}
