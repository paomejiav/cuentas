import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

// Singleton lazy — no se crea hasta el primer uso (evita errores en pre-rendering)
// Usa createBrowserClient (cookie-based) para que la sesión de Supabase Auth
// sea legible desde el middleware / server.
let _client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) throw new Error('Faltan variables de entorno de Supabase')
    _client = createBrowserClient(url, key)
  }
  return _client
}

// Re-exportar como `supabase` para no cambiar los imports existentes
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getSupabase() as unknown as Record<string | symbol, unknown>)[prop]
  },
})
