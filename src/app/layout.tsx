import type { Metadata } from 'next'
import { Lora, DM_Sans, Sora } from 'next/font/google'
import { SessionProvider } from '@/lib/session-store'
import './globals.css'

const lora = Lora({
  subsets: ['latin'],
  weight: ['700'],
  variable: '--font-lora',
  display: 'swap',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-dm-sans',
  display: 'swap',
})

// Rediseño "Walto" — títulos, subtítulos y cifras
const sora = Sora({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
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
