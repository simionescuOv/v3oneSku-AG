import { create } from 'zustand'
import { supabase } from '../lib/supabaseClient'

export const useStockStore = create((set, get) => ({
  spaces: [],
  alerts: [],
  isLoading: false,
  error: null,

  fetchSpaces: async () => {
    set({ isLoading: true, error: null })
    const { data, error } = await supabase
      .from('spaces_summary')
      .select('*')
      .order('created_at', { ascending: true })

    if (error) {
      set({ isLoading: false, error: error.message })
      return { ok: false, error: error.message }
    }

    set({ spaces: data, isLoading: false })
    return { ok: true, data }
  },

  fetchAlerts: async () => {
    const { data, error } = await supabase
      .from('stock_alerts')
      .select('*, products(name_id)')
      .is('resolved_at', null)
      .order('created_at', { ascending: false })

    if (error) {
      return { ok: false, error: error.message }
    }

    set({ alerts: data })
    return { ok: true, data }
  },

  resolveAlert: async (alertId) => {
    const { error } = await supabase
      .from('stock_alerts')
      .update({ resolved_at: new Date().toISOString() })
      .eq('id', alertId)

    if (error) return { ok: false, error: error.message }
    
    // Remove from local state
    set((state) => ({
      alerts: state.alerts.filter((a) => a.id !== alertId)
    }))
    
    return { ok: true }
  },

  commitCart: async (sourceType, sourceSpaceId, destinationSpaceId, items) => {
    const formattedItems = items.map((item) => ({
      product_id: item.product.id,
      quantity: item.quantity,
    }))

    const { data, error } = await supabase.rpc('commit_cart', {
      p_source_type: sourceType,
      p_source_space_id: sourceSpaceId,
      p_destination_space_id: destinationSpaceId,
      p_items: formattedItems,
    })

    if (error) return { ok: false, error: error.message }

    await get().fetchSpaces()
    
    if (data?.alerts && data.alerts.length > 0) {
      await get().fetchAlerts()
    }

    return { ok: true, transactionId: data.transaction_id, alerts: data.alerts }
  },
}))
