'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  {
    href: '/dashboard',
    label: 'Inicio',
    icon: (active: boolean) => (
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
    icon: (active: boolean) => (
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
  { fab: true as const },
  {
    href: '/cierre',
    label: 'Cierre',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle
          cx="12" cy="12" r="9"
          stroke={active ? 'var(--color-cta)' : 'var(--color-text-disabled)'}
          strokeWidth={active ? 2 : 1.5}
        />
        <path
          d="M8 12l3 3 5-5"
          stroke={active ? 'var(--color-cta)' : 'var(--color-text-disabled)'}
          strokeWidth={active ? 2 : 1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    href: '/cuentas-compartidas',
    label: 'Cuentas',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path
          d="M6 3h9l3 3v15a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1z"
          stroke={active ? 'var(--color-cta)' : 'var(--color-text-disabled)'}
          strokeWidth={active ? 2 : 1.5}
          strokeLinejoin="round"
        />
        <path
          d="M8.5 9h7M8.5 13h7M8.5 17h4"
          stroke={active ? 'var(--color-cta)' : 'var(--color-text-disabled)'}
          strokeWidth={active ? 2 : 1.5}
          strokeLinecap="round"
        />
      </svg>
    ),
  },
]

export function BottomNav() {
  const pathname = usePathname()

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
      {tabs.map(tab => {
        if ('fab' in tab) {
          return (
            <Link
              key="fab"
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
          )
        }

        const active = pathname === tab.href || pathname.startsWith(tab.href + '/')
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
      })}
      </div>
    </nav>
  )
}
