import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useNavigate as useRouterNavigate } from 'react-router-dom'
import {
  Plus, FolderInput, ChevronRight, ChevronLeft, ChevronDown, Folder, Tag,
  UnfoldVertical, FoldVertical, Check, SlidersHorizontal, ArrowLeft, RotateCcw,
} from 'lucide-react'
import { useCatalogStore } from '../store/useCatalogStore'
import { useAppStore } from '../store/useAppStore'
import { useCartStore } from '../store/useCartStore'
import { filterAndSort, normalize, buildSearchTree, sortTreeFolders } from '../lib/search'
import { useBottomSearch } from '../hooks/useBottomSearch'
import { usePicker } from '../hooks/usePicker'
import NodeCard, { NodeCount } from '../components/catalog/NodeCard'
import ProductCard from '../components/catalog/ProductCard'
import BottomSheet from '../components/catalog/BottomSheet'
import FilterSheet from '../components/catalog/FilterSheet'
import ActionBar from '../components/catalog/ActionBar'
import DestinationPicker from '../components/catalog/DestinationPicker'
import SubgroupSheet from '../components/catalog/SubgroupSheet'

const nodeLabel = (node) => node.name
const ELLIPSIS_CRUMB = { id: '__ellipsis__', name: '…' }
// Dezactivat temporar — notificările de succes după creare/mutare (erorile rămân vizibile).
const SHOW_ACTION_TOASTS = false

import { SearchGroup, FullTree } from '../components/shared/HierarchyTree'

const EMPTY_SET = new Set()

