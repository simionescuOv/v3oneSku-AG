import { create } from 'zustand'
import { supabase } from '../lib/supabaseClient'
import { normalize } from '../lib/search'

// Supabase e sursa unică de adevăr (SPEC_DatabaseSchema_v3); Zustand e doar
// cache local populat prin fetch și invalidat după fiecare mutație. Citirile
// derivate (getChildren, getBreadcrumb, getValidMoveDestinations etc.) rămân
// sincrone, calculate peste cache-ul local — doar mutațiile trec prin RPC.
//
// Nu se mai filtrează pe `tenant_id` client-side — RLS restricționează deja
// fiecare select la tenantul userului autentificat (auth.uid() → tenant_members).

// Numele de CATEGORIE e unic global per tenant (nu și folderele — libere,
// SPEC_DatabaseSchema_v3 §3.1). Verificare optimistă client-side pentru UX;
// autoritatea reală e indexul unic din DB (`uq_categories_global_name`).
function nameExistsGlobally(nodes, name, exceptId = null) {
  const target = normalize(name.trim())
  return nodes.some(
    (n) => n.id !== exceptId && n.type === 'category' && normalize(n.name) === target
  )
}

function buildIndices(nodes) {
  const nodeMap = new Map()
  const childrenMap = new Map()

  for (const node of nodes) {
    nodeMap.set(node.id, node)
    const parentId = node.parentId
    if (!childrenMap.has(parentId)) {
      childrenMap.set(parentId, [])
    }
    childrenMap.get(parentId).push(node)
  }
  return { nodeMap, childrenMap }
}

function getDescendantIds(childrenMap, id) {
  const result = new Set()
  const queue = [id]
  while (queue.length) {
    const cur = queue.shift()
    const children = childrenMap.get(cur) || []
    for (const c of children) {
      result.add(c.id)
      queue.push(c.id)
    }
  }
  return result
}

async function callRpc(fn, params) {
  const { data, error } = await supabase.rpc(fn, params)
  if (error) return { ok: false, error: error.message }
  return { ok: true, data }
}

// ── Mapare snake_case (DB) → camelCase (contractul consumat de componente) ──
const mapNode = (row) => ({
  id: row.id,
  type: row.node_type,
  name: row.name,
  parentId: row.parent_id,
  position: row.position,
  isTemp: row.is_temp,
  deletedAt: row.deleted_at,
})

const mapProduct = (row) => ({
  id: row.id,
  categoryId: row.category_id,
  nameId: row.name_id,
  attributes: row.attributes ?? {},
  tags: row.tags ?? [],
  listPrice: row.list_price,
  deletedAt: row.deleted_at,
})

const mapCategoryAttribute = (row) => ({
  id: row.id,
  categoryId: row.category_id,
  name: row.name,
  type: row.attribute_type,
  filterable: row.filterable,
  globalAttributeId: row.global_attribute_id,
  position: row.position,
})

const mapAttributeOption = (row) => ({
  id: row.id,
  attributeId: row.attribute_id,
  value: row.value,
  position: row.position,
})

