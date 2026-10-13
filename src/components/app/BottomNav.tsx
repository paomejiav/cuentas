'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface Tab {
  href: string
  label: string
  icon: (active: boolean) => React.ReactNode
  isActive: (pathname: string) => boolean
  // si es true y hay 0 grupos, el tab queda atenuado y sin acción (N9)
  requiereGrupos?: boolean
}

const tabs: Tab[] = [
  {
    href: '/',
    label: 'Inicio',
    isActive: p => p === '/' || p.startsWith('/cuentas') || p.startsWith('/cierre') || p.startsWith('/grupo') || p.startsWith('/saldos'),
    icon: active => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path
          d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"
          stroke={active ? 'var(--color-cta)' : 'var(--color-text-disabled)'}
          strokeWidth={active ? 2 : 1.5}
          strokeLinejoin="round"
        />
        <path
          d="M9 21V12h6v9"
          stroke={active ? 'var(--color-cta)' : 'var(--color-text-disabled)'}
          strokeWidth={active ? 2 : 1.5}
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    href: '/historial',
    label: 'Historial',
    isActive: p => p === '/historial' || p.startsWith('/historial/'),
    requiereGrupos: true,
    icon: active => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect
          x="3" y="4" width="18" height="17" rx="3"
          stroke={active ? 'var(--color-cta)' : 'var(--color-text-disabled)'}
          strokeWidth={active ? 2 : 1.5}
        />
        <path
          d="M7 9h10M7 13h7"
          stroke={active ? 'var(--color-cta)' : 'var(--color-text-disabled)'}
          strokeWidth={active ? 2 : 1.5}
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    href: '/mis-grupos',
    label: 'Grupos',
    isActive: p => p.startsWith('/mis-grupos'),
    icon: active => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="9" cy="8" r="3.2" stroke={active ? 'var(--color-cta)' : 'var(--color-text-disabled)'} strokeWidth={active ? 2 : 1.5} />
        <path
          d="M3 19.5c.5-3 3-4.8 6-4.8s5.5 1.8 6 4.8M15.5 5a3.2 3.2 0 010 6M18 14.8c1.6.7 2.7 2.3 3 4.7"
          stroke={active ? 'var(--color-cta)' : 'var(--color-text-disabled)'}
          strokeWidth={active ? 2 : 1.5}
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    href: '/mas',
    label: 'Más',
    isActive: p => p.startsWith('/mas') || p.startsWith('/perfil'),
    icon: active => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="4" y="4" width="7" height="7" rx="2" stroke={active ? 'var(--color-cta)' : 'var(--color-text-disabled)'} strokeWidth={active ? 2 : 1.5} />
        <rect x="13" y="4" width="7" height="7" rx="2" stroke={active ? 'var(--color-cta)' : 'var(--color-text-disabled)'} strokeWidth={active ? 2 : 1.5} />
        <rect x="4" y="13" width="7" height="7" rx="2" stroke={active ? 'var(--color-cta)' : 'var(--color-text-disabled)'} strokeWidth={active ? 2 : 1.5} />
        <rect x="13" y="13" width="7" height="7" rx="2" stroke={active ? 'var(--color-cta)' : 'var(--color-text-disabled)'} strokeWidth={active ? 2 : 1.5} />
      </svg>
    ),
  },
]

interface BottomNavProps {
  // true cuando la persona no tiene ningún grupo: Historial y el "+" quedan
  // atenuados y sin acción (N9). Inicio, Grupos y Más siguen activos.
  sinGrupos?: boolean
}

export function BottomNav({ sinGrupos = false }: BottomNavProps) {
  const pathname = usePathname()

  // El FAB va entre Historial y Grupos en el orden visual.
  const [inicio, historial, grupos, mas] = tabs

  function renderTab(tab: Tab) {
    const inerte = sinGrupos && tab.requiereGrupos
    const active = !inerte && tab.isActive(pathname)

    if (inerte) {
      return (
        <div
          key={tab.href}
          aria-hidden="true"
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 4, flex: 1, padding: '6px 0', minHeight: 48, minWidth: 48,
            justifyContent: 'center', opacity: 0.4,
          }}
        >
          {tab.icon(false)}
          <span style={{ fontSize: 10, color: 'var(--color-text-disabled)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
            {tab.label}
          </span>
        </div>
      )
    }

    return (
      <Link
        key={tab.href}
        href={tab.href}
        aria-label={tab.label}
        aria-current={active ? 'page' : undefined}
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 4, flex: 1, padding: '6px 0',
          textDecoration: 'none',
          minHeight: 48, minWidth: 48,
          justifyContent: 'center',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        {tab.icon(active)}
        <span
          style={{
            fontSize: 10,
            fontWeight: active ? 700 : 400,
            color: active ? 'var(--color-cta)' : 'var(--color-text-disabled)',
            fontFamily: 'var(--font-dm-sans), sans-serif',
            letterSpacing: '0.01em',
          }}
        >
          {tab.label}
        </span>
      </Link>
    )
  }

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 76,
        background: 'var(--color-surface-white)',
        borderTop: '1px solid var(--color-border)',
        zIndex: 40,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div style={{
        maxWidth: 640,
        margin: '0 auto',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        padding: '0 12px',
      }}>
        {renderTab(inicio)}
        {renderTab(historial)}

        {sinGrupos ? (
          <div
            aria-hidden="true"
            style={{
              width: 52, height: 52, borderRadius: 16, marginTop: -26, flexShrink: 0,
              background: 'var(--color-text-disabled)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
        ) : (
          <Link
            href="/gastos/nuevo"
            aria-label="Agregar nuevo gasto"
            style={{
              width: 52, height: 52, borderRadius: 16,
              background: 'var(--gradient-cta)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: 'var(--shadow-fab)',
              marginTop: -26,
              textDecoration: 'none',
              flexShrink: 0,
              transition: 'transform 120ms ease',
              WebkitTapHighlightColor: 'transparent',
            }}
            onPointerDown={e => (e.currentTarget.style.transform = 'scale(0.93)')}
            onPointerUp={e => (e.currentTarget.style.transform = 'scale(1)')}
            onPointerLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </Link>
        )}

        {renderTab(grupos)}
        {renderTab(mas)}
      </div>
    </nav>
  )
}
