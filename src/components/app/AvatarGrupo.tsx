import { colorDeGrupo } from '@/lib/colores-grupo'

interface AvatarGrupoProps {
  grupoId: string
  nombre: string
  size?: number
  'aria-label'?: string
}

export function AvatarGrupo({ grupoId, nombre, size = 44, 'aria-label': ariaLabel }: AvatarGrupoProps) {
  const { bg, texto } = colorDeGrupo(grupoId)
  const inicial = nombre.charAt(0).toUpperCase()
  const fontSize = Math.round(size * 0.38)
  const radius = Math.round(size * 0.3)

  return (
    <div
      role="img"
      aria-label={ariaLabel ?? `Grupo ${nombre}`}
      style={{
        width: size, height: size,
        borderRadius: radius,
        background: bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          fontSize, fontWeight: 800,
          color: texto,
          fontFamily: 'var(--font-sora), sans-serif',
          lineHeight: 1, userSelect: 'none',
        }}
      >
        {inicial}
      </span>
    </div>
  )
}
