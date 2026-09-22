// [ITEMS FEATURE] — Componentă izolată, removable.
// TagGroupsPicker — vizualizare și organizare tag-uri în foldere
//
// Props:
//   allowOrganize  {boolean}  default: false — Modul complet cu organizare (false = Read-Only)
//   onClose        {fn}       Callback pentru închidere
//
// Mod Read-Only (allowOrganize=false):
//   - Coloana stângă: filtru rapid (folder → dreapta arată tag-urile conținute)
//   - BottomBar search: dreapta afișează tag-urile găsite, stânga arată foldere relevante
//   - Fără butoane de creare/ștergere, fără casete de bifare
//
// Mod Organizare (allowOrganize=true):
//   - Toate comportamentele din Read-Only PLUS:
//   - Meniu contextual (≡) → „Selectează" activează modul de selecție cu checkboxes
//   - Buton „+ Folder nou" (vizibil doar când cel puțin un tag e bifat în dreapta)
//   - Butoane „Salvează" / „Anulează"

import { useState, useMemo, useCallback, useEffect } from 'react'
import { Folder, FolderOpen, Tag, Plus, X, Check, AlignLeft, CheckSquare, Square } from 'lucide-react'
import { useItemsStore } from '../../store/useItemsStore'
import { useAppStore } from '../../store/useAppStore'
import { normalize } from '../../lib/search'
import BottomSheet from '../catalog/BottomSheet'
import { useAutocompleteGhost } from '../../hooks/useAutocompleteGhost'

const SEARCH_CONTEXT_ID = 'tag-groups-picker'

// ─── Folderul virtual „Toate" ─────────────────────────────────────────────────
const ALL_GROUP = { id: '__all__', name: 'Toate', isVirtual: true }

