// [ITEMS FEATURE] — ComponentA izolată, removable.
import { X, Tag } from 'lucide-react'
import BottomSheet from '../catalog/BottomSheet'

// Bottom sheet de detalii — view-only.
// Afișează valoarea completă, descrierea completă, toate tags și momentul.
export default function ItemDetailSheet({ open, onClose, item, onEdit }) {
  if (!open || !item) return null

  const formattedMoment = item.moment
    ? new Date(item.moment).toLocaleString('ro-RO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—'

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="px-4 pb-8 overflow-y-auto max-h-[80dvh]">
        {/* Valoare */}
        <div className="mt-4 text-center">
          <span className="text-5xl font-bold text-zinc-100 tabular-nums">
            {item.value}
          </span>
        </div>

        {/* Moment */}
        <p className="mt-2 text-center text-xs text-zinc-500">{formattedMoment}</p>

        {/* Descriere */}
        {item.description ? (
          <div className="mt-5">
            <label className="block text-xs text-zinc-500 mb-1.5">Descriere</label>
            <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">
              {item.description}
            </p>
          </div>
        ) : (
          <p className="mt-5 text-sm text-zinc-600 italic text-center">Fără descriere</p>
        )}

        {/* Tags */}
        {item.tags?.length > 0 && (
          <div className="mt-5">
            <label className="flex items-center gap-1.5 text-xs text-zinc-500 mb-2">
              <Tag size={12} /> Tags
            </label>
            <div className="flex flex-wrap gap-2">
              {item.tags.map((t) => (
                <span
                  key={t}
                  className="px-3 py-1 rounded-full bg-zinc-800 text-sm text-zinc-200 border border-zinc-700"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Acțiuni */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 h-11 rounded-xl bg-zinc-800 text-sm text-zinc-300 active:bg-zinc-700"
          >
            Închide
          </button>
          <button
            onClick={() => onEdit?.(item)}
            className="flex-1 h-11 rounded-xl bg-blue-600 text-sm font-medium text-white active:bg-blue-700"
          >
            Editează
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}
