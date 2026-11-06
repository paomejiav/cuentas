import type { Metadata } from 'next'
import localFont from 'next/font/local'
import { SessionProvider } from '@/lib/session-store'
import './globals.css'

// Fuentes autohospedadas (subset "latin" de Google Fonts, vendored en
// src/fonts/ con su licencia OFL) en vez de next/font/google: el build de
// Vercel fallaba intermitentemente al descargar las fuentes desde Google
// durante el build ("Module not found ... font/google/font"). El subset
// "latin" ya cubre tildes, ñ, ¿, ¡, el signo $ y el signo menos "−"
// (U+0000-00FF más puntuación, incluye U+2212) — verificado leyendo la
// tabla cmap real de cada archivo, no solo el nombre del subset.
const lora = localFont({
  src: '../fonts/lora/lora-latin-700-normal.woff2',
  weight: '700',
  variable: '--font-lora',
  display: 'swap',
})

const dmSans = localFont({
  src: [
    { path: '../fonts/dm-sans/dm-sans-latin-400-normal.woff2', weight: '400' },
    { path: '../fonts/dm-sans/dm-sans-latin-500-normal.woff2', weight: '500' },
    { path: '../fonts/dm-sans/dm-sans-latin-600-normal.woff2', weight: '600' },
    { path: '../fonts/dm-sans/dm-sans-latin-700-normal.woff2', weight: '700' },
  ],
  variable: '--font-dm-sans',
  display: 'swap',
})

// Rediseño "Walto" — títulos, subtítulos y cifras
const sora = localFont({
  src: [
    { path: '../fonts/sora/sora-latin-400-normal.woff2', weight: '400' },
    { path: '../fonts/sora/sora-latin-600-normal.woff2', weight: '600' },
    { path: '../fonts/sora/sora-latin-700-normal.woff2', weight: '700' },
    { path: '../fonts/sora/sora-latin-800-normal.woff2', weight: '800' },
  ],
  variable: '--font-sora',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Better than Split',
  description: 'Gastos compartidos para amigas',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className={`${lora.variable} ${dmSans.variable} ${sora.variable}`}>
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  )
}
