import { useEffect, useState, useMemo, useCallback } from 'react'
import {
  X, Check, RotateCcw, Folder, Tag, List, SlidersHorizontal
} from 'lucide-react'
import BottomSheet from './BottomSheet'
import { useCatalogStore } from '../../store/useCatalogStore'
import { useAppStore } from '../../store/useAppStore'
import { normalize } from '../../lib/search'
import {
  computeFilteredProductIds,
  computeFacetedCountsForDimension
} from '../../lib/filterEngine'

export default function FilterSheet({
  open,
  onClose,
  title = 'Filtrare Catalog',
  showCategoryDim = true,
  fixedCategoryId = null,
  initialFilters = {},
  onApply,
}) {
  const nodes = useCatalogStore((s) => s.nodes)
  const products = useCatalogStore((s) => s.products)
  const categoryAttributes = useCatalogStore((s) => s.categoryAttributes)
  const filterIndices = useCatalogStore((s) => s.filterIndices)
  const fetchFilterIdx = useCatalogStore((s) => s.fetchFilterIdx)

  // Căutare din BottomBar (SPEC_LocalFilter_v3 §2.3)
  const searchQuery = useAppStore((s) => s.searchQuery)
  const setSearchPlaceholder = useAppStore((s) => s.setSearchPlaceholder)
  const clearSearch = useAppStore((s) => s.clearSearch)

  // Filtre locale în starea sheet-ului: { [dimKey]: string[] }
  const [draftFilters, setDraftFilters] = useState(initialFilters)
  const [activeDimKey, setActiveDimKey] = useState(showCategoryDim ? 'category' : 'tags')

  // 1. Asigurare încărcare indexuri la deschidere + setare stare inițială
  useEffect(() => {
    if (!open) return
    setDraftFilters(initialFilters)
    clearSearch()

    // Încarcă indexul global
    fetchFilterIdx('global')

    // Încarcă indexul categoriei dacă e fixă sau dacă era selectată
    const targetCatId = fixedCategoryId || initialFilters.category?.[0]
    if (targetCatId) {
      fetchFilterIdx('category', targetCatId)
      if (!showCategoryDim) {
        const catAttrs = categoryAttributes.filter(
          (a) => a.categoryId === targetCatId && a.filterable
        )
        if (catAttrs.length > 0) setActiveDimKey(catAttrs[0].id)
        else setActiveDimKey('tags')
      }
    } else if (showCategoryDim) {
      setActiveDimKey('category')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Categoriile disponibile ca dimensiune (doar cele de tip 'category')
  const allCategories = useMemo(
    () => nodes.filter((n) => n.type === 'category' && !n.deletedAt && !n.isTemp),
    [nodes]
  )

  // Categoria selectată în prezent
  const currentSelectedCatId = fixedCategoryId || draftFilters.category?.[0] || null

  // Încărcare index per-categorie când se schimbă categoria selectată
  useEffect(() => {
    if (currentSelectedCatId) {
      fetchFilterIdx('category', currentSelectedCatId)
    }
  }, [currentSelectedCatId, fetchFilterIdx])

  // Atributele categoriei curente (doar cele filterable)
  const activeCategoryAttributes = useMemo(() => {
    if (!currentSelectedCatId) return []
    return categoryAttributes
      .filter((a) => a.categoryId === currentSelectedCatId && a.filterable)
      .sort((a, b) => a.position - b.position)
  }, [currentSelectedCatId, categoryAttributes])

  // 2. Construcția listei de dimensiuni (coloana din stânga)
  const dimensions = useMemo(() => {
    const list = []

    if (showCategoryDim && !fixedCategoryId) {
      list.push({
        key: 'category',
        name: 'Categorie',
        icon: Folder,
        isSingle: true,
        badgeCount: draftFilters.category?.length || 0,
      })
    }

    // Tags
    list.push({
      key: 'tags',
      name: 'Tags',
      icon: Tag,
      isSingle: false,
      badgeCount: draftFilters.tags?.length || 0,
    })

    // Atribute locale de categorie
    for (const attr of activeCategoryAttributes) {
      list.push({
        key: attr.id,
        name: attr.name,
        icon: List,
        isSingle: false,
        badgeCount: draftFilters[attr.id]?.length || 0,
      })
    }

    return list
  }, [showCategoryDim, fixedCategoryId, draftFilters, activeCategoryAttributes])

  // Asigură că activeDimKey este valid
  useEffect(() => {
    if (dimensions.length > 0 && !dimensions.some((d) => d.key === activeDimKey)) {
      setActiveDimKey(dimensions[0].key)
    }
  }, [dimensions, activeDimKey])

  // Setare placeholder contextual în BottomBar în funcție de dimensiunea activă
  useEffect(() => {
    if (!open) return
    const activeDim = dimensions.find((d) => d.key === activeDimKey)
    if (activeDim) {
      setSearchPlaceholder(`Caută în ${activeDim.name}...`)
    } else {
      setSearchPlaceholder('Caută opțiuni...')
    }
  }, [open, activeDimKey, dimensions, setSearchPlaceholder])

  // Resetare placeholder și search la închiderea dialogului
  useEffect(() => {
    if (!open) return
    return () => {
      clearSearch()
      setSearchPlaceholder(showCategoryDim ? 'Caută categorie sau folder...' : 'Caută produs în categorie...')
    }
  }, [open, clearSearch, setSearchPlaceholder, showCategoryDim])

  // Titlu dinamic: include categoria selectată
  const dynamicTitle = useMemo(() => {
    if (currentSelectedCatId) {
      const cat = nodes.find((n) => n.id === currentSelectedCatId)
      if (cat) {
        if (showCategoryDim) return `${title} — ${cat.name}`
        return `Filtrare: ${cat.name}`
      }
    }
    return title
  }, [currentSelectedCatId, nodes, title, showCategoryDim])

  // 3. Indexuri pregătite pentru filterEngine
  const indicesForEngine = useMemo(() => {
    const categoryIndices = {}
    for (const [key, val] of Object.entries(filterIndices)) {
      if (key.startsWith('category:')) {
        const catId = key.split(':')[1]
        categoryIndices[catId] = val
      }
    }
    return {
      global: filterIndices.global || {},
      categoryIndices,
    }
  }, [filterIndices])

  // 4. Calculul rezultatelor curente
  const matchingProductIds = useMemo(() => {
    return computeFilteredProductIds({
      activeFilters: draftFilters,
      indices: indicesForEngine,
      products,
      fixedCategoryId,
    })
  }, [draftFilters, indicesForEngine, products, fixedCategoryId])

  // 5. Lista de valori posibile pentru dimensiunea activă
  const activeDimValues = useMemo(() => {
    if (!activeDimKey) return []

    if (activeDimKey === 'category') {
      return allCategories.map((c) => ({
        value: c.id,
        label: c.name,
      }))
    }

    if (activeDimKey === 'tags') {
      const globalTags = filterIndices.global?.tags || []
      return globalTags.map((t) => ({
        value: t.value,
        label: t.value,
      }))
    }

    // Atribut de categorie
    const globalBucket = filterIndices.global?.[activeDimKey]
    const catBucket = currentSelectedCatId
      ? filterIndices[`category:${currentSelectedCatId}`]?.[activeDimKey]
      : null
    const bucket = globalBucket || catBucket || []

    return bucket.map((b) => ({
      value: b.value,
      label: b.value,
    }))
  }, [activeDimKey, allCategories, filterIndices, currentSelectedCatId])

  // 6. Contoare faceted pentru dimensiunea activă
  const facetedCounts = useMemo(() => {
    if (!activeDimKey || activeDimValues.length === 0) return {}
    return computeFacetedCountsForDimension({
      dimKey: activeDimKey,
      values: activeDimValues.map((v) => v.value),
      activeFilters: draftFilters,
      indices: indicesForEngine,
      products,
      fixedCategoryId,
    })
  }, [activeDimKey, activeDimValues, draftFilters, indicesForEngine, products, fixedCategoryId])

  // Filtrare valori după căutarea din BottomBar
  const filteredValues = useMemo(() => {
    const q = normalize(searchQuery.trim())
    if (!q) return activeDimValues
    return activeDimValues.filter((v) => normalize(v.label).includes(q))
  }, [activeDimValues, searchQuery])

  // Handlers pentru bifare/debifare
  const handleToggleValue = useCallback((dimKey, value) => {
    setDraftFilters((prev) => {
      const next = { ...prev }
      if (dimKey === 'category') {
        // Categorie e single-select
        if (prev.category?.[0] === value) {
          delete next.category
          // Curățăm și filtrele de atribute locale când se debifează categoria
          for (const attr of activeCategoryAttributes) {
            delete next[attr.id]
          }
        } else {
          next.category = [value]
        }
      } else {
        const curList = prev[dimKey] || []
        if (curList.includes(value)) {
          const filtered = curList.filter((v) => v !== value)
          if (filtered.length === 0) delete next[dimKey]
          else next[dimKey] = filtered
        } else {
          next[dimKey] = [...curList, value]
        }
      }
      return next
    })
  }, [activeCategoryAttributes])

  const handleResetAll = useCallback(() => {
    setDraftFilters({})
    clearSearch()
  }, [clearSearch])

  const handleConfirm = useCallback(() => {
    clearSearch()
    onApply?.(draftFilters, matchingProductIds)
    onClose?.()
  }, [draftFilters, matchingProductIds, onApply, onClose, clearSearch])

  const totalActiveFilterCount = useMemo(() => {
    let count = 0
    for (const vals of Object.values(draftFilters)) {
      count += vals.length
    }
    return count
  }, [draftFilters])

  if (!open) return null

  return (
    <BottomSheet open={open} onClose={onClose} aboveBottomBar={true}>
      <div className="flex flex-col h-[65dvh] max-h-[560px] text-zinc-100">
        {/* Header Dialog cu titlu dinamic și spațiere generoasă */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-2 min-w-0 pr-2">
            <SlidersHorizontal size={18} className="text-blue-400 shrink-0" />
            <h2 className="text-sm font-semibold text-zinc-100 truncate">{dynamicTitle}</h2>
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

        {/* Corp cu 2 coloane cu padding-uri la margini */}
        <div className="flex flex-1 min-h-0 divide-x divide-zinc-800 overflow-hidden">
          {/* Coloana Stângă: Dimensiuni (~38% lățime) */}
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

          {/* Coloana Dreaptă: Valori cu Checkbox și Contoare (filtrate prin BottomBar) */}
          <div className="flex-1 flex flex-col min-h-0 px-2 py-2 overflow-y-auto space-y-1 bg-zinc-900/30">
            {filteredValues.map((v) => {
              const isSelected = activeDimKey === 'category'
                ? draftFilters.category?.[0] === v.value
                : (draftFilters[activeDimKey] || []).includes(v.value)
              const count = facetedCounts[v.value] ?? 0
              const isDisabled = count === 0 && !isSelected

              return (
                <button
                  key={v.value}
                  disabled={isDisabled}
                  onClick={() => handleToggleValue(activeDimKey, v.value)}
                  className={[
                    'w-full flex items-center gap-2.5 px-3 py-2.5 text-left rounded-xl transition-colors',
                    isSelected ? 'bg-blue-950/40 text-zinc-100' : 'text-zinc-300 active:bg-zinc-800/60',
                    isDisabled ? 'opacity-35 cursor-not-allowed' : 'hover:bg-zinc-800/40',
                  ].join(' ')}
                >
                  {/* Checkbox sau Radio */}
                  <div
                    className={[
                      'w-4 h-4 flex items-center justify-center border shrink-0 transition-colors',
                      activeDimKey === 'category' ? 'rounded-full' : 'rounded-md',
                      isSelected
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : 'border-zinc-700 bg-zinc-800/60',
                    ].join(' ')}
                  >
                    {isSelected && <Check size={11} strokeWidth={3} />}
                  </div>

                  {/* Denumire valoare */}
                  <span className="flex-1 text-xs truncate">{v.label}</span>

                  {/* Contor live faceted */}
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

        {/* Footer Acțiuni: Resetează + Arată produsele (N) */}
        <div className="flex items-center gap-3 px-4 py-3 border-t border-zinc-800 bg-zinc-950 shrink-0">
          <button
            onClick={handleResetAll}
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
            onClick={handleConfirm}
            className="flex-1 flex items-center justify-center h-11 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-xs font-semibold text-white shadow-lg transition-colors"
          >
            Arată produsele ({matchingProductIds.size})
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}
