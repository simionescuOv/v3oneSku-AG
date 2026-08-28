import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

// Citim env vars direct din fișierul .env
const envContent = fs.readFileSync('.env', 'utf-8')
const envVars = {}
envContent.split(/\r?\n/).forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/)
  if (match) {
    envVars[match[1].trim()] = match[2].trim().replace(/^"|"$/g, '')
  }
})

const supabaseUrl = envVars['VITE_SUPABASE_URL']
const supabaseKey = envVars['VITE_SUPABASE_ANON_KEY']
const supabase = createClient(supabaseUrl, supabaseKey)

async function check() {
  const { data: nodes } = await supabase.from('categories').select('*').is('deleted_at', null).eq('is_temp', false)
  const { data: products } = await supabase.from('products').select('id, category_id, name_id').is('deleted_at', null)
  
  const validCatIds = new Set(nodes.filter(n => n.node_type === 'category').map(n => n.id))
  
  const anomalous = products.filter(p => !validCatIds.has(p.category_id))
  
  console.log('Valid categories count:', validCatIds.size)
  console.log('Total products count:', products.length)
  console.log('Anomalous products count:', anomalous.length)
  if (anomalous.length > 0) {
    console.log('Anomalous products:', anomalous)
    for (const p of anomalous) {
       const { data: cat } = await supabase.from('categories').select('*').eq('id', p.category_id).maybeSingle()
       console.log(`Product ${p.id} (${p.name_id}) category_id: ${p.category_id} -> Category details:`, cat)
    }
  }
}

check().catch(console.error)
