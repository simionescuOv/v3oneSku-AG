import { useMemo, useState, useRef, useCallback, useEffect } from 'react'
import { ArrowDownLeft, ArrowUpRight, ChevronDown, ChevronUp, Check } from 'lucide-react'
import { useFluxStore } from '../../store/useFluxStore'

// ── FluxFeed ──────────────────────────────────────────────────────────────────
// Feed WhatsApp-style al tranzacțiilor unui Space.
// Inbound (Destinație) → stânga + linie verde dreapta
// Outbound (Sursă)     → dreapta + linie roșie stânga
//
// Props:
//   blocks      — array de FluxBlock (granularity='transaction') sau SummaryBlock (agregat)
//   alerts      — array de alerte stoc negativ
//   mode        — 'transaction' (default) | 'aggregated'
//   spaceId     — necesar pentru infinite scroll
//   onLoadMore  — callback pentru infinite scroll (returnează Promise)
// ─────────────────────────────────────────────────────────────────────────────

function formatDate(isoString) {
  if (!isoString) return ''
  const d = new Date(isoString)
  return d.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatTime(isoString) {
  if (!isoString) return ''
  const d = new Date(isoString)
  return d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })
}

function formatBucketLabel(bucketDate, granularity) {
  const d = new Date(bucketDate)
  if (granularity === 'daily') {
    return d.toLocaleDateString('ro-RO', { weekday: 'short', day: 'numeric', month: 'short' })
  }
  if (granularity === 'weekly') {
    const end = new Date(d)
    end.setDate(d.getDate() + 6)
    return `${d.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' })}`
  }
  if (granularity === 'monthly') {
    return d.toLocaleDateString('ro-RO', { month: 'long', year: 'numeric' })
  }
  return formatDate(bucketDate)
}

// Grupare tranzacții individuale pe zi (cheie = data scurtă)
function groupByDay(blocks) {
  const days = {}
  for (const b of blocks) {
    const key = new Date(b.createdAt).toDateString()
    if (!days[key]) days[key] = { label: formatDate(b.createdAt), blocks: [] }
    days[key].blocks.push(b)
  }
  return Object.values(days)
}

// ── FluxBlock: tranzacție individuală ─────────────────────────────────────────
function FluxBlock({ block }) {
  const isInbound = block.direction === 'inbound'
  const TRUNCATE_AT = 3
  const [expanded, setExpanded] = useState(false)
  const showAll = expanded || block.items.length <= TRUNCATE_AT
  const visible = showAll ? block.items : block.items.slice(0, TRUNCATE_AT)
  const hidden = block.items.length - TRUNCATE_AT

  return (
    <div className={[
      'flex w-full px-4 py-1',
      isInbound ? 'justify-start' : 'justify-end',
    ].join(' ')}>
      <div className={[
        'relative max-w-[80%] rounded-xl px-3 py-2.5 bg-zinc-800',
        isInbound
          ? 'rounded-tl-none border-r-2 border-green-500'
          : 'rounded-tr-none border-l-2 border-red-500',
      ].join(' ')}>

        {/* Header bloc */}
        <div className={[
          'flex items-center gap-2 mb-1.5',
          isInbound ? 'flex-row' : 'flex-row-reverse',
        ].join(' ')}>
          {isInbound
            ? <ArrowDownLeft size={14} className="text-green-400 shrink-0" />
            : <ArrowUpRight size={14} className="text-red-400 shrink-0" />
          }
          <span className={[
            'text-xs font-semibold uppercase tracking-wide',
            isInbound ? 'text-green-400' : 'text-red-400',
          ].join(' ')}>
            {isInbound ? 'Intrare' : 'Ieșire'}
          </span>
          <span className="text-xs text-zinc-500 shrink-0">
            {block.sourceLabel}
          </span>
        </div>

        {/* Produse */}
        <ul className="space-y-0.5">
          {visible.map((item, i) => (
            <li key={i} className="flex items-baseline justify-between gap-3">
              <div className="flex items-center gap-1.5 min-w-0">
                {item._matchedFilter && <Check size={14} className="text-blue-400 shrink-0" />}
                <span className="text-sm text-zinc-200 truncate">{item.nameId}</span>
              </div>
              <span className={[
                'text-sm font-semibold tabular-nums shrink-0',
                isInbound ? 'text-green-400' : 'text-red-400',
              ].join(' ')}>
                {item.qty}
              </span>
            </li>
          ))}
          {!showAll && hidden > 0 && (
            <li>
              <button
                onClick={() => setExpanded(true)}
                className="text-xs text-blue-400 active:text-blue-300 mt-0.5"
              >
                +{hidden} {hidden === 1 ? 'produs' : 'produse'}...
              </button>
            </li>
          )}
        </ul>

        {/* Sumar + ora */}
        <div className={[
          'flex items-center gap-3 mt-2 pt-2 border-t border-zinc-700/60',
          isInbound ? 'flex-row' : 'flex-row-reverse',
        ].join(' ')}>
          <span className={[
            'text-xs font-medium',
            isInbound ? 'text-green-400/80' : 'text-red-400/80',
          ].join(' ')}>
            {block.totalQty} {block.totalQty === 1 ? 'buc.' : 'bucăți'}
          </span>
          <span className="text-xs text-zinc-600">{formatTime(block.createdAt)}</span>
        </div>
      </div>
    </div>
  )
}

