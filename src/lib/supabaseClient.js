import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && anonKey)

if (!isSupabaseConfigured) {
  // eslint-disable-next-line no-console
  console.error(
    'Lipsesc VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — vezi .env.example. ' +
    'Aplicația nu poate contacta Supabase fără ele.'
  )
}

// Valori placeholder evită crash-ul createClient() când env-ul lipsește
// (ex. build local fără Supabase configurat) — apelurile vor eșua clar la runtime.
export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  anonKey || 'placeholder-anon-key'
)
