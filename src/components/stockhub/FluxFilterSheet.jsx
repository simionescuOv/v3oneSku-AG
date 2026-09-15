import { useState, useEffect, useMemo, useCallback } from 'react'
import { SlidersHorizontal, Calendar, ArrowLeftRight, Box, Folder, Tag, List, CheckSquare, Square } from 'lucide-react'
import BaseFilterSheet from '../catalog/BaseFilterSheet'
import { useFluxStore } from '../../store/useFluxStore'
import { useStockStore } from '../../store/useStockStore'
import { useCatalogStore } from '../../store/useCatalogStore'

const PERIODS = [
  { key: 'today', label: 'Azi' },
  { key: '7days', label: '7 Zile' },
  { key: 'month', label: 'Luna curentă' },
  { key: 'all', label: 'Toate' },
]

const GRANULARITIES = [
  { key: 'transaction', label: 'Tranzacție' },
  { key: 'daily', label: 'Zi' },
  { key: 'weekly', label: 'Săpt.' },
  { key: 'monthly', label: 'Lună' },
]

function formatHeaderLabel(filter) {
  const periodLabel = PERIODS.find((p) => p.key === filter.period)?.label ?? 'Fără perioadă'
  const granLabel = GRANULARITIES.find((g) => g.key === filter.granularity)?.label ?? 'Tranzacție'
  if (filter.period === 'custom') {
    const from = filter.from ? new Date(filter.from).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' }) : '?'
    const to = filter.to ? new Date(filter.to).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' }) : '?'
    return `${from} – ${to} · ${granLabel}`
  }
  if (!filter.period) return 'Fără filtru'
  return `${periodLabel} · ${granLabel}`
}

