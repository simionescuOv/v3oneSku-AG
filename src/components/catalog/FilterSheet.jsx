import { useEffect, useState, useMemo, useCallback } from 'react'
import { Folder, Tag, List } from 'lucide-react'
import { useCatalogStore } from '../../store/useCatalogStore'
import { useAppStore } from '../../store/useAppStore'
import {
  computeFilteredProductIds,
  computeFacetedCountsForDimension
} from '../../lib/filterEngine'
import BaseFilterSheet from './BaseFilterSheet'

export default function FilterSheet({
  open,
  onClose,
  title = 'Filtrare Catalog',
  showCategoryDim = true,
  fixedCategoryId = null,
  initialFilters = {},
  onApply,
  baseProductIds = null,
}) {
  const nodes = useCatalogStore((s) => s.nodes)
  const allCatalogProducts = useCatalogStore((s) => s.products)
  const categoryAttributes = useCatalogStore((s) => s.categoryAttributes)
  const filterIndices = useCatalogStore((s) => s.filterIndices)
  const fetchFilterIdx = useCatalogStore((s) => s.fetchFilterIdx)
  
  const clearSearch = useAppStore((s) => s.clearSearch)

  const products = useMemo(() => {
    if (!baseProductIds) return allCatalogProducts
    const pidSet = baseProductIds instanceof Set ? baseProductIds : new Set(baseProductIds)
    return allCatalogProducts.filter(p => pidSet.has(p.id))
  }, [allCatalogProducts, baseProductIds])

  const [draftFilters, setDraftFilters] = useState(initialFilters)
  const [activeDimKey, setActiveDimKey] = useState(showCategoryDim ? 'category' : 'tags')

  useEffect(() => {
    if (!open) return
    setDraftFilters(initialFilters)
    clearSearch()

    fetchFilterIdx('global')

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

  const allCategories = useMemo(
    () => nodes.filter((n) => n.type === 'category' && !n.deletedAt && !n.isTemp),
    [nodes]
  )

  const currentSelectedCatId = fixedCategoryId || draftFilters.category?.[0] || null

  useEffect(() => {
    if (currentSelectedCatId) {
      fetchFilterIdx('category', currentSelectedCatId)
    }
  }, [currentSelectedCatId, fetchFilterIdx])

  const activeCategoryAttributes = useMemo(() => {
    if (!currentSelectedCatId) return []
    return categoryAttributes
      .filter((a) => a.categoryId === currentSelectedCatId && a.filterable)
      .sort((a, b) => a.position - b.position)
  }, [currentSelectedCatId, categoryAttributes])

  const dimensions = useMemo(() => {
    const list = []
    if (showCategoryDim && !fixedCategoryId) {
      list.push({ key: 'category', name: 'Categorie', icon: Folder, isSingle: true, badgeCount: draftFilters.category?.length || 0 })
    }
    list.push({ key: 'tags', name: 'Tags', icon: Tag, isSingle: false, badgeCount: draftFilters.tags?.length || 0 })
    for (const attr of activeCategoryAttributes) {
      list.push({ key: attr.id, name: attr.name, icon: List, isSingle: false, badgeCount: draftFilters[attr.id]?.length || 0 })
    }
    return list
  }, [showCategoryDim, fixedCategoryId, draftFilters, activeCategoryAttributes])

  const dynamicTitle = useMemo(() => {
    const baseTitle = title.replace(/^Filtrare\s+/i, '').replace(/^Filtrare:\s*/i, '')
    if (currentSelectedCatId) {
      const cat = nodes.find((n) => n.id === currentSelectedCatId)
      if (cat) {
        if (showCategoryDim) {
          return (
            <span className="flex items-center min-w-0 flex-1">
              <span className="truncate shrink">{baseTitle}</span>
              <span className="shrink-0 whitespace-nowrap">&nbsp;/ {cat.name}</span>
            </span>
          )
        }
        return <span className="truncate shrink-0">{cat.name}</span>
      }
    }
    return <span className="truncate shrink-0">{baseTitle}</span>
  }, [currentSelectedCatId, nodes, title, showCategoryDim])

  const indicesForEngine = useMemo(() => {
    const categoryIndices = {}
    for (const [key, val] of Object.entries(filterIndices)) {
      if (key.startsWith('category:')) {
        const catId = key.split(':')[1]
        categoryIndices[catId] = val
      }
    }
    return { global: filterIndices.global || {}, categoryIndices }
  }, [filterIndices])

  const matchingProductIds = useMemo(() => {
    return computeFilteredProductIds({ activeFilters: draftFilters, indices: indicesForEngine, products, fixedCategoryId })
  }, [draftFilters, indicesForEngine, products, fixedCategoryId])

  const totalAccessibleCount = useMemo(() => {
    return computeFilteredProductIds({ activeFilters: {}, indices: indicesForEngine, products, fixedCategoryId }).size
  }, [indicesForEngine, products, fixedCategoryId])

  const activeDimValues = useMemo(() => {
    if (!activeDimKey) return []
    if (activeDimKey === 'category') return allCategories.map((c) => ({ value: c.id, label: c.name }))
    if (activeDimKey === 'tags') return (filterIndices.global?.tags || []).map((t) => ({ value: t.value, label: t.value }))
    const bucket = filterIndices.global?.[activeDimKey] || (currentSelectedCatId ? filterIndices[`category:${currentSelectedCatId}`]?.[activeDimKey] : null) || []
    return bucket.map((b) => ({ value: b.value, label: b.value }))
  }, [activeDimKey, allCategories, filterIndices, currentSelectedCatId])

  const facetedCounts = useMemo(() => {
    if (!activeDimKey || activeDimValues.length === 0) return {}
    return computeFacetedCountsForDimension({ dimKey: activeDimKey, values: activeDimValues.map((v) => v.value), activeFilters: draftFilters, indices: indicesForEngine, products, fixedCategoryId })
  }, [activeDimKey, activeDimValues, draftFilters, indicesForEngine, products, fixedCategoryId])

  const handleToggleValue = useCallback((dimKey, value, isSingle) => {
    setDraftFilters((prev) => {
      const next = { ...prev }
      if (isSingle) {
        if (prev[dimKey]?.[0] === value) {
          delete next[dimKey]
          if (dimKey === 'category') {
            for (const attr of activeCategoryAttributes) delete next[attr.id]
          }
        } else {
          next[dimKey] = [value]
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
    return Object.values(draftFilters).reduce((sum, vals) => sum + vals.length, 0)
  }, [draftFilters])

  return (
    <BaseFilterSheet
      open={open}
      onClose={onClose}
      dynamicTitle={dynamicTitle}
      totalAccessibleCount={totalAccessibleCount}
      matchingCount={matchingProductIds.size}
      totalActiveFilterCount={totalActiveFilterCount}
      dimensions={dimensions}
      activeDimKey={activeDimKey}
      setActiveDimKey={setActiveDimKey}
      activeDimValues={activeDimValues}
      facetedCounts={facetedCounts}
      draftFilters={draftFilters}
      onToggleValue={handleToggleValue}
      onResetAll={handleResetAll}
      onConfirm={handleConfirm}
      submitLabel="Arată produsele"
    />
  )
}
