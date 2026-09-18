import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
  const { data: spaces } = await supabase.from('spaces').select('id, name').limit(1)
  console.log('spaces:', spaces)
  
  if (spaces && spaces.length > 0) {
    const dest = spaces[0].id
    const { data, error } = await supabase.rpc('commit_cart', {
      p_source_type: 'catalog',
      p_source_space_id: null,
      p_destination_space_id: dest,
      p_items: [{ product_id: '123e4567-e89b-12d3-a456-426614174000', quantity: 1 }]
    })
    console.log('rpc result:', data, error)
  }
}
test()
