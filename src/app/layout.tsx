import type { Metadata } from 'next'
import { Lora, DM_Sans } from 'next/font/google'
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
  weight: ['400', '500', '600'],
  variable: '--font-dm-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Cuentas',
  description: 'Gastos compartidos para amigas',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className={`${lora.variable} ${dmSans.variable}`}>
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  )
}
