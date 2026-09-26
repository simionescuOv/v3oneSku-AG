// [ITEMS FEATURE] — Componentă izolată, removable.
// MultiTagSheet — Manager de preset-uri reutilizabile de etichete (MultiTag-uri)
//
// Props (v1 — manager only):
//   isOpen   {boolean}  obligatoriu — vizibilitate sheet
//   onClose  {fn}       Callback pentru închidere
//
// Flux:
//   1. Step LIST: lista MultiTag-uri existente, filtrată prin BottomBar.
//      - tap pe un MultiTag → expand/collapse vizualizare taguri conținute
//        (incrementează usageCount → ridică în clasament)
//      - zero rezultate în căutare → CTA „Adaugă MultiTag <denumire>"
//   2. Step PICK_TAGS: SWAP cu TagGroupsPicker în selectionMode
//      - Utilizatorul bifează taguri din layout-ul cu două coloane
//      - Salvează → addMultiTag({ name: pendingName, tags }) → close
//      - Înapoi → revine la step LIST
//
// v2 (viitor): se va adăuga prop onApply(tags) pentru aplicare pe înregistrări
// din dialogul de creare/editare, montat din ItemFormSheet sau similar.

import { useState, useEffect, useMemo } from 'react'
import { Tags, ChevronDown, ChevronRight, Plus, Trash2, X } from 'lucide-react'
import { useItemsStore } from '../../store/useItemsStore'
import { useAppStore } from '../../store/useAppStore'
import { useBottomSearch } from '../../hooks/useBottomSearch'
import BottomSheet from '../catalog/BottomSheet'
import TagGroupsPicker from './TagGroupsPicker'

const SEARCH_CTX = 'multitag_sheet'