// ── SummaryBlock: bloc agregat (zilnic/săptămânal/lunar) ──────────────────────
function SummaryBlock({ bucket }) {
  const [expanded, setExpanded] = useState(false)
  const PREVIEW_COUNT = 3
  const products = bucket.products ?? []
  const previewProducts = expanded ? products : products.slice(0, PREVIEW_COUNT)
  const hiddenCount = products.length - PREVIEW_COUNT

  return (
    <div className="mx-4 my-1 rounded-xl bg-zinc-800/70 border border-zinc-700/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-700/40">
        <span className="text-sm font-semibold text-zinc-200">
          {formatBucketLabel(bucket.bucketDate, bucket.granularity)}
        </span>
        <div className="flex items-center gap-2">
          {bucket.totalInbound > 0 && (
            <span className="flex items-center gap-1 text-xs font-semibold text-green-400">
              <ArrowDownLeft size={12} />
              {bucket.totalInbound}
            </span>
          )}
          {bucket.totalOutbound > 0 && (
            <span className="flex items-center gap-1 text-xs font-semibold text-red-400">
              <ArrowUpRight size={12} />
              {bucket.totalOutbound}
            </span>
          )}
          <span className="text-[10px] text-zinc-500 ml-1">
            {bucket.txCount} {bucket.txCount === 1 ? 'tranzacție' : 'tranzacții'}
          </span>
        </div>
      </div>

      {/* Produse */}
      <div className="px-3 py-2 space-y-1">
        {previewProducts.map((p) => (
          <div key={p.productId} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 min-w-0">
              {p._matchedFilter && <Check size={14} className="text-blue-400 shrink-0" />}
              <span className="text-xs text-zinc-300 truncate">{p.nameId}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {p.qtyInbound > 0 && (
                <span className="text-xs font-semibold text-green-400">+{p.qtyInbound}</span>
              )}
              {p.qtyOutbound > 0 && (
                <span className="text-xs font-semibold text-red-400">−{p.qtyOutbound}</span>
              )}
            </div>
          </div>
        ))}

        {!expanded && hiddenCount > 0 && (
          <button
            onClick={() => setExpanded(true)}
            className="flex items-center gap-1 text-xs text-blue-400 active:text-blue-300 mt-1"
          >
            <ChevronDown size={12} />
            +{hiddenCount} {hiddenCount === 1 ? 'produs' : 'produse'}
          </button>
        )}
        {expanded && products.length > PREVIEW_COUNT && (
          <button
            onClick={() => setExpanded(false)}
            className="flex items-center gap-1 text-xs text-zinc-500 active:text-zinc-300 mt-1"
          >
            <ChevronUp size={12} />
            Restrânge
          </button>
        )}
      </div>
    </div>
  )
}

// ── AlertBlock ─────────────────────────────────────────────────────────────────
function AlertBlock({ alert }) {
  return (
    <div className="flex w-full px-4 py-1 justify-center">
      <div className="flex items-center gap-2 max-w-[85%] rounded-xl px-3 py-1.5 bg-red-950/40 border border-red-900/50">
        <span className="text-red-500 font-bold text-sm">⚠</span>
        <span className="text-xs text-red-200">
          Stoc negativ ({alert.stockValue}): <span className="font-semibold">{alert.productName}</span>
        </span>
        <span className="text-[10px] text-red-400/60 ml-2 whitespace-nowrap">{formatTime(alert.createdAt)}</span>
      </div>
    </div>
  )
}

// ── InfiniteScrollSentinel ─────────────────────────────────────────────────────
function InfiniteScrollSentinel({ onIntersect, hasMore, loading }) {
  const ref = useRef(null)

  useEffect(() => {
    if (!ref.current || !hasMore) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading) {
          onIntersect()
        }
      },
      { threshold: 0.1 }
    )
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [hasMore, loading, onIntersect])

  if (!hasMore) return null

  return (
    <div ref={ref} className="flex justify-center py-4">
      {loading && (
        <div className="w-5 h-5 rounded-full border-2 border-zinc-700 border-t-amber-400 animate-spin" />
      )}
    </div>
  )
}

