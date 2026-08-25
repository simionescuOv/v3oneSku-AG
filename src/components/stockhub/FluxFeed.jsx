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

export default function FluxFeed({ blocks }) {
  const days = useMemo(() => groupByDay(blocks), [blocks])

  if (blocks.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center px-8 text-center">
        <p className="text-zinc-500 text-sm leading-relaxed">
          Nicio tranzacție înregistrată pentru acest spațiu.
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto py-2 space-y-4">
      {days.map((day, di) => (
        <div key={di}>
          {/* Sticky day header */}
          <div className="sticky top-0 z-10 flex justify-center py-1.5">
            <span className="text-xs text-zinc-400 bg-zinc-950/90 backdrop-blur-sm px-3 py-1 rounded-full border border-zinc-800">
              {day.label}
            </span>
          </div>
          {/* Blocks for this day */}
          <div className="space-y-2 mt-1">
            {day.blocks.map((block) => (
              <FluxBlock key={block.id} block={block} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
