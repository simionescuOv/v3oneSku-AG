// [ITEMS FEATURE] — ComponentA izolată, removable.
import { useEffect, useState, useRef } from 'react'
import { X, Tag } from 'lucide-react'
import BottomSheet from '../catalog/BottomSheet'
import PickerSheet from '../catalog/PickerSheet'
import { useItemsStore } from '../../store/useItemsStore'
import { useAppStore } from '../../store/useAppStore'

// Bottom sheet pentru adăugarea unui item nou.
// Câmpuri: valoare (number), descriere (text), tags (PickerSheet SWAP), moment (datetime-local).
// Flux: Enter pe valoare → focus descriere → Enter → focus moment → tags se deschide manual.
export default function ItemFormSheet({ open, onClose, showToast, initialData }) {
  const addItem = useItemsStore((s) => s.addItem)
  const updateItem = useItemsStore((s) => s.updateItem)
  const getTagVocabulary = useItemsStore((s) => s.getTagVocabulary)
  const setBottomBarHidden = useAppStore((s) => s.setBottomBarHidden)

  const [value, setValue] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState([])
  const [moment, setMoment] = useState('')
  const [saving, setSaving] = useState(false)
  // SWAP pattern: null | 'tags'
  const [picker, setPicker] = useState(null)
  const [tagVocab, setTagVocab] = useState(null)

  const descRef = useRef(null)
  const momentRef = useRef(null)
  const prevOpenRef = useRef(false)

  // BottomBar ascuns când formularul e deschis (dar vizibil când e picker-ul de tags)
  useEffect(() => {
    setBottomBarHidden(open && picker !== 'tags')
  }, [open, picker, setBottomBarHidden])

  // Reset la deschidere, curăță la închidere
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      if (initialData) {
        setValue(initialData.value.toString())
        setDescription(initialData.description || '')
        setTags(initialData.tags || [])
        // initialData.moment este ISO 8601 (ex: "2023-10-14T15:30:00.000Z")
        // Trebuie trunchiat pentru input datetime-local
        setMoment(initialData.moment ? initialData.moment.slice(0, 16) : '')
      } else {
        setValue('')
        setDescription('')
        setTags([])
        // Pre-completează momentul cu data/ora curentă în format datetime-local
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
      setMoment('')
      setSaving(false)
      setPicker(null)
      setTagVocab(null)
    }
    prevOpenRef.current = open
  }, [open, initialData])

  useEffect(() => () => setBottomBarHidden(false), [setBottomBarHidden])

  if (!open) return null

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
      updateItem(initialData.id, { value, description, tags, moment })
      showToast?.('Element actualizat')
    } else {
      addItem({ value, description, tags, moment })
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
          <input
            type="number"
            inputMode="numeric"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="ex: 42"
            autoComplete="off"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                descRef.current?.focus()
              }
            }}
            className="w-full bg-zinc-800 rounded-xl px-3 h-11 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:ring-1 focus:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>

        {/* Descriere */}
        <div className="mt-4">
          <label className="block text-xs text-zinc-400 font-medium mb-1">Descriere</label>
          <input
            ref={descRef}
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Scrie o descriere..."
            autoComplete="off"
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
          <label className="flex items-center gap-1.5 text-xs text-zinc-400 font-medium mb-1">
            <Tag size={12} /> Tags
          </label>
          <div
            onClick={() => {
              setTagVocab(null)
              setPicker('tags')
            }}
            className="w-full flex items-center gap-2 flex-wrap bg-zinc-800 rounded-xl px-3 min-h-11 py-1.5 cursor-pointer active:bg-zinc-700"
          >
            {tags.length === 0 ? (
              <span className="flex-1 text-sm text-zinc-500">Adaugă tag-uri</span>
            ) : (
              tags.map((t) => (
                <span
                  key={t}
                  className="flex items-center gap-1.5 px-2.5 h-8 rounded-lg bg-zinc-700 text-sm text-zinc-100"
                >
                  {t}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setTags((prev) => prev.filter((x) => x !== t))
                    }}
                    className="flex items-center justify-center -mr-1 w-5 h-5 rounded-full active:bg-zinc-600"
                  >
                    <X size={13} />
                  </button>
                </span>
              ))
            )}
          </div>
        </div>

        {/* Moment */}
        <div className="mt-4">
          <label className="block text-xs text-zinc-400 font-medium mb-1">Moment</label>
          <input
            ref={momentRef}
            type="datetime-local"
            value={moment}
            onChange={(e) => setMoment(e.target.value)}
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
