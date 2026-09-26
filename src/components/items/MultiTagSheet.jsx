// [ITEMS FEATURE] — Componentă izolată, removable.
// MultiTagSheet — Manager de preset-uri reutilizabile de etichete (MultiTag-uri)
//
// Props (v1 — manager only):
//   isOpen   {boolean}  obligatoriu — vizibilitate sheet
//   onClose  {fn}       Callback pentru închidere
//
// Flux:
//   1. Step LIST: lista MultiTag-uri existente, filtrată prin BottomBar.
//      - Secțiune "Pinned" (elemente fixate) și secțiune "Unpinned".
//      - tap pe un MultiTag → deschide mod EDIT_TAGS
//      - zero rezultate în căutare → CTA „Adaugă MultiTag <denumire>"
//   2. Step PICK_TAGS (CRARE) / EDIT_TAGS (EDITARE): SWAP cu TagGroupsPicker
//      - Utilizatorul bifează taguri / modifică numele
//      - Salvează → addMultiTag / updateMultiTag → revine la LIST
//
// v2 (viitor): se va adăuga prop onApply(tags) pentru aplicare pe înregistrări

import { useState, useEffect, useMemo } from 'react'
import { Tags, ChevronDown, ChevronRight, Plus, Trash2, X, Pin } from 'lucide-react'
import { useItemsStore } from '../../store/useItemsStore'
import { useAppStore } from '../../store/useAppStore'
import { useBottomSearch } from '../../hooks/useBottomSearch'
import BottomSheet from '../catalog/BottomSheet'
import TagGroupsPicker from './TagGroupsPicker'

const SEARCH_CTX = 'multitag_sheet'