export default function CatalogPage() {
  const hasCart = useCartStore((s) => s.items.length > 0)
  const nodes = useCatalogStore((s) => s.nodes)
  const products = useCatalogStore((s) => s.products)
  const currentFolderId = useCatalogStore((s) => s.currentFolderId)
  const navigate = useCatalogStore((s) => s.navigate)
  const navigateUp = useCatalogStore((s) => s.navigateUp)
  const getBreadcrumb = useCatalogStore((s) => s.getBreadcrumb)
  const getChildren = useCatalogStore((s) => s.getChildren)
  const getAncestorFolders = useCatalogStore((s) => s.getAncestorFolders)
  const addCategory = useCatalogStore((s) => s.addCategory)
  const treeExpanded = useCatalogStore((s) => s.treeExpanded)
  const toggleTreeExpanded = useCatalogStore((s) => s.toggleTreeExpanded)

  const selectionMode = useCatalogStore((s) => s.selectionMode)
  const selectedNodeIds = useCatalogStore((s) => s.selectedNodeIds)
  const enterSelectionMode = useCatalogStore((s) => s.enterSelectionMode)
  const toggleNodeSelection = useCatalogStore((s) => s.toggleNodeSelection)
  const clearSelection = useCatalogStore((s) => s.clearSelection)
  const getValidMoveDestinations = useCatalogStore((s) => s.getValidMoveDestinations)
  const moveNodes = useCatalogStore((s) => s.moveNodes)
  const createTempFolder = useCatalogStore((s) => s.createTempFolder)
  const dissolveTempFolder = useCatalogStore((s) => s.dissolveTempFolder)
  const promoteTempFolder = useCatalogStore((s) => s.promoteTempFolder)
  const cleanupTempFolders = useCatalogStore((s) => s.cleanupTempFolders)

  const searchQuery = useAppStore((s) => s.searchQuery)
  const setSearchPlaceholder = useAppStore((s) => s.setSearchPlaceholder)
  const clearSearch = useAppStore((s) => s.clearSearch)
  const catalogMenuOpen = useAppStore((s) => s.catalogMenuOpen)
  const closeCatalogMenu = useAppStore((s) => s.closeCatalogMenu)

  const [toast, setToast] = useState(null)
  // Filtrare Catalog (stare persistentă din store)
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)
  const catalogFilter = useCatalogStore((s) => s.catalogFilter)
  const setCatalogFilter = useCatalogStore((s) => s.setCatalogFilter)
  const resetCatalogFilter = useCatalogStore((s) => s.resetCatalogFilter)

  const appliedFilters = catalogFilter.appliedFilters
  const filteredProductIds = catalogFilter.filteredProductIds

  // Mutare cross-folder (SPEC_MutareCrossFolder §3.3): temp folder + cele
  // două sheet-uri ale fluxului (destinație → subfolder opțional).
  const [tempFolderId, setTempFolderId] = useState(null)
  const [pendingMoveCount, setPendingMoveCount] = useState(0)
  const [destinationPickerOpen, setDestinationPickerOpen] = useState(false)
  const [subgroupSheetOpen, setSubgroupSheetOpen] = useState(false)
  // Toate elementele selectate erau la rădăcină → destinația „Rădăcină" devine
  // „New folder" și sare peste întrebarea „New folder?" (intenția e deja clară).
  const [allRootSelection, setAllRootSelection] = useState(false)
  const [skipSubgroupQuestion, setSkipSubgroupQuestion] = useState(false)
  // Fold/unfold per-folder în modul Unfold (independent de selecție/căutare).
  const [collapsedFolderIds, setCollapsedFolderIds] = useState(() => new Set())
  const toastTimer = useRef(null)
  const isPopRef = useRef(false)
  const selectionModeRef = useRef(selectionMode)
  selectionModeRef.current = selectionMode
  const destinationIdRef = useRef(null)
  const goHome = useRouterNavigate()

  const currentChildren = getChildren(currentFolderId)
  const isSearching = searchQuery.trim().length > 0

  const categoryMap = useMemo(() => {
    return new Map(nodes.map((n) => [n.id, n.name]))
  }, [nodes])

  const filteredProducts = useMemo(() => {
    if (filteredProductIds === null) return []
    return products
      .filter((p) => filteredProductIds.has(p.id) && !p.deletedAt)
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
  }, [products, filteredProductIds])

  // Pasul 2: aplică căutarea live din BottomBar peste produsele pre-filtrate.
  // `labelFn` concatenează nameId + numele categoriei + tags — intenționat fără
  // valorile de atribute, deoarece în lista globală (Catalog) nu există schema
  // per-categorie; nameId + categoria + tags sunt suficiente pentru identificare.
  // (ARCH_SearchableAttrs: când va exista flag-ul `searchable`, labelFn va fi
  //  extins în CategoryPage, nu aici — contextele sunt diferite.)
  const { results: visibleFilteredProducts } = useBottomSearch(
    filteredProducts,
    (p) => [p.nameId, categoryMap.get(p.categoryId) || '', (p.tags || []).join(' ')].join(' '),
    { enabled: filteredProductIds !== null }
  )

  const productCounts = useMemo(() => {
    const counts = {}
    for (const p of products) {
      if (p.deletedAt) continue
      counts[p.categoryId] = (counts[p.categoryId] || 0) + 1
    }
    return counts
  }, [products])

  const getProductMeta = (prod) => {
    const catName = categoryMap.get(prod.categoryId) || ''
    const tagStr = (prod.tags || []).slice(0, 2).join(' · ')
    if (catName && tagStr) return `${catName} | ${tagStr}`
    return catName || tagStr || ''
  }

  // ── Placeholder — contextual în funcție de modul activ ──────────────────────
  useEffect(() => {
    setSearchPlaceholder(
      filteredProductIds !== null
        ? 'Caută în rezultate...'
        : 'Caută categorie sau folder...'
    )
  }, [setSearchPlaceholder, filteredProductIds])

  // ── Cleanup foldere temporare orfane (SPEC_MutareCrossFolder §2.4, §3.6) ──────
  useEffect(() => {
    cleanupTempFolders()
  }, [cleanupTempFolders])

  // ── Back gesture (Android/browser) → exit selection sau navigate up ──────────
  useEffect(() => {
    const onPopState = () => {
      if (selectionModeRef.current) {
        clearSelection()
        return
      }
      isPopRef.current = true
      navigateUp()
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [navigateUp, clearSelection])

  useEffect(() => {
    if (isPopRef.current) {
      isPopRef.current = false
      return
    }
    if (currentFolderId !== null) {
      window.history.pushState({ catalogFolder: currentFolderId }, '')
    }
  }, [currentFolderId])

  // ── Toast ────────────────────────────────────────────────────────────────────
  const showToast = useCallback((message) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast(message)
    toastTimer.current = setTimeout(() => setToast(null), 3000)
  }, [])

  // ── Tap ──────────────────────────────────────────────────────────────────────
  const handleTap = useCallback((node) => {
    if (node.type === 'folder') {
      navigate(node.id)
    } else {
      goHome(`/catalog/category/${node.id}`)
    }
  }, [navigate, goHome])

  // ── Search (= unicul mecanism de adăugare categorie) ─────────────────────────
  // Caută atât în categorii, cât și în foldere (ex: „i” → folderul „Îmbrăcăminte”)
  // Modul inline al usePicker: BottomBar deține input-ul, hook-ul filtrează lista.
  const searchableNodes = useMemo(
    () => nodes.filter((n) => n.type === 'category' || n.type === 'folder'),
    [nodes]
  )
  // usePicker (mod inline, SPEC_Picker_v2) e motorul canonic de căutare;
  // A2 e implementat în interiorul hook-ului (exactExists normalizat).
  const { filteredItems: searchMatches, showCreate: pickerShowCreate } = usePicker({
    mode: 'inline',
    items: isSearching ? searchableNodes : [],
    labelFn: nodeLabel,
    query: searchQuery,
    multiSelect: false,
    allowCreate: true,
  })
  const searchTree = useMemo(() => {
    if (!isSearching) return null
    const tree = buildSearchTree(nodes, searchMatches)
    const orderOf = (id) => nodes.findIndex((n) => n.id === id)
    sortTreeFolders(tree, orderOf)
    return tree
  }, [nodes, searchMatches, isSearching])

  const showCreate = !selectionMode && pickerShowCreate

  // Când arborele se actualizează (creare, mutare, grupare), în Unfold rămâne
  // deschis doar drumul către folderul actualizat (el + părinții lui) —
  // restul folderelor se pliază, ca să se vadă imediat unde s-a produs
  // schimbarea, fără zgomot vizual.
  const collapseAllExcept = useCallback((updatedFolderId) => {
    if (!updatedFolderId) return
    const keepOpen = new Set([updatedFolderId, ...getAncestorFolders(updatedFolderId).map((f) => f.id)])
    const allFolderIds = nodes.filter((n) => n.type === 'folder' && !n.isTemp).map((n) => n.id)
    setCollapsedFolderIds(new Set(allFolderIds.filter((id) => !keepOpen.has(id))))
  }, [nodes, getAncestorFolders])

  const handleCreateFromSearch = useCallback(async () => {
    const name = searchQuery.trim()
    if (!name) return
    // Gardă hard: re-verifică unicitatea globală chiar înainte de creare.
    if (nodes.some((n) => n.type === 'category' && normalize(n.name) === normalize(name))) {
      showToast(`Există deja „${name}"`)
      return
    }
    const res = await addCategory(name, currentFolderId)
    if (!res.ok) showToast(res.error)
    else {
      if (SHOW_ACTION_TOASTS) showToast(`„${name}" adăugată`)
      collapseAllExcept(currentFolderId)
      clearSearch()
    }
  }, [searchQuery, nodes, addCategory, currentFolderId, clearSearch, showToast, collapseAllExcept])

  // ── Selection mode ───────────────────────────────────────────────────────────
  const selectionItems = useMemo(() => {
    if (!selectionMode) return []
    return isSearching
      ? filterAndSort(currentChildren, searchQuery, (n) => n.name)
      : currentChildren
  }, [selectionMode, isSearching, currentChildren, searchQuery])

  // ── Organize — pas „Organize < N >" (SPEC_MutareCrossFolder §3.3) ─────────────
  const handleContinue = useCallback(async () => {
    if (selectionMode !== 'move') return
    const ids = [...selectedNodeIds]
    const allRoot = ids.every((id) => nodes.find((n) => n.id === id)?.parentId === null)
    const tempId = await createTempFolder()
    if (!tempId) {
      showToast('Eroare la pornirea mutării')
      return
    }
    const res = await moveNodes(ids, tempId)
    if (!res.ok) {
      showToast(res.error)
      return
    }
    setTempFolderId(tempId)
    setPendingMoveCount(ids.length)
    setAllRootSelection(allRoot)
    setDestinationPickerOpen(true)
  }, [selectionMode, selectedNodeIds, nodes, createTempFolder, moveNodes, showToast])

  const finalizeMove = useCallback((updatedFolderId, subfolderName) => {
    setDestinationPickerOpen(false)
    setSubgroupSheetOpen(false)
    setTempFolderId(null)
    clearSelection()
    collapseAllExcept(updatedFolderId)
    if (SHOW_ACTION_TOASTS) {
      const base = `${pendingMoveCount} ${pendingMoveCount === 1 ? 'element mutat' : 'elemente mutate'}`
      showToast(subfolderName ? `${base} în subfolderul „${subfolderName}"` : base)
    }
  }, [pendingMoveCount, clearSelection, showToast, collapseAllExcept])

  const handleDestinationPicked = useCallback(async (destinationId, _label, skipQuestion) => {
    destinationIdRef.current = destinationId
    setDestinationPickerOpen(false)
    const res = await moveNodes([tempFolderId], destinationId)
    if (!res.ok) {
      showToast(res.error)
      return
    }
    setSkipSubgroupQuestion(!!skipQuestion)
    setSubgroupSheetOpen(true)
  }, [tempFolderId, moveNodes, showToast])

  const handleSubgroupNo = useCallback(async () => {
    await dissolveTempFolder(tempFolderId)
    finalizeMove(destinationIdRef.current, null)
  }, [tempFolderId, dissolveTempFolder, finalizeMove])

  const handleSubgroupYes = useCallback(async (name) => {
    const res = await promoteTempFolder(tempFolderId, name)
    if (!res.ok) {
      showToast(res.error)
      return
    }
    finalizeMove(tempFolderId, name.trim())
  }, [tempFolderId, promoteTempFolder, finalizeMove, showToast])

  // ── Context menu — Organize ───────────────────────────────────────────────────
  const handleOrganize = useCallback(() => {
    closeCatalogMenu()
    clearSearch()
    enterSelectionMode('move')
  }, [closeCatalogMenu, clearSearch, enterSelectionMode])

  // Organize e cross-folder (Unfold) — verificăm tot arborele, nu doar nivelul curent.
  const organizeDisabled = nodes.filter((n) => !n.isTemp).length < 1

  const handleToggleTree = useCallback(() => {
    toggleTreeExpanded()
    closeCatalogMenu()
  }, [toggleTreeExpanded, closeCatalogMenu])

  // Tap pe un folder în Unfold îl pliază/depliază ȚI marchează ca „locul curent" —
  // cărarea din header trebuie să reflecte exact folderul pe care ai tăut, oriunde
  // s-ar afla el în arbore (vezi feedback: al 6-lea folder din cale nu se evidenția).
  const toggleFold = useCallback((id) => {
    navigate(id)
    setCollapsedFolderIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [navigate])

  // Căutarea în Unfold trebuie să filtreze exact ca în modul normal (același
  // motor — usePicker/searchMatches): păstrăm doar rezultatele + lanțul lor
  // de foldere-părinte, ca structura să rămână lizibilă.
  const searchVisibleIds = useMemo(() => {
    if (!isSearching || !treeExpanded) return null
    const set = new Set()
    for (const item of searchMatches) {
      set.add(item.id)
      for (const folder of getAncestorFolders(item.id)) set.add(folder.id)
    }
    return set
  }, [isSearching, treeExpanded, searchMatches, getAncestorFolders])

  // ── Header propriu (back + cale clicabilă) — Catalog n-are TopBar generic ────
  // „Catalog" e mereu primul, cu chenar de buton (nu e folder). Pe un singur rând
  // calea NU se scrolează orizontal: arată mereu primul și ultimul element, iar
  // mijlocul se rupe cu „…". „…" e apăsabil → expandează toată calea pe mai multe
  // rânduri (wrap), ca să poți sări direct la orice folder intermediar.
  const fullCrumbs = useMemo(
    () => [{ id: null, name: 'Catalog' }, ...getBreadcrumb()],
    [getBreadcrumb, currentFolderId]
  )
  const isCrumbTruncated = fullCrumbs.length > 3
  const collapsedCrumbs = isCrumbTruncated
    ? [fullCrumbs[0], ELLIPSIS_CRUMB, fullCrumbs[fullCrumbs.length - 1]]
    : fullCrumbs

  const [crumbsExpanded, setCrumbsExpanded] = useState(false)
  // Navigarea într-un alt folder reașează calea în forma compactă.
  useEffect(() => { setCrumbsExpanded(false) }, [currentFolderId])

  const crumbClasses = (crumb, isLast) => {
    const isRootCrumb = crumb.id === null
    return [
      'text-sm',
      isRootCrumb
        ? isLast
          ? 'shrink-0 px-2.5 py-1 rounded-lg border border-blue-400/60 text-blue-400 font-semibold'
          : 'shrink-0 px-2.5 py-1 rounded-lg border border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-zinc-100'
        : isLast
          ? 'text-green-400 font-semibold'
          : 'text-zinc-400 hover:text-zinc-100',
    ].join(' ')
  }

  const goToCrumb = (id) => {
    setCrumbsExpanded(false)
    navigate(id)
  }

  // Săgeata duce direct la home, indiferent de adâncime — nu se mai întoarce
  // pas cu pas pe cărare (pentru asta există linkurile din breadcrumb).
  const handleBack = useCallback(() => {
    if (selectionMode) clearSelection()
    else goHome('/')
  }, [selectionMode, clearSelection, goHome])

  return (
    <div className="flex flex-col h-full">
      {/* Header propriu — back + cale clicabilă, înlocuiește TopBar-ul generic
          (redundant pe Catalog). „Catalog" are chenar de buton (nu e folder);
          fiecare element e link direct spre rută. Rămâne vizibil inclusiv în
          Unfold. Săgeata e mereu vizibilă: la root duce spre home, altfel un
          nivel sus. Calea: un rând fără scroll (mijlocul „…"), iar „…" expandează
          tot drumul pe mai multe rânduri. */}
      <div className="flex-none flex items-start gap-1 px-2 py-2 border-b border-zinc-800">
        <button
          onClick={handleBack}
          className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg text-zinc-400 active:text-zinc-100 active:bg-zinc-800"
        >
          <ChevronLeft size={20} />
        </button>

        {crumbsExpanded && isCrumbTruncated ? (
          // Calea completă, pe câte rânduri e nevoie — fiecare element e link.
          <div className="flex flex-wrap content-start items-center gap-x-1.5 gap-y-1.5 min-h-8 min-w-0 flex-1">
            {fullCrumbs.map((crumb, i, arr) => {
              const isLast = i === arr.length - 1
              return (
                <span key={crumb.id ?? `full-${i}`} className="flex items-center gap-1.5">
                  {i > 0 && <span className="text-zinc-600 text-sm">|</span>}
                  <button onClick={() => goToCrumb(crumb.id)} className={crumbClasses(crumb, isLast)}>
                    {crumb.name}
                  </button>
                </span>
              )
            })}
          </div>
        ) : (
          // Un singur rând, fără scroll orizontal; ultimul element se trunchiază.
          <div className="flex items-center gap-1.5 min-h-8 min-w-0 flex-1 overflow-hidden">
            {collapsedCrumbs.map((crumb, i, arr) => {
              const isLast = i === arr.length - 1
              const isEllipsis = crumb === ELLIPSIS_CRUMB
              return (
                <span
                  key={crumb.id ?? (isEllipsis ? 'ellipsis' : `c-${i}`)}
                  className={['flex items-center gap-1.5', isLast ? 'min-w-0 flex-1' : 'shrink-0'].join(' ')}
                >
                  {i > 0 && <span className="text-zinc-600 text-sm shrink-0">|</span>}
                  {isEllipsis ? (
                    <button
                      onClick={() => setCrumbsExpanded(true)}
                      className="shrink-0 px-1.5 rounded text-sm text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
                      aria-label="Arată toată calea"
                    >
                      …
                    </button>
                  ) : (
                    <button
                      onClick={() => goToCrumb(crumb.id)}
                      className={[crumbClasses(crumb, isLast), isLast ? 'min-w-0 truncate' : 'whitespace-nowrap'].join(' ')}
                    >
                      {crumb.name}
                    </button>
                  )}
                </span>
              )
            })}
          </div>
        )}
      </div>

      {/* Main content */}
      {filteredProductIds !== null ? (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Header mod filtrare */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-blue-950/30 border-b border-blue-900/40 text-xs shrink-0">
            <span className="text-blue-300 font-medium">
              Rezultate filtrare ({visibleFilteredProducts.length})
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFilterSheetOpen(true)}
                className="text-zinc-300 hover:text-white flex items-center gap-1 font-medium bg-zinc-800 px-2.5 py-1 rounded-lg"
              >
                <SlidersHorizontal size={13} />
                <span>Modifică</span>
              </button>
              <button
                onClick={() => {
                  resetCatalogFilter()
                }}
                className="text-zinc-400 hover:text-zinc-200 flex items-center gap-1 font-medium bg-zinc-800/60 px-2 py-1 rounded-lg"
              >
                <RotateCcw size={13} />
                <span>Închide</span>
              </button>
            </div>
          </div>

          {/* Listă produse filtrate */}
          <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-zinc-800">
            {visibleFilteredProducts.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                meta={getProductMeta(p)}
                onTap={(prod) => goHome('/catalog/product/' + encodeURIComponent(prod.nameId))}
              />
            ))}
            {visibleFilteredProducts.length === 0 && (
              <div className="px-4 py-12 text-center text-sm text-zinc-500">
                {filteredProducts.length === 0
                  ? 'Niciun produs nu corespunde filtrelor selectate'
                  : 'Niciun produs nu corespunde căutării'}
              </div>
            )}
          </div>
        </div>
      ) : treeExpanded ? (
        <div
          className="flex-1 min-h-0 overflow-y-auto"
          style={{ paddingBottom: selectionMode ? '3.5rem' : undefined }}
        >
          <FullTree
            parentId={null}
            depth={0}
            getChildren={getChildren}
            selectable={selectionMode === 'move'}
            selectedIds={selectedNodeIds}
            onToggle={toggleNodeSelection}
            collapsedIds={collapsedFolderIds}
            onToggleFold={toggleFold}
            visibleIds={searchVisibleIds}
            currentFolderId={currentFolderId}
            productCounts={productCounts}
            onNodeTap={handleTap}
          />
          {isSearching && searchVisibleIds?.size === 0 && (
            <div className="px-4 py-8 text-center text-sm text-zinc-500">
              Niciun rezultat
            </div>
          )}
        </div>
      ) : selectionMode ? (
        <div
          className="flex-1 min-h-0 overflow-y-auto divide-y divide-zinc-800"
          style={{ paddingBottom: '3.5rem' }}
        >
          {selectionItems.map((node) => (
            <NodeCard
              key={node.id}
              node={node}
              selectable
              selected={selectedNodeIds.has(node.id)}
              onTap={(n) => toggleNodeSelection(n.id)}
              productCount={productCounts[node.id]}
            />
          ))}
          {selectionItems.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-zinc-500">
              Niciun element
            </div>
          )}
        </div>
      ) : isSearching ? (
        <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-zinc-800">
          <SearchGroup group={searchTree} depth={0} onTap={handleTap} productCounts={productCounts} />
          {showCreate && (
            <button
              onClick={handleCreateFromSearch}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left text-blue-400 active:bg-zinc-900"
            >
              <Plus size={18} className="shrink-0" />
              <span className="text-sm">Adaugă „{searchQuery.trim()}"</span>
            </button>
          )}
        </div>
      ) : currentChildren.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
          <p className="text-zinc-400 text-sm leading-relaxed">
            Catalogul e gol.<br />
            Scrie un nume în bara de căutare ca să creezi prima categorie.
          </p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-zinc-800">
          {currentChildren.map((node) => (
            <NodeCard key={node.id} node={node} onTap={handleTap} productCount={productCounts[node.id]} />
          ))}
        </div>
      )}

      {/* FAB „+" — vizibil doar când căutarea nu are match exact */}
      {showCreate && (
        <button
          onClick={handleCreateFromSearch}
          className="absolute right-4 z-20 flex items-center justify-center w-14 h-14 rounded-full bg-blue-600 text-white shadow-xl active:bg-blue-700"
          style={{ bottom: `calc(${hasCart ? '9rem' : '5rem'} + env(safe-area-inset-bottom))` }}
        >
          <Plus size={24} />
        </button>
      )}

      {/* Action bar — mod selecție (deasupra BottomBar-ului) */}
      <ActionBar 
        selectionMode={selectionMode}
        selectedCount={selectedNodeIds.size}
        onClear={clearSelection}
        onContinue={handleContinue} 
      />

      {/* Toast */}
      {toast && (
        <div className="absolute bottom-20 left-4 right-4 z-50 flex items-center gap-3 px-4 py-3 bg-zinc-800 rounded-2xl shadow-xl">
          <span className="flex-1 text-sm text-zinc-100">{toast}</span>
        </div>
      )}

      {/* Context menu — Filtrare + Organize + Unfold/Fold */}
      <BottomSheet open={catalogMenuOpen} onClose={closeCatalogMenu}>
        <div className="px-4 pb-6 space-y-1">
          <button
            onClick={() => {
              closeCatalogMenu()
              setFilterSheetOpen(true)
            }}
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
          <button
            onClick={organizeDisabled ? undefined : handleOrganize}
            disabled={organizeDisabled}
            className={[
              'w-full flex items-center gap-3 px-3 py-3.5 rounded-xl text-sm',
              organizeDisabled
                ? 'text-zinc-600 cursor-not-allowed'
                : 'text-zinc-200 hover:bg-zinc-800 active:bg-zinc-700',
            ].join(' ')}
          >
            <span className={organizeDisabled ? 'text-zinc-600' : 'text-zinc-400'}><FolderInput size={18} /></span>
            <span className="flex-1 text-left">Organize</span>
          </button>
          <button
            onClick={handleToggleTree}
            className="w-full flex items-center gap-3 px-3 py-3.5 rounded-xl text-sm text-zinc-200 hover:bg-zinc-800 active:bg-zinc-700"
          >
            <span className="text-zinc-400">
              {treeExpanded ? <FoldVertical size={18} /> : <UnfoldVertical size={18} />}
            </span>
            <span className="flex-1 text-left">{treeExpanded ? 'Fold' : 'Unfold'}</span>
          </button>
        </div>
      </BottomSheet>

      {/* Dialog Filtrare 2 Coloane */}
      <FilterSheet
        open={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        title="Filtrare Catalog"
        showCategoryDim={true}
        initialFilters={appliedFilters}
        onApply={(filters, pids) => {
          setCatalogFilter(filters, pids)
        }}
      />

      {/* Sheets pasul final */}
      <DestinationPicker
        open={destinationPickerOpen}
        onClose={() => setDestinationPickerOpen(false)}
        tempFolderId={tempFolderId}
        onPicked={handleDestinationPicked}
        allRootSelection={allRootSelection}
        getValidDestinations={getValidMoveDestinations}
      />
      <SubgroupSheet
        open={subgroupSheetOpen}
        onClose={() => setSubgroupSheetOpen(false)}
        onConfirmNo={handleSubgroupNo}
        onConfirmYes={handleSubgroupYes}
        startExpanded={skipSubgroupQuestion}
      />
    </div>
  )
}
