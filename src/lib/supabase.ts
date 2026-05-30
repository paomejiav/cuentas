import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Singleton lazy — no se crea hasta el primer uso (evita errores en pre-rendering)
let _client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) throw new Error('Faltan variables de entorno de Supabase')
    _client = createClient(url, key)
  }
  return _client
}

// Re-exportar como `supabase` para no cambiar los imports existentes
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getSupabase() as unknown as Record<string | symbol, unknown>)[prop]
  },
})
