'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  {
    href: '/dashboard',
    label: 'Inicio',
    icon: (active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path
          d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"
          stroke={active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)'}
          strokeWidth={active ? 2 : 1.5}
          strokeLinejoin="round"
        />
        <path
          d="M9 21V12h6v9"
          stroke={active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)'}
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
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <rect
          x="3" y="4" width="18" height="17" rx="3"
          stroke={active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)'}
          strokeWidth={active ? 2 : 1.5}
        />
        <path
          d="M7 9h10M7 13h7"
          stroke={active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)'}
          strokeWidth={active ? 2 : 1.5}
          strokeLinecap="round"
        />
        <path
          d="M8 2v4M16 2v4"
          stroke={active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)'}
          strokeWidth={1.5}
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    href: '/cierre',
    label: 'Cierre',
    icon: (active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <circle
          cx="12" cy="12" r="9"
          stroke={active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)'}
          strokeWidth={active ? 2 : 1.5}
        />
        <path
          d="M8 12l3 3 5-5"
          stroke={active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)'}
          strokeWidth={active ? 2 : 1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
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
        height: 60,
        background: 'var(--color-bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        borderTop: '1px solid var(--color-border)',
        zIndex: 40,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {tabs.map(tab => {
        const active = pathname === tab.href || pathname.startsWith(tab.href + '/')
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-label={tab.label}
            aria-current={active ? 'page' : undefined}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 3, flex: 1, padding: '6px 0',
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
                fontWeight: active ? 600 : 400,
                color: active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                fontFamily: 'var(--font-dm-sans), sans-serif',
                letterSpacing: '0.01em',
              }}
            >
              {tab.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
