import { useState, useCallback, useMemo, useEffect } from 'react'
import { filterAndSort, normalize } from '../lib/search'
import { useAppStore, useActiveSearchQuery } from '../store/useAppStore'
import { useAutocompleteGhost } from './useAutocompleteGhost'

export function usePicker({
  mode = 'standalone',
  items = [],
  options = [],
  labelFn = (x) => x,
  multiSelect = false,
  allowCreate = false,
  query: controlledQuery = '', // unused explicitly, but kept for compatibility
  searchContext = 'global',
  value = [],
  maxSelections = Infinity,
  onChange,
}) {
  const activeQuery = useActiveSearchQuery(searchContext)
  const [localOptions, setLocalOptions] = useState([...options])
  const [tempSelected, setTempSelected] = useState([])
  const [internalQuery, setInternalQuery] = useState('')
  const [markedForDelete, setMarkedForDelete] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  const isInline = mode === 'inline'
  const query = isInline ? activeQuery : internalQuery
  const trimmedQuery = query.trim()

  // ── Mod inline: filtrare directă pe lista paginii ───────────────────────────
  const filteredItems = useMemo(
    () => filterAndSort(items, query, labelFn),
    [items, query, labelFn]
  )

  // „+ Adaugă «query»" apare pe match inexact
  const inlineExactExists =
    isInline && items.some((it) => normalize(labelFn(it)) === normalize(trimmedQuery))
  const showCreate =
    isInline && allowCreate && trimmedQuery.length > 0 && !inlineExactExists

  useAutocompleteGhost(isInline, trimmedQuery, filteredItems, labelFn)

  // ── Mod standalone: filtrare pe opțiuni locale, excluzând cele deja selectate ─
  const filteredOptions = useMemo(() => {
    const base = multiSelect
      ? localOptions.filter((o) => !tempSelected.includes(o))
      : localOptions
    return filterAndSort(base, query, labelFn)
  }, [localOptions, query, multiSelect, tempSelected, labelFn])

  const open = useCallback(() => {
    setTempSelected(multiSelect ? [...value] : [])
    setInternalQuery('')
    setMarkedForDelete(false)
    setIsOpen(true)
  }, [value, multiSelect])

  const close = useCallback(() => {
    setIsOpen(false)
    setInternalQuery('')
    setMarkedForDelete(false)
  }, [])

  const commit = useCallback((selected) => {
    const newItems = selected.filter((s) => !options.includes(s))
    onChange?.({ selected, newItems })
  }, [options, onChange])

  const handleSelect = useCallback((val) => {
    if (!multiSelect) {
      commit([val])
      close()
      return
    }
    setTempSelected((prev) => {
      if (prev.includes(val)) return prev
      if (prev.length >= maxSelections) return prev
      return [...prev, val]
    })
    setInternalQuery('')
    setMarkedForDelete(false)
  }, [multiSelect, maxSelections, commit, close])

  const handleRemove = useCallback((val) => {
    setTempSelected((prev) => prev.filter((s) => s !== val))
    setMarkedForDelete(false)
  }, [])

  const handleQueryChange = useCallback((val) => {
    setInternalQuery(val)
    if (val.length > 0) setMarkedForDelete(false)
  }, [])

  const handleBackspace = useCallback(() => {
    if (internalQuery !== '' || tempSelected.length === 0) return
    if (!markedForDelete) setMarkedForDelete(true)
    else {
      setTempSelected((p) => p.slice(0, -1))
      setMarkedForDelete(false)
    }
  }, [internalQuery, tempSelected, markedForDelete])

  const handleAddNew = useCallback(() => {
    const trimmed = internalQuery.trim()
    if (!trimmed) return
    setLocalOptions((prev) =>
      prev.includes(trimmed) ? prev : [...prev, trimmed]
    )
    if (!multiSelect) {
      commit([trimmed])
      close()
      return
    }
    if (tempSelected.length >= maxSelections) return
    setTempSelected((prev) => [...prev, trimmed])
    setInternalQuery('')
  }, [internalQuery, multiSelect, tempSelected, maxSelections, commit, close])

  const handleSave = useCallback(() => {
    commit(tempSelected)
    close()
  }, [tempSelected, commit, close])

  const handleCancel = useCallback(() => {
    close()
  }, [close])

  const isAtMax = tempSelected.length >= maxSelections

  // „+ Adaugă" apare pe match inexact (normalizat, diacritic-insensitive),
  // nu pe zero rezultate — chiar dacă există rezultate similare prin
  // substring (IMPL_GrupareMutare §A2).
  const exactExists = localOptions.some(
    (o) => normalize(labelFn(o)) === normalize(trimmedQuery)
  )
  const showAddRow = allowCreate && trimmedQuery.length > 0 && !exactExists

  if (isInline) {
    return {
      mode,
      query,
      filteredItems,
      showCreate,
      allowCreate,
    }
  }

  return {
    mode,
    isOpen, tempSelected, localOptions, query, markedForDelete,
    filteredOptions, isAtMax, showAddRow, multiSelect, allowCreate,
    open, close, handleSelect, handleRemove, handleQueryChange,
    handleBackspace, handleAddNew, handleSave, handleCancel,
  }
}
