'use client'

import { AvatarGrupo } from '@/components/app/AvatarGrupo'
import type { GrupoParaSheet } from '@/lib/grupo'

export type { GrupoParaSheet }

const F_HEAD = 'var(--font-sora), sans-serif'
const F_BODY = 'var(--font-dm-sans), sans-serif'

interface SelectorGrupoSheetProps {
  abierto: boolean
  onCerrar: () => void
  grupos: GrupoParaSheet[]
  seleccionActual: string | 'todos'
  // true: pantallas tipo Inicio/Historial, que pueden mostrar todo.
  // false: pantallas que exigen un grupo puntual (no ofrece "Todos").
  permitirTodos: boolean
  onElegir: (idOTodos: string) => void
  onCrearGrupo: () => void
  onUnirseConCodigo: () => void
}

function Check() {
  return (
    <div style={{
      width: 24, height: 24, borderRadius: '50%', background: 'var(--color-cta)', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
        <path d="M5 12.5l4.5 4.5L19 7" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

function Divider() {
  return <div style={{ height: 1, background: 'var(--color-divider)', margin: '10px 4px' }} />
}

export function SelectorGrupoSheet({
  abierto, onCerrar, grupos, seleccionActual, permitirTodos, onElegir, onCrearGrupo, onUnirseConCodigo,
}: SelectorGrupoSheetProps) {
  if (!abierto) return null

  const listaScrollable = grupos.length > 5

  return (
    <>
      <div
        onClick={onCerrar}
        style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(26,26,30,0.45)' }}
      />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 70,
        background: 'var(--color-surface-white)', borderRadius: '28px 28px 0 0',
        padding: '10px 18px max(30px, env(safe-area-inset-bottom))',
        maxHeight: '80dvh', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ width: 40, height: 5, borderRadius: 3, background: '#E2E2E8', margin: '0 auto 16px', flexShrink: 0 }} />
        <div style={{
          fontFamily: F_HEAD, fontSize: 17, fontWeight: 800, letterSpacing: '-0.01em',
          color: 'var(--color-text-primary)', marginBottom: 4, flexShrink: 0,
        }}>
          Cambiar de grupo
        </div>

        {permitirTodos && (
          <>
            <button
              type="button"
              onClick={() => onElegir('todos')}
              style={{
                display: 'flex', alignItems: 'center', gap: 13, padding: '11px 12px', borderRadius: 15,
                background: seleccionActual === 'todos' ? '#F5F3FE' : 'transparent',
                border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer', marginTop: 8, flexShrink: 0,
              }}
            >
              <span style={{
                width: 42, height: 42, borderRadius: 13, background: '#1A1A1E', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M12 3.5l8.5 4.3L12 12 3.5 7.8 12 3.5z" stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
                  <path d="M3.5 12.2L12 16.5l8.5-4.3M3.5 16.4L12 20.7l8.5-4.3" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.005em', color: 'var(--color-text-primary)', fontFamily: F_BODY }}>
                  Todos los grupos
                </div>
                <div style={{ fontSize: 12, color: '#9AA0A8', marginTop: 2, fontFamily: F_BODY }}>
                  Tus {grupos.length} grupo{grupos.length === 1 ? '' : 's'} y gastos personales
                </div>
              </div>
              {seleccionActual === 'todos' && <Check />}
            </button>
            <Divider />
          </>
        )}

        <div style={{
          display: 'flex', flexDirection: 'column', gap: 4,
          overflowY: listaScrollable ? 'auto' : 'visible',
          maxHeight: listaScrollable ? 340 : undefined,
          WebkitOverflowScrolling: 'touch',
        }}>
          {grupos.map(g => {
            const activo = seleccionActual === g.id
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => onElegir(g.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 13, padding: '11px 12px', borderRadius: 15,
                  background: activo ? '#F5F3FE' : 'transparent',
                  border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer',
                }}
              >
                <AvatarGrupo grupoId={g.id} nombre={g.nombre} size={42} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 15, fontWeight: 700, letterSpacing: '-0.005em', color: 'var(--color-text-primary)',
                    fontFamily: F_BODY, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {g.nombre}
                  </div>
                  <div style={{ fontSize: 12, color: '#9AA0A8', marginTop: 2, fontFamily: F_BODY }}>
                    {g.integrantes} integrante{g.integrantes === 1 ? '' : 's'}
                  </div>
                </div>
                {activo && <Check />}
              </button>
            )
          })}
        </div>

        <Divider />

        <div style={{ flexShrink: 0 }}>
          <button
            type="button"
            onClick={onCrearGrupo}
            style={{ display: 'flex', alignItems: 'center', gap: 13, padding: 12, width: '100%', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer' }}
          >
            <span style={{ width: 40, height: 40, borderRadius: 13, background: 'var(--tint-cta)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="var(--color-cta-dark)" strokeWidth="2" strokeLinecap="round" /></svg>
            </span>
            <span style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: F_BODY }}>Crear grupo nuevo</span>
          </button>
          <button
            type="button"
            onClick={onUnirseConCodigo}
            style={{ display: 'flex', alignItems: 'center', gap: 13, padding: 12, width: '100%', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer' }}
          >
            <span style={{ width: 40, height: 40, borderRadius: 13, background: 'var(--color-icon-bg)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="4" width="18" height="16" rx="4" stroke="var(--color-text-secondary)" strokeWidth="1.6" />
                <path d="M7.5 9.5h9M7.5 13h9M7.5 16.5h5" stroke="var(--color-text-secondary)" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </span>
            <span style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: F_BODY }}>Unirme con código</span>
          </button>
        </div>
      </div>
    </>
  )
}
