import { create } from 'zustand'
import { supabase } from '../lib/supabaseClient'

// ── Constante ──────────────────────────────────────────────────────────────────
// SPEC_Flux_Filtering_Architecture.md §10
const ROUTING_THRESHOLD = 2000   // max tranzacții pentru procesare locală
const PAGE_SIZE = 50              // dimensiune pagină infinite scroll

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Returnează [from, to] ISO8601 pentru perioadele rapide predefinite.
 * `to` e Always "acum" (capăt deschis).
 */
function getPeriodRange(period) {
  const now = new Date()
  const to = now.toISOString()

  if (period === 'today') {
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    return { from, to }
  }
  if (period === '7days') {
    const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    return { from, to }
  }
  if (period === 'month') {
    const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    return { from, to }
  }
  if (period === 'all') {
    return { from: null, to: null }
  }
  // custom: { from, to } deja ISO8601
  return null
}

/**
 * Verifică dacă o perioadă [from, to] este acoperită integral de Working Window.
 * Working Window = cele mai recente ROUTING_THRESHOLD tranzacții (nu are garanție temporală).
 * Se consideră acoperită dacă:
 *   - WW are < ROUTING_THRESHOLD tranzacții (înseamnă că are TOATE istoricul din DB)
 *   - SAU `from` >= created_at al celei mai vechi tranzacții din WW
 */
function isPeriodCoveredByWorkingWindow(workingWindow, workingWindowMeta, from) {
  if (!from) return false // 'all' nu e acoperit de WW decât dacă WW e complet
  if (workingWindowMeta.count < ROUTING_THRESHOLD) return true // avem tot istoricul
  if (workingWindow.length === 0) return false
  const oldestInWW = workingWindow[workingWindow.length - 1]?.createdAt
  if (!oldestInWW) return false
  return new Date(from) >= new Date(oldestInWW)
}

/**
 * Verifică dacă o perioadă [from, to] este acoperită de Session Cache.
 */
function isPeriodCoveredBySessionCache(sessionCache, spaceId, from, to) {
  if (!sessionCache || sessionCache.spaceId !== spaceId) return false
  if (!sessionCache.transactions || sessionCache.transactions.length === 0) return false
  const cachedFrom = sessionCache.from
  const cachedTo = sessionCache.to
  // from >= cachedFrom (sau cachedFrom e null = "all")
  const fromOk = !cachedFrom || !from || new Date(from) >= new Date(cachedFrom)
  // to <= cachedTo (sau cachedTo e null = "all")
  const toOk = !cachedTo || !to || new Date(to) <= new Date(cachedTo)
  return fromOk && toOk
}

/**
 * Aplică filtrele fluxFilter pe un array de tranzacții brute (Working Window sau Session Cache).
 * Returnează array filtrat.
 */
