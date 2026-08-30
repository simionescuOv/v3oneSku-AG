import { useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'
import { normalize } from '../lib/search'

export function useAutocompleteGhost(enabled, query, results, labelFn = (x) => x) {
  const setAutocompleteSuggestion = useAppStore((s) => s.setAutocompleteSuggestion)

  useEffect(() => {
    if (!enabled || !query.trim() || results.length === 0) {
      setAutocompleteSuggestion(null)
      return
    }

    const q = normalize(query.trim())
    const prefixMatches = results.filter(it => normalize(labelFn(it)).startsWith(q))

    if (prefixMatches.length > 0) {
      setAutocompleteSuggestion({ text: labelFn(prefixMatches[0]), isPrefix: true })
    } else if (results.length === 1) {
      setAutocompleteSuggestion({ text: labelFn(results[0]), isPrefix: false })
    } else {
      setAutocompleteSuggestion(null)
    }
  }, [enabled, query, results, labelFn, setAutocompleteSuggestion])
}
