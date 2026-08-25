import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useNavigate as useRouterNavigate } from 'react-router-dom'
import {
  Plus, FolderInput, ChevronLeft,
  UnfoldVertical, FoldVertical,
} from 'lucide-react'
import { useStockStore } from '../store/useStockStore'
import { useAppStore } from '../store/useAppStore'
import { useCartStore } from '../store/useCartStore'
import { usePicker } from '../hooks/usePicker'
import BottomSheet from '../components/catalog/BottomSheet'
import { SearchGroup, FullTree } from '../components/shared/HierarchyTree'
import NodeCard from '../components/catalog/NodeCard'
import ActionBar from '../components/catalog/ActionBar'
import DestinationPicker from '../components/catalog/DestinationPicker'
import SubgroupSheet from '../components/catalog/SubgroupSheet'
import { buildSearchTree } from '../lib/search'

const ELLIPSIS_CRUMB = { id: '__ellipsis__', name: '…' }

export default function StockHubPage() {
  const hasCart = useCartStore((s) => s.items.length > 0)
  
  const { 
    spaces, alerts, isLoading, fetchSpaces, fetchAlerts,
    createSpace, moveNodes, groupNodes,
    currentFolderId, navigate, navigateUp, getBreadcrumb, getChildren,
    selectionMode, selectedNodeIds, enterSelectionMode, toggleNodeSelection, clearSelection
  } = useStockStore()
  
  const { searchQuery, setSearchQuery, setSearchPlaceholder, clearSearch, stockHubMenuOpen, closeStockHubMenu } = useAppStore()
  
  // Stări locale pentru UI
  const [toast, setToast] = useState(null)
  const [treeExpanded, setTreeExpanded] = useState(false)
  const [collapsedIds, setCollapsedIds] = useState(new Set())
  
  // Stări pentru formularele/sheets
  const [destinationPickerOpen, setDestinationPickerOpen] = useState(false)
  const [subgroupSheetOpen, setSubgroupSheetOpen] = useState(false)
  
  // Stări tranzitorii pentru procesul de mutare/grupare
  const [tempFolderId, setTempFolderId] = useState(null)
  const [allRootSelection, setAllRootSelection] = useState(false)
  const [skipSubgroupQuestion, setSkipSubgroupQuestion] = useState(false)

  // Breadcrumb expand/collapse
  const [crumbsExpanded, setCrumbsExpanded] = useState(false)

  // Refs for history/back navigation
  const toastTimer = useRef(null)
  const isPopRef = useRef(false)
  const selectionModeRef = useRef(selectionMode)
  selectionModeRef.current = selectionMode
  const goHome = useRouterNavigate()

  // Închidem meniul automat pe unmount (safety)
  useEffect(() => {
    return () => closeStockHubMenu()
  }, [closeStockHubMenu])

  useEffect(() => {
    if (spaces.length === 0) fetchSpaces()
    fetchAlerts()
  }, [spaces.length, fetchSpaces, fetchAlerts])

  // ── Placeholder ──────────────────────────────────────────────────────────────
  useEffect(() => {
    setSearchPlaceholder('Caută sau creează spații...')
  }, [setSearchPlaceholder])

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
      window.history.pushState({ stockHubFolder: currentFolderId }, '')
    }
  }, [currentFolderId])

  // Breadcrumb se resetează la collapsed când schimbăm folderul
  useEffect(() => { setCrumbsExpanded(false) }, [currentFolderId])

  const showToast = useCallback((msg) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast(msg)
    toastTimer.current = setTimeout(() => setToast(null), 3000)
  }, [])

  const isSearching = searchQuery.trim().length > 0
  const breadcrumb = getBreadcrumb()
  const currentChildren = getChildren(currentFolderId)

  // ── Căutare ──────────────────────────────────────────────────────────
  const { filteredItems: searchNodes } = usePicker({
    mode: 'inline',
    items: spaces,
    labelFn: (n) => n.name,
    query: searchQuery,
  })
  const searchVisibleIds = useMemo(() => new Set(searchNodes.map(n => n.id)), [searchNodes])
  
  const searchTree = useMemo(() => {
    if (!isSearching) return null
    return buildSearchTree(spaces, searchNodes)
  }, [spaces, searchNodes, isSearching])

  const exactMatch = searchNodes.some(
    (n) => n.name.trim().toLowerCase() === searchQuery.trim().toLowerCase()
  )
  const showCreate = isSearching && !exactMatch && !selectionMode

  // ── Helpers pentru info spații ───────────────────────────────────────
  const getAlertsForSpace = (spaceId) => alerts.filter(a => a.space_id === spaceId)

  const getSpaceSubtitle = (node) => {
    if (node.type !== 'space') return null
    const parts = []
    parts.push(`${node.product_count || 0} produse`)
    parts.push(`${node.total_units || 0} unități`)
    if (node.allow_negative_stock) parts.push('negativ permis')
    const spaceAlerts = getAlertsForSpace(node.id)
    if (spaceAlerts.length > 0) parts.push(`⚠ ${spaceAlerts.length} alertă`)
    return parts.join('  ·  ')
  }

  const getSpaceSubtitleClass = (node) => {
    if (node.type !== 'space') return undefined
    if ((node.total_units || 0) < 0) return 'text-red-400'
    const spaceAlerts = getAlertsForSpace(node.id)
    if (spaceAlerts.length > 0) return 'text-amber-400/70'
    return 'text-zinc-500'
  }

  // ── Navigare ─────────────────────────────────────────────────────────
  const handleNodeTap = useCallback((node) => {
    if (selectionMode) {
      toggleNodeSelection(node.id)
    } else if (node.type === 'folder') {
      navigate(node.id)
    } else if (node.type === 'space') {
      goHome('/stockhub/space/' + node.id)
    }
  }, [selectionMode, toggleNodeSelection, navigate, goHome])

  const handleToggleFold = useCallback((id) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // ── Creare Spațiu ────────────────────────────────────────────────────
  const handleCreateFromSearch = useCallback(async () => {
    const trimmed = searchQuery.trim()
    if (!trimmed) return
    const res = await createSpace(trimmed, false)
    if (!res.ok) {
      showToast(res.error)
    } else {
      setSearchQuery('')
      showToast(`Spațiul "${trimmed}" creat`)
    }
  }, [searchQuery, createSpace, setSearchQuery, showToast])

  // ── Flux Organize ────────────────────────────────────────────────────
  const handleOrganize = useCallback(() => {
    closeStockHubMenu()
    clearSearch()
    enterSelectionMode('cross-folder')
  }, [closeStockHubMenu, clearSearch, enterSelectionMode])

  const organizeDisabled = spaces.length === 0

  const handleContinue = useCallback(() => {
    if (selectedNodeIds.size === 0) return
    setDestinationPickerOpen(true)
    
    let allRoot = true
    for (const id of selectedNodeIds) {
      const node = spaces.find((n) => n.id === id)
      if (node && node.parentId !== null) {
        allRoot = false
        break
      }
    }
    setAllRootSelection(allRoot)
    setTempFolderId(null)
  }, [selectedNodeIds, spaces])

  const handleDestinationPicked = useCallback((folderId, folderName, isNewFolderRequest) => {
    setDestinationPickerOpen(false)
    if (isNewFolderRequest) {
      setTempFolderId(null)
      setSkipSubgroupQuestion(true)
      setSubgroupSheetOpen(true)
    } else {
      setTempFolderId(folderId)
      setSkipSubgroupQuestion(false)
      setSubgroupSheetOpen(true)
    }
  }, [])

  const handleSubgroupNo = useCallback(async () => {
    setSubgroupSheetOpen(false)
    const res = await moveNodes(Array.from(selectedNodeIds), tempFolderId)
    if (res.ok) {
      showToast('Spațiile au fost mutate.')
      clearSelection()
      if (tempFolderId) navigate(tempFolderId)
      else navigate(null)
    } else {
      showToast(res.error)
    }
  }, [selectedNodeIds, tempFolderId, moveNodes, clearSelection, navigate, showToast])

  const handleSubgroupYes = useCallback(async (folderName) => {
    setSubgroupSheetOpen(false)
    const previousFolder = currentFolderId
    navigate(tempFolderId)
    const res = await groupNodes(Array.from(selectedNodeIds), folderName)
    navigate(previousFolder)
    if (res.ok) {
      showToast(`A fost creat grupul "${folderName}"`)
      clearSelection()
      navigate(tempFolderId)
    } else {
      showToast(res.error)
    }
  }, [selectedNodeIds, tempFolderId, currentFolderId, groupNodes, clearSelection, navigate, showToast])

  const handleToggleTree = useCallback(() => {
    setTreeExpanded(prev => !prev)
    closeStockHubMenu()
  }, [closeStockHubMenu])

  // ── Breadcrumb (identic cu CatalogPage) ──────────────────────────────
  const fullCrumbs = useMemo(
    () => [{ id: null, name: 'StockHub' }, ...breadcrumb],
    [breadcrumb, currentFolderId]
  )
  const isCrumbTruncated = fullCrumbs.length > 3
  const collapsedCrumbs = isCrumbTruncated
    ? [fullCrumbs[0], ELLIPSIS_CRUMB, fullCrumbs[fullCrumbs.length - 1]]
    : fullCrumbs

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

  const handleBack = useCallback(() => {
    if (selectionMode) clearSelection()
    else goHome('/')
  }, [selectionMode, clearSelection, goHome])

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* Header — breadcrumb identic cu CatalogPage */}
      <div className="flex-none flex items-start gap-1 px-2 py-2 border-b border-zinc-800">
        <button
          onClick={handleBack}
          className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg text-zinc-400 active:text-zinc-100 active:bg-zinc-800"
        >
          <ChevronLeft size={20} />
        </button>

        {crumbsExpanded && isCrumbTruncated ? (
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
      {isLoading && spaces.length === 0 ? (
        <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-zinc-800">
          {[1, 2, 3].map((i) => (
            <div key={i} className="px-4 py-3.5 animate-pulse h-14"></div>
          ))}
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
            selectable={selectionMode === 'cross-folder'}
            selectedIds={selectedNodeIds}
            onToggle={toggleNodeSelection}
            collapsedIds={collapsedIds}
            onToggleFold={handleToggleFold}
            visibleIds={isSearching ? searchVisibleIds : undefined}
            currentFolderId={currentFolderId}
            onNodeTap={handleNodeTap}
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
          {(isSearching ? searchNodes : currentChildren).map((node) => (
            <NodeCard
              key={node.id}
              node={node}
              selectable
              selected={selectedNodeIds.has(node.id)}
              onTap={(n) => toggleNodeSelection(n.id)}
              productCount={node.type === 'space' ? node.product_count : undefined}
              subtitle={getSpaceSubtitle(node)}
              subtitleClassName={getSpaceSubtitleClass(node)}
            />
          ))}
          {(isSearching ? searchNodes : currentChildren).length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-zinc-500">Niciun element</div>
          )}
        </div>
      ) : isSearching ? (
        <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-zinc-800">
          <SearchGroup group={searchTree} depth={0} onTap={handleNodeTap} />
          {showCreate && (
            <button
              onClick={handleCreateFromSearch}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left text-blue-400 active:bg-zinc-900"
            >
              <Plus size={18} className="shrink-0" />
              <span className="text-sm">Adaugă spațiul „{searchQuery.trim()}"</span>
            </button>
          )}
        </div>
      ) : currentChildren.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
          <p className="text-zinc-400 text-sm leading-relaxed">
            Acest folder e gol.<br />
            Scrie un nume în bara de căutare ca să creezi primul spațiu.
          </p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-zinc-800">
          {currentChildren.map((node) => (
            <NodeCard
              key={node.id}
              node={node}
              onTap={handleNodeTap}
              productCount={node.type === 'space' ? node.product_count : undefined}
              subtitle={getSpaceSubtitle(node)}
              subtitleClassName={getSpaceSubtitleClass(node)}
            />
          ))}
        </div>
      )}

      {/* FAB „+" — vizibil doar la match inexact sau la zero rezultate de căutare */}
      {showCreate && (
        <button
          onClick={handleCreateFromSearch}
          className="absolute right-4 z-20 flex items-center justify-center w-14 h-14 rounded-full bg-blue-600 text-white shadow-xl active:bg-blue-700"
          style={{ bottom: `calc(${hasCart ? '9rem' : '5rem'} + env(safe-area-inset-bottom))` }}
        >
          <Plus size={24} />
        </button>
      )}

      {/* Action bar — mod selecție */}
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

      {/* Context Menu BottomSheet */}
      <BottomSheet open={stockHubMenuOpen} onClose={closeStockHubMenu}>
        <div className="px-4 pb-6 space-y-1">
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
            <span className="flex-1 text-left">Organizează spațiile</span>
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

      {/* Sheets (Organize) */}
      <DestinationPicker
        open={destinationPickerOpen}
        onClose={() => setDestinationPickerOpen(false)}
        tempFolderId={tempFolderId || 'virtual'}
        onPicked={handleDestinationPicked}
        allRootSelection={allRootSelection}
        getValidDestinations={() => {
          const excluded = new Set()
          const getDesc = (parent) => {
            spaces.filter(s => s.parentId === parent).forEach(c => {
              excluded.add(c.id)
              getDesc(c.id)
            })
          }
          for (const sId of selectedNodeIds) {
            excluded.add(sId)
            getDesc(sId)
          }
          return spaces.filter(s => s.type === 'folder' && !excluded.has(s.id))
        }}
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