function applyLocalFilters(transactions, filter) {
  let result = transactions

  // Filtru Tip mișcare (inbound/outbound)
  if (filter.types && filter.types.length > 0 && filter.types.length < 2) {
    result = result.filter((tx) => filter.types.includes(tx.direction))
  }

  // Filtru Spațiu Partener (sursă sau destinație)
  if (filter.partnerSpaceId) {
    result = result.filter(
      (tx) => tx.sourceSpaceId === filter.partnerSpaceId || tx.destinationSpaceId === filter.partnerSpaceId
    )
  }

  // Filtru Produs specific (product_id sau nameId lookup)
  if (filter.productId) {
    result = result.filter((tx) =>
      tx.items.some((item) => item.productId === filter.productId)
    )
  }

  // Filtru Perioadă
  if (filter.from) {
    const fromMs = new Date(filter.from).getTime()
    result = result.filter((tx) => new Date(tx.createdAt).getTime() >= fromMs)
  }
  if (filter.to) {
    const toMs = new Date(filter.to).getTime()
    result = result.filter((tx) => new Date(tx.createdAt).getTime() <= toMs)
  }

  // După filtrele la nivel de tranzacție, evaluăm filtrele specifice produselor (items)
  const hasItemFilters = filter.categoryId || (filter.tags && filter.tags.length > 0) || (filter.attributes && Object.keys(filter.attributes).length > 0) || filter.productId
  const showWhole = filter.showWholeTransaction !== false

  if (hasItemFilters) {
    result = result.map(tx => {
      const newItems = []
      tx.items.forEach(item => {
        let matches = true
        if (filter.productId && item.productId !== filter.productId) matches = false
        if (matches && filter.categoryId && item.categoryId !== filter.categoryId) matches = false
        if (matches && filter.tags && filter.tags.length > 0) {
          if (!filter.tags.some((tag) => (item.tags ?? []).includes(tag))) matches = false
        }
        if (matches && filter.attributes && Object.keys(filter.attributes).length > 0) {
          const attrs = item.attributes ?? {}
          const attrMatch = Object.entries(filter.attributes).every(([attrId, values]) => {
            const itemVal = attrs[attrId]
            return Array.isArray(values) ? values.includes(itemVal) : itemVal === values
          })
          if (!attrMatch) matches = false
        }

        if (matches) {
          newItems.push({ ...item, _matchedFilter: true })
        } else if (showWhole) {
          newItems.push({ ...item }) // fără bifa
        }
      })

      if (newItems.some(i => i._matchedFilter)) {
        return { ...tx, items: newItems }
      }
      return null
    }).filter(Boolean)
  }

  return result
}

/**
 * Agregă tranzacții în funcție de granularitate.
 * Returnează array de FluxBlock-uri (pentru granularitate 'transaction') sau
 * SummaryBlock-uri (pentru 'daily', 'weekly', 'monthly').
 */
function aggregateByGranularity(transactions, granularity) {
  if (granularity === 'transaction') return transactions

  // Funcție de key per bucket
  const getBucketKey = (isoDate) => {
    const d = new Date(isoDate)
    if (granularity === 'daily') {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }
    if (granularity === 'weekly') {
      // Luni ca start de săptămână
      const day = d.getDay() === 0 ? 6 : d.getDay() - 1
      const monday = new Date(d)
      monday.setDate(d.getDate() - day)
      return `week-${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`
    }
    if (granularity === 'monthly') {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    }
    return isoDate
  }

  const buckets = new Map()

  for (const tx of transactions) {
    const key = getBucketKey(tx.createdAt)
    if (!buckets.has(key)) {
      buckets.set(key, {
        bucketKey: key,
        bucketDate: tx.createdAt,
        granularity,
        // Map: productId → { nameId, qtyInbound, qtyOutbound, categoryId, tags, attributes }
        products: new Map(),
        totalInbound: 0,
        totalOutbound: 0,
        txCount: 0,
      })
    }
    const bucket = buckets.get(key)
    bucket.txCount++

    for (const item of tx.items) {
      const existing = bucket.products.get(item.productId) ?? {
        productId: item.productId,
        nameId: item.nameId,
        categoryId: item.categoryId ?? null,
        tags: item.tags ?? [],
        attributes: item.attributes ?? {},
        qtyInbound: 0,
        qtyOutbound: 0,
        _matchedFilter: false,
      }
      if (item._matchedFilter) {
        existing._matchedFilter = true
      }
      if (tx.direction === 'inbound') {
        existing.qtyInbound += Number(item.qty)
        bucket.totalInbound += Number(item.qty)
      } else {
        existing.qtyOutbound += Number(item.qty)
        bucket.totalOutbound += Number(item.qty)
      }
      bucket.products.set(item.productId, existing)
    }
  }

  // Convertim Map → array, sortăm descrescător după data bucket-ului
  return Array.from(buckets.values())
    .map((b) => ({
      ...b,
      products: Array.from(b.products.values()),
    }))
    .sort((a, b) => new Date(b.bucketDate).getTime() - new Date(a.bucketDate).getTime())
}

