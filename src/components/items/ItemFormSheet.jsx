// [ITEMS FEATURE] — ComponentA izolată, removable.
import { useEffect, useState, useRef } from 'react'
import { Tag, ChevronRight, Save, MoreHorizontal } from 'lucide-react'
import BottomSheet from '../catalog/BottomSheet'
import PickerSheet from '../catalog/PickerSheet'
import MultiTagSheet from './MultiTagSheet'
import { useItemsStore } from '../../store/useItemsStore'
import { useAppStore } from '../../store/useAppStore'
import { NO_AUTOFILL_PROPS } from '../../utils/formProps'

export default function ItemFormSheet({ open, onClose, showToast, initialData }) {
  const addItem = useItemsStore((s) => s.addItem)
  const updateItem = useItemsStore((s) => s.updateItem)
  const getTagVocabulary = useItemsStore((s) => s.getTagVocabulary)
  const multiTags = useItemsStore((s) => s.multiTags)
  const setBottomBarHidden = useAppStore((s) => s.setBottomBarHidden)

  const [value, setValue] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState([])
  const [moment, setMoment] = useState('')
  const [isIncomplete, setIsIncomplete] = useState(false)
  const [saving, setSaving] = useState(false)
  const [picker, setPicker] = useState(null)
  const [tagVocab, setTagVocab] = useState(null)

  const descRef = useRef(null)
  const momentRef = useRef(null)
  const prevOpenRef = useRef(false)

  useEffect(() => {
    setBottomBarHidden(open && picker !== 'tags' && picker !== 'multitag_apply' && picker !== 'multitag_manager')
  }, [open, picker, setBottomBarHidden])

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      if (initialData) {
        setValue(initialData.value.toString())
        setDescription(initialData.description || '')
        setTags(initialData.tags || [])
        setIsIncomplete(initialData.isIncomplete || false)
        setMoment(initialData.moment ? initialData.moment.slice(0, 16) : '')
      } else {
        setValue('')
        setDescription('')
        setTags([])
        setIsIncomplete(false)
        const now = new Date()
        const pad = (n) => String(n).padStart(2, '0')
        const local = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`
        setMoment(local)
      }
      setSaving(false)
      setPicker(null)
      setTagVocab(null)
    } else if (!open && prevOpenRef.current) {
      setValue('')
      setDescription('')
      setTags([])
      setIsIncomplete(false)
      setMoment('')
      setSaving(false)
      setPicker(null)
      setTagVocab(null)
    }
    prevOpenRef.current = open
  }, [open, initialData])

  useEffect(() => () => setBottomBarHidden(false), [setBottomBarHidden])

  if (!open) return null

  // SWAP: multitag manager
  if (picker === 'multitag_manager') {
    return (
      <MultiTagSheet 
        isOpen={true} 
        onClose={() => setPicker(null)} 
      />
    )
  }

  // SWAP: multitag apply (picker)
  if (picker === 'multitag_apply') {
    const items = multiTags.map(mt => ({
      value: mt.name,
      count: mt.tags.length
    }))

    return (
      <PickerSheet
        open
        title="Aplică MultiTag"
        items={items}
        selected={[]}
        multiSelect={false}
        allowCreate={false}
        searchPlaceholder="Caută MultiTag..."
        emptyLabel="Niciun MultiTag salvat"
        onConfirm={({ selected }) => {
          if (selected.length > 0) {
            const mtName = selected[0]
            const mt = multiTags.find((m) => m.name === mtName)
            if (mt) {
              setTags((prev) => [...new Set([...prev, ...mt.tags])])
            }
          }
          setPicker(null)
        }}
        onClose={() => setPicker(null)}
      />
    )
  }

  // SWAP: tags picker
  if (picker === 'tags') {
    if (tagVocab === null) {
      const vocab = getTagVocabulary()
      setTagVocab(vocab)
    }

    const items = [
      ...(tagVocab ?? []),
      ...tags
        .filter((t) => !(tagVocab ?? []).some((v) => v.value === t))
        .map((t) => ({ value: t, count: 0 })),
    ]

    items.sort((a, b) => {
      const selA = tags.includes(a.value) ? 1 : 0
      const selB = tags.includes(b.value) ? 1 : 0
      if (selA !== selB) return selB - selA
      if (a.count !== b.count) return b.count - a.count
      return a.value.localeCompare(b.value)
    })

    return (
      <PickerSheet
        open
        title="Tags"
        items={items}
        selected={tags}
        multiSelect
        allowCreate
        searchPlaceholder="Caută sau adaugă tag..."
        emptyLabel="Niciun tag încă — scrie pentru a adăuga"
        onConfirm={({ selected }) => {
          setTags(selected)
          setTagVocab(null) // invalidăm cache-ul vocab după modificare
          setPicker(null)
        }}
        onClose={() => setPicker(null)}
      />
    )
  }

  const handleSave = () => {
    if (!value.trim()) {
      showToast?.('Introduceți o valoare numerică')
      return
    }
    setSaving(true)
    if (initialData) {
      updateItem(initialData.id, { value, description, tags, moment, isIncomplete })
      showToast?.('Element actualizat')
    } else {
      addItem({ value, description, tags, moment, isIncomplete })
      showToast?.('Element adăugat')
    }
    setSaving(false)
    onClose?.()
  }

  const handleCancel = () => {
    onClose?.()
  }

  return (
    <BottomSheet open={open} onClose={handleCancel}>
      <div className="px-4 pb-6 overflow-y-auto max-h-[80dvh]">
        {/* Valoare */}
        <div className="mt-2">
          <label className="block text-xs text-zinc-400 font-medium mb-1">Valoare</label>
          <div className="flex gap-2 items-stretch">
            <input
              type="search"
              inputMode="numeric"
              name="flux-item-val"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="ex: 42"
              {...NO_AUTOFILL_PROPS}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  descRef.current?.focus()
                }
              }}
              className="flex-1 min-w-0 bg-zinc-800 rounded-xl px-3 h-11 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:ring-1 focus:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button 
              type="button"
              onClick={() => setIsIncomplete(!isIncomplete)}
              className={`w-11 flex-shrink-0 flex items-center justify-center rounded-xl font-bold transition-colors ${isIncomplete ? 'bg-orange-500 text-white active:bg-orange-600' : 'bg-orange-500/20 text-orange-400 active:bg-orange-500/30'}`}
            >
              <MoreHorizontal size={20} />
            </button>
            <button 
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="w-11 flex-shrink-0 flex items-center justify-center bg-blue-600 rounded-xl text-white active:bg-blue-700 disabled:opacity-50"
            >
              <Save size={20} />
            </button>
          </div>
        </div>

        {/* Descriere */}
        <div className="mt-4">
          <label className="block text-xs text-zinc-400 font-medium mb-1">Descriere</label>
          <input
            ref={descRef}
            type="search"
            name="flux-item-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Scrie o descriere..."
            {...NO_AUTOFILL_PROPS}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                setTagVocab(null)
                setPicker('tags')
              }
            }}
            className="w-full bg-zinc-800 rounded-xl px-3 h-11 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Tags */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1">
            <label className="flex items-center gap-1.5 text-xs text-zinc-400 font-medium">
              <Tag size={12} /> Tags
            </label>
            <button
              onClick={() => setPicker('multitag_manager')}
              className="text-xs text-purple-400 font-semibold bg-purple-500/10 px-2 py-0.5 rounded active:bg-purple-500/20"
            >
              MultiTag
            </button>
          </div>
          <div className="flex gap-2 items-stretch mt-1">
            <div
              onClick={() => {
                setTagVocab(null)
                setPicker('tags')
              }}
              className="flex-1 flex items-center bg-zinc-800 rounded-xl px-3 h-11 cursor-pointer active:bg-zinc-700"
            >
              {tags.length === 0 ? (
                <span className="text-sm text-zinc-500">Adaugă tag-uri</span>
              ) : (
                <span className="text-sm text-zinc-100 font-medium">
                  {tags.length} tag{tags.length !== 1 ? 'uri' : ''}
                </span>
              )}
            </div>
            <button
               onClick={() => setPicker('multitag_apply')}
               className="w-11 flex-shrink-0 flex items-center justify-center bg-zinc-800 rounded-xl active:bg-zinc-700 text-zinc-400"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        {/* Moment */}
        <div className="mt-4">
          <label className="block text-xs text-zinc-400 font-medium mb-1">Moment</label>
          <input
            ref={momentRef}
            type="datetime-local"
            name="flux-item-moment"
            value={moment}
            onChange={(e) => setMoment(e.target.value)}
            {...NO_AUTOFILL_PROPS}
            className="w-full bg-zinc-800 rounded-xl px-3 h-11 text-sm text-zinc-100 outline-none focus:ring-1 focus:ring-blue-500 [color-scheme:dark]"
          />
        </div>

        {/* Acțiuni */}
        <div className="flex gap-3 mt-5">
          <button
            onClick={handleCancel}
            className="flex-1 h-11 rounded-xl bg-zinc-800 text-sm text-zinc-300 active:bg-zinc-700"
          >
            Anulează
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={[
              'flex-1 h-11 rounded-xl text-sm font-medium',
              saving ? 'bg-zinc-700 text-zinc-500' : 'bg-blue-600 text-white active:bg-blue-700',
            ].join(' ')}
          >
            Salvează
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}
