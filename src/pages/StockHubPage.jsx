import { useEffect, useState, useMemo } from 'react'
import { AlertTriangle, Check, Plus, ChevronRight, ChevronDown, FolderInput, UnfoldVertical, FoldVertical, ArrowLeft } from 'lucide-react'
import { useStockStore } from '../store/useStockStore'
import { useAppStore } from '../store/useAppStore'
import { usePicker } from '../hooks/usePicker'
import BottomSheet from '../components/catalog/BottomSheet'
import { SearchGroup, FullTree } from '../components/shared/HierarchyTree'
import NodeCard from '../components/catalog/NodeCard'
import ActionBar from '../components/catalog/ActionBar'
import DestinationPicker from '../components/catalog/DestinationPicker'
import SubgroupSheet from '../components/catalog/SubgroupSheet'
import { buildSearchTree } from '../lib/search'

export default function StockHubPage() {
  const { 
    spaces, alerts, isLoading, fetchSpaces, fetchAlerts, resolveAlert, 
    createSpace, createFolder, moveNodes, groupNodes,
    currentFolderId, navigate, navigateUp, getBreadcrumb, getChildren,
    selectionMode, selectedNodeIds, enterSelectionMode, toggleNodeSelection, clearSelection
  } = useStockStore()
  
  const { searchQuery, setSearchQuery, stockHubMenuOpen, closeStockHubMenu } = useAppStore()
  const [expandedAlerts, setExpandedAlerts] = useState({})
  
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

  // Închidem meniul automat pe unmount (safety)
  useEffect(() => {
    return () => closeStockHubMenu()
  }, [closeStockHubMenu])

  useEffect(() => {
    if (spaces.length === 0) fetchSpaces()
    fetchAlerts()
  }, [spaces.length, fetchSpaces, fetchAlerts])

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const isSearching = searchQuery.trim().length > 0
  const breadcrumb = getBreadcrumb()
  const currentChildren = getChildren(currentFolderId)

  // ── Căutare (Folosim `buildSearchTree` identic cu Catalogul) ─────────
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
  const showCreate = isSearching && !exactMatch

  // ── Handlers pentru alerte ───────────────────────────────────────────
  const toggleAlerts = (spaceId) => {
    setExpandedAlerts(prev => ({ ...prev, [spaceId]: !prev[spaceId] }))
  }

  const handleResolve = async (alertId) => {
    await resolveAlert(alertId)
    fetchAlerts()
  }

  const getAlertsForSpace = (spaceId) => alerts.filter(a => a.space_id === spaceId)

  // ── Navigare ─────────────────────────────────────────────────────────
  const handleNodeTap = (node) => {
    if (selectionMode) {
      toggleNodeSelection(node.id)
    } else if (node.type === 'folder') {
      navigate(node.id)
    } else {
      // It's a space. We might just toggle its alerts or show details in future.
      toggleAlerts(node.id)
    }
  }

  const handleToggleFold = (id) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ── Creare Spațiu (Manual, din căutare) ──────────────────────────────
  const handleCreateFromSearch = async () => {
    const trimmed = searchQuery.trim()
    if (!trimmed) return
    const res = await createSpace(trimmed, false)
    if (!res.ok) {
      showToast(res.error)
    } else {
      setSearchQuery('')
      showToast(`Spațiul "${trimmed}" creat`)
    }
  }

  // ── Flux Organize (Selecție, Mutare, Grupare) ────────────────────────
  const handleOrganize = () => {
    closeStockHubMenu()
    enterSelectionMode('cross-folder')
  }

  const organizeDisabled = spaces.length === 0

  const handleContinue = () => {
    if (selectedNodeIds.size === 0) return
    setDestinationPickerOpen(true)
    
    // Verificăm dacă toate nodurile sunt din root (parentId === null)
    let allRoot = true
    for (const id of selectedNodeIds) {
      const node = spaces.find((n) => n.id === id)
      if (node && node.parentId !== null) {
        allRoot = false
        break
      }
    }
    setAllRootSelection(allRoot)
    setTempFolderId(null) // în StockHub nu avem folder temporar în DB, așa că trecem null
  }

  const handleDestinationPicked = (folderId, folderName, isNewFolderRequest) => {
    setDestinationPickerOpen(false)
    if (isNewFolderRequest) {
      setTempFolderId(null) // destinația e rădăcina, dar vrem un folder nou
      setSkipSubgroupQuestion(true)
      setSubgroupSheetOpen(true)
    } else {
      setTempFolderId(folderId) // aici e destinația dorită
      setSkipSubgroupQuestion(false)
      setSubgroupSheetOpen(true)
    }
  }

  const handleSubgroupNo = async () => {
    setSubgroupSheetOpen(false)
    
    // Mutați nodurile direct în folderId ales (sau root dacă e null)
    const res = await moveNodes(Array.from(selectedNodeIds), tempFolderId)
    if (res.ok) {
      showToast('Spațiile au fost mutate.')
      clearSelection()
      if (tempFolderId) navigate(tempFolderId)
      else navigate(null)
    } else {
      showToast(res.error)
    }
  }

  const handleSubgroupYes = async (folderName) => {
    setSubgroupSheetOpen(false)
    
    // Creare folder + mutare
    // Aici setăm temporar `currentFolderId` ca fiind target-ul ales, pentru crearea folderului
    const previousFolder = currentFolderId
    navigate(tempFolderId) 

    const res = await groupNodes(Array.from(selectedNodeIds), folderName)
    
    navigate(previousFolder) // restore

    if (res.ok) {
      showToast(`A fost creat grupul "${folderName}"`)
      clearSelection()
      navigate(tempFolderId) // Mergem în destinația unde s-a creat noul folder
    } else {
      showToast(res.error)
    }
  }

  // ── Redare Lista ─────────────────────────────────────────────────────
  const renderList = () => {
    // Select-Mode (lista hibridă pentru selectare din folderul curent)
    if (selectionMode) {
      const selectionItems = treeExpanded 
        ? spaces 
        : (isSearching ? searchNodes : currentChildren)
        
      return (
        <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-zinc-800 pb-16">
          {treeExpanded ? (
            <FullTree
              parentId={null}
              depth={0}
              getChildren={getChildren}
              selectable={true}
              selectedIds={selectedNodeIds}
              onToggle={toggleNodeSelection}
              collapsedIds={collapsedIds}
              onToggleFold={handleToggleFold}
              visibleIds={isSearching ? searchVisibleIds : undefined}
              currentFolderId={currentFolderId}
              onNodeTap={handleNodeTap}
            />
          ) : (
            selectionItems.map(node => (
              <NodeCard
                key={node.id}
                node={node}
                selectable
                selected={selectedNodeIds.has(node.id)}
                onTap={handleNodeTap}
              />
            ))
          )}
          {selectionItems.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-zinc-500">Niciun element</div>
          )}
        </div>
      )
    }

    // Mod Căutare
    if (isSearching) {
      return (
        <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-zinc-800">
          <SearchGroup group={searchTree} depth={0} onTap={handleNodeTap} />
          {showCreate && (
            <button
              onClick={handleCreateFromSearch}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left text-blue-400 active:bg-zinc-900"
            >
              <Plus size={18} className="shrink-0" />
              <span className="text-sm">Adaugă spațiul „{searchQuery.trim()}”</span>
            </button>
          )}
        </div>
      )
    }

    // Arbore deschis complet
    if (treeExpanded) {
      return (
        <div className="flex-1 min-h-0 overflow-y-auto pb-16">
          <FullTree
            parentId={null}
            depth={0}
            getChildren={getChildren}
            collapsedIds={collapsedIds}
            onToggleFold={handleToggleFold}
            currentFolderId={currentFolderId}
            onNodeTap={handleNodeTap}
          />
        </div>
      )
    }

    // Empty state
    if (currentChildren.length === 0) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center min-h-[50vh]">
          <p className="text-zinc-400 text-sm leading-relaxed">
            Acest folder e gol.<br />
            Scrie un nume în bara de căutare ca să creezi primul spațiu.
          </p>
        </div>
      )
    }

    // Vizualizare normală a folderului curent
    return (
      <div className="flex-1 min-h-0 overflow-y-auto pb-24 px-4">
        <ul className="space-y-2 mt-2">
          {currentChildren.map(node => {
            if (node.type === 'folder') {
              return (
                <li key={node.id} className="rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900">
                  <NodeCard node={node} onTap={handleNodeTap} />
                </li>
              )
            }

            // Spațiu (Afișează alertele)
            const spaceAlerts = getAlertsForSpace(node.id)
            const hasAlerts = spaceAlerts.length > 0
            const isExpanded = expandedAlerts[node.id]

            return (
              <li key={node.id} className="px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800">
                <div 
                  className="flex items-center justify-between mb-1 cursor-pointer"
                  onClick={() => handleNodeTap(node)}
                >
                  <span className="text-sm font-medium text-zinc-100">{node.name}</span>
                  {node.allow_negative_stock && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20">
                      negativ permis
                    </span>
                  )}
                </div>
                <div className="flex gap-4 text-xs text-zinc-500 mb-2">
                  <span>{node.product_count || 0} produse</span>
                  <span className={node.total_units < 0 ? 'text-red-400' : ''}>
                    {node.total_units || 0} unități
                  </span>
                </div>

                {hasAlerts && (
                  <div className="mt-3 pt-3 border-t border-red-500/20">
                    <button 
                      onClick={() => toggleAlerts(node.id)}
                      className="flex items-center gap-2 text-xs font-medium text-red-400 hover:text-red-300 transition-colors w-full"
                    >
                      <AlertTriangle size={14} className="shrink-0" />
                      <span className="flex-1 text-left">{spaceAlerts.length} produse cu stoc negativ</span>
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                    
                    {isExpanded && (
                      <div className="mt-2 space-y-1.5 pl-5">
                        {spaceAlerts.map(alert => (
                          <div key={alert.id} className="flex items-center justify-between text-xs bg-zinc-950/50 p-2 rounded-lg">
                            <span className="text-zinc-300 truncate mr-2">
                              <span className="text-zinc-500 mr-1">•</span>
                              {alert.products?.name_id || 'Produs sters'}: <span className="text-red-400 font-medium">{alert.stock_value} un.</span>
                            </span>
                            <button
                              onClick={() => handleResolve(alert.id)}
                              className="flex items-center gap-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2 py-1 rounded transition-colors shrink-0"
                            >
                              <Check size={12} className="text-green-400" />
                              Rezolvă
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    )
  }

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-100">
      {/* Header cu Breadcrumb */}
      <div className="flex-none bg-zinc-950 border-b border-zinc-900 z-10 p-4">
        {breadcrumb.length > 0 ? (
          <div className="flex items-center gap-3">
            <button
              onClick={navigateUp}
              className="p-2 -ml-2 text-zinc-400 hover:text-zinc-100 active:bg-zinc-800 rounded-xl"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="flex-1 min-w-0 flex items-center text-sm">
              <span className="text-zinc-500 truncate" onClick={() => navigate(null)}>StockHub</span>
              {breadcrumb.slice(0, -1).map(node => (
                <div key={node.id} className="flex items-center shrink-0">
                  <ChevronRight size={14} className="text-zinc-600 mx-1" />
                  <span className="text-zinc-500 truncate max-w-[80px]" onClick={() => navigate(node.id)}>
                    {node.name}
                  </span>
                </div>
              ))}
              <ChevronRight size={14} className="text-zinc-600 mx-1 shrink-0" />
              <span className="text-amber-400 font-semibold truncate">
                {breadcrumb[breadcrumb.length - 1].name}
              </span>
            </div>
          </div>
        ) : (
          <div>
            <h1 className="text-xl font-bold text-zinc-100 leading-tight">StockHub</h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              {spaces.length} noduri în sistem
            </p>
          </div>
        )}
      </div>

      {/* Continut Principal */}
      {isLoading && spaces.length === 0 ? (
        <div className="px-6 space-y-2 mt-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 animate-pulse h-16"></div>
          ))}
        </div>
      ) : (
        renderList()
      )}

      {/* FAB - Create shortcut if searching */}
      {showCreate && !selectionMode && (
        <button
          onClick={handleCreateFromSearch}
          className="absolute right-4 z-20 flex items-center justify-center w-14 h-14 rounded-full bg-blue-600 text-white shadow-xl active:bg-blue-700"
          style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
        >
          <Plus size={24} />
        </button>
      )}

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
            onClick={() => {
              setTreeExpanded(!treeExpanded)
              closeStockHubMenu()
            }}
            className="w-full flex items-center gap-3 px-3 py-3.5 rounded-xl text-sm text-zinc-200 hover:bg-zinc-800 active:bg-zinc-700"
          >
            <span className="text-zinc-400">
              {treeExpanded ? <FoldVertical size={18} /> : <UnfoldVertical size={18} />}
            </span>
            <span className="flex-1 text-left">{treeExpanded ? 'Fold' : 'Unfold'}</span>
          </button>
        </div>
      </BottomSheet>

      {/* Sheets pasul final (Organize) */}
      <DestinationPicker
        open={destinationPickerOpen}
        onClose={() => setDestinationPickerOpen(false)}
        tempFolderId={tempFolderId}
        onPicked={handleDestinationPicked}
        allRootSelection={allRootSelection}
        getValidDestinations={(id) => {
          // exclude sub-folders of id
          const excluded = new Set()
          const getDesc = (parent) => {
            spaces.filter(s => s.parentId === parent).forEach(c => {
              excluded.add(c.id)
              getDesc(c.id)
            })
          }
          if (id) {
            excluded.add(id)
            getDesc(id)
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
