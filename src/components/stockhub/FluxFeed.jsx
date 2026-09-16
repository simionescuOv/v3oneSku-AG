import { useMemo, useState, useRef, useCallback, useEffect } from 'react'
import { ArrowDownLeft, ArrowUpRight, Check } from 'lucide-react'
import { useFluxStore } from '../../store/useFluxStore'
import BottomSheet from '../catalog/BottomSheet'
import { useBottomSearch } from '../../hooks/useBottomSearch'

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

// ── FluxBlock: tranzacție individuală ─────────────────────────────────────────
function FluxBlock({ block, onSelect }) {
  const isInbound = block.direction === 'inbound'
  const TRUNCATE_AT = 3
  const visible = block.items.slice(0, TRUNCATE_AT)
  const hidden = block.items.length - TRUNCATE_AT

  return (
    <div className={[
      'flex w-full px-4 py-1 justify-start cursor-pointer',
      isInbound ? 'justify-start' : 'justify-end',
    ].join(' ')}>
      <div 
        onClick={() => onSelect({ ...block, blockType: 'transaction' })}
        className={[
          'relative w-full max-w-[85%] rounded-xl px-3 py-2.5 bg-zinc-800 active:bg-zinc-700/80 transition-colors',
          isInbound
            ? 'rounded-tl-none border-r-2 border-green-500'
            : 'rounded-tr-none border-l-2 border-red-500',
        ].join(' ')}
      >
        {/* Header bloc */}
        <div className={[
          'flex items-center justify-between mb-2',
          isInbound ? 'flex-row' : 'flex-row-reverse',
        ].join(' ')}>
          <div className={[
            'flex items-center gap-1.5 min-w-0',
            isInbound ? 'flex-row' : 'flex-row-reverse',
          ].join(' ')}>
            {isInbound
              ? <ArrowDownLeft size={14} className="text-green-400 shrink-0" />
              : <ArrowUpRight size={14} className="text-red-400 shrink-0" />
            }
            <span className={[
              'text-[10px] font-bold uppercase tracking-wider shrink-0',
              isInbound ? 'text-green-400' : 'text-red-400',
            ].join(' ')}>
              {isInbound ? 'Intrare' : 'Ieșire'}
            </span>
            <span className="text-xs text-zinc-500 truncate max-w-[110px] mx-0.5">
              {block.sourceLabel}
            </span>
          </div>
          <span className="text-[10px] text-zinc-500 shrink-0 opacity-70 mt-0.5">
            {formatTime(block.createdAt)}
          </span>
        </div>

        {/* Produse */}
        <ul className="space-y-1">
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
          {hidden > 0 && (
            <li className="text-[11px] text-zinc-500 font-medium pt-0.5">
              + încă {hidden} {hidden === 1 ? 'produs' : 'produse'}
            </li>
          )}
        </ul>

        {/* Sumar (Footer read-only) */}
        <div className="flex items-center gap-3 mt-2.5 pt-2 border-t border-zinc-700/60 justify-between">
          <span className="text-[11px] font-medium text-zinc-400">
            {block.items.length} {block.items.length === 1 ? 'articol' : 'articole'}
          </span>
          <span className={[
            'text-xs font-semibold',
            isInbound ? 'text-green-400/90' : 'text-red-400/90',
          ].join(' ')}>
            {block.totalQty} {block.totalQty === 1 ? 'buc.' : 'bucăți'}
          </span>
        </div>
      </div>
    </div>
  )
}

