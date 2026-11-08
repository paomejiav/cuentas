'use client'

const F_HEAD = 'var(--font-sora), sans-serif'
const F_BODY = 'var(--font-dm-sans), sans-serif'

interface EstadoErrorProps {
  mensaje: string
  onReintentar: () => void
  reintentando?: boolean
}

/**
 * Estado compartido para cuando una consulta falla: nunca se muestra un
 * monto en $0 ni "al día" en su lugar — esto es lo que se renderiza en vez
 * de esa pantalla. Mismo lenguaje visual que EstadoVacio/EstadoExito
 * (cierre/page.tsx), pero sin depender de ellos para poder usarse en
 * cualquier pantalla.
 */
export function EstadoError({ mensaje, onReintentar, reintentando }: EstadoErrorProps) {
  return (
    <div style={{
      background: 'var(--color-surface-white)', border: '1px solid var(--color-border)',
      borderRadius: 18, padding: '36px 22px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 36, marginBottom: 10 }}>⚠️</div>
      <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: F_HEAD }}>
        No se pudo cargar
      </p>
      <p style={{ margin: '6px 0 18px', fontSize: 13, color: 'var(--color-text-secondary)', fontFamily: F_BODY, lineHeight: 1.5 }}>
        {mensaje}
      </p>
      <button
        onClick={onReintentar}
        disabled={reintentando}
        style={{
          height: 44, padding: '0 22px', borderRadius: 12, border: 'none',
          background: 'var(--tint-cta)', color: 'var(--color-cta-dark)',
          fontSize: 13.5, fontWeight: 700, fontFamily: F_BODY,
          cursor: reintentando ? 'default' : 'pointer', opacity: reintentando ? 0.6 : 1,
        }}
      >
        {reintentando ? 'Reintentando…' : 'Reintentar'}
      </button>
    </div>
  )
}

interface EstadoErrorCompactoProps {
  mensaje?: string
  onReintentar: () => void
  reintentando?: boolean
}

/**
 * Variante compacta de EstadoError, para una tarjeta o fila puntual dentro
 * de una lista más grande (ej. una fila de "Inicio" o "Grupos" cuando falla
 * SOLO el saldo de ESE grupo) — no reemplaza toda la pantalla, así que lo
 * que sí cargó bien en el resto de la lista se mantiene visible.
 */
export function EstadoErrorCompacto({ mensaje, onReintentar, reintentando }: EstadoErrorCompactoProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 15, flexShrink: 0 }}>⚠️</span>
      <span style={{ flex: 1, fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: F_BODY }}>
        {mensaje ?? 'No se pudo cargar'}
      </span>
      <button
        onClick={onReintentar}
        disabled={reintentando}
        style={{
          flexShrink: 0, background: 'none', border: 'none', padding: 0,
          fontSize: 12, fontWeight: 700, color: 'var(--color-cta-dark)', fontFamily: F_BODY,
          cursor: reintentando ? 'default' : 'pointer', opacity: reintentando ? 0.6 : 1,
        }}
      >
        {reintentando ? 'Reintentando…' : 'Reintentar'}
      </button>
    </div>
  )
}
