import { useEffect, useLayoutEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { ChevronLeft, SlidersHorizontal, RotateCcw, Warehouse, Activity, WifiOff, AlertCircle, CheckSquare, Square, Calendar, ListFilter } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useStockStore } from '../store/useStockStore'
import { useFluxStore } from '../store/useFluxStore'
import { useAppStore } from '../store/useAppStore'
import { useCatalogStore } from '../store/useCatalogStore'
import { useCartStore } from '../store/useCartStore'
import { usePicker } from '../hooks/usePicker'
import SpaceProductCard from '../components/stockhub/SpaceProductCard'
import FluxFeed from '../components/stockhub/FluxFeed'
import FluxFilterSheet, { PeriodPopover } from '../components/stockhub/FluxFilterSheet'
import BottomSheet from '../components/catalog/BottomSheet'
import FilterSheet from '../components/catalog/FilterSheet'
import ContextMenu from '../components/shell/ContextMenu'

// Vizualizarea curentă a Space-ului: 'stoc' sau 'flux'
// Comutarea se face din meniul de context (BottomBar), nu printr-un tab vizibil.

export default function SpacePage() {
  const { spaceId } = useParams()
  const routerNavigate = useNavigate()
  const location = useLocation()
  const fromBarcodeScan = location.state?.fromBarcodeScan
  const scannedBarcode = useAppStore((s) => s.scannedBarcode)

  // ── Store-uri ────────────────────────────────────────────────────────
  const spaces = useStockStore((s) => s.spaces)
  const alerts = useStockStore((s) => s.alerts)
  const fetchSpaceProducts = useStockStore((s) => s.fetchSpaceProducts)
  const deltaFetchSpaceProducts = useStockStore((s) => s.deltaFetchSpaceProducts)
  const fetchAlerts = useStockStore((s) => s.fetchAlerts)
  const getBreadcrumb = useStockStore((s) => s.getBreadcrumb)

  // ── Flux Store ────────────────────────────────────────────────────────
  const initWorkingWindow = useFluxStore((s) => s.initWorkingWindow)
  const deltaFetch = useFluxStore((s) => s.deltaFetch)
  const loadMorePages = useFluxStore((s) => s.loadMorePages)
  const clearFlux = useFluxStore((s) => s.clearFlux)
  const fluxResult = useFluxStore((s) => s.fluxResult)
  const fluxRoutingStatus = useFluxStore((s) => s.fluxRoutingStatus)
  const fluxError = useFluxStore((s) => s.fluxError)
  const fluxFilter = useFluxStore((s) => s.fluxFilter)
  const resetFilter = useFluxStore((s) => s.resetFilter)
  const applyFilter = useFluxStore((s) => s.applyFilter)
  const filteredRawCount = useFluxStore((s) => s.filteredRawCount)
  const currentRawSource = useFluxStore((s) => s.currentRawSource)

  const categoryAttributes = useCatalogStore((s) => s.categoryAttributes)
  const hasCart = useCartStore((s) => s.items.length > 0)

  const searchQuery = useAppStore((s) => s.searchQuery)
  const updateSearchContext = useAppStore((s) => s.updateSearchContext)
  const clearSearch = useAppStore((s) => s.clearSearch)
  const barcodeScanMode = useAppStore((s) => s.barcodeScanMode)
  const spaceMenuOpen = useAppStore((s) => s.spaceMenuOpen)
  const closeSpaceMenu = useAppStore((s) => s.closeSpaceMenu)

  // ── Stare locală ──────────────────────────────────────────────────────
  const [view, setView] = useState('stoc')          // 'stoc' | 'flux'
  const [spaceProducts, setSpaceProducts] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [filterOpen, setFilterOpen] = useState(false)
  const [fluxFilterOpen, setFluxFilterOpen] = useState(false)
  const [appliedFilters, setAppliedFilters] = useState({})
  const [filteredProductIds, setFilteredProductIds] = useState(null)
  const [intervalSheetOpen, setIntervalSheetOpen] = useState(false)
  const [isTransactionSheetOpen, setIsTransactionSheetOpen] = useState(false)
  const [toast, setToast] = useState(null)
  const toastTimer = useRef(null)

  // ── Smart JIT Sync ────────────────────────────────────────────────────
  const handleIntentSync = useCallback(() => {
    if (!spaceId) return
    deltaFetchSpaceProducts(spaceId).then(res => {
      if (res.ok && res.updated && res.data) {
        setSpaceProducts(res.data)
      }
    })
    // Sincronizăm și fluxul (dacă există instanțiat)
    deltaFetch(spaceId)
    // Opțional, actualizăm și alertele în fundal
    fetchAlerts()
  }, [spaceId, deltaFetchSpaceProducts, deltaFetch, fetchAlerts])

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') handleIntentSync()
    }
    const onFocus = () => handleIntentSync()

    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('focus', onFocus)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('focus', onFocus)
    }
  }, [handleIntentSync])

  // ── Datele Space-ului curent ──────────────────────────────────────────
  const isFluxFilterActive = useMemo(() => {
    let count = 0
    if (fluxFilter.period) count++
    if (fluxFilter.partnerSpaceId) count++
    if (fluxFilter.productId) count++
    if (fluxFilter.categoryId) count++
    if (fluxFilter.tags?.length > 0) count++
    if (Object.keys(fluxFilter.attributes ?? {}).length > 0) count++
    if (fluxFilter.types?.length === 1) count++
    return count > 0
  }, [fluxFilter])

  const space = useMemo(
    () => spaces.find((s) => s.id === spaceId),
    [spaces, spaceId]
  )

  const spaceAlerts = useMemo(
    () => alerts.filter(a => a.space_id === spaceId),
    [alerts, spaceId]
  )

  const spaceProductIds = useMemo(
    () => new Set(spaceProducts.map(p => p.productId)),
    [spaceProducts]
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

  const setBottomBarFilterAction = useAppStore(s => s.setBottomBarFilterAction)
  const setBottomBarSearchFocusAction = useAppStore(s => s.setBottomBarSearchFocusAction)

  useEffect(() => {
    const isActive = view === 'stoc' ? filteredProductIds !== null : isFluxFilterActive
    if (isActive && !filterOpen && !fluxFilterOpen) {
      setBottomBarFilterAction({
        active: true,
        onClick: () => {
          handleIntentSync() // JIT Sync la intenția de filtrare
          if (view === 'stoc') setFilterOpen(true)
          else setFluxFilterOpen(true)
        }
      })
    } else {
      setBottomBarFilterAction(null)
    }
    return () => setBottomBarFilterAction(null)
  }, [view, filteredProductIds, isFluxFilterActive, filterOpen, fluxFilterOpen, setBottomBarFilterAction, handleIntentSync])

  useEffect(() => {
    setBottomBarSearchFocusAction(handleIntentSync)
    return () => setBottomBarSearchFocusAction(null)
  }, [setBottomBarSearchFocusAction, handleIntentSync])

  // ── Fetch la montare ─────────────────────────────────────────────────
  const { t } = useTranslation()
  useEffect(() => {
    if (!spaceId) return
    setIsLoading(true)
    clearSearch()
    updateSearchContext('global', t('search.space'))

    // 1. Verificăm Cache-ul
    const { activeSpaceCache, deltaFetchSpaceProducts } = useStockStore.getState()
    const hasCache = activeSpaceCache.spaceId === spaceId && activeSpaceCache.products.length > 0

    if (hasCache) {
      // Afișăm instant din cache
      setSpaceProducts(activeSpaceCache.products)
      setIsLoading(false)

      // Delta Fetch în fundal (fără să blocăm UI-ul)
      Promise.all([
        deltaFetchSpaceProducts(spaceId),
        initWorkingWindow(spaceId)
      ]).then(([deltaRes]) => {
        if (deltaRes.ok && deltaRes.updated) {
          setSpaceProducts(deltaRes.data)
        }
      })
    } else {
      // Așteptăm datele critice (Full Fetch)
      setIsLoading(true)
      Promise.all([
        fetchSpaceProducts(spaceId),
        initWorkingWindow(spaceId),
      ]).then(([productsRes]) => {
        if (productsRes.ok) setSpaceProducts(productsRes.data)
        setIsLoading(false)
      })
    }

    // Alertele se încarcă în fundal (fire-and-forget), nu blochează afișarea
    fetchAlerts()

    return () => {
      const state = useAppStore.getState()
      // Dacă este activ barcodeScanMode, restaurăm codul de bare pentru StockHubPage la Back
      if (state.barcodeScanMode && state.scannedBarcode) {
        state.setSearchQuery(state.scannedBarcode)
      } else {
        state.clearSearch()
      }
      // Re-folosim state pentru a apela actions fără a le pune în dependințe
      state.updateSearchContext('global', t('search.space_default'))
      // Eliminăm clearFlux() de pe unmount pentru a permite cache-ului de WW
      // să deservească instanța din RAM atunci când utilizatorul dă "Back".
      // useFluxStore.getState().clearFlux()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spaceId])

  // ── Restore Scroll Position ───────────────────────────────────────────
  const scrollRef = useRef(null)
  const scrollCache = useAppStore((s) => s.scrollCache)
  const setScrollCache = useAppStore((s) => s.setScrollCache)

  useLayoutEffect(() => {
    if (!isLoading && scrollRef.current) {
      const savedPos = scrollCache[`space_${spaceId}`]
      if (savedPos !== undefined) {
        scrollRef.current.scrollTop = savedPos
      }
    }
  }, [isLoading, spaceId, scrollCache])

  // Dacă utilizatorul declanșează o nouă scanare barcode din BottomBar în timp ce se află în SpacePage,
  // navigăm la StockHubPage pentru a afișa rezultatele globale per spații
  useEffect(() => {
    if (barcodeScanMode && scannedBarcode && scannedBarcode !== fromBarcodeScan) {
      routerNavigate('/stockhub')
    }
  }, [barcodeScanMode, scannedBarcode, fromBarcodeScan, routerNavigate])

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
    enabled: view === 'stoc',
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
          onClick={() => {
            if (fromBarcodeScan) {
              routerNavigate(-1)
            } else {
              routerNavigate('/stockhub')
            }
          }}
          className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg text-zinc-400 active:text-zinc-100 active:bg-zinc-800"
          aria-label={fromBarcodeScan ? 'Înapoi la rezultate scanare' : 'Înapoi la spații'}
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
                    onClick={() => {
                      if (fromBarcodeScan) {
                        routerNavigate(-1)
                      } else {
                        routerNavigate('/stockhub')
                      }
                    }}
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
            <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto divide-y divide-zinc-800">
              {searchMatches.map((p) => (
                <SpaceProductCard
                  key={p.productId}
                  spaceProduct={p}
                  catalogProduct={p.catalogProduct}
                  meta={getProductMeta(p)}
                  sourceId={spaceId}
                  onTap={(cp) => {
                    if (cp?.nameId) {
                      if (scrollRef.current) {
                        setScrollCache(`space_${spaceId}`, scrollRef.current.scrollTop)
                      }
                      routerNavigate(
                        '/catalog/product/' + encodeURIComponent(cp.nameId), 
                        { state: { sourceSpaceId: spaceId } }
                      )
                    }
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
              {/* Rezumat flux + buton filtru activ */}
              <div className="flex-none flex items-center justify-between px-4 py-2 text-xs border-b border-zinc-900">
                {isFluxFilterActive ? (
                  <span className="text-blue-400 font-medium">
                    Filtrate {filteredRawCount}/{currentRawSource.length} tranzacții
                  </span>
                ) : (
                  <span className="text-zinc-500">
                    {fluxResult.length} {fluxResult.length === 1 ? 'tranzacție' : 'tranzacții'} recente
                  </span>
                )}
                
                {/* Buton manual de reset dacă e nevoie (când mode e activ) */}
                {isFluxFilterActive && (
                  <button
                    onClick={resetFilter}
                    className="flex items-center gap-1 text-zinc-400 bg-zinc-800/60 px-2 py-0.5 rounded active:bg-zinc-700"
                  >
                    <RotateCcw size={10} />
                    <span>Resetează</span>
                  </button>
                )}
              </div>

              {/* Banner stări speciale */}
              {fluxRoutingStatus === 'offline_blocked' && (
                <div className="flex-none mx-4 mt-3 flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-amber-950/50 border border-amber-800/60">
                  <WifiOff size={16} className="text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-200 leading-relaxed">{fluxError}</p>
                </div>
              )}

              {fluxRoutingStatus === 'volume_exceeded' && (
                <div className="flex-none mx-4 mt-3 flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-red-950/50 border border-red-800/60">
                  <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-200 leading-relaxed">{fluxError}</p>
                </div>
              )}

              {fluxRoutingStatus === 'error' && (
                <div className="flex-none mx-4 mt-3 flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-red-950/50 border border-red-800/60">
                  <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-200 leading-relaxed">Eroare: {fluxError}</p>
                </div>
              )}

              {/* Loading spinner (fetch inițial sau RPC în curs) */}
              {(isLoading || fluxRoutingStatus === 'loading_ww' || fluxRoutingStatus === 'fetching_raw' || fluxRoutingStatus === 'counting') ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="w-6 h-6 rounded-full border-2 border-zinc-700 border-t-amber-400 animate-spin" />
                </div>
              ) : (fluxRoutingStatus === 'offline_blocked' || fluxRoutingStatus === 'volume_exceeded') ? (
                // Banner ocupă spațiul — nu afișăm FluxFeed
                <div className="flex-1" />
              ) : (
                <FluxFeed
                  blocks={fluxResult}
                  alerts={spaceAlerts}
                  mode={fluxFilter.granularity === 'transaction' ? 'transaction' : 'aggregated'}
                  spaceId={spaceId}
                  onLoadMore={() => loadMorePages(spaceId)}
                  onSheetOpenChange={setIsTransactionSheetOpen}
                />
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
      <ContextMenu
        open={spaceMenuOpen}
        onClose={closeSpaceMenu}
        options={[
          {
            label: `Filtrare ${view === 'stoc' ? 'Stoc' : 'Flux'}`,
            icon: <ListFilter size={18} />,
            active: view === 'stoc' ? filteredProductIds !== null : isFluxFilterActive,
            onClick: () => {
              handleIntentSync() // JIT Sync
              closeSpaceMenu()
              if (view === 'stoc') setFilterOpen(true)
              else setFluxFilterOpen(true)
            },
            leadingAction: {
              icon: (view === 'stoc' ? filteredProductIds !== null : isFluxFilterActive) 
                ? <CheckSquare size={18} className="text-blue-400" /> 
                : <Square size={18} className="text-zinc-500" />,
              onClick: () => {
                if (view === 'stoc') {
                  if (filteredProductIds !== null) {
                    setAppliedFilters({})
                    setFilteredProductIds(null)
                  } else {
                    handleIntentSync() // JIT Sync
                    closeSpaceMenu()
                    setFilterOpen(true)
                  }
                } else {
                  if (isFluxFilterActive) {
                    resetFilter()
                  } else {
                    closeSpaceMenu()
                    setFluxFilterOpen(true)
                  }
                }
              }
            }
          }
        ]}
        footer={
          <div className="px-4 pb-4 flex gap-2">
            <button 
              onClick={() => setView('stoc')} 
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-colors ${view === 'stoc' ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'}`}
            >
              <Warehouse size={18} /> Stoc
            </button>
            <button 
              onClick={() => setView('flux')} 
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-colors ${view === 'flux' ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'}`}
            >
              <Activity size={18} /> Flux
            </button>
          </div>
        }
      />

      {/* FilterSheet — filtrare Stoc (produse) */}
      <FilterSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        title={space?.name ?? 'Filtrare spațiu'}
        showCategoryDim={true}
        fixedCategoryId={null}
        initialFilters={appliedFilters}
        baseProductIds={spaceProductIds}
        onApply={(filters, pids) => {
          if (Object.keys(filters).length === 0) {
            setAppliedFilters({})
            setFilteredProductIds(null)
          } else {
            setAppliedFilters(filters)
            setFilteredProductIds(pids)
          }
        }}
      />

      {/* FluxFilterSheet — filtrare Flux (tranzacții) */}
      <FluxFilterSheet
        open={fluxFilterOpen}
        onClose={() => setFluxFilterOpen(false)}
        onOpenInterval={() => {
          setFluxFilterOpen(false)
          setIntervalSheetOpen(true)
        }}
      />

      {/* Interval Sheet — setare rapida perioada */}
      <BottomSheet open={intervalSheetOpen} onClose={() => setIntervalSheetOpen(false)} aboveBottomBar={true} zIndex={60}>
        <div className="px-4 pb-6 pt-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
              <Calendar size={20} className="text-blue-400" />
              Interval & Granularitate
            </h2>
            <button
              onClick={() => {
                const nextFilter = { ...fluxFilter, period: null, from: null, to: null, granularity: 'transaction', showWholeTransaction: true }
                applyFilter(nextFilter)
                setIntervalSheetOpen(false)
              }}
              className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 bg-zinc-800 px-3 py-1.5 rounded-lg active:bg-zinc-700 hover:text-zinc-200 transition-colors"
            >
              <RotateCcw size={12} />
              Resetează
            </button>
          </div>
          <PeriodPopover 
            draft={fluxFilter}
            onChangeDraft={(newDraft) => {
              applyFilter(newDraft)
              setIntervalSheetOpen(false)
            }}
            onClose={() => setIntervalSheetOpen(false)}
            className="w-full relative mt-0 bg-transparent border-none shadow-none p-0"
          />
        </div>
      </BottomSheet>
    </div>
  )
}
