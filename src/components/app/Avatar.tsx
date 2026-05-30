interface AvatarProps {
  nombre: string
  color: string
  size?: number
  'aria-label'?: string
}

function darkenHex(hex: string, amount = 0.4): string {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  return `rgb(${Math.round(r * (1 - amount))}, ${Math.round(g * (1 - amount))}, ${Math.round(b * (1 - amount))})`
}

export function Avatar({ nombre, color, size = 40, 'aria-label': ariaLabel }: AvatarProps) {
  const inicial = nombre.charAt(0).toUpperCase()
  const textColor = darkenHex(color)
  const fontSize = Math.round(size * 0.4)

  return (
    <div
      role="img"
      aria-label={ariaLabel ?? `Avatar de ${nombre}`}
      style={{
        width: size, height: size,
        borderRadius: '50%',
        background: color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          fontSize, fontWeight: 700,
          color: textColor,
          fontFamily: 'var(--font-dm-sans), sans-serif',
          lineHeight: 1, userSelect: 'none',
        }}
      >
        {inicial}
      </span>
    </div>
  )
}
