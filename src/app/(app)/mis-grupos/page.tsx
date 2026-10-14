'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { listarGruposActivos, hrefHomeGrupo, type GrupoNombre } from '@/lib/grupo'
import { calcularSaldosGrupo } from '@/lib/cuentas'
import { formatCLP } from '@/lib/format'
import { seleccionarGrupo, obtenerSeleccion } from '@/lib/grupo-activo'
import { AvatarGrupo } from '@/components/app/AvatarGrupo'
import { colorDeGrupo } from '@/lib/colores-grupo'
import { BottomNav } from '@/components/app/BottomNav'
import { FlujoCrearUnirseGrupo } from '@/components/app/FlujoCrearUnirseGrupo'

const F_HEAD = 'var(--font-sora), sans-serif'
const F_BODY = 'var(--font-dm-sans), sans-serif'

interface GrupoConResumen extends GrupoNombre {
  integrantes: number
  netoUsuario: number
}

function BotonPrimario({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        height: 54, width: '100%', borderRadius: 15, border: 'none',
        background: 'var(--gradient-cta)', boxShadow: 'var(--shadow-cta)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        fontFamily: F_BODY, fontSize: 15.5, fontWeight: 700, color: '#fff', cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}

function BotonSecundario({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        height: 54, width: '100%', borderRadius: 15,
        background: 'var(--color-surface-white)', border: '1px solid var(--color-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
        fontFamily: F_BODY, fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)', cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}

export default function MisGruposPage() {
  const router = useRouter()

  const [cargando, setCargando] = useState(true)
  const [grupos, setGrupos] = useState<GrupoConResumen[]>([])
  const [grupoActivoId, setGrupoActivoId] = useState<string | 'todos'>('todos')
  const [flujoAbierto, setFlujoAbierto] = useState<'crear' | 'unirse' | null>(null)

  useEffect(() => {
    let activo = true
    async function cargar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }
      if (!activo) return

      const [listaGrupos, { seleccion }] = await Promise.all([
        listarGruposActivos(user.id),
        obtenerSeleccion(user.id, null),
      ])
      if (!activo) return

      const conResumen = await Promise.all(
        listaGrupos.map(async g => {
          const saldos = await calcularSaldosGrupo(g.id, user.id)
          return {
            ...g,
            integrantes: saldos.length + 1,
            netoUsuario: saldos.reduce((suma, s) => suma + s.neto, 0),
          }
        })
      )
      if (!activo) return

      setGrupos(conResumen)
      setGrupoActivoId(seleccion.tipo === 'grupo' ? seleccion.grupoId : 'todos')
      setCargando(false)
    }
    cargar()
    return () => { activo = false }
  }, [router])

  function handleElegirGrupo(grupoId: string) {
    seleccionarGrupo(grupoId, { refresh: () => {} })
    router.push(hrefHomeGrupo(grupoId))
  }

  function handleListoFlujo(grupo: { id: string; nombre: string }) {
    seleccionarGrupo(grupo.id, { refresh: () => {} })
    router.push(hrefHomeGrupo(grupo.id))
  }

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

        <div style={{ margin: '4px 0 18px' }}>
          <div style={{ fontFamily: F_HEAD, fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--color-text-primary)' }}>
            Grupos
          </div>
          <div style={{ fontSize: 13, color: '#8A8F98', marginTop: 3, fontFamily: F_BODY }}>
            Estás en {grupos.length} grupo{grupos.length === 1 ? '' : 's'}
          </div>
        </div>

        {grupos.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {grupos.map(g => {
              const activo = grupoActivoId === g.id
              const { bg, texto } = colorDeGrupo(g.id)
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => handleElegirGrupo(g.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 13, padding: 14, width: '100%', textAlign: 'left',
                    background: 'var(--color-surface-white)',
                    border: activo ? '1px solid #DCD6FB' : '1px solid var(--color-border)',
                    boxShadow: activo ? '0 0 0 3px #F1EEFE' : 'none',
                    borderRadius: 18, cursor: 'pointer', boxSizing: 'border-box',
                  }}
                >
                  <AvatarGrupo grupoId={g.id} nombre={g.nombre} size={46} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span style={{
                        fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: F_BODY,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {g.nombre}
                      </span>
                      {activo && (
                        <span style={{
                          fontSize: 10.5, fontWeight: 700, color: texto, background: bg,
                          borderRadius: 6, padding: '2px 6px', flexShrink: 0, fontFamily: F_BODY,
                        }}>
                          Activo
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--color-neutral)', marginTop: 1, fontFamily: F_BODY }}>
                      {g.integrantes} integrante{g.integrantes === 1 ? '' : 's'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{
                      fontFamily: F_HEAD, fontSize: 14.5, fontWeight: 700,
                      color: g.netoUsuario > 0 ? 'var(--color-positive)' : g.netoUsuario < 0 ? 'var(--color-negative)' : '#8A8F98',
                    }}>
                      {g.netoUsuario === 0 ? 'Al día' : formatCLP(Math.abs(g.netoUsuario))}
                    </div>
                    {g.netoUsuario !== 0 && (
                      <div style={{ fontSize: 11, color: '#9AA0A8', fontFamily: F_BODY }}>
                        {g.netoUsuario > 0 ? 'Te deben' : 'Debes'}
                      </div>
                    )}
                  </div>
                  <svg width="8" height="14" viewBox="0 0 8 14" fill="none" style={{ flexShrink: 0 }}>
                    <path d="M1.5 1.5L6.5 7l-5 5.5" stroke="#C4C7CE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              )
            })}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: grupos.length > 0 ? 22 : 8 }}>
          <BotonPrimario onClick={() => setFlujoAbierto('crear')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" /></svg>
            <span>Crear grupo nuevo</span>
          </BotonPrimario>
          <BotonSecundario onClick={() => setFlujoAbierto('unirse')}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="4" width="18" height="16" rx="4" stroke="var(--color-text-secondary)" strokeWidth="1.6" />
              <path d="M7.5 9.5h9M7.5 13h9M7.5 16.5h5" stroke="var(--color-text-secondary)" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <span>Unirme con código</span>
          </BotonSecundario>
        </div>
      </div>

      <BottomNav sinGrupos={grupos.length === 0} />

      {flujoAbierto && (
        <FlujoCrearUnirseGrupo
          pasoInicial={flujoAbierto}
          onCerrar={() => setFlujoAbierto(null)}
          onListo={handleListoFlujo}
        />
      )}
    </main>
  )
}