export default function TagGroupsPicker({ allowOrganize = false, onClose }) {
  const tagGroups = useItemsStore((s) => s.tagGroups)
  const tagGroupMembers = useItemsStore((s) => s.tagGroupMembers)
  const getTagVocabulary = useItemsStore((s) => s.getTagVocabulary)
  const associateTagsToGroups = useItemsStore((s) => s.associateTagsToGroups)
  const createGroupWithTags = useItemsStore((s) => s.createGroupWithTags)
  const items = useItemsStore((s) => s.items)

  const searchQuery = useAppStore((s) => s.searchQuery)
  const pushSearchContext = useAppStore((s) => s.pushSearchContext)
  const popSearchContext = useAppStore((s) => s.popSearchContext)
  const clearSearch = useAppStore((s) => s.clearSearch)
  const pushBottomBarOverride = useAppStore((s) => s.pushBottomBarOverride)
  const popBottomBarOverride = useAppStore((s) => s.popBottomBarOverride)

  // ─── State local ──────────────────────────────────────────────────────────
  const [activeGroupId, setActiveGroupId] = useState(ALL_GROUP.id)
  const [organizeMode, setOrganizeMode] = useState(false)
  const [selectedTagValues, setSelectedTagValues] = useState(new Set())
  const [selectedGroupIds, setSelectedGroupIds] = useState(new Set())
  const [newFolderMode, setNewFolderMode] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [actionsSheetOpen, setActionsSheetOpen] = useState(false)

  // ─── BottomBar search context ────────────────────────────────────────────
  useEffect(() => {
    clearSearch()
    pushSearchContext(SEARCH_CONTEXT_ID, 'Caută tag...')
    return () => {
      clearSearch()
      popSearchContext(SEARCH_CONTEXT_ID)
    }
  }, [pushSearchContext, popSearchContext, clearSearch])

  // ─── BottomBar Meniu Contextual ──────────────────────────────────────────
  useEffect(() => {
    if (allowOrganize) {
      const overrideId = 'tag-groups-picker-menu'
      const timer = setTimeout(() => {
        pushBottomBarOverride({
          id: overrideId,
          icon: 'AlignLeft',
          onClick: () => setActionsSheetOpen(true),
        })
      }, 0)
      return () => {
        clearTimeout(timer)
        popBottomBarOverride(overrideId)
      }
    }
  }, [allowOrganize, pushBottomBarOverride, popBottomBarOverride])

  // ─── Vocabular complet (toate tag-urile din items) ───────────────────────
  const vocabulary = useMemo(() => getTagVocabulary(), [items, getTagVocabulary])

  // ─── Map invers: tagValue → lista groupId-uri care îl conțin ─────────────
  const tagToGroups = useMemo(() => {
    const map = {}
    for (const [groupId, tags] of Object.entries(tagGroupMembers)) {
      for (const tag of tags) {
        if (!map[tag]) map[tag] = []
        map[tag].push(groupId)
      }
    }
    return map
  }, [tagGroupMembers])

  // ─── Filtrare prin BottomBar ─────────────────────────────────────────────
  const isSearching = searchQuery.trim().length > 0
  const q = searchQuery.trim()

  const filteredTags = useMemo(() => {
    if (!isSearching) return null
    const qNorm = normalize(q)
    return vocabulary.filter((t) => normalize(t.value).startsWith(qNorm))
  }, [isSearching, q, vocabulary])

  // ─── Autocomplete ────────────────────────────────────────────────────────
  useAutocompleteGhost(isSearching, searchQuery, vocabulary, (t) => t.value)

  // Foldere relevante pentru căutare (conțin cel puțin un tag din filteredTags)
  const relevantGroupIds = useMemo(() => {
    if (!filteredTags) return null
    const tagSet = new Set(filteredTags.map((t) => t.value))
    return new Set(
      tagGroups
        .filter((g) =>
          (tagGroupMembers[g.id] ?? []).some((t) => tagSet.has(t))
        )
        .map((g) => g.id)
    )
  }, [filteredTags, tagGroups, tagGroupMembers])

  // ─── Lista de foldere afișată în coloana stângă ──────────────────────────
  const visibleGroups = useMemo(() => {
    if (isSearching) {
      // La căutare: ascunde „Toate", arată doar foldere cu rezultate
      return tagGroups.filter((g) => relevantGroupIds?.has(g.id))
    }
    // Normal: „Toate" primul, apoi celelalte
    return [ALL_GROUP, ...tagGroups]
  }, [isSearching, tagGroups, relevantGroupIds])

  // ─── Tag-uri afișate în coloana dreaptă ──────────────────────────────────
  const visibleTags = useMemo(() => {
    if (isSearching) {
      return filteredTags ?? []
    }
    if (activeGroupId === ALL_GROUP.id) {
      return vocabulary
    }
    const members = tagGroupMembers[activeGroupId] ?? []
    return vocabulary.filter((t) => members.includes(t.value))
  }, [isSearching, filteredTags, activeGroupId, vocabulary, tagGroupMembers])

  // Contor tag-uri per folder (pentru display)
  const groupCount = useCallback(
    (groupId) => (tagGroupMembers[groupId] ?? []).length,
    [tagGroupMembers]
  )

  // ─── Selecție tag-uri (coloana dreaptă) ──────────────────────────────────
  const toggleTagSelect = (tagValue) => {
    setSelectedTagValues((prev) => {
      const next = new Set(prev)
      if (next.has(tagValue)) next.delete(tagValue)
      else next.add(tagValue)
      return next
    })
  }

  // ─── Selecție foldere (coloana stângă) ───────────────────────────────────
  const toggleGroupSelect = (groupId) => {
    setSelectedGroupIds((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }

  // ─── Salvare asociere ─────────────────────────────────────────────────────
  const handleSave = () => {
    if (selectedTagValues.size === 0) return
    if (selectedGroupIds.size > 0) {
      associateTagsToGroups({
        targetGroupIds: [...selectedGroupIds],
        tagValues: [...selectedTagValues],
      })
    }
    exitOrganizeMode()
  }

  // ─── Creare folder nou cu tag-urile selectate ─────────────────────────────
  const handleCreateFolder = () => {
    if (!newFolderName.trim() || selectedTagValues.size === 0) return
    createGroupWithTags({
      groupName: newFolderName.trim(),
      tagValues: [...selectedTagValues],
    })
    setNewFolderName('')
    setNewFolderMode(false)
    exitOrganizeMode()
  }

  // ─── Exit modul organizare ────────────────────────────────────────────────
  const exitOrganizeMode = () => {
    setOrganizeMode(false)
    setSelectedTagValues(new Set())
    setSelectedGroupIds(new Set())
    setNewFolderMode(false)
    setNewFolderName('')
  }

  // ─── Derivate ──────────────────────────────────────────────────────────────
  const hasTagsSelected = selectedTagValues.size > 0
  const hasGroupsSelected = selectedGroupIds.size > 0

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col flex-1 min-h-0 relative">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="px-4 pt-4 pb-2 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tag size={18} className="text-zinc-400" />
          <h2 className="text-lg font-bold text-zinc-100">Tags</h2>
        </div>
        <button
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center rounded-xl text-zinc-400 active:bg-zinc-800 active:text-zinc-100"
          aria-label="Închide"
        >
          <X size={18} />
        </button>
      </div>

      {/* ── Bandă stare modul organizare ─────────────────────────────────── */}
      {organizeMode && (
        <div className="px-4 pb-2 shrink-0">
          <p className="text-xs text-blue-400 font-medium">
            {hasTagsSelected
              ? `${selectedTagValues.size} tag${selectedTagValues.size !== 1 ? '-uri' : ''} selectat${selectedTagValues.size !== 1 ? 'e' : ''} · bifează foldere pentru asociere`
              : 'Bifează tag-uri din dreapta, apoi foldere din stânga'}
          </p>
        </div>
      )}

      {/* ── Separator ────────────────────────────────────────────────────── */}
      <div className="shrink-0 h-px bg-zinc-800" />

      {/* ── Layout 2 coloane ─────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">
        {/* Coloana stângă — Foldere */}
        <div className="w-[42%] border-r border-zinc-800 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto pb-16">
            {visibleGroups.length === 0 && isSearching && (
              <p className="px-3 py-4 text-xs text-zinc-600 italic">Niciun folder cu rezultate</p>
            )}
            {visibleGroups.length === 0 && !isSearching && (
              <p className="px-3 py-4 text-xs text-zinc-600 italic">Niciun folder creat</p>
            )}
            {visibleGroups.map((group) => {
              const isVirtual = group.isVirtual
              const isActive = activeGroupId === group.id && !isSearching && !organizeMode
              const count = isVirtual ? vocabulary.length : groupCount(group.id)
              const isGroupSelected = organizeMode && !isVirtual && selectedGroupIds.has(group.id)
              // Număr de tag-uri relevante pentru căutare (în modul search)
              const searchCount = isSearching && !isVirtual
                ? (tagGroupMembers[group.id] ?? []).filter(
                    (t) => filteredTags?.some((ft) => ft.value === t)
                  ).length
                : null

              return (
                <button
                  key={group.id}
                  onClick={() => {
                    if (organizeMode && !isVirtual) {
                      // În modul organizare: tap pe folder → toggle selecție folder
                      toggleGroupSelect(group.id)
                    } else if (!isSearching && !organizeMode) {
                      setActiveGroupId(group.id)
                    }
                  }}
                  className={[
                    'w-full flex items-center gap-2 px-3 py-3 text-left transition-colors',
                    isActive
                      ? 'bg-blue-900/30 text-blue-300'
                      : isGroupSelected
                      ? 'bg-blue-900/20 text-blue-300'
                      : 'text-zinc-400 active:bg-zinc-800/50',
                  ].join(' ')}
                >
                  {/* Checkbox selecție grup (modul organizare, non-virtual) */}
                  {organizeMode && !isVirtual && (
                    <span className="shrink-0">
                      {isGroupSelected
                        ? <CheckSquare size={15} className="text-blue-400" />
                        : <Square size={15} className="text-zinc-600" />}
                    </span>
                  )}
                  {/* Iconiță folder */}
                  {isVirtual
                    ? <Tag size={14} className="shrink-0 opacity-60" />
                    : isActive
                    ? <FolderOpen size={14} className="shrink-0" />
                    : <Folder size={14} className="shrink-0 opacity-60" />}

                  <span className="flex-1 text-xs font-medium truncate leading-snug">
                    {group.name}
                  </span>
                  <span className="text-[10px] text-zinc-600 shrink-0 tabular-nums">
                    {isSearching && searchCount !== null ? searchCount : count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Buton „+ Folder nou" — doar în modul organizare cu tag-uri selectate */}
          {organizeMode && hasTagsSelected && !newFolderMode && (
            <button
              onClick={() => setNewFolderMode(true)}
              className="shrink-0 flex items-center gap-2 px-3 py-3 border-t border-zinc-800 text-blue-400 text-xs font-medium active:bg-zinc-800/50"
            >
              <Plus size={14} />
              Folder nou
            </button>
          )}

          {/* Input creare folder nou */}
          {newFolderMode && (
            <div className="shrink-0 border-t border-zinc-800 p-2 flex gap-1">
              <input
                autoFocus
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateFolder()
                  if (e.key === 'Escape') setNewFolderMode(false)
                }}
                placeholder="Nume folder..."
                className="flex-1 min-w-0 bg-zinc-800 text-zinc-100 text-xs rounded-lg px-2 py-1.5 placeholder:text-zinc-600 outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                onClick={handleCreateFolder}
                disabled={!newFolderName.trim()}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-blue-600 text-white disabled:opacity-40 active:bg-blue-700"
              >
                <Check size={13} />
              </button>
              <button
                onClick={() => setNewFolderMode(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-500 active:bg-zinc-800"
              >
                <X size={13} />
              </button>
            </div>
          )}
        </div>

        {/* Coloana dreaptă — Tag-uri */}
        <div className="flex-1 overflow-y-auto pb-16">
          {visibleTags.length === 0 ? (
            <p className="px-4 py-4 text-xs text-zinc-600 italic">
              {isSearching ? 'Niciun tag găsit' : 'Niciun tag în acest folder'}
            </p>
          ) : (
            visibleTags.map((tag) => {
              const isTagSelected = organizeMode && selectedTagValues.has(tag.value)
              // Foldere care conțin acest tag (pentru badge info)
              const belongsToCount = (tagToGroups[tag.value] ?? []).length

              return (
                <button
                  key={tag.value}
                  onClick={() => {
                    if (organizeMode) toggleTagSelect(tag.value)
                    // Read-Only: tap pe tag = no-op (extensibil în viitor)
                  }}
                  className={[
                    'w-full flex items-center gap-2 px-4 py-3 text-left border-b border-zinc-800/50 last:border-b-0 transition-colors',
                    isTagSelected ? 'bg-blue-900/20' : organizeMode ? 'active:bg-zinc-800/40' : '',
                  ].join(' ')}
                >
                  {/* Checkbox selecție tag (modul organizare) */}
                  {organizeMode && (
                    <span className="shrink-0">
                      {isTagSelected
                        ? <CheckSquare size={15} className="text-blue-400" />
                        : <Square size={15} className="text-zinc-600" />}
                    </span>
                  )}

                  <span className="flex-1 text-sm text-zinc-200 font-medium truncate">
                    {tag.value}
                  </span>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Badge: câte foldere conțin tag-ul */}
                    {belongsToCount > 0 && (
                      <span className="text-[10px] text-zinc-600">
                        {belongsToCount}f
                      </span>
                    )}
                    {/* Frecvența tag-ului în items */}
                    {tag.count > 0 && (
                      <span className="text-xs text-zinc-500 tabular-nums w-4 text-right">
                        {tag.count}
                      </span>
                    )}
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* ── Footer fix de acțiune (mod organizare) ───────────────────────── */}
      {organizeMode && (
        <div className="absolute bottom-0 left-0 right-0 z-20 flex items-center gap-2.5 px-4 py-2 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur-md">
          <button
            onClick={exitOrganizeMode}
            className="px-4 py-1.5 rounded-lg text-sm text-zinc-300 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 transition-colors"
          >
            Anulează
          </button>
          <button
            onClick={handleSave}
            disabled={!hasTagsSelected || !hasGroupsSelected}
            className={[
              'flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-sm font-semibold transition-colors',
              hasTagsSelected && hasGroupsSelected
                ? 'bg-blue-600 text-white hover:bg-blue-500 active:bg-blue-700'
                : 'bg-zinc-800 text-zinc-500 cursor-not-allowed',
            ].join(' ')}
          >
            <Check size={16} className="shrink-0" />
            <span>Salvează asocierile</span>
          </button>
        </div>
      )}

      {/* ── Actions Sheet (din BottomBar) ──────────────────────────────── */}
      <BottomSheet
        open={actionsSheetOpen}
        onClose={() => setActionsSheetOpen(false)}
      >
        <div className="pb-6">
          <h3 className="px-4 pt-2 pb-3 text-sm font-medium text-zinc-400 text-center border-b border-zinc-800/50 mb-2">
            Acțiuni Tags
          </h3>
          <button
            onClick={() => {
              setActionsSheetOpen(false)
              if (organizeMode) {
                exitOrganizeMode()
              } else {
                setOrganizeMode(true)
              }
            }}
            className="w-full flex items-center gap-4 px-6 py-4 active:bg-zinc-800 transition-colors"
          >
            <CheckSquare size={20} className="text-blue-400 shrink-0" />
            <span className="text-sm font-medium text-blue-400">
              {organizeMode ? 'Anulează selecția' : 'Selectează'}
            </span>
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}
