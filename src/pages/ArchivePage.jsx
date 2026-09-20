// [ITEMS FEATURE] — Pagină izolată, removable.
import { useState, useEffect, useMemo, useCallback } from 'react'
import { X, ArrowLeft, CheckSquare, Square, ArchiveRestore } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import { useItemsStore } from '../store/useItemsStore'
import ItemDetailSheet from '../components/items/ItemDetailSheet'
import TagSuggestionsPanel from '../components/items/TagSuggestionsPanel'
import { useAutocompleteGhost } from '../hooks/useAutocompleteGhost'
import BottomSheet from '../components/catalog/BottomSheet'

const SEARCH_CONTEXT_ID = 'archive-list'

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

export default function ArchivePage() {
  const navigate = useNavigate()
  const archivedItems = useItemsStore((s) => s.archivedItems)
  const getArchivedTagVocabulary = useItemsStore((s) => s.getArchivedTagVocabulary)
  const restoreItems = useItemsStore((s) => s.restoreItems)

  const searchQuery = useAppStore((s) => s.searchQuery)
  const setSearchQuery = useAppStore((s) => s.setSearchQuery)
  const pushSearchContext = useAppStore((s) => s.pushSearchContext)
  const popSearchContext = useAppStore((s) => s.popSearchContext)
  const clearSearch = useAppStore((s) => s.clearSearch)
  const setBottomBarScrollHidden = useAppStore((s) => s.setBottomBarScrollHidden)

  const [detailItem, setDetailItem] = useState(null)
  const [activeTags, setActiveTags] = useState([])
  const [toast, setToast] = useState(null)

  // Selecție
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [confirmRestore, setConfirmRestore] = useState(false)

  const vocabulary = useMemo(() => getArchivedTagVocabulary(), [archivedItems, getArchivedTagVocabulary])

  useEffect(() => {
    clearSearch()
    setActiveTags([])
    pushSearchContext(SEARCH_CONTEXT_ID, 'Caută tag...')
    setBottomBarScrollHidden(false)
    return () => {
      clearSearch()
      popSearchContext(SEARCH_CONTEXT_ID)
    }
  }, [pushSearchContext, popSearchContext, clearSearch, setBottomBarScrollHidden])

  const handleTagSelect = useCallback((tagValue) => {
    setActiveTags((prev) => prev.includes(tagValue) ? prev : [...prev, tagValue])
    setSearchQuery('')
  }, [setSearchQuery])

  const removeActiveTag = (tagValue) => {
    setActiveTags((prev) => prev.filter((t) => t !== tagValue))
  }

  const visibleItems = useMemo(() => {
    let result = [...archivedItems]
    if (activeTags.length > 0) {
      result = result.filter((item) =>
        activeTags.every((at) => item.tags?.includes(at))
      )
    }
    // Ordonate după archivedAt desc
    result.sort((a, b) => {
      const ma = a.archivedAt ? new Date(a.archivedAt).getTime() : 0
      const mb = b.archivedAt ? new Date(b.archivedAt).getTime() : 0
      return mb - ma
    })
    return result
  }, [archivedItems, activeTags])

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
    setConfirmRestore(false)
  }

  const handleRestoreConfirm = () => {
    restoreItems([...selectedIds])
    exitSelectionMode()
    showToast(`${selectedIds.size} element${selectedIds.size !== 1 ? 'e' : ''} recuperat${selectedIds.size !== 1 ? 'e' : ''}`)
  }

  const selCount = selectedIds.size
  const showClearFAB = !selectionMode && activeTags.length > 0
  const showRestoreFAB = selectionMode && selCount > 0

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
            <h1 className="text-xl font-bold text-zinc-100">Arhivă</h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              {archivedItems.length} {archivedItems.length === 1 ? 'element' : 'elemente'}
              {activeTags.length > 0 && ` · ${visibleItems.length} filtrate`}
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold text-zinc-100 tabular-nums leading-none">{totalValue}</div>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 mt-1 font-medium">Total</p>
        </div>
      </div>

      {/* Chips tags active */}
      {activeTags.length > 0 && (
        <div className="px-4 pb-2 shrink-0 flex flex-wrap gap-2">
          {activeTags.map((tag) => (
            <span key={tag} className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-900/60 border border-blue-700/50 text-sm text-blue-200">
              {tag}
              <button onClick={() => removeActiveTag(tag)} className="flex items-center justify-center w-4 h-4 rounded-full active:bg-blue-700/50">
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Lista */}
      <div className="flex-1 overflow-y-auto min-h-0 relative">
        {visibleItems.length === 0 ? (
          <div className="p-8 text-center text-zinc-500">
            <p>{archivedItems.length === 0 ? 'Niciun element arhivat.' : 'Niciun element găsit.'}</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/60">
            {visibleItems.map((item, index) => {
              const curr = parseDateStrings(item.archivedAt || item.moment)
              const prev = index > 0 ? parseDateStrings(visibleItems[index - 1].archivedAt || visibleItems[index - 1].moment) : null
              const isSameDate = prev && curr.dateStr === prev.dateStr
              const dateDisplay = isSameDate ? null : curr.dateStr
              const isSelected = selectedIds.has(item.id)

              return (
                <button
                  key={item.id}
                  onClick={() => selectionMode ? toggleSelect(item.id) : setDetailItem(item)}
                  className={[
                    'w-full flex items-start gap-3 py-3.5 text-left transition-colors px-4',
                    isSelected ? 'bg-blue-900/20 active:bg-blue-900/30' : 'active:bg-zinc-800/40',
                  ].join(' ')}
                >
                  {selectionMode && (
                    <span className="shrink-0 pt-0.5">
                      {isSelected
                        ? <CheckSquare size={20} className="text-blue-400" />
                        : <Square size={20} className="text-zinc-600" />}
                    </span>
                  )}
                  <span className="text-2xl font-bold text-zinc-100 tabular-nums leading-none pt-0.5 shrink-0 min-w-[60px] text-right">
                    {item.value}
                  </span>
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
                  <div className="flex flex-col items-end shrink-0 pt-0.5">
                    {dateDisplay && <span className="text-xs text-zinc-400 font-medium mb-0.5">{dateDisplay}</span>}
                    <span className="text-xs text-zinc-500 tabular-nums">{curr.timeStr}</span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* FAB */}
      {showRestoreFAB ? (
        <button
          onClick={() => setConfirmRestore(true)}
          className="fixed right-4 bottom-20 z-20 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white px-5 h-14 rounded-full shadow-lg shadow-black/50 transition-all duration-200 flex items-center gap-2"
        >
          <ArchiveRestore size={20} />
          <span className="text-base font-bold tabular-nums">{selCount}</span>
        </button>
      ) : showClearFAB ? (
        <button
          onClick={() => setActiveTags([])}
          className="fixed right-4 bottom-20 z-20 bg-zinc-700 hover:bg-zinc-600 active:bg-zinc-800 text-white p-4 rounded-full shadow-lg shadow-black/50 transition-all duration-200"
          aria-label="Șterge filtre"
        >
          <X size={22} />
        </button>
      ) : null}

      {/* Buton Selectează / Anulează în BottomBar */}
      <div className="fixed bottom-0 left-0 right-0 h-16 z-30 flex items-center justify-end px-4 pointer-events-none">
        <button
          onClick={() => selectionMode ? exitSelectionMode() : setSelectionMode(true)}
          className="pointer-events-auto text-sm font-medium text-blue-400 active:text-blue-300 px-3 py-2"
        >
          {selectionMode ? 'Anulează' : 'Selectează & recuperează'}
        </button>
      </div>

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

      {/* Detail sheet — view only, fără editare */}
      <ItemDetailSheet
        open={Boolean(detailItem)}
        onClose={() => setDetailItem(null)}
        item={detailItem}
      />

      {/* Dialog confirmare recuperare */}
      {confirmRestore && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={() => setConfirmRestore(false)}>
          <div className="w-full max-w-md bg-zinc-900 rounded-t-2xl px-6 pb-8 pt-6" onClick={(e) => e.stopPropagation()}>
            <p className="text-zinc-100 text-base font-medium text-center mb-1">Recuperezi {selCount} element{selCount !== 1 ? 'e' : ''}?</p>
            <p className="text-zinc-500 text-sm text-center mb-6">Elementele vor fi readuse în lista principală.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmRestore(false)} className="flex-1 h-11 rounded-xl bg-zinc-800 text-sm text-zinc-300 active:bg-zinc-700">
                Nu
              </button>
              <button onClick={handleRestoreConfirm} className="flex-1 h-11 rounded-xl bg-blue-600 text-sm font-medium text-white active:bg-blue-700">
                Da, recuperează
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
