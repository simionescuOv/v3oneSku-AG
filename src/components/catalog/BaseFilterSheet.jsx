import { useEffect, useMemo, useState, useRef } from 'react'
import { X, Check, RotateCcw, SlidersHorizontal } from 'lucide-react'
import BottomSheet from './BottomSheet'
import { useAppStore, useActiveSearchQuery } from '../../store/useAppStore'
import { normalize } from '../../lib/search'
import { useAutocompleteGhost } from '../../hooks/useAutocompleteGhost'

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
  const pushSearchContext = useAppStore((s) => s.pushSearchContext)
  const popSearchContext = useAppStore((s) => s.popSearchContext)
  const clearSearch = useAppStore((s) => s.clearSearch)
  const setSearchPlaceholder = useAppStore((s) => s.setSearchPlaceholder)

  const activeContext = useAppStore(s => s.searchContextStack[s.searchContextStack.length - 1])
  const isMySearch = activeContext === 'filter_sheet'
  const effectiveQuery = useActiveSearchQuery('filter_sheet')

  useEffect(() => {
    if (open) {
      pushSearchContext('filter_sheet')
      return () => {
        popSearchContext('filter_sheet')
        clearSearch()
      }
    }
  }, [open, pushSearchContext, popSearchContext, clearSearch])

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
    const q = normalize(effectiveQuery.trim())
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
  }, [activeDimKey, activeDimValues, draftFilters, effectiveQuery, facetedCounts, dimensions])

  useAutocompleteGhost(open && isMySearch, effectiveQuery, filteredValues, (v) => v.label)

  const [isScrolling, setIsScrolling] = useState(false)
  const scrollTimeoutRef = useRef(null)

  const handleScroll = () => {
    setIsScrolling(true)
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current)
    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false)
    }, 250)
  }

  if (!open) return null

  const activeDim = dimensions.find(d => d.key === activeDimKey)

  return (
    <BottomSheet open={open} onClose={onClose} aboveBottomBar={true}>
      <div className="flex flex-col relative overflow-hidden h-[65dvh] max-h-[560px] text-zinc-100">
        <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-1.5 min-w-0 pr-1 flex-1">
            <SlidersHorizontal size={17} className="text-blue-400 shrink-0" />
            <h2 className="flex items-center flex-1 min-w-0 text-sm font-semibold text-zinc-100">
              {dynamicTitle}
              <span className="text-zinc-500 font-normal ml-1.5 shrink-0">{matchingCount} / {totalAccessibleCount}</span>
            </h2>
            {totalActiveFilterCount > 0 && (
              <span className="text-[11px] font-medium bg-blue-600 text-white px-2 py-0.5 rounded-full shrink-0 ml-1">
                {totalActiveFilterCount}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-1 min-h-0 divide-x divide-zinc-800 overflow-hidden">
          <div 
            className="w-[45%] overflow-y-auto px-2 pt-2 pb-16 space-y-1 bg-zinc-950/40 shrink-0"
            onScroll={handleScroll}
          >
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
                    'w-full flex items-center gap-1.5 pl-1.5 pr-2 py-2.5 text-left rounded-xl transition-colors',
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

          <div 
            className="flex-1 flex flex-col min-h-0 pl-1 pr-2 pt-2 pb-16 overflow-y-auto space-y-1 bg-zinc-900/30"
            onScroll={handleScroll}
          >
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
                    'w-full flex items-center gap-2 pl-1 pr-2 py-2.5 text-left rounded-xl transition-colors',
                    isSelected ? 'bg-blue-950/40 text-zinc-100' : 'text-zinc-300 active:bg-zinc-800/60',
                    isDisabled ? 'opacity-35 cursor-not-allowed' : 'hover:bg-zinc-800/40',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'text-xs font-bold shrink-0 w-[20px] text-right',
                      isSelected ? 'text-white' : 'text-zinc-100',
                    ].join(' ')}
                  >
                    {count}
                  </span>
                  <span className="flex-1 text-xs truncate">{v.label}</span>
                  <div className="w-4 h-4 flex items-center justify-end shrink-0">
                    {isSelected && <Check size={16} strokeWidth={3.5} className="text-blue-500" />}
                  </div>
                </button>
              )
            })}

            {filteredValues.length === 0 && (
              <div className="py-12 text-center text-xs text-zinc-500">
                {effectiveQuery.trim() ? `Nicio opțiune pentru „${effectiveQuery.trim()}”` : 'Nicio valoare disponibilă'}
              </div>
            )}
          </div>
        </div>

        <div 
          className={[
            'absolute bottom-0 left-0 right-0 z-20 flex items-center gap-2.5 px-4 py-1.5 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur-md transition-transform duration-300 ease-in-out',
            isScrolling ? 'translate-y-[120%]' : 'translate-y-0'
          ].join(' ')}
        >
          <button
            onClick={onResetAll}
            disabled={totalActiveFilterCount === 0}
            className={[
              'flex items-center justify-center py-1 px-3 rounded-lg transition-colors shrink-0',
              totalActiveFilterCount > 0
                ? 'text-zinc-300 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600'
                : 'text-zinc-600 bg-zinc-900/50 cursor-not-allowed',
            ].join(' ')}
          >
            <RotateCcw size={16} />
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 flex items-center justify-center gap-1 py-1 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-sm leading-tight font-semibold text-white shadow-lg transition-colors min-w-0"
          >
            <span className="truncate">{submitLabel}</span>
            <span className="shrink-0">({matchingCount})</span>
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}
