import { create } from 'zustand'
import { supabase } from '../lib/supabaseClient'

export const useStockStore = create((set, get) => ({
  spaces: [],
  alerts: [],
  isLoading: false,
  error: null,

  currentFolderId: null,

  // ── Navigation (client-side, peste cache) ────────────────────────────
  navigate: (folderId) => set({ currentFolderId: folderId }),

  navigateUp: () => {
    const { spaces, currentFolderId } = get()
    if (!currentFolderId) return
    const current = spaces.find((n) => n.id === currentFolderId)
    set({ currentFolderId: current?.parentId ?? null })
  },

  getBreadcrumb: () => {
    const { spaces, currentFolderId } = get()
    if (!currentFolderId) return []
    const crumbs = []
    let id = currentFolderId
    while (id) {
      const node = spaces.find((n) => n.id === id)
      if (!node) break
      crumbs.unshift(node)
      id = node.parentId
    }
    return crumbs
  },

  getChildren: (parentId) => {
    const { spaces } = get()
    const children = spaces.filter((n) => n.parentId === parentId)
    return [
      ...children.filter((n) => n.type === 'folder'),
      ...children.filter((n) => n.type === 'space'),
    ]
  },

  // ── Selection mode (Grupare / Mutare) ───────────────────────────────
  selectionMode: null,
  selectedNodeIds: new Set(),

  enterSelectionMode: (mode) =>
    set({ selectionMode: mode, selectedNodeIds: new Set() }),

  toggleNodeSelection: (id) =>
    set((s) => {
      const next = new Set(s.selectedNodeIds)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { selectedNodeIds: next }
    }),

  clearSelection: () => set({ selectionMode: null, selectedNodeIds: new Set() }),

  // ── API ─────────────────────────────────────────────────────────────
  fetchSpaces: async () => {
    set({ isLoading: true, error: null })
    const { data, error } = await supabase
      .from('spaces_summary')
      .select('*')
      .order('position', { ascending: true }) // changed from created_at to position

    if (error) {
      set({ isLoading: false, error: error.message })
      return { ok: false, error: error.message }
    }

    // Map DB to camelCase
    const mapped = data.map(s => ({
      ...s,
      parentId: s.parent_id,
    }))

    set({ spaces: mapped, isLoading: false })
    return { ok: true, data: mapped }
  },

  createSpace: async (name, allowNegativeStock = false) => {
    const tenantId = (await import('./useAuthStore')).useAuthStore.getState().tenantId
    const parentId = get().currentFolderId

    const { error } = await supabase
      .from('spaces')
      .insert({
        tenant_id: tenantId,
        name,
        type: 'space',
        parent_id: parentId,
        allow_negative_stock: allowNegativeStock,
      })

    if (error) return { ok: false, error: error.message }
    await get().fetchSpaces()
    return { ok: true }
  },

  createFolder: async (name) => {
    const tenantId = (await import('./useAuthStore')).useAuthStore.getState().tenantId
    const parentId = get().currentFolderId

    const { error } = await supabase
      .from('spaces')
      .insert({
        tenant_id: tenantId,
        name,
        type: 'folder',
        parent_id: parentId,
      })

    if (error) return { ok: false, error: error.message }
    await get().fetchSpaces()
    return { ok: true }
  },

  moveNodes: async (ids, targetParentId) => {
    const { error } = await supabase
      .from('spaces')
      .update({ parent_id: targetParentId })
      .in('id', ids)

    if (error) return { ok: false, error: error.message }
    await get().fetchSpaces()
    return { ok: true }
  },

  groupNodes: async (ids, folderName) => {
    const tenantId = (await import('./useAuthStore')).useAuthStore.getState().tenantId
    const parentId = get().currentFolderId

    // 1. Create folder
    const { data: folder, error: folderErr } = await supabase
      .from('spaces')
      .insert({
        tenant_id: tenantId,
        name: folderName,
        type: 'folder',
        parent_id: parentId,
      })
      .select('id')
      .single()

    if (folderErr) return { ok: false, error: folderErr.message }

    // 2. Move items
    const { error: moveErr } = await supabase
      .from('spaces')
      .update({ parent_id: folder.id })
      .in('id', ids)

    if (moveErr) return { ok: false, error: moveErr.message }

    await get().fetchSpaces()
    return { ok: true }
  },

  // ... (rest of methods)
  fetchAlerts: async () => {
    const { data, error } = await supabase
      .from('stock_alerts')
      .select('*, products(name_id)')
      .is('resolved_at', null)
      .order('created_at', { ascending: false })

    if (error) return { ok: false, error: error.message }
    set({ alerts: data })
    return { ok: true, data }
  },

  resolveAlert: async (alertId) => {
    const { error } = await supabase
      .from('stock_alerts')
      .update({ resolved_at: new Date().toISOString() })
      .eq('id', alertId)

    if (error) return { ok: false, error: error.message }
    set((state) => ({ alerts: state.alerts.filter((a) => a.id !== alertId) }))
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

  // ── Pagina unui Space ────────────────────────────────────────────────
  // Produsele din Space: space_products (stoc + delta locală) + produsele din
  // Catalog (NameID, atribute, categorie) citite live prin pointer.
  fetchSpaceProducts: async (spaceId) => {
    const { data, error } = await supabase
      .from('space_products')
      .select(`
        space_id,
        product_id,
        stock,
        local_tags,
        updated_at,
        products (
          id,
          name_id,
          category_id,
          attributes,
          tags,
          list_price,
          categories ( name )
        )
      `)
      .eq('space_id', spaceId)
      .order('updated_at', { ascending: false })

    if (error) return { ok: false, error: error.message }

    const mapped = data.map((row) => ({
      productId: row.product_id,
      spaceId: row.space_id,
      stock: row.stock,
      localTags: row.local_tags ?? [],
      updatedAt: row.updated_at,
      // date din Catalog (live prin pointer)
      nameId: row.products?.name_id ?? '—',
      categoryId: row.products?.category_id ?? null,
      categoryName: row.products?.categories?.name ?? null,
      attributes: row.products?.attributes ?? {},
      tags: row.products?.tags ?? [],
      listPrice: row.products?.list_price ?? null,
      // referință completă pentru coș
      catalogProduct: row.products
        ? {
            id: row.products.id,
            nameId: row.products.name_id,
            categoryId: row.products.category_id,
            attributes: row.products.attributes ?? {},
            tags: row.products.tags ?? [],
            listPrice: row.products.list_price,
          }
        : null,
    }))

    return { ok: true, data: mapped }
  },

  // Tranzacțiile unui Space: toate în care Space-ul e sursă SAU destinație,
  // cu item-urile aferente și NameID-ul produselor.
  fetchSpaceTransactions: async (spaceId) => {
    const { data, error } = await supabase
      .from('transactions')
      .select(`
        id,
        source_type,
        source_space_id,
        destination_space_id,
        created_at,
        transaction_items (
          product_id,
          quantity,
          products ( name_id )
        ),
        source_space:spaces!source_space_id ( name ),
        destination_space:spaces!destination_space_id ( name )
      `)
      .or(`source_space_id.eq.${spaceId},destination_space_id.eq.${spaceId}`)
      .order('created_at', { ascending: false })

    if (error) return { ok: false, error: error.message }

    // Transformă fiecare tranzacție într-un bloc Flux
    const blocks = data.map((tx) => {
      const isInbound = tx.destination_space_id === spaceId
      const direction = isInbound ? 'inbound' : 'outbound'

      let sourceLabel = ''
      if (tx.source_type === 'catalog') {
        sourceLabel = 'din catalog'
      } else if (isInbound) {
        sourceLabel = `← ${tx.source_space?.name ?? '?'}`
      } else {
        sourceLabel = `→ ${tx.destination_space?.name ?? '?'}`
      }

      const items = (tx.transaction_items ?? []).map((item) => ({
        nameId: item.products?.name_id ?? '—',
        qty: item.quantity,
      }))

      const totalQty = items.reduce((sum, i) => sum + Number(i.qty), 0)

      return {
        id: tx.id,
        direction,
        sourceLabel,
        createdAt: tx.created_at,
        items,
        totalQty,
      }
    })

    return { ok: true, data: blocks }
  },
}))
