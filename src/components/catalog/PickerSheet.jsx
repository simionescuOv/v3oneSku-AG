import { useEffect, useState, useCallback } from 'react'
import { Plus, Square, CheckSquare, Check, X, ChevronDown } from 'lucide-react'
import BottomSheet from './BottomSheet'
import { usePicker } from '../../hooks/usePicker'
import { useAppStore, useActiveSearchQuery } from '../../store/useAppStore'
import { useTranslation } from 'react-i18next'

export default function PickerSheet({
  open,
  title,
  items = [],                 // [{ value, count? }] — pre-sortate de părinte
  selected = [],              // string[] — selecția curentă din formular
  multiSelect = false,
  allowCreate = false,
  searchPlaceholder = null,
  emptyLabel = 'Nicio valoare încă',
  saveButtonLabel = 'Salvează',
  saveButtonIcon: SaveIcon,
  saveButtonClass = 'bg-blue-600 active:bg-blue-700',
  onConfirm,                  // ({ selected: string[], created: string[] }) => void
  onClose,
}) {
  const { t } = useTranslation()
  const searchQuery = useActiveSearchQuery('picker_sheet')
  const pushSearchContext = useAppStore((s) => s.pushSearchContext)
  const popSearchContext = useAppStore((s) => s.popSearchContext)
  const clearSearch = useAppStore((s) => s.clearSearch)
  const setBottomBarAcceptAction = useAppStore((s) => s.setBottomBarAcceptAction)

  const [tempSelected, setTempSelected] = useState([])
  const [created, setCreated] = useState([])
  const [isPinnedExpanded, setIsPinnedExpanded] = useState(true)


  // 1. Inițializare stare la deschidere
  useEffect(() => {
    if (!open) return
    setTempSelected([...selected])
    setCreated([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const confirm = useCallback((sel, extraCreated = created) =>
    onConfirm?.({
      selected: sel,
      created: extraCreated.filter((c) => sel.includes(c)),
    }), [onConfirm, created])

  // 2a. Înregistrare context de căutare
  useEffect(() => {
    if (!open) return
    clearSearch()
    const effectivePlaceholder = searchPlaceholder || t('search.placeholder_fallback')
    pushSearchContext('picker_sheet', effectivePlaceholder)
    
    return () => {
      clearSearch()
      popSearchContext('picker_sheet')
    }
  }, [open, clearSearch, pushSearchContext, popSearchContext, searchPlaceholder, t])

  // 2b. Acțiune accept BottomBar
  useEffect(() => {
    if (!open) return

    const action = (text) => {
      const trimmed = text.trim()
      if (!trimmed) return
      if (!multiSelect) {
        confirm([trimmed], [...created, trimmed])
        return
      }
      setCreated((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]))
      setTempSelected((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]))
      clearSearch()
    }
    setBottomBarAcceptAction(action)

    return () => {
      if (useAppStore.getState().bottomBarAcceptAction === action) {
        setBottomBarAcceptAction(null)
      }
    }
  }, [open, multiSelect, created, confirm, setBottomBarAcceptAction, clearSearch])

  const allItems = [
    ...items,
    ...created
      .filter((c) => !items.some((it) => it.value === c))
      .map((c) => ({ value: c, count: 0 })),
  ]

  const { filteredItems, showCreate } = usePicker({
    mode: 'inline',
    items: allItems,
    labelFn: (t) => t.value,
    allowCreate,
    query: searchQuery,
    searchContext: 'picker_sheet',
    multiSelect,
    value: tempSelected,
  })

  if (!open) return null


  const handleTap = (value) => {
    if (!multiSelect) {
      confirm([value])
      return
    }
    setTempSelected((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    )
  }

  const handleAddNew = () => {
    const trimmed = searchQuery.trim()
    if (!trimmed) return
    if (!multiSelect) {
      confirm([trimmed], [...created, trimmed])
      return
    }
    setCreated((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]))
    setTempSelected((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]))
    clearSearch()
  }

  return (
    <BottomSheet open={open} onClose={onClose} aboveBottomBar>
      <div className="pb-6">
        <h2 className="px-4 text-sm font-medium text-zinc-200 mb-2 text-center">{title}</h2>

        {/* Panou tag-uri active (se aplică doar la multiSelect) */}
        {multiSelect && tempSelected.length > 0 && (
          <div className="px-4 mb-3 shrink-0">
            <button
              onClick={() => setIsPinnedExpanded(!isPinnedExpanded)}
              className="w-full flex items-center justify-between py-2"
            >
              <span className="text-xs font-medium text-zinc-400">
                {tempSelected.length} {tempSelected.length === 1 ? 'tag activ' : 'tag-uri active'}
              </span>
              <ChevronDown
                size={16}
                className={`text-zinc-500 transition-transform ${isPinnedExpanded ? 'rotate-180' : ''}`}
              />
            </button>
            {isPinnedExpanded && (
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto pb-1 mt-1">
                {tempSelected.map(tag => (
                  <span 
                    key={tag} 
                    className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-900/60 border border-blue-700/50 text-sm text-blue-200"
                  >
                    {tag}
                    <button 
                      onClick={(e) => {
                        e.stopPropagation()
                        setTempSelected(prev => prev.filter(t => t !== tag))
                      }} 
                      className="flex items-center justify-center w-4 h-4 rounded-full active:bg-blue-700/50"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="max-h-[55dvh] overflow-y-auto divide-y divide-zinc-800">
          {filteredItems.map((it) => {
            // multiSelect: checkbox reflectă selecția temporară (tags).
            // single-select: bifă simplă pe valoarea deja aleasă în formular
            // (fără checkbox — tap pe orice rând confirmă imediat).
            const isSelected = multiSelect
              ? tempSelected.includes(it.value)
              : selected.includes(it.value)
            return (
              <button
                key={it.value}
                onClick={() => handleTap(it.value)}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-zinc-800"
              >
                {multiSelect &&
                  (isSelected
                    ? <CheckSquare size={18} className="text-blue-400 shrink-0" />
                    : <Square size={18} className="text-zinc-600 shrink-0" />)}
                <span className="flex-1 text-sm text-zinc-100 truncate">{it.value}</span>
                {it.count > 0 && (
                  <span className="text-xs text-zinc-500 shrink-0">{it.count}</span>
                )}
                {!multiSelect && isSelected && (
                  <Check size={16} className="text-blue-400 shrink-0" />
                )}
              </button>
            )
          })}

          {showCreate && (
            <button
              onClick={handleAddNew}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-zinc-800"
            >
              <Plus size={18} className="text-blue-400 shrink-0" />
              <span className="flex-1 text-sm text-blue-400 truncate">
                Adaugă „{searchQuery.trim()}"
              </span>
            </button>
          )}

          {filteredItems.length === 0 && !showCreate && (
            <div className="px-4 py-6 text-center text-sm text-zinc-500">
              {searchQuery.trim() ? 'Niciun rezultat' : emptyLabel}
            </div>
          )}
        </div>

        {multiSelect && (
          <div className="flex gap-3 px-4 mt-4">
            <button
              onClick={onClose}
              className="flex-1 h-11 rounded-xl bg-zinc-800 text-sm text-zinc-300 active:bg-zinc-700"
            >
              Anulează
            </button>
            <button
              onClick={() => confirm(tempSelected)}
              className={`flex-1 h-11 rounded-xl text-sm font-medium text-white flex items-center justify-center gap-2 ${saveButtonClass}`}
            >
              {SaveIcon && <SaveIcon size={18} className="text-white shrink-0" />}
              {saveButtonLabel}
            </button>
          </div>
        )}
      </div>
    </BottomSheet>
  )
}
