import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        serif:  ['var(--font-lora)', 'Georgia', 'serif'],
        sans:   ['var(--font-dm-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-sora)', 'system-ui', 'sans-serif'],
      },
      colors: {
        bg:            'var(--color-bg)',
        card:          'var(--color-card)',
        'card-light':  'var(--color-card-light)',
        surface:       'var(--color-surface-white)',
        cta:           'var(--color-cta)',
        'cta-dark':    'var(--color-cta-dark)',
        primary:       'var(--color-text-primary)',
        secondary:     'var(--color-text-secondary)',
        disabled:      'var(--color-text-disabled)',
        positive:      'var(--color-positive)',
        negative:      'var(--color-negative)',
        neutral:       'var(--color-neutral)',
        border:        'var(--color-border)',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