export const useCatalogStore = create((set, get) => {
  const setNodes = (nodes) => {
    const { nodeMap, childrenMap } = buildIndices(nodes)
    set({ nodes, nodeMap, childrenMap })
  }

  return {
    nodes: [],
    nodeMap: new Map(),
    childrenMap: new Map(),
    trash: [],
    products: [],
    categoryAttributes: [],
    attributeOptions: [],
    loading: false,
    loaded: false,
    loadError: null,

    currentFolderId: null,
    treeExpanded: false,
    toggleTreeExpanded: () => set((s) => ({ treeExpanded: !s.treeExpanded })),
    setNodes,

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

  // ── Fetch (Supabase → cache local) ───────────────────────────────────
  fetchCatalog: async () => {
    set({ loading: true, loadError: null })
    const [nodesRes, productsRes, attrsRes, optsRes] = await Promise.all([
      supabase
        .from('categories')
        .select('*')
        .eq('is_temp', false)
        .is('deleted_at', null)
        .order('position'),
      supabase
        .from('products')
        .select('*')
        .is('deleted_at', null),
      supabase
        .from('category_attributes')
        .select('*')
        .order('position'),
      supabase
        .from('category_attribute_options')
        .select('*')
        .order('position'),
    ])

    const firstError = [nodesRes, productsRes, attrsRes, optsRes].find((r) => r.error)?.error
    if (firstError) {
      set({ loading: false, loadError: firstError.message })
      return { ok: false, error: firstError.message }
    }

    const nodes = nodesRes.data.map(mapNode)
    get().setNodes(nodes)

    set({
      products: productsRes.data.map(mapProduct),
      categoryAttributes: attrsRes.data.map(mapCategoryAttribute),
      attributeOptions: optsRes.data.map(mapAttributeOption),
      loading: false,
      loaded: true,
    })
    return { ok: true }
  },

  fetchTrash: async () => {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
    if (error) return { ok: false, error: error.message }
    set({ trash: data.map(mapNode) })
    return { ok: true }
  },

  // ── Navigation (client-side, peste cache) ────────────────────────────
  navigate: (folderId) => set({ currentFolderId: folderId }),

  navigateUp: () => {
    const { nodeMap, currentFolderId } = get()
    if (!currentFolderId) return
    const current = nodeMap.get(currentFolderId)
    set({ currentFolderId: current?.parentId ?? null })
  },

  // ── Derived helpers (sincrone, peste cache-ul local) ─────────────────
  getBreadcrumb: () => {
    const { nodeMap, currentFolderId } = get()
    if (!currentFolderId) return []
    const crumbs = []
    let id = currentFolderId
    while (id) {
      const node = nodeMap.get(id)
      if (!node) break
      crumbs.unshift(node)
      id = node.parentId
    }
    return crumbs
  },

  getChildren: (parentId) => {
    const { childrenMap } = get()
    const children = childrenMap.get(parentId) || []
    const validChildren = children.filter((n) => !n.isTemp)
    return [
      ...validChildren.filter((n) => n.type === 'folder'),
      ...validChildren.filter((n) => n.type === 'category'),
    ]
  },

  getAncestorFolders: (nodeId) => {
    const { nodeMap } = get()
    const node = nodeMap.get(nodeId)
    if (!node) return []
    const chain = []
    let parentId = node.parentId
    while (parentId) {
      const parent = nodeMap.get(parentId)
      if (!parent || parent.isTemp) break
      chain.unshift(parent)
      parentId = parent.parentId
    }
    return chain
  },

  getValidMoveDestinations: (nodeId) => {
    const { nodes, childrenMap } = get()
    const excluded = getDescendantIds(childrenMap, nodeId)
    excluded.add(nodeId)
    return nodes.filter((n) => n.type === 'folder' && !n.isTemp && !excluded.has(n.id))
  },

  // ── CRUD categorii/foldere (RPC + refetch) ───────────────────────────
  addCategory: async (name, parentId = null) => {
    const trimmed = name.trim()
    if (nameExistsGlobally(get().nodes, trimmed)) {
      return { ok: false, error: `Categoria „${trimmed}” există deja` }
    }
    const res = await callRpc('create_category', {
      p_parent_id: parentId, p_name: trimmed, p_node_type: 'category',
    })
    if (!res.ok) return res
    await get().fetchCatalog()
    return res
  },

  addFolder: async (name, parentId = null) => {
    const res = await callRpc('create_category', {
      p_parent_id: parentId, p_name: name.trim(), p_node_type: 'folder',
    })
    if (!res.ok) return res
    await get().fetchCatalog()
    return res
  },

  // Soft delete category → Trash (server-side)
  deleteCategory: async (id) => {
    const res = await callRpc('soft_delete_category', { p_category_id: id })
    if (!res.ok) return res
    await get().fetchCatalog()
    return res
  },

  // Hard delete folder → promovare copii la părintele folderului
  deleteFolder: async (id) => {
    const res = await callRpc('delete_folder', { p_folder_id: id })
    if (!res.ok) return res
    await get().fetchCatalog()
    return res
  },

  restoreFromTrash: async (id) => {
    const res = await callRpc('restore_from_trash', { p_category_id: id })
    if (!res.ok) return res
    await Promise.all([get().fetchCatalog(), get().fetchTrash()])
    return res
  },

  // ── Group (doar la rădăcină) ──────────────────────────────────────────
  groupNodes: async (ids, folderName) => {
    if (!Array.isArray(ids) || ids.length < 2) {
      return { ok: false, error: 'Gruparea necesită minim 2 elemente' }
    }
    const res = await callRpc('group_nodes', {
      p_node_ids: ids, p_folder_name: folderName.trim(),
    })
    if (!res.ok) return res
    await get().fetchCatalog()
    return res
  },

  // ── Move ─────────────────────────────────────────────────────────────
  moveNodes: async (ids, targetParentId) => {
    for (const id of ids) {
      const res = await callRpc('move_node', {
        p_node_id: id, p_new_parent_id: targetParentId,
      })
      if (!res.ok) {
        await get().fetchCatalog()
        return res
      }
    }
    await get().fetchCatalog()
    return { ok: true }
  },

  // ── Mutare cross-folder (Unfold mode) — SPEC_MutareCrossFolder ───────
  createTempFolder: async () => {
    const res = await callRpc('create_temp_folder', {})
    if (!res.ok) return null
    await get().fetchCatalog()
    return res.data
  },

  dissolveTempFolder: async (tempFolderId) => {
    const res = await callRpc('dissolve_temp_folder', { p_folder_id: tempFolderId })
    await get().fetchCatalog()
    return res
  },

  promoteTempFolder: async (tempFolderId, newName) => {
    const trimmed = newName.trim()
    if (!trimmed) return { ok: false, error: 'Numele nu poate fi gol' }
    const res = await callRpc('promote_temp_folder', {
      p_folder_id: tempFolderId, p_new_name: trimmed,
    })
    if (!res.ok) return res
    await get().fetchCatalog()
    return res
  },

  cleanupTempFolders: async () => {
    await callRpc('cleanup_temp_folders', {})
    await get().fetchCatalog()
  },

  // ── Produse (pagina categoriei) ───────────────────────────────────────
  getProductsByCategory: (categoryId) => {
    const { products } = get()
    return products.filter((p) => p.categoryId === categoryId && !p.deletedAt)
  },

  // name_id e generat server-side (RPC) — clientul nu trimite niciodată un nume.
  addProduct: async (categoryId, attributes = {}, listPrice = null, tags = []) => {
    const res = await callRpc('create_product', {
      p_category_id: categoryId,
      p_attributes: attributes,
      p_tags: tags,
      p_list_price: listPrice === '' || listPrice == null ? null : Number(listPrice),
    })
    if (!res.ok) return res
    await get().fetchCatalog()
    return res
  },

  // ── Tags — vocabular derivat din filter_idx global (SPEC_Tags §4.4) ────
  // Fără RPC dedicat și fără scanare de produse client-side. Rândul global
  // poate lipsi complet (tenant fără nicio mutație de produs/atribut încă)
  // sau poate exista fără bucket-ul `tags` (niciun produs cu tag-uri) —
  // ambele cazuri înseamnă vocabular gol, nu eroare.
  fetchTagVocabulary: async () => {
    const { data, error } = await supabase
      .from('filter_idx')
      .select('idx')
      .eq('scope_type', 'global')
      .maybeSingle()
    if (error) return { ok: false, error: error.message }
    const bucket = data?.idx?.tags ?? []
    return {
      ok: true,
      data: bucket.map((t) => ({ value: t.value, count: t.idx.length })),
    }
  },

  // ── Schema de atribute a categoriei ────────────────────────────────────
  getCategoryAttributes: (categoryId) => {
    const { categoryAttributes } = get()
    return categoryAttributes
      .filter((a) => a.categoryId === categoryId)
      .sort((a, b) => a.position - b.position)
  },

  getAttributeOptions: (attributeId) => {
    const { attributeOptions } = get()
    return attributeOptions
      .filter((o) => o.attributeId === attributeId)
      .sort((a, b) => a.position - b.position)
  },

  addAttribute: async (categoryId, name, type) => {
    const res = await callRpc('create_category_attribute', {
      p_category_id: categoryId, p_name: name, p_attribute_type: type,
    })
    if (!res.ok) return res
    await get().fetchCatalog()
    return res
  },

  addAttributeOption: async (attributeId, value) => {
    const res = await callRpc('add_category_attribute_option', {
      p_attribute_id: attributeId, p_value: value,
    })
    if (!res.ok) return res
    await get().fetchCatalog()
    return res
  },
  }
})
