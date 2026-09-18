import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env.local', 'utf8')
const supabaseUrl = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim()
const supabaseKey = env.match(/VITE_SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim()
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data, error } = await supabase.from('transactions').select('*').order('created_at', { ascending: false }).limit(5)
  console.log('TXs:', data, error)
  if (data?.length) {
    const { data: items } = await supabase.from('transaction_items').select('*').eq('transaction_id', data[0].id)
    console.log('TX Items:', items)
  }
}
run()
