import { useEffect, useMemo } from 'react'
import { X, Check, RotateCcw, SlidersHorizontal } from 'lucide-react'
import BottomSheet from './BottomSheet'
import { useAppStore } from '../../store/useAppStore'
import { normalize } from '../../lib/search'

export default function BaseFilterSheet({
  open,
  onClose,
  dynamicTitle,
  totalAccessibleCount,
  matchingCount,
  totalActiveFilterCount,
  dimensions,
  activeDimKey,
  setActiveDimKey,
  activeDimValues,
  facetedCounts,
  draftFilters,
  onToggleValue,
  onResetAll,
  onConfirm,
  submitLabel = 'Arată rezultatele'
}) {
  const searchQuery = useAppStore((s) => s.searchQuery)
  const setSearchPlaceholder = useAppStore((s) => s.setSearchPlaceholder)
  const clearSearch = useAppStore((s) => s.clearSearch)

  // Asigură că activeDimKey este valid
  useEffect(() => {
    if (dimensions.length > 0 && !dimensions.some((d) => d.key === activeDimKey)) {
      setActiveDimKey(dimensions[0].key)
    }
  }, [dimensions, activeDimKey, setActiveDimKey])

  // Setare placeholder
  useEffect(() => {
    if (!open) return
    const activeDim = dimensions.find((d) => d.key === activeDimKey)
    if (activeDim) {
      setSearchPlaceholder(`Caută în ${activeDim.name}...`)
    } else {
      setSearchPlaceholder('Caută opțiuni...')
    }
  }, [open, activeDimKey, dimensions, setSearchPlaceholder])

  // Filtrare și sortare inteligentă
  const filteredValues = useMemo(() => {
    const q = normalize(searchQuery.trim())
    let items = activeDimValues || []
    if (q) {
      items = items.filter((v) => normalize(v.label).includes(q))
    }

    const activeDim = dimensions.find(d => d.key === activeDimKey)
    const isCategory = activeDimKey === 'category'

    return [...items].sort((a, b) => {
      if (isCategory) {
        return normalize(a.label).localeCompare(normalize(b.label))
      }

      const isSelA = (draftFilters[activeDimKey] || []).includes(a.value) ? 1 : 0
      const isSelB = (draftFilters[activeDimKey] || []).includes(b.value) ? 1 : 0
      
      if (isSelA !== isSelB) return isSelB - isSelA

      const countA = facetedCounts[a.value] || 0
      const countB = facetedCounts[b.value] || 0

      const hasA = countA > 0 ? 1 : 0
      const hasB = countB > 0 ? 1 : 0

      if (hasA !== hasB) return hasB - hasA
      if (countA !== countB) return countB - countA

      return normalize(a.label).localeCompare(normalize(b.label))
    })
  }, [activeDimKey, activeDimValues, draftFilters, searchQuery, facetedCounts, dimensions])

  if (!open) return null

  const activeDim = dimensions.find(d => d.key === activeDimKey)

  return (
    <BottomSheet open={open} onClose={onClose} aboveBottomBar={true}>
      <div className="flex flex-col h-[65dvh] max-h-[560px] text-zinc-100">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-2 min-w-0 pr-2">
            <SlidersHorizontal size={18} className="text-blue-400 shrink-0" />
            <h2 className="text-sm font-semibold text-zinc-100 truncate">
              {dynamicTitle} <span className="text-zinc-500 font-normal ml-1">({totalAccessibleCount})</span>
            </h2>
            {totalActiveFilterCount > 0 && (
              <span className="text-[11px] font-medium bg-blue-600 text-white px-2 py-0.5 rounded-full shrink-0">
                {totalActiveFilterCount}
              </span>
            )}
          </div>
          <button
            onClick={() => {
              clearSearch()
              onClose?.()
            }}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-200 active:bg-zinc-800 shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-1 min-h-0 divide-x divide-zinc-800 overflow-hidden">
          <div className="w-[38%] overflow-y-auto px-2 py-2 space-y-1 bg-zinc-950/40 shrink-0">
            {dimensions.map((dim) => {
              const Icon = dim.icon
              const isSelected = activeDimKey === dim.key
              return (
                <button
                  key={dim.key}
                  onClick={() => {
                    setActiveDimKey(dim.key)
                    clearSearch()
                  }}
                  className={[
                    'w-full flex items-center gap-2 px-3 py-2.5 text-left rounded-xl transition-colors',
                    isSelected
                      ? 'bg-zinc-800 text-blue-400 font-medium'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 active:bg-zinc-800',
                  ].join(' ')}
                >
                  <Icon size={15} className={isSelected ? 'text-blue-400 shrink-0' : 'text-zinc-500 shrink-0'} />
                  <span className="flex-1 text-xs truncate">{dim.name}</span>
                  {dim.badgeCount > 0 && (
                    <span className="shrink-0 text-[10px] font-semibold bg-blue-600 text-white px-1.5 py-0.2 rounded-full min-w-4 text-center">
                      {dim.badgeCount}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          <div className="flex-1 flex flex-col min-h-0 px-2 py-2 overflow-y-auto space-y-1 bg-zinc-900/30">
            {filteredValues.map((v) => {
              const isSelected = activeDim?.isSingle
                ? draftFilters[activeDimKey]?.[0] === v.value
                : (draftFilters[activeDimKey] || []).includes(v.value)
              const count = facetedCounts[v.value] ?? 0
              const isDisabled = count === 0 && !isSelected

              return (
                <button
                  key={v.value}
                  disabled={isDisabled}
                  onClick={() => onToggleValue(activeDimKey, v.value, activeDim?.isSingle)}
                  className={[
                    'w-full flex items-center gap-2.5 px-3 py-2.5 text-left rounded-xl transition-colors',
                    isSelected ? 'bg-blue-950/40 text-zinc-100' : 'text-zinc-300 active:bg-zinc-800/60',
                    isDisabled ? 'opacity-35 cursor-not-allowed' : 'hover:bg-zinc-800/40',
                  ].join(' ')}
                >
                  <div
                    className={[
                      'w-4 h-4 flex items-center justify-center border shrink-0 transition-colors',
                      activeDim?.isSingle ? 'rounded-full' : 'rounded-md',
                      isSelected
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : 'border-zinc-700 bg-zinc-800/60',
                    ].join(' ')}
                  >
                    {isSelected && <Check size={11} strokeWidth={3} />}
                  </div>
                  <span className="flex-1 text-xs truncate">{v.label}</span>
                  <span
                    className={[
                      'text-[11px] font-medium shrink-0',
                      isSelected ? 'text-blue-400' : 'text-zinc-500',
                    ].join(' ')}
                  >
                    ({count})
                  </span>
                </button>
              )
            })}

            {filteredValues.length === 0 && (
              <div className="py-12 text-center text-xs text-zinc-500">
                {searchQuery.trim() ? `Nicio opțiune pentru „${searchQuery.trim()}”` : 'Nicio valoare disponibilă'}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 px-4 py-3 border-t border-zinc-800 bg-zinc-950 shrink-0">
          <button
            onClick={onResetAll}
            disabled={totalActiveFilterCount === 0}
            className={[
              'flex items-center justify-center gap-1.5 h-11 px-4 rounded-xl text-xs font-medium transition-colors shrink-0',
              totalActiveFilterCount > 0
                ? 'text-zinc-300 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600'
                : 'text-zinc-600 bg-zinc-900/50 cursor-not-allowed',
            ].join(' ')}
          >
            <RotateCcw size={14} />
            <span>Resetează</span>
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 flex items-center justify-center h-11 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-xs font-semibold text-white shadow-lg transition-colors"
          >
            {submitLabel} ({matchingCount})
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}
