import { useEffect, useRef } from 'react'
import { useAppStore } from '../store/useAppStore'
import { normalize } from '../lib/search'

export function useAutocompleteGhost(enabled, query, results, labelFn = (x) => x) {
  const setAutocompleteSuggestion = useAppStore((s) => s.setAutocompleteSuggestion)
  const labelFnRef = useRef(labelFn)
  labelFnRef.current = labelFn

  useEffect(() => {
    if (!enabled) return

    const getLabel = labelFnRef.current
    const q = normalize((query || '').trim())
    if (!q || !results || results.length === 0) {
      setAutocompleteSuggestion(null)
      return
    }

    const prefixMatches = results.filter(it => normalize(getLabel(it) ?? '').startsWith(q))

    if (prefixMatches.length > 0) {
      setAutocompleteSuggestion({ text: getLabel(prefixMatches[0]) ?? '', isPrefix: true })
    } else if (results.length === 1) {
      setAutocompleteSuggestion({ text: getLabel(results[0]) ?? '', isPrefix: false })
    } else {
      setAutocompleteSuggestion(null)
    }
  }, [enabled, query, results, setAutocompleteSuggestion])

  useEffect(() => {
    return () => {
      if (enabled) {
        setAutocompleteSuggestion(null)
      }
    }
  }, [enabled, setAutocompleteSuggestion])
}
