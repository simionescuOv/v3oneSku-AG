import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, SlidersHorizontal, RotateCcw, Warehouse } from 'lucide-react'
import { useStockStore } from '../store/useStockStore'
import { useAppStore } from '../store/useAppStore'
import { useCatalogStore } from '../store/useCatalogStore'
import { useCartStore } from '../store/useCartStore'
import { usePicker } from '../hooks/usePicker'
import SpaceProductCard from '../components/stockhub/SpaceProductCard'
import FluxFeed from '../components/stockhub/FluxFeed'
import BottomSheet from '../components/catalog/BottomSheet'
import FilterSheet from '../components/catalog/FilterSheet'

// Vizualizarea curentă a Space-ului: 'stoc' sau 'flux'
// Comutarea se face din meniul de context (BottomBar), nu printr-un tab vizibil.

export default function SpacePage() {
  const { spaceId } = useParams()
  const routerNavigate = useNavigate()

  // ── Store-uri ────────────────────────────────────────────────────────
  const spaces = useStockStore((s) => s.spaces)
  const fetchSpaceProducts = useStockStore((s) => s.fetchSpaceProducts)
  const fetchSpaceTransactions = useStockStore((s) => s.fetchSpaceTransactions)
  const getBreadcrumb = useStockStore((s) => s.getBreadcrumb)

  const categoryAttributes = useCatalogStore((s) => s.categoryAttributes)
  const hasCart = useCartStore((s) => s.items.length > 0)

  const searchQuery = useAppStore((s) => s.searchQuery)
  const setSearchPlaceholder = useAppStore((s) => s.setSearchPlaceholder)
  const clearSearch = useAppStore((s) => s.clearSearch)
  const spaceMenuOpen = useAppStore((s) => s.spaceMenuOpen)
  const closeSpaceMenu = useAppStore((s) => s.closeSpaceMenu)

  // ── Stare locală ──────────────────────────────────────────────────────
  const [view, setView] = useState('stoc')          // 'stoc' | 'flux'
  const [spaceProducts, setSpaceProducts] = useState([])
  const [fluxBlocks, setFluxBlocks] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [filterOpen, setFilterOpen] = useState(false)
  const [appliedFilters, setAppliedFilters] = useState({})
  const [filteredProductIds, setFilteredProductIds] = useState(null)
  const [toast, setToast] = useState(null)
  const toastTimer = useRef(null)

  // ── Datele Space-ului curent ──────────────────────────────────────────
  const space = useMemo(
    () => spaces.find((s) => s.id === spaceId),
    [spaces, spaceId]
  )

  // Breadcrumb: StockHub → [Folder?] → Space
  // Navigăm virtual în store la spaceId ca să obținem breadcrumb-ul corect
  const breadcrumb = useMemo(() => {
    // Construim manual: ancestor-ii din tree + space-ul curent
    if (!space) return []
    const crumbs = []
    let parentId = space.parentId
    while (parentId) {
      const node = spaces.find((n) => n.id === parentId)
      if (!node) break
      crumbs.unshift(node)
      parentId = node.parentId
    }
    return crumbs
  }, [space, spaces])

  const fullCrumbs = useMemo(
    () => [{ id: null, name: 'StockHub' }, ...breadcrumb, space ? { id: space.id, name: space.name } : null].filter(Boolean),
    [breadcrumb, space]
  )

  // ── Fetch la montare ─────────────────────────────────────────────────
  useEffect(() => {
    if (!spaceId) return
    setIsLoading(true)
    clearSearch()
    setSearchPlaceholder('Caută produs în spațiu...')

    Promise.all([
      fetchSpaceProducts(spaceId),
      fetchSpaceTransactions(spaceId),
    ]).then(([productsRes, txRes]) => {
      if (productsRes.ok) setSpaceProducts(productsRes.data)
      if (txRes.ok) setFluxBlocks(txRes.data)
      setIsLoading(false)
    })

    return () => {
      clearSearch()
      setSearchPlaceholder('Caută sau creează spații...')
    }
  }, [spaceId, fetchSpaceProducts, fetchSpaceTransactions, clearSearch, setSearchPlaceholder])

  // Închide meniul la unmount
  useEffect(() => () => closeSpaceMenu(), [closeSpaceMenu])

  const showToast = useCallback((msg) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast(msg)
    toastTimer.current = setTimeout(() => setToast(null), 3000)
  }, [])

  // ── Căutare produse (tab Stoc) ────────────────────────────────────────
  const baseProducts = useMemo(() => {
    if (filteredProductIds === null) return spaceProducts
    return spaceProducts.filter((p) => filteredProductIds.has(p.productId))
  }, [spaceProducts, filteredProductIds])

  const { filteredItems: searchMatches } = usePicker({
    mode: 'inline',
    items: baseProducts,
    labelFn: (p) => `${p.nameId} ${p.categoryName ?? ''} ${(p.tags ?? []).join(' ')}`,
    query: searchQuery,
  })

  // ── Meta atribute pentru card (câmpurile cu cardPreview = true) ───────
  const getProductMeta = useCallback((p) => {
    const catAttrs = categoryAttributes.filter(
      (a) => a.categoryId === p.categoryId && a.cardPreview
    )
    return catAttrs.map((a) => p.attributes?.[a.id]).filter(Boolean).join(' · ')
  }, [categoryAttributes])

  // ── Comutare Stoc/Flux din meniu ──────────────────────────────────────
  const handleSwitchView = useCallback((newView) => {
    setView(newView)
    closeSpaceMenu()
    clearSearch()
  }, [closeSpaceMenu, clearSearch])

  // ── Guard: Space inexistent ───────────────────────────────────────────
  if (!isLoading && !space) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        <p className="text-zinc-400 text-sm mb-4">Spațiul nu există.</p>
        <button
          onClick={() => routerNavigate('/stockhub')}
          className="px-4 h-10 rounded-xl bg-blue-600 text-sm font-medium text-white active:bg-blue-700"
        >
          Înapoi la StockHub
        </button>
      </div>
    )
  }

  // ── Rezumat ───────────────────────────────────────────────────────────
  const totalUnits = spaceProducts.reduce((sum, p) => sum + Number(p.stock), 0)
  const productCount = spaceProducts.length

  return (
    <div className="flex flex-col h-full">

      {/* Header — breadcrumb */}
      <div className="flex-none flex items-start gap-1 px-2 py-2 border-b border-zinc-800">
        <button
          onClick={() => routerNavigate('/stockhub')}
          className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg text-zinc-400 active:text-zinc-100 active:bg-zinc-800"
        >
          <ChevronLeft size={20} />
        </button>

        <div className="flex items-center gap-1.5 min-h-8 min-w-0 flex-1 overflow-hidden">
          {fullCrumbs.map((crumb, i, arr) => {
            const isLast = i === arr.length - 1
            return (
              <span key={crumb.id ?? `c-${i}`} className="flex items-center gap-1.5 shrink-0">
                {i > 0 && <span className="text-zinc-600 text-sm">|</span>}
                {isLast ? (
                  <span className="text-sm text-green-400 font-semibold truncate flex items-center gap-1">
                    <Warehouse size={14} className="shrink-0" />
                    {crumb.name}
                  </span>
                ) : crumb.id === null ? (
                  <button
                    onClick={() => routerNavigate('/stockhub')}
                    className="text-sm shrink-0 px-2.5 py-1 rounded-lg border border-zinc-700 text-zinc-300 hover:border-zinc-500"
                  >
                    {crumb.name}
                  </button>
                ) : (
                  <span className="text-sm text-zinc-400 shrink-0">{crumb.name}</span>
                )}
              </span>
            )
          })}
        </div>

        {/* Indicator vizualizare curentă */}
        <span className={[
          'shrink-0 self-center text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide',
          view === 'flux'
            ? 'bg-amber-900/40 text-amber-400 border border-amber-800/60'
            : 'bg-blue-950/40 text-blue-400 border border-blue-900/60',
        ].join(' ')}>
          {view === 'flux' ? 'Flux' : 'Stoc'}
        </span>
      </div>

      {/* ── Vizualizarea STOC ────────────────────────────────────────── */}
      {view === 'stoc' && (
        <>
          {/* Rezumat + filtre active */}
          <div className="flex-none flex items-center justify-between px-4 py-2 text-xs border-b border-zinc-900">
            <span className="text-zinc-500">
              {productCount} {productCount === 1 ? 'produs' : 'produse'}
              {' · '}
              {totalUnits} {totalUnits === 1 ? 'unitate' : 'unități'}
              {filteredProductIds !== null && ` (${baseProducts.length} filtrate)`}
            </span>
            {filteredProductIds !== null && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFilterOpen(true)}
                  className="text-blue-400 flex items-center gap-1 font-medium bg-blue-950/40 px-2 py-0.5 rounded"
                >
                  <SlidersHorizontal size={11} />
                  <span>Modifică</span>
                </button>
                <button
                  onClick={() => { setAppliedFilters({}); setFilteredProductIds(null) }}
                  className="text-zinc-400 flex items-center gap-1 font-medium bg-zinc-800/60 px-2 py-0.5 rounded"
                >
                  <RotateCcw size={11} />
                  <span>Resetează</span>
                </button>
              </div>
            )}
          </div>

          {/* Lista produse */}
          {isLoading ? (
            <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-zinc-800">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="px-4 py-3 animate-pulse h-[72px]" />
              ))}
            </div>
          ) : spaceProducts.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
              <p className="text-zinc-400 text-sm leading-relaxed">
                Niciun produs în acest spațiu.
                <br />
                <span className="text-zinc-600">
                  Adaugă produse printr-o tranzacție din Catalog sau alt spațiu.
                </span>
              </p>
            </div>
          ) : searchMatches.length === 0 && searchQuery.trim() ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-zinc-500 text-sm">Niciun produs găsit.</p>
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-zinc-800">
              {searchMatches.map((p) => (
                <SpaceProductCard
                  key={p.productId}
                  spaceProduct={p}
                  catalogProduct={p.catalogProduct}
                  meta={getProductMeta(p)}
                  sourceId={spaceId}
                  onTap={(cp) => {
                    if (cp?.nameId) routerNavigate('/catalog/product/' + encodeURIComponent(cp.nameId))
                  }}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Vizualizarea FLUX ────────────────────────────────────────── */}
      {view === 'flux' && (
        <>
          {/* Rezumat flux */}
          <div className="flex-none px-4 py-2 text-xs border-b border-zinc-900">
            <span className="text-zinc-500">
              {fluxBlocks.length} {fluxBlocks.length === 1 ? 'tranzacție' : 'tranzacții'}
            </span>
          </div>

          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-6 h-6 rounded-full border-2 border-zinc-700 border-t-amber-400 animate-spin" />
            </div>
          ) : (
            <FluxFeed blocks={fluxBlocks} />
          )}
        </>
      )}

      {/* Toast */}
      {toast && (
        <div className="absolute bottom-20 left-4 right-4 z-50 flex items-center gap-3 px-4 py-3 bg-zinc-800 rounded-2xl shadow-xl">
          <span className="flex-1 text-sm text-zinc-100">{toast}</span>
        </div>
      )}

      {/* Context Menu (BottomBar → SpacePage) */}
      <BottomSheet open={spaceMenuOpen} onClose={closeSpaceMenu}>
        <div className="px-4 pb-6 space-y-1">
          {/* Comutare Stoc / Flux */}
          <button
            onClick={() => handleSwitchView('stoc')}
            className={[
              'w-full flex items-center gap-3 px-3 py-3.5 rounded-xl text-sm',
              view === 'stoc'
                ? 'bg-blue-950/40 text-blue-400'
                : 'text-zinc-200 hover:bg-zinc-800 active:bg-zinc-700',
            ].join(' ')}
          >
            <span className={view === 'stoc' ? 'text-blue-400' : 'text-zinc-400'}>
              <Warehouse size={18} />
            </span>
            <span className="flex-1 text-left">Stoc</span>
            {view === 'stoc' && (
              <span className="text-[10px] font-semibold bg-blue-600 text-white px-2 py-0.5 rounded-full">
                Activ
              </span>
            )}
          </button>

          <button
            onClick={() => handleSwitchView('flux')}
            className={[
              'w-full flex items-center gap-3 px-3 py-3.5 rounded-xl text-sm',
              view === 'flux'
                ? 'bg-amber-950/40 text-amber-400'
                : 'text-zinc-200 hover:bg-zinc-800 active:bg-zinc-700',
            ].join(' ')}
          >
            <span className={view === 'flux' ? 'text-amber-400' : 'text-zinc-400'}>
              <SlidersHorizontal size={18} />
            </span>
            <span className="flex-1 text-left">Flux</span>
            {view === 'flux' && (
              <span className="text-[10px] font-semibold bg-amber-600 text-white px-2 py-0.5 rounded-full">
                Activ
              </span>
            )}
            {fluxBlocks.length > 0 && (
              <span className="text-xs text-zinc-500">{fluxBlocks.length}</span>
            )}
          </button>

          {/* Filtrare — disponibilă doar în Stoc */}
          {view === 'stoc' && (
            <button
              onClick={() => { closeSpaceMenu(); setFilterOpen(true) }}
              className="w-full flex items-center gap-3 px-3 py-3.5 rounded-xl text-sm text-zinc-200 hover:bg-zinc-800 active:bg-zinc-700"
            >
              <span className="text-zinc-400"><SlidersHorizontal size={18} /></span>
              <span className="flex-1 text-left">Filtrare</span>
              {filteredProductIds !== null && (
                <span className="text-[10px] font-semibold bg-blue-600 text-white px-2 py-0.5 rounded-full">
                  Activ
                </span>
              )}
            </button>
          )}
        </div>
      </BottomSheet>

      {/* FilterSheet — identic cu cel din CategoryPage, dar fără fixedCategoryId */}
      <FilterSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        title={space?.name ?? 'Filtrare spațiu'}
        showCategoryDim={true}
        fixedCategoryId={null}
        initialFilters={appliedFilters}
        onApply={(filters, pids) => {
          setAppliedFilters(filters)
          setFilteredProductIds(pids)
        }}
      />
    </div>
  )
}