// ── Mapare DB row → FluxBlock (reutilizată în init + delta-fetch) ───────────
function mapTxToBlock(tx, spaceId) {
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
    productId: item.product_id,
    nameId: item.products?.name_id ?? '—',
    qty: item.quantity,
    categoryId: item.products?.category_id ?? null,
    tags: item.products?.tags ?? [],
    attributes: item.products?.attributes ?? {},
  }))

  const totalQty = items.reduce((sum, i) => sum + Number(i.qty), 0)

  return {
    id: tx.id,
    direction,
    sourceLabel,
    sourceSpaceId: tx.source_space_id,
    destinationSpaceId: tx.destination_space_id,
    createdAt: tx.created_at,
    items,
    totalQty,
  }
}

// ── Store ──────────────────────────────────────────────────────────────────────
export const useFluxStore = create((set, get) => ({

  // ── Stratul 1: Working Window ────────────────────────────────────────────────
  workingWindow: [],
  workingWindowMeta: {
    spaceId: null,
    lastSyncedAt: null,   // cursor pentru delta-fetch (created_at server-side)
    count: 0,
  },

  // ── Stratul 2: Session Cache ─────────────────────────────────────────────────
  sessionCache: {
    spaceId: null,
    from: null,
    to: null,
    transactions: [],
    fetchedAt: null,
  },

  // ── Sursă brută activă pentru fațete inteligente ─────────────────────────────
  currentRawSource: [],
  filteredRawCount: 0,

  // ── Filtrul activ ────────────────────────────────────────────────────────────
  fluxFilter: {
    period: null,          // 'today' | '7days' | 'month' | 'all' | 'custom' | null (= infinite scroll mode)
    from: null,            // ISO8601, calculat din period sau setat manual (custom)
    to: null,              // ISO8601
    granularity: 'transaction',  // 'transaction' | 'daily' | 'weekly' | 'monthly'
    types: ['inbound', 'outbound'],
    partnerSpaceId: null,
    productId: null,
    categoryId: null,
    tags: [],
    attributes: {},
    showWholeTransaction: true,
  },

  // ── Stare routing ────────────────────────────────────────────────────────────
  // 'idle' | 'loading_ww' | 'counting' | 'fetching_raw' | 'computing_local'
  // | 'done' | 'error' | 'offline_blocked' | 'volume_exceeded'
  fluxRoutingStatus: 'idle',
  fluxError: null,

  // ── Infinite scroll (default view, fără filtru activ) ────────────────────────
  infiniteScrollPage: 1,
  hasMorePages: true,

  // ── Rezultatul final (output calculat) ───────────────────────────────────────
  // REGULĂ: nu se scrie niciodată direct — e recalculat de applyFilter / aggregateLocalResult
  fluxResult: [],

  // ════════════════════════════════════════════════════════════════════════════
  // ACȚIUNI
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Inițializează Working Window la intrarea pe tab Flux.
   * Aduce cele mai recente ROUTING_THRESHOLD tranzacții ale spaceId.
   * Dacă WW-ul pentru același spaceId este deja în memorie, nu refetch.
   */
  initWorkingWindow: async (spaceId) => {
    const { workingWindowMeta } = get()

    // Cache hit: același space, WW deja populat
    if (workingWindowMeta.spaceId === spaceId && workingWindowMeta.count > 0) {
      // Recalculăm rezultatul pentru view-ul curent
      get()._recomputeResult()
      return { ok: true, fromCache: true }
    }

    set({ fluxRoutingStatus: 'loading_ww', fluxError: null })

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
          products ( name_id, category_id, tags, attributes )
        ),
        source_space:spaces!source_space_id ( name ),
        destination_space:spaces!destination_space_id ( name )
      `)
      .or(`source_space_id.eq.${spaceId},destination_space_id.eq.${spaceId}`)
      .order('created_at', { ascending: false })
      .limit(ROUTING_THRESHOLD)

    if (error) {
      set({ fluxRoutingStatus: 'error', fluxError: error.message })
      return { ok: false, error: error.message }
    }

    const blocks = data.map((tx) => mapTxToBlock(tx, spaceId))
    const lastSyncedAt = blocks.length > 0 ? blocks[0].createdAt : null

    set({
      workingWindow: blocks,
      workingWindowMeta: {
        spaceId,
        lastSyncedAt,
        count: blocks.length,
      },
      infiniteScrollPage: 1,
      hasMorePages: blocks.length === ROUTING_THRESHOLD,
      fluxRoutingStatus: 'done',
    })

    get()._recomputeResult()
    return { ok: true, fromCache: false }
  },

  /**
   * Delta-fetch: aduce tranzacțiile noi după commitCart.
   * Cursor: created_at al ultimei tranzacții sincronizate (server-side, nu Date.now()).
   * Deduplicare pe id.
   */
  deltaFetch: async (spaceId) => {
    const { workingWindowMeta, workingWindow } = get()
    if (workingWindowMeta.spaceId !== spaceId) return { ok: false, reason: 'wrong_space' }

    const cursor = workingWindowMeta.lastSyncedAt
    if (!cursor) return { ok: false, reason: 'no_cursor' }

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
          products ( name_id, category_id, tags, attributes )
        ),
        source_space:spaces!source_space_id ( name ),
        destination_space:spaces!destination_space_id ( name )
      `)
      .or(`source_space_id.eq.${spaceId},destination_space_id.eq.${spaceId}`)
      .gt('created_at', cursor)
      .order('created_at', { ascending: false })

    if (error) return { ok: false, error: error.message }
    if (!data || data.length === 0) return { ok: true, newCount: 0 }

    const newBlocks = data.map((tx) => mapTxToBlock(tx, spaceId))

    // Deduplicare (în caz de tranzacții simultane cu același timestamp)
    const existingIds = new Set(workingWindow.map((b) => b.id))
    const uniqueNew = newBlocks.filter((b) => !existingIds.has(b.id))

    if (uniqueNew.length === 0) return { ok: true, newCount: 0 }

    const newLastSyncedAt = uniqueNew[0].createdAt // cel mai recent (desc order)
    const merged = [...uniqueNew, ...workingWindow].slice(0, ROUTING_THRESHOLD)

    set((state) => ({
      workingWindow: merged,
      workingWindowMeta: {
        ...state.workingWindowMeta,
        lastSyncedAt: newLastSyncedAt,
        count: merged.length,
      },
    }))

    get()._recomputeResult()
    return { ok: true, newCount: uniqueNew.length }
  },

  /**
   * Infinite scroll: încarcă pagina următoare (numai în modul fără filtru activ).
   */
  loadMorePages: async (spaceId) => {
    const { infiniteScrollPage, hasMorePages, workingWindowMeta, workingWindow } = get()
    if (!hasMorePages) return { ok: false, reason: 'no_more' }
    // Nu paginem dacă e în modul filtru
    if (get().fluxFilter.period !== null) return { ok: false, reason: 'filter_active' }

    const offset = workingWindowMeta.count + (infiniteScrollPage - 1) * PAGE_SIZE
    // Dacă WW nu e complet (count < THRESHOLD), nu mai avem ce aduce
    if (workingWindowMeta.count < ROUTING_THRESHOLD) {
      set({ hasMorePages: false })
      return { ok: true, newCount: 0 }
    }

    const oldestInWW = workingWindow[workingWindow.length - 1]?.createdAt
    if (!oldestInWW) return { ok: false, reason: 'no_cursor' }

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
          products ( name_id, category_id, tags, attributes )
        ),
        source_space:spaces!source_space_id ( name ),
        destination_space:spaces!destination_space_id ( name )
      `)
      .or(`source_space_id.eq.${spaceId},destination_space_id.eq.${spaceId}`)
      .lt('created_at', oldestInWW)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE)

    if (error) return { ok: false, error: error.message }

    const newBlocks = (data || []).map((tx) => mapTxToBlock(tx, spaceId))

    set((state) => ({
      workingWindow: [...state.workingWindow, ...newBlocks],
      infiniteScrollPage: state.infiniteScrollPage + 1,
      hasMorePages: newBlocks.length === PAGE_SIZE,
      workingWindowMeta: {
        ...state.workingWindowMeta,
        count: state.workingWindowMeta.count + newBlocks.length,
      },
    }))

    get()._recomputeResult()
    return { ok: true, newCount: newBlocks.length }
  },

  /**
   * Aplică un filtru nou.
   * Implementează decision tree-ul pe 3 niveluri (Faza 1: max Nivel 2 local).
   */
  applyFilter: async (newFilter) => {
    set({ fluxFilter: newFilter, fluxError: null })

    // Modul Infinite Scroll (niciun filtru de perioadă)
    if (!newFilter.period) {
      get()._recomputeResult()
      return
    }

    // Rezolvă from/to din period
    let range = null
    if (newFilter.period === 'custom') {
      range = { from: newFilter.from, to: newFilter.to }
    } else {
      range = getPeriodRange(newFilter.period)
    }
    const { from, to } = range || {}

    const { workingWindow, workingWindowMeta, sessionCache } = get()

    // ── Nivel 1: Working Window ───────────────────────────────────────────────
    if (isPeriodCoveredByWorkingWindow(workingWindow, workingWindowMeta, from)) {
      set({ fluxRoutingStatus: 'computing_local' })
      get()._recomputeResult()
      set({ fluxRoutingStatus: 'done' })
      return
    }

    // ── Nivel 1b: Session Cache ───────────────────────────────────────────────
    if (isPeriodCoveredBySessionCache(sessionCache, workingWindowMeta.spaceId, from, to)) {
      set({ fluxRoutingStatus: 'computing_local' })
      get()._recomputeResult()
      set({ fluxRoutingStatus: 'done' })
      return
    }

    // ── Verificare offline ────────────────────────────────────────────────────
    if (!navigator.onLine) {
      const wwCount = workingWindowMeta.count
      set({
        fluxRoutingStatus: 'offline_blocked',
        fluxError: `Ești offline. Datele disponibile local acoperă ${wwCount} tranzacții recente. Pentru perioada solicitată este necesară o conexiune la internet.`,
        fluxResult: [],
      })
      return
    }

    // ── COUNT query server ────────────────────────────────────────────────────
    set({ fluxRoutingStatus: 'counting' })

    let countQuery = supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .or(`source_space_id.eq.${workingWindowMeta.spaceId},destination_space_id.eq.${workingWindowMeta.spaceId}`)

    if (from) countQuery = countQuery.gte('created_at', from)
    if (to) countQuery = countQuery.lte('created_at', to)

    const { count, error: countError } = await countQuery

    if (countError) {
      set({ fluxRoutingStatus: 'error', fluxError: countError.message })
      return
    }

    // ── Volume exceeded (Faza 1: hard limit) ─────────────────────────────────
    if (count > ROUTING_THRESHOLD) {
      set({
        fluxRoutingStatus: 'volume_exceeded',
        fluxError: `Perioada selectată conține ${count.toLocaleString('ro-RO')} tranzacții. Selectează o perioadă mai scurtă (max ${ROUTING_THRESHOLD.toLocaleString('ro-RO')} tranzacții).`,
        fluxResult: [],
      })
      return
    }

    // ── Fetch date brute → Session Cache ─────────────────────────────────────
    set({ fluxRoutingStatus: 'fetching_raw' })

    let rawQuery = supabase
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
          products ( name_id, category_id, tags, attributes )
        ),
        source_space:spaces!source_space_id ( name ),
        destination_space:spaces!destination_space_id ( name )
      `)
      .or(`source_space_id.eq.${workingWindowMeta.spaceId},destination_space_id.eq.${workingWindowMeta.spaceId}`)
      .order('created_at', { ascending: false })

    if (from) rawQuery = rawQuery.gte('created_at', from)
    if (to) rawQuery = rawQuery.lte('created_at', to)

    const { data: rawData, error: rawError } = await rawQuery

    if (rawError) {
      set({ fluxRoutingStatus: 'error', fluxError: rawError.message })
      return
    }

    const transactions = rawData.map((tx) => mapTxToBlock(tx, workingWindowMeta.spaceId))

    set({
      sessionCache: {
        spaceId: workingWindowMeta.spaceId,
        from: from || null,
        to: to || null,
        transactions,
        fetchedAt: new Date().toISOString(),
      },
      fluxRoutingStatus: 'computing_local',
    })

    // Recalculăm cu datele din Session Cache (deja setate în state)
    get()._recomputeResult()
    set({ fluxRoutingStatus: 'done' })
  },

  /**
   * Resetează filtrul → revine la modul Infinite Scroll (Working Window).
   */
  resetFilter: () => {
    set({
      fluxFilter: {
        period: null,
        from: null,
        to: null,
        granularity: 'transaction',
        types: ['inbound', 'outbound'],
        partnerSpaceId: null,
        productId: null,
        categoryId: null,
        tags: [],
        attributes: {},
      },
      fluxRoutingStatus: 'done',
      fluxError: null,
    })
    get()._recomputeResult()
  },

  /**
   * Curăță starea la ieșirea din SpacePage (unmount).
   */
  clearFlux: () => {
    set({
      workingWindow: [],
      workingWindowMeta: { spaceId: null, lastSyncedAt: null, count: 0 },
      sessionCache: { spaceId: null, from: null, to: null, transactions: [], fetchedAt: null },
      fluxFilter: {
        period: null, from: null, to: null, granularity: 'transaction',
        types: ['inbound', 'outbound'], partnerSpaceId: null,
        productId: null, categoryId: null, tags: [], attributes: {},
        showWholeTransaction: true,
      },
      currentRawSource: [],
      filteredRawCount: 0,
      fluxRoutingStatus: 'idle',
      fluxError: null,
      fluxResult: [],
      infiniteScrollPage: 1,
      hasMorePages: true,
    })
  },

  // ════════════════════════════════════════════════════════════════════════════
  // INTERNĂ — recalculare fluxResult din sursa corectă
  // ════════════════════════════════════════════════════════════════════════════
  _recomputeResult: () => {
    const { fluxFilter, workingWindow, sessionCache, workingWindowMeta } = get()

    let source = []

    if (!fluxFilter.period) {
      // Fără filtru de perioadă → modul Infinite Scroll folosește Working Window
      source = workingWindow
    } else {
      // Cu filtru activ → determinăm sursa pe baza perioadei
      let range = null
      if (fluxFilter.period === 'custom') {
        range = { from: fluxFilter.from, to: fluxFilter.to }
      } else {
        range = getPeriodRange(fluxFilter.period)
      }
      const { from, to } = range || {}

      if (isPeriodCoveredByWorkingWindow(workingWindow, workingWindowMeta, from)) {
        source = workingWindow
      } else if (isPeriodCoveredBySessionCache(sessionCache, workingWindowMeta.spaceId, from, to)) {
        source = sessionCache.transactions
      } else {
        // Nu avem date locale (așteptăm fetch) — fluxResult rămâne cum era sau []
        return
      }
    }

    // Aplicăm filtrele și agregarea PENTRU ORICE SURSĂ (inclusiv Infinite Scroll)
    const filtered = applyLocalFilters(source, fluxFilter)
    const aggregated = aggregateByGranularity(filtered, fluxFilter.granularity)
    
    set({ fluxResult: aggregated, currentRawSource: source, filteredRawCount: filtered.length })
  },
}))
