import { useMemo } from 'react'
import { useAppStore } from '../store/useAppStore'
import { filterAndSort } from '../lib/search'

/**
 * useBottomSearch — filtru pur peste searchQuery-ul global din BottomBar.
 *
 * Contract arhitectural (ARCH_BottomSearch):
 * Orice componentă care afișează o listă scrollabilă cu BottomBar vizibil
 * TREBUIE să treacă lista prin acest hook sau prin `usePicker`.
 *
 * Transparent când query-ul e gol: returnează referința originală (zero re-render).
 * Când query-ul e non-gol: aplică `filterAndSort` (motorul canonic din lib/search).
 *
 * @param {Array}    items     - lista sursă de elemente
 * @param {Function} labelFn   - extrage string-ul de căutare dintr-un element (default: x => x)
 * @param {Object}   opts
 *   @param {boolean} opts.enabled - dezactivează filtrarea când false (default: true)
 *
 * @returns {{ results: Array, isFiltering: boolean, query: string }}
 *
 * Exemplu de utilizare:
 *   const { results, isFiltering } = useBottomSearch(
 *     myItems,
 *     (item) => item.name,
 *     { enabled: someCondition }
 *   )
 *
 * Notă privind atributele căutabile (ARCH_SearchableAttrs — implementare viitoare):
 * `labelFn` este singurul punct de extensie pentru controlul a ce se caută.
 * Când va fi implementat flag-ul `searchable` pe schema categoriei, doar `labelFn`
 * va trebui actualizat în componentele consumatoare — acest hook rămâne neschimbat.
 */
export function useBottomSearch(items, labelFn = (x) => x, { enabled = true } = {}) {
  const searchQuery = useAppStore((s) => s.searchQuery)

  const results = useMemo(() => {
    if (!enabled || !searchQuery.trim()) return items
    return filterAndSort(items, searchQuery, labelFn)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, searchQuery, labelFn, enabled])

  return {
    results,
    isFiltering: enabled && searchQuery.trim().length > 0,
    query: searchQuery,
  }
}