export default function MultiTagSheet({ isOpen, onClose }) {
  const multiTags = useItemsStore((s) => s.multiTags)
  const addMultiTag = useItemsStore((s) => s.addMultiTag)
  const deleteMultiTag = useItemsStore((s) => s.deleteMultiTag)
  const incrementMultiTagUsage = useItemsStore((s) => s.incrementMultiTagUsage)
  const getMultiTagsSorted = useItemsStore((s) => s.getMultiTagsSorted)

  const pushSearchContext = useAppStore((s) => s.pushSearchContext)
  const popSearchContext = useAppStore((s) => s.popSearchContext)
  const clearSearch = useAppStore((s) => s.clearSearch)
  const searchQuery = useAppStore((s) => s.searchQuery)

  // ─── State intern ──────────────────────────────────────────────────────────
  const [step, setStep] = useState('LIST') // 'LIST' | 'PICK_TAGS'
  const [pendingName, setPendingName] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)

  // ─── BottomBar context (activ doar în step LIST) ───────────────────────────
  useEffect(() => {
    if (!isOpen || step !== 'LIST') return
    clearSearch()
    pushSearchContext(SEARCH_CTX, 'Caută sau tastează denumire...')
    return () => {
      clearSearch()
      popSearchContext(SEARCH_CTX)
    }
  }, [isOpen, step, pushSearchContext, popSearchContext, clearSearch])

  // ─── Reset la închidere ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) {
      setStep('LIST')
      setPendingName('')
      setExpandedId(null)
      setDeleteConfirmId(null)
    }
  }, [isOpen])

  // ─── Lista sortată + filtrare prin BottomSearch ────────────────────────────
  const sortedMultiTags = useMemo(() => getMultiTagsSorted(), [multiTags, getMultiTagsSorted])

  const { results: filteredMultiTags, isFiltering, query } = useBottomSearch(
    sortedMultiTags,
    (mt) => mt.name,
    { enabled: step === 'LIST', searchContext: SEARCH_CTX }
  )

  // Calcul stări CTA
  const trimmedQuery = query.trim()
  const zeroMatches = isFiltering && filteredMultiTags.length === 0
  const showAddCTA = zeroMatches && trimmedQuery.length > 0

  // ─── Handler expand/collapse (incrementează usage) ─────────────────────────
  const handleToggleExpand = (id) => {
    if (expandedId === id) {
      setExpandedId(null)
    } else {
      setExpandedId(id)
      incrementMultiTagUsage(id)
    }
    setDeleteConfirmId(null)
  }

  // ─── Handler delete ────────────────────────────────────────────────────────
  const handleDeleteRequest = (e, id) => {
    e.stopPropagation()
    setDeleteConfirmId(id === deleteConfirmId ? null : id)
  }

  const handleDeleteConfirm = (e, id) => {
    e.stopPropagation()
    deleteMultiTag(id)
    if (expandedId === id) setExpandedId(null)
    setDeleteConfirmId(null)
  }

  // ─── Handler CTA creare ────────────────────────────────────────────────────
  const handleAddCTA = () => {
    setPendingName(trimmedQuery)
    setStep('PICK_TAGS')
  }

  // ─── SWAP: step PICK_TAGS ──────────────────────────────────────────────────
  if (step === 'PICK_TAGS') {
    return (
      <BottomSheet open={isOpen} onClose={onClose} aboveBottomBar>
        <TagGroupsPicker
          selectionMode
          onConfirm={(selectedTags) => {
            if (selectedTags.length > 0) {
              addMultiTag({ name: pendingName, tags: selectedTags })
            }
            onClose()
          }}
          onBack={() => {
            setStep('LIST')
          }}
        />
      </BottomSheet>
    )
  }

  // ─── Render step LIST ──────────────────────────────────────────────────────
  if (!isOpen) return null

  return (
    <BottomSheet open={isOpen} onClose={onClose} aboveBottomBar>
      <div className="flex flex-col min-h-0 max-h-[75dvh]">

        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="px-4 pt-4 pb-3 shrink-0 flex items-center justify-between border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Tags size={18} className="text-purple-400" />
            <h2 className="text-base font-bold text-zinc-100">MultiTag</h2>
            {sortedMultiTags.length > 0 && (
              <span className="text-xs text-zinc-500 tabular-nums">
                {sortedMultiTags.length}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-zinc-400 active:bg-zinc-800 active:text-zinc-100"
            aria-label="Închide"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Lista MultiTag-uri ─────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto pb-2">

          {/* Empty state — nicio denumire tastată, lista goală */}
          {sortedMultiTags.length === 0 && !isFiltering && (
            <div className="px-4 py-10 text-center">
              <Tags size={32} className="text-zinc-700 mx-auto mb-3" />
              <p className="text-sm text-zinc-500 font-medium">Niciun MultiTag salvat</p>
              <p className="text-xs text-zinc-600 mt-1">
                Tastează o denumire în bara de căutare pentru a crea primul preset.
              </p>
            </div>
          )}

          {/* Lista filtrată */}
          {filteredMultiTags.map((mt) => {
            const isExpanded = expandedId === mt.id
            const isDeletePending = deleteConfirmId === mt.id

            return (
              <div key={mt.id} className="border-b border-zinc-800/50 last:border-b-0">
                {/* Rândul principal */}
                <button
                  onClick={() => handleToggleExpand(mt.id)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-zinc-800/40 transition-colors"
                >
                  {/* Chevron expand */}
                  <span className="shrink-0 text-zinc-600">
                    {isExpanded
                      ? <ChevronDown size={16} />
                      : <ChevronRight size={16} />
                    }
                  </span>

                  {/* Denumire + contor taguri */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-zinc-100 truncate">
                      {mt.name}
                    </p>
                    {!isExpanded && mt.tags.length > 0 && (
                      <p className="text-xs text-zinc-500 mt-0.5 truncate">
                        {mt.tags.slice(0, 4).join(', ')}
                        {mt.tags.length > 4 && ` +${mt.tags.length - 4}`}
                      </p>
                    )}
                  </div>

                  {/* Contor */}
                  <span className="shrink-0 text-xs text-zinc-600 tabular-nums">
                    {mt.tags.length} tag{mt.tags.length !== 1 ? 'uri' : ''}
                  </span>

                  {/* Buton delete */}
                  <button
                    onClick={(e) => handleDeleteRequest(e, mt.id)}
                    className={[
                      'shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-colors',
                      isDeletePending
                        ? 'bg-red-600/20 text-red-400'
                        : 'text-zinc-600 active:bg-zinc-700 active:text-zinc-300',
                    ].join(' ')}
                    aria-label="Șterge MultiTag"
                  >
                    <Trash2 size={15} />
                  </button>
                </button>

                {/* Confirmare delete */}
                {isDeletePending && (
                  <div className="mx-4 mb-3 flex items-center gap-2 px-3 py-2.5 bg-red-950/40 border border-red-800/40 rounded-xl">
                    <p className="flex-1 text-xs text-red-300">Ștergi „{mt.name}"?</p>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(null) }}
                      className="px-3 py-1 rounded-lg text-xs text-zinc-400 bg-zinc-800 active:bg-zinc-700"
                    >
                      Nu
                    </button>
                    <button
                      onClick={(e) => handleDeleteConfirm(e, mt.id)}
                      className="px-3 py-1 rounded-lg text-xs font-semibold text-white bg-red-600 active:bg-red-700"
                    >
                      Șterge
                    </button>
                  </div>
                )}

                {/* Taguri expandate */}
                {isExpanded && (
                  <div className="px-4 pb-3">
                    {mt.tags.length === 0 ? (
                      <p className="text-xs text-zinc-600 italic py-1">Niciun tag în acest preset</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {mt.tags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center px-2.5 py-1 rounded-lg bg-zinc-800 text-xs text-zinc-200 font-medium"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {/* Zero matches în căutare — dar NU showAddCTA (niciun rezultat, fără denumire tastată) */}
          {isFiltering && filteredMultiTags.length === 0 && !showAddCTA && (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-zinc-500">Niciun rezultat</p>
            </div>
          )}

          {/* CTA Adaugă MultiTag — apare când zero rezultate și există query */}
          {showAddCTA && (
            <button
              onClick={handleAddCTA}
              className="w-full flex items-center gap-3 px-4 py-4 text-left active:bg-zinc-800/50 transition-colors"
            >
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-purple-600/20 text-purple-400 shrink-0">
                <Plus size={18} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-purple-400">
                  Adaugă MultiTag
                </p>
                <p className="text-xs text-zinc-400 truncate mt-0.5">
                  „{trimmedQuery}"
                </p>
              </div>
            </button>
          )}
        </div>
      </div>
    </BottomSheet>
  )
}