export function PeriodPopover({ draft, onChangeDraft, onClose, className = "absolute top-full right-0 mt-1 w-[260px]" }) {
  return (
    <div className={`z-50 bg-zinc-900 border border-zinc-700 rounded-2xl shadow-xl p-4 space-y-4 ${className}`}>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">Perioadă</p>
        <div className="flex flex-wrap gap-2">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => {
                onChangeDraft({ ...draft, period: p.key, from: null, to: null })
                onClose()
              }}
              className={[
                'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                draft.period === p.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-zinc-800 text-zinc-300 active:bg-zinc-700',
              ].join(' ')}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">Granularitate</p>
        <div className="flex gap-1 bg-zinc-800 rounded-xl p-1">
          {GRANULARITIES.map((g) => (
            <button
              key={g.key}
              onClick={() => onChangeDraft({ ...draft, granularity: g.key })}
              className={[
                'flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors',
                draft.granularity === g.key
                  ? 'bg-zinc-600 text-white'
                  : 'text-zinc-400 active:bg-zinc-700',
              ].join(' ')}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>
      <div className="pt-2 border-t border-zinc-800">
        <button
          onClick={() => onChangeDraft({ ...draft, showWholeTransaction: !(draft.showWholeTransaction ?? true) })}
          className="w-full flex items-center justify-between py-2 text-sm text-zinc-300 hover:text-zinc-100 transition-colors"
        >
          <span>Toată tranzacția</span>
          {(draft.showWholeTransaction ?? true) ? (
            <CheckSquare size={16} className="text-blue-400" />
          ) : (
            <Square size={16} className="text-zinc-500" />
          )}
        </button>
      </div>
    </div>
  )
}

export default function FluxFilterSheet({ open, onClose }) {
  const fluxFilter = useFluxStore((s) => s.fluxFilter)
  const applyFilter = useFluxStore((s) => s.applyFilter)
  const currentRawSource = useFluxStore((s) => s.currentRawSource)

  const spaces = useStockStore((s) => s.spaces)
  const physicalSpaces = useMemo(
    () => spaces.filter((s) => s.type === 'space'),
    [spaces]
  )

  const nodes = useCatalogStore((s) => s.nodes)
  const categoryAttributes = useCatalogStore((s) => s.categoryAttributes)
  const filterIndices = useCatalogStore((s) => s.filterIndices)

  const [draft, setDraft] = useState(fluxFilter)
  const [periodPopoverOpen, setPeriodPopoverOpen] = useState(false)
  const [activeDimKey, setActiveDimKey] = useState('types')

  useEffect(() => {
    if (!open) return
    setDraft(fluxFilter)
    setPeriodPopoverOpen(false)
  }, [open, fluxFilter])

  const allCategories = useMemo(
    () => nodes.filter((n) => n.type === 'category' && !n.deletedAt && !n.isTemp),
    [nodes]
  )

  const activeCategoryAttributes = useMemo(() => {
    if (!draft.categoryId) return []
    return categoryAttributes
      .filter((a) => a.categoryId === draft.categoryId && a.filterable)
      .sort((a, b) => a.position - b.position)
  }, [draft.categoryId, categoryAttributes])

  const availableTags = useMemo(
    () => (filterIndices.global?.tags ?? []).map((t) => t.value),
    [filterIndices]
  )

  const sheetDraft = useMemo(() => {
    const d = {}
    if (draft.types?.length > 0) d['types'] = draft.types
    if (draft.partnerSpaceId) d['partnerSpaceId'] = [draft.partnerSpaceId]
    if (draft.categoryId) d['categoryId'] = [draft.categoryId]
    if (draft.tags?.length > 0) d['tags'] = draft.tags
    if (draft.attributes) {
      Object.entries(draft.attributes).forEach(([k, v]) => {
        if (v?.length > 0) d[`attr:${k}`] = v
      })
    }
    return d
  }, [draft])

  // ── Extracție inteligentă (Faceted Index local) ──
  const activeFacetedSets = useMemo(() => {
    const spaceIds = new Set()
    const categoryIds = new Set()
    const tags = new Set()
    const attrs = {} // attrId -> Set of values

    if (currentRawSource) {
      for (const tx of currentRawSource) {
        if (tx.sourceSpaceId) spaceIds.add(tx.sourceSpaceId)
        if (tx.destinationSpaceId) spaceIds.add(tx.destinationSpaceId)

        if (tx.items) {
          for (const item of tx.items) {
            if (item.categoryId) categoryIds.add(item.categoryId)
            if (item.tags) {
              item.tags.forEach(t => tags.add(t))
            }
            if (item.attributes) {
              Object.entries(item.attributes).forEach(([k, v]) => {
                if (!attrs[k]) attrs[k] = new Set()
                attrs[k].add(v)
              })
            }
          }
        }
      }
    }
    return { spaceIds, categoryIds, tags, attrs }
  }, [currentRawSource])

  const dimensions = useMemo(() => {
    const dims = [
      { key: 'types', name: 'Tip Tranzacție', icon: ArrowLeftRight, isSingle: false },
    ]
    if (activeFacetedSets.spaceIds.size > 0) {
      dims.push({ key: 'partnerSpaceId', name: 'Spațiu Partener', icon: Box, isSingle: true })
    }
    if (activeFacetedSets.categoryIds.size > 0) {
      dims.push({ key: 'categoryId', name: 'Categorie', icon: Folder, isSingle: true })
    }
    if (activeFacetedSets.tags.size > 0) {
      dims.push({ key: 'tags', name: 'Tags', icon: Tag, isSingle: false })
    }
    activeCategoryAttributes.forEach(attr => {
      if (activeFacetedSets.attrs[attr.id]?.size > 0) {
        dims.push({ key: `attr:${attr.id}`, name: attr.name, icon: List, isSingle: false })
      }
    })
    
    dims.forEach(d => {
      d.badgeCount = (sheetDraft[d.key] || []).length
    })
    return dims
  }, [activeCategoryAttributes, sheetDraft, activeFacetedSets])

  const activeDimValues = useMemo(() => {
    if (!activeDimKey) return []
    if (activeDimKey === 'types') {
      return [
        { value: 'inbound', label: 'Intrare (Inbound)' },
        { value: 'outbound', label: 'Ieșire (Outbound)' }
      ]
    }
    if (activeDimKey === 'partnerSpaceId') {
      return physicalSpaces
        .filter(s => activeFacetedSets.spaceIds.has(s.id))
        .map(s => ({ value: s.id, label: s.name }))
    }
    if (activeDimKey === 'categoryId') {
      return allCategories
        .filter(c => activeFacetedSets.categoryIds.has(c.id))
        .map(c => ({ value: c.id, label: c.name }))
    }
    if (activeDimKey === 'tags') {
      return Array.from(activeFacetedSets.tags).map(t => ({ value: t, label: t }))
    }
    if (activeDimKey.startsWith('attr:')) {
      const attrId = activeDimKey.replace('attr:', '')
      const valuesSet = activeFacetedSets.attrs[attrId]
      if (!valuesSet) return []
      return Array.from(valuesSet).map(v => ({ value: v, label: v }))
    }
    return []
  }, [activeDimKey, physicalSpaces, allCategories, availableTags, filterIndices, draft.categoryId, activeFacetedSets])

  const handleToggleValue = useCallback((dimKey, value, isSingle) => {
    setDraft(prev => {
      const next = { ...prev }
      if (dimKey === 'types') {
        const arr = next.types || []
        if (arr.includes(value)) next.types = arr.filter(v => v !== value)
        else next.types = [...arr, value]
        if (next.types.length === 0) next.types = ['inbound', 'outbound']
      } 
      else if (dimKey === 'partnerSpaceId') {
        next.partnerSpaceId = next.partnerSpaceId === value ? null : value
      } 
      else if (dimKey === 'categoryId') {
        next.categoryId = next.categoryId === value ? null : value
        if (next.categoryId !== prev.categoryId) next.attributes = {}
      } 
      else if (dimKey === 'tags') {
        const arr = next.tags || []
        if (arr.includes(value)) next.tags = arr.filter(v => v !== value)
        else next.tags = [...arr, value]
      } 
      else if (dimKey.startsWith('attr:')) {
        const attrId = dimKey.replace('attr:', '')
        const attrs = { ...(next.attributes || {}) }
        const arr = attrs[attrId] || []
        if (arr.includes(value)) attrs[attrId] = arr.filter(v => v !== value)
        else attrs[attrId] = [...arr, value]
        if (attrs[attrId].length === 0) delete attrs[attrId]
        next.attributes = attrs
      }
      return next
    })
  }, [])

  const handleResetDimension = useCallback((dimKey) => {
    setDraft(prev => {
      const next = { ...prev }
      if (dimKey === 'types') next.types = ['inbound', 'outbound']
      else if (dimKey === 'partnerSpaceId') next.partnerSpaceId = null
      else if (dimKey === 'categoryId') { next.categoryId = null; next.attributes = {} }
      else if (dimKey === 'tags') next.tags = []
      else if (dimKey.startsWith('attr:')) {
        const attrId = dimKey.replace('attr:', '')
        const attrs = { ...(next.attributes || {}) }
        delete attrs[attrId]
        next.attributes = attrs
      }
      return next
    })
  }, [])

  const handleResetAll = useCallback(() => {
    setDraft({
      period: null, from: null, to: null, granularity: 'transaction',
      types: ['inbound', 'outbound'], partnerSpaceId: null, productId: null,
      categoryId: null, tags: [], attributes: {}
    })
  }, [])

  const handleConfirm = useCallback(() => {
    applyFilter(draft)
    onClose?.()
  }, [draft, applyFilter, onClose])

  const totalActiveFilterCount = useMemo(() => {
    let count = 0
    if (draft.period) count++
    if (draft.partnerSpaceId) count++
    if (draft.productId) count++
    if (draft.categoryId) count++
    if (draft.tags?.length > 0) count++
    if (Object.keys(draft.attributes ?? {}).length > 0) count++
    if (draft.types?.length === 1) count++
    return count
  }, [draft])

  const headerExt = (
    <div className="relative">
      <button
        onClick={() => setPeriodPopoverOpen(!periodPopoverOpen)}
        className={[
          'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-medium border transition-colors',
          periodPopoverOpen ? 'bg-zinc-800 border-zinc-600 text-zinc-100' : 'bg-zinc-900 border-zinc-800 text-zinc-400',
        ].join(' ')
        }
      >
        <Calendar size={12} />
        {formatHeaderLabel(draft)}
      </button>
      {periodPopoverOpen && (
        <PeriodPopover
          draft={draft}
          onChangeDraft={setDraft}
          onClose={() => setPeriodPopoverOpen(false)}
        />
      )}
    </div>
  )

  return (
    <BaseFilterSheet
      open={open}
      onClose={onClose}
      dynamicTitle="Filtrare Flux"
      totalAccessibleCount={undefined}
      matchingCount={undefined}
      totalActiveFilterCount={totalActiveFilterCount}
      dimensions={dimensions}
      activeDimKey={activeDimKey}
      setActiveDimKey={setActiveDimKey}
      activeDimValues={activeDimValues}
      facetedCounts={{}} 
      draftFilters={sheetDraft}
      onToggleValue={handleToggleValue}
      onResetAll={handleResetAll}
      onResetDimension={handleResetDimension}
      onConfirm={handleConfirm}
      submitLabel="Aplică filtrul"
      submitIcon={SlidersHorizontal}
      headerExtension={headerExt}
      showCounts={false}
    />
  )
}
