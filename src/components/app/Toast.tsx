'use client'

import { useEffect, useState } from 'react'

interface ToastProps {
  mensaje: string
  tipo?: 'exito' | 'error'
  onClose: () => void
}

export function Toast({ mensaje, tipo = 'exito', onClose }: ToastProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Animación de entrada
    const t1 = setTimeout(() => setVisible(true), 10)
    // Auto-dismiss a los 3s
    const t2 = setTimeout(() => {
      setVisible(false)
      setTimeout(onClose, 300)
    }, 3000)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [onClose])

  const bg = tipo === 'exito' ? 'var(--color-cta)' : 'var(--color-negative)'

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 88,
        left: 16,
        right: 16,
        zIndex: 100,
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
        opacity: visible ? 1 : 0,
        transition: 'transform 280ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 250ms ease',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          background: bg,
          color: 'white',
          borderRadius: 16,
          padding: '14px 18px',
          fontSize: 14,
          fontWeight: 600,
          fontFamily: 'var(--font-dm-sans), sans-serif',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          boxShadow: `0 8px 24px ${tipo === 'exito' ? 'rgba(0,200,81,0.3)' : 'rgba(192,57,43,0.3)'}`,
        }}
      >
        <span style={{ fontSize: 18, flexShrink: 0 }}>
          {tipo === 'exito' ? '✅' : '❌'}
        </span>
        {mensaje}
      </div>
    </div>
  )
}
