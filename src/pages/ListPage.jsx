// [ITEMS FEATURE] — Pagină izolată, removable. Șterge din App.jsx și DashboardPage pentru a elimina.
import { useState, useEffect, useMemo, useCallback } from 'react'
import { Plus, X, ArrowLeft, CheckSquare, Square, Archive, Tag } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import { useItemsStore } from '../store/useItemsStore'
import ItemFormSheet from '../components/items/ItemFormSheet'
import ItemDetailSheet from '../components/items/ItemDetailSheet'
import TagSuggestionsPanel from '../components/items/TagSuggestionsPanel'
import TagGroupsPicker from '../components/items/TagGroupsPicker'
import { useAutocompleteGhost } from '../hooks/useAutocompleteGhost'
import BottomSheet from '../components/catalog/BottomSheet'


const SEARCH_CONTEXT_ID = 'items-list'

function parseDateStrings(iso) {
  if (!iso) return { dateStr: '', timeStr: '—' }
  try {
    const d = new Date(iso)
    const dateStr = d.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' })
    const timeStr = d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })
    return { dateStr, timeStr }
  } catch {
    return { dateStr: '', timeStr: '—' }
  }
}

export default function ListPage() {
  const navigate = useNavigate()
  const items = useItemsStore((s) => s.items)
  const getTagVocabulary = useItemsStore((s) => s.getTagVocabulary)
  const archiveItems = useItemsStore((s) => s.archiveItems)

  const searchQuery = useAppStore((s) => s.searchQuery)
  const setSearchQuery = useAppStore((s) => s.setSearchQuery)
  const pushSearchContext = useAppStore((s) => s.pushSearchContext)
  const popSearchContext = useAppStore((s) => s.popSearchContext)
  const clearSearch = useAppStore((s) => s.clearSearch)
  const setBottomBarScrollHidden = useAppStore((s) => s.setBottomBarScrollHidden)

  const [formOpen, setFormOpen] = useState(false)
  const [detailItem, setDetailItem] = useState(null)
  const [editItem, setEditItem] = useState(null)
  const [activeTags, setActiveTags] = useState([])
  const [toast, setToast] = useState(null)

  // Selecție
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [actionSheetOpen, setActionSheetOpen] = useState(false)
  const [confirmArchive, setConfirmArchive] = useState(false)
  
  // Context Menu
  const [contextMenuOpen, setContextMenuOpen] = useState(false)
  const [tagsSheetOpen, setTagsSheetOpen] = useState(false)
  const setBottomBarMenuOverride = useAppStore((s) => s.setBottomBarMenuOverride)


  const vocabulary = useMemo(() => getTagVocabulary(), [items, getTagVocabulary])

  useEffect(() => {
    clearSearch()
    setActiveTags([])
    pushSearchContext(SEARCH_CONTEXT_ID, 'Caută tag...')
    setBottomBarScrollHidden(false)
    setBottomBarMenuOverride(() => setContextMenuOpen(true))
    return () => {
      clearSearch()
      popSearchContext(SEARCH_CONTEXT_ID)
      setBottomBarMenuOverride(null)
    }
  }, [pushSearchContext, popSearchContext, clearSearch, setBottomBarScrollHidden, setBottomBarMenuOverride])

  const handleTagSelect = useCallback((tagValue) => {
    setActiveTags((prev) => prev.includes(tagValue) ? prev : [...prev, tagValue])
    setSearchQuery('')
  }, [setSearchQuery])

  const removeActiveTag = (tagValue) => {
    setActiveTags((prev) => prev.filter((t) => t !== tagValue))
  }

  const visibleItems = useMemo(() => {
    let result = [...items]
    if (activeTags.length > 0) {
      result = result.filter((item) =>
        activeTags.every((at) => item.tags?.includes(at))
      )
    }
    result.sort((a, b) => {
      const ma = a.moment ? new Date(a.moment).getTime() : 0
      const mb = b.moment ? new Date(b.moment).getTime() : 0
      return mb - ma
    })
    return result
  }, [items, activeTags])

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  const isSearchActive = useAppStore((s) => {
    const activeContext = s.searchContextStack[s.searchContextStack.length - 1]
    return activeContext?.id === SEARCH_CONTEXT_ID
  })

  const setBottomBarAcceptAction = useAppStore((s) => s.setBottomBarAcceptAction)
  const allowedVocab = useMemo(() => vocabulary.filter(t => !activeTags.includes(t.value)), [vocabulary, activeTags])

  useAutocompleteGhost(isSearchActive, searchQuery, allowedVocab, (t) => t.value)

  useEffect(() => {
    if (isSearchActive) {
      const action = (val) => { if (val) handleTagSelect(val) }
      setBottomBarAcceptAction(action)
      return () => {
        if (useAppStore.getState().bottomBarAcceptAction === action) {
          setBottomBarAcceptAction(null)
        }
      }
    }
  }, [isSearchActive, setBottomBarAcceptAction, handleTagSelect])

  const totalValue = visibleItems.reduce((acc, item) => acc + (item.value || 0), 0)

  // Selecție helpers
  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const exitSelectionMode = () => {
    setSelectionMode(false)
    setSelectedIds(new Set())
    setActionSheetOpen(false)
    setConfirmArchive(false)
  }

  const handleArchiveConfirm = () => {
    archiveItems([...selectedIds])
    exitSelectionMode()
    showToast(`${selectedIds.size} element${selectedIds.size !== 1 ? 'e' : ''} arhivat${selectedIds.size !== 1 ? 'e' : ''}`)
  }

  const inSelectionMode = selectionMode
  const selCount = selectedIds.size

  // FAB logic
  const showFAB = !formOpen && !editItem
  const fabIsReset = !inSelectionMode && activeTags.length > 0
  const fabIsSelection = inSelectionMode && selCount > 0

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-2 shrink-0 flex justify-between items-start">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center justify-center w-8 h-8 -ml-1 rounded-xl text-zinc-400 active:text-zinc-100 active:bg-zinc-800"
            aria-label="Înapoi"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-zinc-100">Items</h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              {items.length} {items.length === 1 ? 'element' : 'elemente'}
              {activeTags.length > 0 && ` · ${visibleItems.length} filtrate`}
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold text-zinc-100 tabular-nums leading-none">
            {totalValue}
          </div>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 mt-1 font-medium">Total</p>
        </div>
      </div>

      {/* Chips tags active (filtru AND) */}
      {activeTags.length > 0 && (
        <div className="px-4 pb-2 shrink-0 flex flex-wrap gap-2">
          {activeTags.map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-900/60 border border-blue-700/50 text-sm text-blue-200"
            >
              {tag}
              <button
                onClick={() => removeActiveTag(tag)}
                className="flex items-center justify-center w-4 h-4 rounded-full active:bg-blue-700/50"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Lista sau empty state */}
      <div className="flex-1 overflow-y-auto min-h-0 relative">
        {visibleItems.length === 0 ? (
          <div className="p-8 text-center text-zinc-500">
            <p>Niciun element găsit.</p>
            {activeTags.length === 0 && !inSelectionMode && (
              <button
                onClick={() => setFormOpen(true)}
                className="mt-4 px-4 py-2 rounded-xl bg-blue-600 text-sm text-white active:bg-blue-700"
              >
                Adaugă primul element
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/60">
            {visibleItems.map((item, index) => {
              const curr = parseDateStrings(item.moment)
              const prev = index > 0 ? parseDateStrings(visibleItems[index - 1].moment) : null
              const isSameDate = prev && curr.dateStr === prev.dateStr
              const dateDisplay = isSameDate ? null : curr.dateStr
              const isSelected = selectedIds.has(item.id)

              return (
                <button
                  key={item.id}
                  onClick={() => inSelectionMode ? toggleSelect(item.id) : setDetailItem(item)}
                  className={[
                    'w-full flex items-start gap-3 py-3.5 text-left transition-colors px-4',
                    isSelected ? 'bg-blue-900/20 active:bg-blue-900/30' : 'active:bg-zinc-800/40',
                  ].join(' ')}
                >
                  {/* Checkbox selecție */}
                  {inSelectionMode && (
                    <span className="shrink-0 pt-0.5">
                      {isSelected
                        ? <CheckSquare size={20} className="text-blue-400" />
                        : <Square size={20} className="text-zinc-600" />}
                    </span>
                  )}

                  {/* Valoare — proeminentă */}
                  <span className="text-2xl font-bold text-zinc-100 tabular-nums leading-none pt-0.5 shrink-0 min-w-[60px] text-right">
                    {item.value}
                  </span>

                  {/* Corp card */}
                  <div className="flex-1 min-w-0">
                    {item.description ? (
                      <p className="text-sm text-zinc-300 truncate leading-snug">{item.description}</p>
                    ) : (
                      <p className="text-sm text-zinc-600 italic leading-snug">fără descriere</p>
                    )}
                    {item.tags?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {item.tags.map((t) => (
                          <span key={t} className="px-2 py-0.5 rounded-md bg-zinc-800/80 text-[10px] text-zinc-400 font-medium tracking-wide uppercase">
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Data / Ora */}
                  <div className="flex flex-col items-end shrink-0 pt-0.5">
                    {dateDisplay && (
                      <span className="text-xs text-zinc-400 font-medium mb-0.5">{dateDisplay}</span>
                    )}
                    <span className="text-xs text-zinc-500 tabular-nums">{curr.timeStr}</span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* FAB */}
      {showFAB && (
        fabIsSelection ? (
          <button
            onClick={() => setActionSheetOpen(true)}
            className="fixed right-4 bottom-20 z-20 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white px-5 h-14 rounded-full shadow-lg shadow-black/50 transition-all duration-200 flex items-center gap-2"
          >
            <CheckSquare size={20} />
            <span className="text-base font-bold tabular-nums">{selCount}</span>
          </button>
        ) : fabIsReset ? (
          <button
            onClick={() => setActiveTags([])}
            className="fixed right-4 bottom-20 z-20 bg-zinc-700 hover:bg-zinc-600 active:bg-zinc-800 text-white p-4 rounded-full shadow-lg shadow-black/50 transition-all duration-200"
            aria-label="Șterge filtre"
          >
            <X size={22} />
          </button>
        ) : !inSelectionMode ? (
          <button
            onClick={() => setFormOpen(true)}
            className="fixed right-4 bottom-20 z-20 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white p-4 rounded-full shadow-lg shadow-black/50 transition-all duration-200"
            aria-label="Adaugă element"
          >
            <Plus size={22} />
          </button>
        ) : null
      )}

      {/* Context Menu Sheet */}
      <BottomSheet open={contextMenuOpen} onClose={() => setContextMenuOpen(false)}>
        <div className="pb-6">
          <h2 className="px-4 text-sm font-medium text-zinc-400 mb-3 text-center">Acțiuni listă</h2>
          <button
            onClick={() => {
              setContextMenuOpen(false)
              if (inSelectionMode) exitSelectionMode()
              else setSelectionMode(true)
            }}
            className="w-full flex items-center gap-4 px-6 py-4 active:bg-zinc-800"
          >
            <CheckSquare size={20} className="text-blue-400 shrink-0" />
            <span className="text-sm font-medium text-blue-400">
              {inSelectionMode ? 'Anulează selecția' : 'Selectează'}
            </span>
          </button>
          {/* Opțiunea Tags — deschide TagGroupsPicker cu modul complet de organizare */}
          <button
            onClick={() => {
              setContextMenuOpen(false)
              setTagsSheetOpen(true)
            }}
            className="w-full flex items-center gap-4 px-6 py-4 active:bg-zinc-800"
          >
            <Tag size={20} className="text-zinc-400 shrink-0" />
            <span className="text-sm text-zinc-100">Tags</span>
          </button>
        </div>
      </BottomSheet>

      {/* TagGroupsPicker Sheet — aboveBottomBar pentru a permite căutarea prin BottomBar */}
      <BottomSheet
        open={tagsSheetOpen}
        onClose={() => setTagsSheetOpen(false)}
        aboveBottomBar
        className="max-h-[85dvh]"
      >
        <TagGroupsPicker
          allowOrganize
          onClose={() => setTagsSheetOpen(false)}
        />
      </BottomSheet>


      {/* Panel sugestii tags */}
      {isSearchActive && (
        <TagSuggestionsPanel
          query={searchQuery}
          vocabulary={vocabulary}
          activeTags={activeTags}
          onSelect={handleTagSelect}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-zinc-700 text-zinc-100 text-sm px-4 py-2 rounded-xl shadow-lg pointer-events-none">
          {toast}
        </div>
      )}

      {/* Form adăugare/editare item */}
      <ItemFormSheet
        open={formOpen || Boolean(editItem)}
        onClose={() => { setFormOpen(false); setEditItem(null) }}
        initialData={editItem}
        showToast={showToast}
      />

      {/* Detail sheet */}
      <ItemDetailSheet
        open={Boolean(detailItem)}
        onClose={() => setDetailItem(null)}
        item={detailItem}
        onEdit={(item) => { setDetailItem(null); setEditItem(item) }}
      />

      {/* Action sheet selecție */}
      <BottomSheet open={actionSheetOpen} onClose={() => setActionSheetOpen(false)}>
        <div className="pb-6">
          <h2 className="px-4 text-sm font-medium text-zinc-400 mb-3 text-center">
            {selCount} element{selCount !== 1 ? 'e' : ''} selectat{selCount !== 1 ? 'e' : ''}
          </h2>
          <button
            onClick={() => { setActionSheetOpen(false); setConfirmArchive(true) }}
            className="w-full flex items-center gap-4 px-6 py-4 active:bg-zinc-800"
          >
            <Archive size={20} className="text-zinc-400 shrink-0" />
            <span className="text-sm text-zinc-100">Arhivează</span>
          </button>
        </div>
      </BottomSheet>

      {/* Dialog confirmare arhivare */}
      {confirmArchive && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={() => setConfirmArchive(false)}>
          <div className="w-full max-w-md bg-zinc-900 rounded-t-2xl px-6 pb-8 pt-6" onClick={(e) => e.stopPropagation()}>
            <p className="text-zinc-100 text-base font-medium text-center mb-1">Arhivezi {selCount} element{selCount !== 1 ? 'e' : ''}?</p>
            <p className="text-zinc-500 text-sm text-center mb-6">Elementele pot fi recuperate din Arhivă.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmArchive(false)} className="flex-1 h-11 rounded-xl bg-zinc-800 text-sm text-zinc-300 active:bg-zinc-700">
                Nu
              </button>
              <button onClick={handleArchiveConfirm} className="flex-1 h-11 rounded-xl bg-blue-600 text-sm font-medium text-white active:bg-blue-700">
                Da, arhivează
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