// ── SummaryBlock: bloc agregat (zilnic/săptămânal/lunar) ──────────────────────
function SummaryBlock({ bucket, onSelect }) {
  const PREVIEW_COUNT = 3
  const products = bucket.products ?? []
  const previewProducts = products.slice(0, PREVIEW_COUNT)
  const hiddenCount = products.length - PREVIEW_COUNT

  return (
    <div 
      onClick={() => onSelect({ ...bucket, blockType: 'summary' })}
      className="mx-4 my-1 rounded-xl bg-zinc-800/70 border border-zinc-700/50 overflow-hidden cursor-pointer active:bg-zinc-700/90 transition-colors"
    >
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
        {hiddenCount > 0 && (
          <div className="text-[11px] text-zinc-500 font-medium pt-1">
            + încă {hiddenCount} {hiddenCount === 1 ? 'produs' : 'produse'}
          </div>
        )}
      </div>

      {/* Footer sumar */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-zinc-700/40 bg-zinc-800/30">
        <span className="text-xs font-medium text-zinc-400">
          {products.length} {products.length === 1 ? 'articol' : 'articole'}
        </span>
        <div className="flex items-center gap-2">
          {bucket.totalInbound > 0 && <span className="text-xs font-semibold text-green-400">+{bucket.totalInbound}</span>}
          {bucket.totalOutbound > 0 && <span className="text-xs font-semibold text-red-400">-{bucket.totalOutbound}</span>}
        </div>
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

// ── TransactionSheetContent ────────────────────────────────────────────────────
const transactionLabelFn = (p) => p.nameId || p.productId;

function TransactionSheetContent({ block, onClose }) {
  const isSummary = block.blockType === 'summary'
  const items = isSummary ? block.products : block.items
  const { results } = useBottomSearch(items, transactionLabelFn, { enabled: true })

  const isInbound = !isSummary && block.direction === 'inbound'
  
  return (
    <div className="flex flex-col h-full max-h-[85vh]">
      {/* Mâner pt swipe */}
      <div className="shrink-0 flex justify-center pt-3 pb-2">
        <div className="w-12 h-1.5 rounded-full bg-zinc-700"></div>
      </div>
      
      <div className="flex items-center justify-between px-4 pb-3 border-b border-zinc-800 shrink-0">
        <div className="flex flex-col">
          <h3 className="font-semibold text-zinc-100">
            {isSummary 
              ? formatBucketLabel(block.bucketDate, block.granularity) 
              : (isInbound ? 'Detalii Intrare' : 'Detalii Ieșire')}
          </h3>
          {!isSummary && (
            <span className="text-xs text-zinc-400 mt-0.5">
              {block.sourceLabel} · {formatDate(block.createdAt)} {formatTime(block.createdAt)}
            </span>
          )}
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto py-2">
        {results.map((p, i) => (
          <div key={i} className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/50 last:border-0 hover:bg-zinc-800/30">
            <div className="flex items-center gap-2 min-w-0">
              {p._matchedFilter && <Check size={16} className="text-blue-400 shrink-0" />}
              <span className="text-sm text-zinc-200 truncate font-medium">{p.nameId || p.productId}</span>
            </div>
            <div className="flex items-center gap-3 shrink-0 pl-2">
              {isSummary ? (
                <>
                  {p.qtyInbound > 0 && <span className="text-sm font-semibold text-green-400">+{p.qtyInbound}</span>}
                  {p.qtyOutbound > 0 && <span className="text-sm font-semibold text-red-400">−{p.qtyOutbound}</span>}
                </>
              ) : (
                <span className={['text-sm font-bold', isInbound ? 'text-green-400' : 'text-red-400'].join(' ')}>
                  {p.qty}
                </span>
              )}
            </div>
          </div>
        ))}
        {results.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-zinc-500">
            Niciun produs găsit
          </div>
        )}
      </div>
    </div>
  )
}

// ── FluxFeed (principal) ───────────────────────────────────────────────────────
export default function FluxFeed({ blocks = [], alerts = [], mode = 'transaction', spaceId, onLoadMore, onSheetOpenChange }) {
  const hasMorePages = useFluxStore((s) => s.hasMorePages)
  const [loadingMore, setLoadingMore] = useState(false)
  const [selectedBlock, setSelectedBlock] = useState(null)

  // Anunță părintele când se deschide/închide sheet-ul
  useEffect(() => {
    onSheetOpenChange?.(!!selectedBlock)
  }, [selectedBlock, onSheetOpenChange])

  const handleLoadMore = useCallback(async () => {
    if (!onLoadMore || loadingMore) return
    setLoadingMore(true)
    await onLoadMore()
    setLoadingMore(false)
  }, [onLoadMore, loadingMore])

  const days = useMemo(() => {
    if (mode === 'aggregated') return [] 

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
      <>
        <div className="flex-1 min-h-0 py-2 overflow-y-auto">
          <div className="max-w-2xl mx-auto space-y-2">
            {blocks.map((bucket, i) => (
              <SummaryBlock key={bucket.bucketKey ?? i} bucket={bucket} onSelect={setSelectedBlock} />
            ))}
          </div>
        </div>
        
        <BottomSheet 
          open={!!selectedBlock} 
          onClose={() => setSelectedBlock(null)} 
          aboveBottomBar={true}
        >
          {selectedBlock && (
            <TransactionSheetContent block={selectedBlock} onClose={() => setSelectedBlock(null)} />
          )}
        </BottomSheet>
      </>
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
    <>
      <div className="flex-1 min-h-0 py-2 overflow-y-auto">
        <div className="max-w-2xl mx-auto space-y-4">
          {days.map((day, di) => (
            <div key={di}>
              <div className="sticky top-0 z-10 flex justify-center py-1.5">
                <span className="text-xs text-zinc-400 bg-zinc-950/90 backdrop-blur-sm px-3 py-1 rounded-full border border-zinc-800 shadow-sm">
                  {day.label}
                </span>
              </div>
              <div className="space-y-2 mt-1">
                {day.items.map((item) => (
                  item.itemType === 'alert'
                    ? <AlertBlock key={item.id} alert={item} />
                    : <FluxBlock key={item.id} block={item} onSelect={setSelectedBlock} />
                ))}
              </div>
            </div>
          ))}

          <InfiniteScrollSentinel
            hasMore={hasMorePages}
            loading={loadingMore}
            onIntersect={handleLoadMore}
          />
        </div>
      </div>

      <BottomSheet 
        open={!!selectedBlock} 
        onClose={() => setSelectedBlock(null)} 
        aboveBottomBar={true}
      >
        {selectedBlock && (
          <TransactionSheetContent block={selectedBlock} onClose={() => setSelectedBlock(null)} />
        )}
      </BottomSheet>
    </>
  )
}
