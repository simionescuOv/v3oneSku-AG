import { useMemo, useEffect } from 'react'
import { useAppStore, useActiveSearchQuery } from '../store/useAppStore'
import { filterAndSort, normalize } from '../lib/search'
import { useAutocompleteGhost } from './useAutocompleteGhost'

export function useBottomSearch(items, labelFn = (x) => x, { enabled = true, searchContext = 'global' } = {}) {
  const searchQuery = useActiveSearchQuery(searchContext)

  const results = useMemo(() => {
    if (!enabled || !searchQuery.trim()) return items
    return filterAndSort(items, searchQuery, labelFn)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, searchQuery, labelFn, enabled])

  useAutocompleteGhost(enabled, searchQuery, results, labelFn)

  return {
    results,
    isFiltering: enabled && searchQuery.trim().length > 0,
    query: searchQuery,
  }
}
