import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Elimina el header X-Powered-By en producción
  poweredByHeader: false,

  // Compresión de respuestas
  compress: true,

  // Imágenes: permitir dominios externos si se agregan en el futuro
  images: {
    formats: ['image/avif', 'image/webp'],
  },

  // Variables de entorno que deben existir en build time
  env: {
    NEXT_PUBLIC_SUPABASE_URL:      process.env.NEXT_PUBLIC_SUPABASE_URL      ?? '',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  },
}

export default nextConfig
