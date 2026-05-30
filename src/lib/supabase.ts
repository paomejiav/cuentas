import { createClient } from '@supabase/supabase-js'

// Cliente sin genérico tipado — se tipan los resultados en cada query
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
