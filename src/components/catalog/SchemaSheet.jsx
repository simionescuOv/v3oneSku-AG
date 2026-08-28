import { useEffect, useState, useCallback } from 'react'
import { ChevronRight, ChevronLeft, Plus, Type, List, Cog, Filter, Eye, Check } from 'lucide-react'
import BottomSheet from './BottomSheet'
import { useCatalogStore } from '../../store/useCatalogStore'
import { useAppStore } from '../../store/useAppStore'
import { getAllAttributeTypes } from '../../lib/attributeTypes'

// Schema de atribute a categoriei — bottom-sheet FĂRĂ căutare (BottomBar ascuns).
// Vizualizări: listă atribute → adăugare atribut → editare atribut / opțiunile unui atribut single_choice.
export default function SchemaSheet({ open, onClose, categoryId, showToast }) {
  const categoryAttributes = useCatalogStore((s) => s.categoryAttributes)
  const attributeOptions = useCatalogStore((s) => s.attributeOptions)
  const addAttribute = useCatalogStore((s) => s.addAttribute)
  const updateCategoryAttribute = useCatalogStore((s) => s.updateCategoryAttribute)
  const addAttributeOption = useCatalogStore((s) => s.addAttributeOption)
  const setBottomBarHidden = useAppStore((s) => s.setBottomBarHidden)

  const [view, setView] = useState('list') // 'list' | 'add' | 'options' | 'edit'
  const [attrName, setAttrName] = useState('')
  const [attrType, setAttrType] = useState('text')
  const [cardPreview, setCardPreview] = useState(false)
  const [filterable, setFilterable] = useState(false)

  const [optionValue, setOptionValue] = useState('')
  const [activeAttrId, setActiveAttrId] = useState(null)

  useEffect(() => {
    setBottomBarHidden(open)
    if (open) {
      setView('list')
      setAttrName('')
      setAttrType('text')
      setCardPreview(false)
      setFilterable(false)
      setOptionValue('')
      setActiveAttrId(null)
    }
  }, [open, setBottomBarHidden])

  useEffect(() => () => setBottomBarHidden(false), [setBottomBarHidden])

  // Gestul Back navighează înapoi prin sub-view-uri înainte de a închide sheet-ul
  // OBLIGATORIU înainte de orice early return (Rules of Hooks)
  const handleBackIntercept = useCallback(() => {
    if (view === 'options') { setView('edit'); return true }
    if (view === 'add' || view === 'edit') { setView('list'); return true }
    return false // view === 'list' → BottomSheet se închide
  }, [view])

  if (!open) return null

  const attrs = categoryAttributes
    .filter((a) => a.categoryId === categoryId)
    .sort((a, b) => a.position - b.position)
  const activeAttr = attrs.find((a) => a.id === activeAttrId)
  const activeOptions = attributeOptions
    .filter((o) => o.attributeId === activeAttrId)
    .sort((a, b) => a.position - b.position)

  const handleTypeSelect = (type) => {
    setAttrType(type)
    // Default inteligent după tip
    if (type === 'single_choice') {
      setCardPreview(true)
      setFilterable(true)
    } else {
      setCardPreview(false)
      setFilterable(false)
    }
  }

  const handleAddAttr = async () => {
    const res = await addAttribute(categoryId, attrName, attrType, filterable, null, cardPreview)
    if (!res.ok) {
      showToast?.(res.error)
      return
    }
    setAttrName('')
    setAttrType('text')
    setView('list')
  }

  const handleSaveEdit = async () => {
    if (!activeAttrId) return
    const res = await updateCategoryAttribute(activeAttrId, {
      name: attrName,
      filterable,
      cardPreview,
    })
    if (!res.ok) {
      showToast?.(res.error)
      return
    }
    setView('list')
  }

  const handleOpenEdit = (attr) => {
    setActiveAttrId(attr.id)
    setAttrName(attr.name)
    setAttrType(attr.type)
    setCardPreview(Boolean(attr.cardPreview))
    setFilterable(Boolean(attr.filterable))
    setView('edit')
  }

  const handleAddOption = async () => {
    const res = await addAttributeOption(activeAttrId, optionValue)
    if (!res.ok) {
      showToast?.(res.error)
      return
    }
    setOptionValue('')
  }

  return (
    <BottomSheet open={open} onClose={onClose} onBackIntercept={handleBackIntercept}>
      <div className="px-4 pb-6">
        {view === 'list' && (
          <>
            <h2 className="text-sm font-medium text-zinc-200 mb-3 text-center">Schema categoriei</h2>

            {/* Atribute de sistem — strict read-only, pur explicativ (SPEC_Tags §2) */}
            <p className="pb-1 text-[11px] font-medium tracking-wider text-zinc-600">DE SISTEM</p>
            <div className="divide-y divide-zinc-800/60 mb-3">
              <div className="flex items-start gap-3 py-2.5">
                <Cog size={16} className="text-zinc-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-zinc-400">NameID</p>
                  <p className="text-xs text-zinc-600">
                    Identificator generat automat la creare — unic, needitabil
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 py-2.5">
                <Cog size={16} className="text-zinc-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-zinc-400">Tags</p>
                  <p className="text-xs text-zinc-600">
                    Etichete libere, valabile în tot catalogul; se completează în formularul de produs
                  </p>
                </div>
              </div>
            </div>

            <p className="pb-1 text-[11px] font-medium tracking-wider text-zinc-600">ATRIBUTELE CATEGORIEI</p>
            <div className="divide-y divide-zinc-800 max-h-[50dvh] overflow-y-auto">
              {attrs.map((a) => (
                <div
                  key={a.id}
                  onClick={() => handleOpenEdit(a)}
                  className="w-full flex items-center gap-3 py-3 text-left active:bg-zinc-800/60 cursor-pointer"
                >
                  {a.type === 'single_choice' ? (
                    <List size={16} className="text-amber-400 shrink-0" />
                  ) : (
                    <Type size={16} className="text-zinc-400 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="block text-sm text-zinc-100 truncate">{a.name}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-zinc-500">
                        {a.type === 'single_choice' ? 'listă' : 'text'}
                      </span>
                      {a.cardPreview && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-blue-400 bg-blue-950/60 px-1.5 py-0.2 rounded">
                          <Eye size={10} /> Card
                        </span>
                      )}
                      {a.filterable && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-400 bg-emerald-950/60 px-1.5 py-0.2 rounded">
                          <Filter size={10} /> Filtru
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-zinc-600 shrink-0" />
                </div>
              ))}
              {attrs.length === 0 && (
                <div className="py-6 text-center text-sm text-zinc-500">Niciun atribut definit</div>
              )}
            </div>
            <button
              onClick={() => {
                setAttrName('')
                handleTypeSelect('text')
                setView('add')
              }}
              className="mt-4 w-full flex items-center justify-center gap-2 h-11 rounded-xl bg-blue-600 text-sm font-medium text-white active:bg-blue-700"
            >
              <Plus size={18} /> Adaugă atribut
            </button>
          </>
        )}

        {view === 'add' && (
          <>
            <div className="flex items-center mb-3">
              <button onClick={() => setView('list')} className="text-zinc-400 active:text-zinc-100">
                <ChevronLeft size={20} />
              </button>
              <h2 className="flex-1 text-sm font-medium text-zinc-200 text-center pr-5">Atribut nou</h2>
            </div>
            <input
              type="text"
              value={attrName}
              onChange={(e) => setAttrName(e.target.value)}
              placeholder="Numele atributului (ex: Culoare)"
              autoComplete="off"
              className="w-full bg-zinc-800 rounded-xl px-3 h-11 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:ring-1 focus:ring-blue-500"
            />
            <div className="flex gap-3 mt-3">
              {getAllAttributeTypes().map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => handleTypeSelect(id)}
                  className={[
                    'flex-1 flex items-center justify-center gap-2 h-11 rounded-xl text-sm',
                    attrType === id ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-300 active:bg-zinc-700',
                  ].join(' ')}
                >
                  <Icon size={16} /> {label}
                </button>
              ))}
            </div>

            {/* Setări date locale & filtrare */}
            <div className="mt-4 space-y-3 bg-zinc-900/60 p-3 rounded-xl border border-zinc-800">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cardPreview}
                  onChange={(e) => setCardPreview(e.target.checked)}
                  className="mt-1 rounded bg-zinc-800 border-zinc-700 text-blue-600 focus:ring-0"
                />
                <div>
                  <span className="text-xs font-medium text-zinc-200 block">Afișare pe Card & Păstrare locală</span>
                  <span className="text-[11px] text-zinc-500 block leading-tight">
                    Valoarea se descarcă mereu pentru afișare instantă pe liste și mod offline.
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filterable}
                  onChange={(e) => setFilterable(e.target.checked)}
                  className="mt-1 rounded bg-zinc-800 border-zinc-700 text-emerald-600 focus:ring-0"
                />
                <div>
                  <span className="text-xs font-medium text-zinc-200 block">Permite Filtrare (Faceted Search)</span>
                  <span className="text-[11px] text-zinc-500 block leading-tight">
                    Include acest atribut în dialogul de filtrare rapidă cu 2 coloane.
                  </span>
                </div>
              </label>
            </div>

            <button
              onClick={handleAddAttr}
              disabled={!attrName.trim()}
              className={[
                'mt-4 w-full h-11 rounded-xl text-sm font-medium',
                attrName.trim() ? 'bg-blue-600 text-white active:bg-blue-700' : 'bg-zinc-700 text-zinc-500',
              ].join(' ')}
            >
              Creează atribut
            </button>
          </>
        )}

        {view === 'edit' && activeAttr && (
          <>
            <div className="flex items-center mb-3">
              <button onClick={() => setView('list')} className="text-zinc-400 active:text-zinc-100">
                <ChevronLeft size={20} />
              </button>
              <h2 className="flex-1 text-sm font-medium text-zinc-200 text-center pr-5 truncate">
                Setări: {activeAttr.name}
              </h2>
            </div>
            <input
              type="text"
              value={attrName}
              onChange={(e) => setAttrName(e.target.value)}
              placeholder="Numele atributului"
              autoComplete="off"
              className="w-full bg-zinc-800 rounded-xl px-3 h-11 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:ring-1 focus:ring-blue-500"
            />

            {/* Setări date locale & filtrare */}
            <div className="mt-4 space-y-3 bg-zinc-900/60 p-3 rounded-xl border border-zinc-800">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cardPreview}
                  onChange={(e) => setCardPreview(e.target.checked)}
                  className="mt-1 rounded bg-zinc-800 border-zinc-700 text-blue-600 focus:ring-0"
                />
                <div>
                  <span className="text-xs font-medium text-zinc-200 block">Afișare pe Card & Păstrare locală</span>
                  <span className="text-[11px] text-zinc-500 block leading-tight">
                    Valoarea se descarcă mereu pentru afișare instantă pe liste și mod offline.
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filterable}
                  onChange={(e) => setFilterable(e.target.checked)}
                  className="mt-1 rounded bg-zinc-800 border-zinc-700 text-emerald-600 focus:ring-0"
                />
                <div>
                  <span className="text-xs font-medium text-zinc-200 block">Permite Filtrare (Faceted Search)</span>
                  <span className="text-[11px] text-zinc-500 block leading-tight">
                    Include acest atribut în dialogul de filtrare rapidă cu 2 coloane.
                  </span>
                </div>
              </label>
            </div>

            {activeAttr.type === 'single_choice' && (
              <button
                onClick={() => setView('options')}
                className="mt-3 w-full flex items-center justify-between px-3 py-2.5 bg-zinc-800 rounded-xl text-xs text-zinc-300 active:bg-zinc-700"
              >
                <span>Gestionează valorile posibile ale listei</span>
                <ChevronRight size={14} className="text-zinc-500" />
              </button>
            )}

            <button
              onClick={handleSaveEdit}
              disabled={!attrName.trim()}
              className={[
                'mt-4 w-full h-11 rounded-xl text-sm font-medium',
                attrName.trim() ? 'bg-blue-600 text-white active:bg-blue-700' : 'bg-zinc-700 text-zinc-500',
              ].join(' ')}
            >
              Salvează modificările
            </button>
          </>
        )}

        {view === 'options' && activeAttr && (
          <>
            <div className="flex items-center mb-3">
              <button onClick={() => setView('edit')} className="text-zinc-400 active:text-zinc-100">
                <ChevronLeft size={20} />
              </button>
              <h2 className="flex-1 text-sm font-medium text-zinc-200 text-center pr-5 truncate">
                {activeAttr.name} — opțiuni
              </h2>
            </div>
            <div className="divide-y divide-zinc-800 max-h-[40dvh] overflow-y-auto">
              {activeOptions.map((o) => (
                <div key={o.id} className="py-2.5 text-sm text-zinc-100">{o.value}</div>
              ))}
              {activeOptions.length === 0 && (
                <div className="py-6 text-center text-sm text-zinc-500">Nicio opțiune</div>
              )}
            </div>
            <div className="flex gap-3 mt-4">
              <input
                type="text"
                value={optionValue}
                onChange={(e) => setOptionValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && optionValue.trim()) handleAddOption() }}
                placeholder="Valoare nouă..."
                autoComplete="off"
                className="flex-1 bg-zinc-800 rounded-xl px-3 h-11 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                onClick={handleAddOption}
                disabled={!optionValue.trim()}
                className={[
                  'shrink-0 flex items-center justify-center w-11 h-11 rounded-xl',
                  optionValue.trim() ? 'bg-blue-600 text-white active:bg-blue-700' : 'bg-zinc-700 text-zinc-500',
                ].join(' ')}
              >
                <Plus size={18} />
              </button>
            </div>
          </>
        )}
      </div>
    </BottomSheet>
  )
}
