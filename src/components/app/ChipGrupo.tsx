'use client'

import { AvatarGrupo } from '@/components/app/AvatarGrupo'

interface ChipGrupoProps {
  // undefined/null = selección "todos los grupos"
  grupo: { id: string; nombre: string } | null
  onClick: () => void
}

function IconoTodos() {
  return (
    <span style={{
      width: 24, height: 24, borderRadius: 8, background: '#1A1A1E', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path d="M12 3.5l8.5 4.3L12 12 3.5 7.8 12 3.5z" stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
        <path d="M3.5 12.2L12 16.5l8.5-4.3M3.5 16.4L12 20.7l8.5-4.3" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}

export function ChipGrupo({ grupo, onClick }: ChipGrupoProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Cambiar de grupo"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8, height: 38,
        padding: '0 12px 0 7px', background: '#fff', border: '1px solid var(--color-border)',
        borderRadius: 100, maxWidth: 236, boxSizing: 'border-box', minWidth: 0,
        cursor: 'pointer', alignSelf: 'flex-start',
      }}
    >
      {grupo ? (
        <AvatarGrupo grupoId={grupo.id} nombre={grupo.nombre} size={24} />
      ) : (
        <IconoTodos />
      )}
      <span style={{
        fontFamily: 'var(--font-sora), sans-serif', fontWeight: 700, fontSize: 14,
        letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        minWidth: 0, color: 'var(--color-text-primary)',
      }}>
        {grupo ? grupo.nombre : 'Todos los grupos'}
      </span>
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
        <path d="M3 4.5L6 7.5l3-3" stroke="#6B7280" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}
