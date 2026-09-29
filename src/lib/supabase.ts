import { createClient } from '@supabase/supabase-js'

export const SCHEMA = 'red_conexion_gerencial'
export const COVER_BUCKET = 'rcg-newsletters'

const cleanConfig = (value: string | undefined) => value?.replace(/^\uFEFF/, '').trim()
const url = cleanConfig(import.meta.env.VITE_SUPABASE_URL)
const publishableKey = cleanConfig(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY)

export const supabase = url && publishableKey
  ? createClient(url, publishableKey, { auth: { persistSession: true, autoRefreshToken: true } })
  : null

export function requireSupabase() {
  if (!supabase) throw new Error('Falta configurar Supabase en las variables VITE_SUPABASE_*')
  return supabase
}
