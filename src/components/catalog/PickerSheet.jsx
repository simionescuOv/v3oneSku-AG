import { useEffect, useState } from 'react'
import { Plus, Square, CheckSquare, Check } from 'lucide-react'
import BottomSheet from './BottomSheet'
import { usePicker } from '../../hooks/usePicker'
import { useAppStore } from '../../store/useAppStore'

// Picker generic în modul „cu căutare" (SPEC_Picker_v2 §4.5, SPEC_Tags §4):
// BottomBar rămâne vizibil și inputul lui filtrează lista — fără input propriu
// de căutare în sheet. Se deschide prin SWAP din sheet-ul părinte (SPEC_Tags §5):
// părintele se ascunde vizual, picker-ul îi ia locul, la confirmare/anulare
// părintele revine cu starea intactă.
//
// multiSelect: checkbox + selecție temporară + „Salvează" (tags).
// single-select: tap pe rând confirmă imediat (single_choice).
// allowCreate: rând „+ Adaugă «query»" pe potrivire inexactă normalizată —
// elementul nou intră doar în lista locală a picker-ului; persistența e
// responsabilitatea părintelui (onConfirm primește și lista `created`).
export default function PickerSheet({
  open,
  title,
  items = [],                 // [{ value, count? }] — pre-sortate de părinte
  selected = [],              // string[] — selecția curentă din formular
  multiSelect = false,
  allowCreate = false,
  searchPlaceholder = 'Caută...',
  restorePlaceholder = 'Caută...',
  emptyLabel = 'Nicio valoare încă',
  onConfirm,                  // ({ selected: string[], created: string[] }) => void
  onClose,
}) {
  const searchQuery = useAppStore((s) => s.searchQuery)
  const setSearchPlaceholder = useAppStore((s) => s.setSearchPlaceholder)
  const clearSearch = useAppStore((s) => s.clearSearch)

  const [tempSelected, setTempSelected] = useState([])
  const [created, setCreated] = useState([])

  useEffect(() => {
    if (!open) return
    setTempSelected([...selected])
    setCreated([])
    clearSearch()
    setSearchPlaceholder(searchPlaceholder)
    return () => {
      clearSearch()
      setSearchPlaceholder(restorePlaceholder)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

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
  })

  if (!open) return null

  const confirm = (sel, extraCreated = created) =>
    onConfirm?.({
      selected: sel,
      created: extraCreated.filter((c) => sel.includes(c)),
    })

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
              className="flex-1 h-11 rounded-xl bg-blue-600 text-sm font-medium text-white active:bg-blue-700"
            >
              Salvează
            </button>
          </div>
        )}
      </div>
    </BottomSheet>
  )
}
