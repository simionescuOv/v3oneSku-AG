import { useMemo, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'

// ── FluxFeed ──────────────────────────────────────────────────────────────────
// Feed WhatsApp-style al tranzacțiilor unui Space.
// Inbound (Destinație) → stânga + linie verde dreapta
// Outbound (Sursă)     → dreapta + linie roșie stânga
//
// transactions: array de obiecte deja prelucrate:
//   { id, direction ('inbound'|'outbound'), label, date, items: [{nameId, qty}], totalQty }
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

// Grupare tranzacții pe zi (cheie = data scurtă)
function groupByDay(blocks) {
  const days = {}
  for (const b of blocks) {
    const key = new Date(b.createdAt).toDateString()
    if (!days[key]) days[key] = { label: formatDate(b.createdAt), blocks: [] }
    days[key].blocks.push(b)
  }
  return Object.values(days)
}

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
              <span className="text-sm text-zinc-200 truncate">{item.nameId}</span>
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

export default function FluxFeed({ blocks, alerts = [] }) {
  const days = useMemo(() => {
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
        if (a.itemType === 'transaction' && b.itemType === 'alert') return -1 // a (tx) before b (alert)
        if (a.itemType === 'alert' && b.itemType === 'transaction') return 1  // b (tx) before a (alert)
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
  }, [blocks, alerts])

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
      </div>
    </div>
  )
}