// ── FluxFeed (principal) ───────────────────────────────────────────────────────
export default function FluxFeed({ blocks, alerts = [], mode = 'transaction', spaceId, onLoadMore }) {
  const hasMorePages = useFluxStore((s) => s.hasMorePages)
  const [loadingMore, setLoadingMore] = useState(false)

  const handleLoadMore = useCallback(async () => {
    if (!onLoadMore || loadingMore) return
    setLoadingMore(true)
    await onLoadMore()
    setLoadingMore(false)
  }, [onLoadMore, loadingMore])

  // ── Mutat sus pentru a respecta Rules of Hooks (niciun hook după return) ──
  const days = useMemo(() => {
    if (mode === 'aggregated') return [] // scurtcircuitare pentru a evita procesarea inutilă

    // 1. Combine blocks (transactions) and alerts
    const feedItems = [
      ...blocks.map(b => ({ ...b, itemType: 'transaction' })),
      ...alerts.map(a => ({
        itemType: 'alert',
        id: `alert-${a.id}`,
        createdAt: a.created_at,
        productName: a.products?.name_id || 'Produs sters',
        stockValue: a.stock_value,
      }))
    ]

    // 2. Sort descending (newest first).
    // If times are very close, ensure Transaction comes BEFORE (above) Alert in the UI.
    feedItems.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime()
      const dateB = new Date(b.createdAt).getTime()

      if (Math.abs(dateA - dateB) < 2000) { // within 2 seconds
        if (a.itemType === 'transaction' && b.itemType === 'alert') return -1
        if (a.itemType === 'alert' && b.itemType === 'transaction') return 1
      }
      return dateB - dateA
    })

    // 3. Group by day
    const daysMap = new Map()
    for (const item of feedItems) {
      const dateObj = new Date(item.createdAt)
      const key = dateObj.toDateString()
      if (!daysMap.has(key)) {
        daysMap.set(key, { label: formatDate(item.createdAt), date: dateObj.getTime(), items: [] })
      }
      daysMap.get(key).items.push(item)
    }

    return Array.from(daysMap.values()).sort((a, b) => b.date - a.date)
  }, [blocks, alerts, mode])

  // ── Modul AGGREGATED (SummaryBlock-uri) ──────────────────────────────────
  if (mode === 'aggregated') {
    if (blocks.length === 0) {
      return (
        <div className="flex-1 flex items-center justify-center px-8 text-center">
          <p className="text-zinc-500 text-sm leading-relaxed">
            Nicio tranzacție pentru perioada selectată.
          </p>
        </div>
      )
    }
    return (
      <div className="flex-1 min-h-0 py-2 overflow-y-auto">
        <div className="max-w-2xl mx-auto space-y-2">
          {blocks.map((bucket, i) => (
            <SummaryBlock key={bucket.bucketKey ?? i} bucket={bucket} />
          ))}
        </div>
      </div>
    )
  }

  // ── Modul TRANSACTION (FluxBlock-uri individuale) ────────────────────────
  if (blocks.length === 0 && alerts.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center px-8 text-center">
        <p className="text-zinc-500 text-sm leading-relaxed">
          Nicio tranzacție înregistrată pentru acest spațiu.
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-0 py-2 overflow-y-auto">
      {/* Wrapper pentru centrarea fluxului pe ecrane late */}
      <div className="max-w-2xl mx-auto space-y-4">
        {days.map((day, di) => (
          <div key={di}>
            {/* Sticky day header */}
            <div className="sticky top-0 z-10 flex justify-center py-1.5">
              <span className="text-xs text-zinc-400 bg-zinc-950/90 backdrop-blur-sm px-3 py-1 rounded-full border border-zinc-800 shadow-sm">
                {day.label}
              </span>
            </div>
            {/* Items for this day */}
            <div className="space-y-2 mt-1">
              {day.items.map((item) => (
                item.itemType === 'alert'
                  ? <AlertBlock key={item.id} alert={item} />
                  : <FluxBlock key={item.id} block={item} />
              ))}
            </div>
          </div>
        ))}

        {/* Infinite Scroll Sentinel */}
        <InfiniteScrollSentinel
          hasMore={hasMorePages}
          loading={loadingMore}
          onIntersect={handleLoadMore}
        />
      </div>
    </div>
  )
}

