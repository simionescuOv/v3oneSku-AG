// [ITEMS FEATURE] — ComponentA izolată, removable.
import { useMemo, useEffect } from 'react'
import { normalize } from '../../lib/search'

// Panel fix poziționat deasupra BottomBar-ului (bottom-16).
// Apare când utilizatorul tastează în BottomBar pe ListPage.
// Afișează tags din vocabularul local care se potrivesc cu query-ul curent.
// - Click pe un tag → îl adaugă în filtrul activ
// - Dacă rămâne un singur rezultat → se selectează automat după un scurt delay
//
// Props:
//   query       — string: textul curent din BottomBar
//   vocabulary  — { value: string, count: number }[]: toate tags din items
//   activeTags  — string[]: tags deja selectate ca filtru (excluse din sugestii)
//   onSelect    — (tagValue: string) => void
//   onClearQuery — () => void  (apelat după auto-select)
export default function TagSuggestionsPanel({ query, vocabulary, activeTags, onSelect }) {
  const q = query.trim()

  const suggestions = useMemo(() => {
    if (!q) return []
    const qNorm = normalize(q)
    return vocabulary
      .filter(
        (t) =>
          !activeTags.includes(t.value) &&
          normalize(t.value).startsWith(qNorm)
      )
      .sort((a, b) => {
        // Prefix match prima
        const aN = normalize(a.value)
        const bN = normalize(b.value)
        const aPrefix = aN.startsWith(qNorm)
        const bPrefix = bN.startsWith(qNorm)
        if (aPrefix !== bPrefix) return bPrefix ? 1 : -1
        // Apoi frecvența
        if (a.count !== b.count) return b.count - a.count
        return a.value.localeCompare(b.value)
      })
  }, [q, vocabulary, activeTags])


  if (!q || suggestions.length === 0) return null

  return (
    <div
      className={[
        'fixed left-0 right-0 z-30',
        'bottom-16', // deasupra BottomBar (h-16)
        'bg-zinc-900 border-t border-zinc-800',
        'max-h-48 overflow-y-auto',
        'shadow-lg shadow-black/40',
      ].join(' ')}
    >
      {suggestions.map((tag) => {
        // Evidențiem porțiunea din tag care se potrivește cu query-ul
        const tagNorm = normalize(tag.value)
        const qNorm = normalize(q)
        const matchIdx = tagNorm.indexOf(qNorm)

        let before = tag.value
        let matched = ''
        let after = ''
        if (matchIdx !== -1) {
          before = tag.value.slice(0, matchIdx)
          matched = tag.value.slice(matchIdx, matchIdx + q.length)
          after = tag.value.slice(matchIdx + q.length)
        }

        return (
          <button
            key={tag.value}
            onMouseDown={(e) => {
              // mouseDown în loc de onClick ca să nu pierdem focus-ul inputului
              e.preventDefault()
              onSelect(tag.value)
            }}
            className="w-full flex items-center justify-between px-4 py-3 text-left active:bg-zinc-800 border-b border-zinc-800 last:border-b-0"
          >
            <span className="text-sm text-zinc-300">
              {before}
              <span className="text-blue-400 font-medium">{matched}</span>
              {after}
            </span>
            {tag.count > 0 && (
              <span className="text-xs text-zinc-600 shrink-0 ml-2">{tag.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