export default function MultiTagSheet({ isOpen, onClose }) {
  const multiTags = useItemsStore((s) => s.multiTags)
  const multiTagsPinnedExpanded = useItemsStore((s) => s.multiTagsPinnedExpanded)
  const toggleMultiTagsPinnedExpanded = useItemsStore((s) => s.toggleMultiTagsPinnedExpanded)
  
  const addMultiTag = useItemsStore((s) => s.addMultiTag)
  const updateMultiTag = useItemsStore((s) => s.updateMultiTag)
  const deleteMultiTag = useItemsStore((s) => s.deleteMultiTag)
  const toggleMultiTagPin = useItemsStore((s) => s.toggleMultiTagPin)
  const getMultiTagsSorted = useItemsStore((s) => s.getMultiTagsSorted)

  const pushSearchContext = useAppStore((s) => s.pushSearchContext)
  const popSearchContext = useAppStore((s) => s.popSearchContext)
  const clearSearch = useAppStore((s) => s.clearSearch)
  const searchQuery = useAppStore((s) => s.searchQuery)

  // ─── State intern ──────────────────────────────────────────────────────────
  const [step, setStep] = useState('LIST') // 'LIST' | 'PICK_TAGS' | 'EDIT_TAGS'
  const [pendingName, setPendingName] = useState('')
  const [editingMtId, setEditingMtId] = useState(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)
  const [searchOverride, setSearchOverride] = useState(null)

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
      setEditingMtId(null)
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

  const isSearchActive = trimmedQuery.length > 0
  
  useEffect(() => {
    if (isSearchActive) {
      setSearchOverride(true)
    } else {
      setSearchOverride(null)
    }
  }, [isSearchActive])

  const effectivelyExpanded = searchOverride !== null ? searchOverride : multiTagsPinnedExpanded

  const handleTogglePinned = () => {
    if (searchOverride !== null) {
      setSearchOverride(!searchOverride)
    } else {
      toggleMultiTagsPinnedExpanded()
    }
  }

  // ─── Secțiuni Listă ────────────────────────────────────────────────────────
  const pinnedList = useMemo(() => filteredMultiTags.filter(mt => mt.isPinned), [filteredMultiTags])
  const unpinnedList = useMemo(() => filteredMultiTags.filter(mt => !mt.isPinned), [filteredMultiTags])

  // ─── Handlers ──────────────────────────────────────────────────────────────
  const handleCreateRequest = () => {
    setPendingName(trimmedQuery)
    setStep('PICK_TAGS')
  }

  const handleEditRequest = (mt) => {
    setEditingMtId(mt.id)
    setStep('EDIT_TAGS')
  }

  const handleDeleteRequest = (e, id) => {
    e.stopPropagation()
    setDeleteConfirmId(id === deleteConfirmId ? null : id)
  }

  const handleDeleteConfirm = (e, id) => {
    e.stopPropagation()
    deleteMultiTag(id)
    setDeleteConfirmId(null)
  }

  const handleTogglePin = (e, id) => {
    e.stopPropagation()
    toggleMultiTagPin(id)
  }

  // ─── Renders ───────────────────────────────────────────────────────────────

  const renderMultiTagRow = (mt) => {
    const isDeletePending = deleteConfirmId === mt.id

    return (
      <div key={mt.id} className="border-b border-zinc-800/50 last:border-b-0">
        <div className="flex items-stretch w-full active:bg-zinc-800/40 transition-colors">
          {/* Pin Button */}
          <button
            onClick={(e) => handleTogglePin(e, mt.id)}
            className="px-4 py-3.5 flex items-center justify-center shrink-0"
            aria-label="Fixează/Defixează"
          >
            <Pin
              size={16}
              className={`transition-colors ${mt.isPinned ? 'text-blue-500 fill-blue-500/20' : 'text-zinc-600'}`}
            />
          </button>

          {/* Nume & Tags (apăsare pt Edit) */}
          <button
            onClick={() => handleEditRequest(mt)}
            className="flex-1 flex items-center py-3.5 pr-2 text-left min-w-0"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-zinc-100 truncate">
                {mt.name}
              </p>
              {mt.tags.length > 0 && (
                <p className="text-xs text-zinc-500 mt-0.5 truncate">
                  {mt.tags.slice(0, 4).join(', ')}
                  {mt.tags.length > 4 && ` +${mt.tags.length - 4}`}
                </p>
              )}
            </div>
          </button>

          {/* Contor + Trash */}
          <div className="flex items-center pr-4 shrink-0 gap-3">
            <span className="text-xs text-zinc-600 tabular-nums">
              <span className="font-bold text-white">{mt.tags.length}</span> tag{mt.tags.length !== 1 ? 'uri' : ''}
            </span>
            <button
              onClick={(e) => handleDeleteRequest(e, mt.id)}
              className={
                'w-8 h-8 flex items-center justify-center rounded-lg transition-colors shrink-0 ' +
                (isDeletePending
                  ? 'bg-red-600/20 text-red-400'
                  : 'text-zinc-600 active:bg-zinc-700 active:text-zinc-300')
              }
              aria-label="Șterge MultiTag"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>

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
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SWAP: 'PICK_TAGS' (Creare nou)
  // ─────────────────────────────────────────────────────────────────────────
  if (step === 'PICK_TAGS') {
    return (
      <BottomSheet open={isOpen} onClose={onClose} aboveBottomBar>
        <TagGroupsPicker
          selectionMode={true}
          initialTitle={pendingName}
          editableTitle={true}
          onConfirm={(selectedTags, newName) => {
            if (selectedTags.length > 0) {
              addMultiTag({ name: newName || pendingName, tags: selectedTags })
            }
            setStep('LIST')
          }}
          onBack={() => setStep('LIST')}
          onClose={onClose}
        />
      </BottomSheet>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SWAP: 'EDIT_TAGS' (Editare existent)
  // ─────────────────────────────────────────────────────────────────────────
  if (step === 'EDIT_TAGS') {
    const editingMt = multiTags.find(mt => mt.id === editingMtId)
    if (!editingMt) {
      setStep('LIST')
      return null
    }

    return (
      <BottomSheet open={isOpen} onClose={onClose} aboveBottomBar>
        <TagGroupsPicker
          selectionMode={true}
          initialSelectedTags={editingMt.tags}
          initialTitle={editingMt.name}
          editableTitle={true}
          onConfirm={(selectedTags, newName) => {
            if (selectedTags.length > 0) {
              updateMultiTag(editingMt.id, { name: newName || editingMt.name, tags: selectedTags })
            } else {
              // Daca lasa 0 taguri, dezactivat oricum in TagGroupsPicker
            }
            setStep('LIST')
          }}
          onBack={() => setStep('LIST')}
          onClose={onClose}
        />
      </BottomSheet>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SWAP: 'LIST' (Consultare/Manager MultiTag-uri)
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <BottomSheet open={isOpen} onClose={onClose} aboveBottomBar>
      <div className="flex flex-col flex-1 min-h-0 relative">
        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div className="px-4 pt-4 pb-2 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tags size={18} className="text-purple-400" />
            <h2 className="text-lg font-bold text-zinc-100">MultiTag</h2>
            {isFiltering && !zeroMatches && (
              <span className="ml-2 px-2 py-0.5 rounded-md bg-zinc-800 text-[10px] font-semibold text-zinc-400">
                {filteredMultiTags.length} rezultate
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

          {/* Secțiunea Pinned */}
          {pinnedList.length > 0 && (
            <div className="mb-2">
              <button
                onClick={handleTogglePinned}
                className="w-full flex items-center gap-2 px-4 py-2 text-left bg-zinc-900/50 active:bg-zinc-800/50 transition-colors"
              >
                <ChevronDown
                  size={14}
                  className={`text-zinc-500 transition-transform ${!effectivelyExpanded ? '-rotate-90' : ''}`}
                />
                <span className="text-xs font-semibold text-zinc-400 tracking-wide uppercase">
                  {!effectivelyExpanded ? `${pinnedList.length} fixate` : 'Fixate'}
                </span>
              </button>
              
              {effectivelyExpanded && (
                <div className="border-b border-zinc-800/50">
                  {pinnedList.map(renderMultiTagRow)}
                </div>
              )}
            </div>
          )}

          {/* Header Unpinned (dacă avem ambele) */}
          {pinnedList.length > 0 && unpinnedList.length > 0 && (
            <div className="px-4 py-2 mt-2">
              <span className="text-xs font-semibold text-zinc-600 tracking-wide uppercase">Toate</span>
            </div>
          )}

          {/* Lista Unpinned (sau simplă) */}
          {unpinnedList.map(renderMultiTagRow)}

          {/* CTA Creare la 0 potriviri de căutare */}
          {showAddCTA && (
            <div className="px-4 pt-4 pb-2">
              <div className="p-4 bg-zinc-900/50 rounded-xl border border-zinc-800 border-dashed text-center">
                <p className="text-sm text-zinc-400 mb-3">
                  Nu există niciun MultiTag cu numele „<span className="font-semibold text-zinc-200">{trimmedQuery}</span>”
                </p>
                <button
                  onClick={handleCreateRequest}
                  className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  <Plus size={18} />
                  Adaugă MultiTag
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </BottomSheet>
  )
}