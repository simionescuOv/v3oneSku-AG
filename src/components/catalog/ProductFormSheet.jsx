import { useEffect, useState, useRef } from 'react'
import { X, ChevronRight, Tag, Dices, ScanBarcode as ScanBarcodeIcon } from 'lucide-react'
import BottomSheet from './BottomSheet'
import PickerSheet from './PickerSheet'
import { useCatalogStore } from '../../store/useCatalogStore'
import { useAppStore } from '../../store/useAppStore'
import { normalize } from '../../lib/search'
import { generateRandomNameId, isNameIdAvailable } from '../../lib/nameIdGenerator'
import { generateRandomBarcode, isBarcodeAvailable } from '../../lib/barcodeGenerator'

// Formular unificat de adăugare / editare produs — bottom-sheet FĂRĂ căutare (BottomBar ascuns).
// Primul câmp este Name ID (preluat din căutare sau generat aleatoriu la cerere pe client, local-first).
// La creare este editabil; la editare devine imuabil (read-only).
// Câmpurile se generează din schema categoriei: text → input; single_choice → rând care deschide PickerSheet.
//
// Selecțiile (single_choice, tags) rulează prin SWAP (SPEC_Tags §5): formularul
// se ascunde vizual, picker-ul îi ia locul, la confirmare/anulare formularul
// revine cu starea intactă (state-ul trăiește aici, componenta rămâne montată).
export default function ProductFormSheet({ open, onClose, categoryId, product = null, initialNameId = '', showToast, onCreated, onSaved }) {
  const products = useCatalogStore((s) => s.products)
  const categoryAttributes = useCatalogStore((s) => s.categoryAttributes)
  const attributeOptions = useCatalogStore((s) => s.attributeOptions)
  const addAttributeOption = useCatalogStore((s) => s.addAttributeOption)
  const addProduct = useCatalogStore((s) => s.addProduct)
  const updateProduct = useCatalogStore((s) => s.updateProduct)
  const fetchTagVocabulary = useCatalogStore((s) => s.fetchTagVocabulary)
  const setBottomBarHidden = useAppStore((s) => s.setBottomBarHidden)

  const isEdit = Boolean(product)
  const effectiveCategoryId = categoryId || product?.categoryId

  const [nameId, setNameId] = useState('')
  const [barcode, setBarcode] = useState('')
  const [values, setValues] = useState({})
  const [tags, setTags] = useState([])
  const [listPrice, setListPrice] = useState('')
  const [saving, setSaving] = useState(false)
  // Swap: null | { type: 'tags' } | { type: 'attr', attrId }
  const [picker, setPicker] = useState(null)
  // Vocabular derivat din filter_idx global — cache pe durata sesiunii de
  // formular (SPEC_Tags §4.4); null = încă nefetchuit.
  const [tagVocab, setTagVocab] = useState(null)

  const prevOpenRef = useRef(false)

  // BottomBar: ascuns cât e vizibil formularul, vizibil (cu căutare) cât e
  // deschis un picker — comutarea modurilor e per-sheet (SPEC_Tags §5).
  useEffect(() => {
    setBottomBarHidden(open && !picker)
  }, [open, picker, setBottomBarHidden])

  // Resetare / inițializare stare DOAR când se deschide / închide formularul (tranziție de open)
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      // Formularul tocmai s-a deschis
      if (product) {
        setNameId(product.nameId ?? '')
        setBarcode(product.barcode ?? '')
        setValues(product.attributes ? { ...product.attributes } : {})
        setTags(product.tags ? [...product.tags] : [])
        setListPrice(product.listPrice != null ? String(product.listPrice) : '')
      } else {
        if (initialNameId) {
          setNameId(initialNameId)
        } else {
          generateRandomNameId(products).then(setNameId)
        }
        setBarcode('')
        setValues({})
        setTags([])
        setListPrice('')
      }
      setSaving(false)
      setPicker(null)
      setTagVocab(null)
    } else if (!open && prevOpenRef.current) {
      // Formularul tocmai s-a închis
      setNameId('')
      setBarcode('')
      setValues({})
      setTags([])
      setListPrice('')
      setSaving(false)
      setPicker(null)
      setTagVocab(null)
    }
    prevOpenRef.current = open
  }, [open, product, initialNameId, products])

  useEffect(() => () => setBottomBarHidden(false), [setBottomBarHidden])

  if (!open) return null

  const attrs = categoryAttributes
    .filter((a) => a.categoryId === effectiveCategoryId)
    .sort((a, b) => a.position - b.position)

  const optionsOf = (attrId) =>
    attributeOptions.filter((o) => o.attributeId === attrId).sort((a, b) => a.position - b.position)

  const setValue = (attrId, val) => setValues((prev) => ({ ...prev, [attrId]: val }))

  const openTagsPicker = async () => {
    if (tagVocab === null) {
      // Fetch-ul poate eșua (rețea/RLS) în afara formei { ok, error } —
      // picker-ul tot trebuie să se deschidă (vocabular gol e stare validă,
      // SPEC_Tags §4.4), altfel un eșec de fetch blochează tap-ul pe rândul
      // Tags fără niciun feedback vizual.
      let vocab = []
      try {
        const res = await fetchTagVocabulary()
        if (!res.ok) showToast(res.error)
        else vocab = res.data
      } catch (err) {
        showToast(err?.message ?? 'Eroare la încărcarea vocabularului de tags')
      }
      vocab.sort(
        (a, b) => b.count - a.count || normalize(a.value).localeCompare(normalize(b.value))
      )
      setTagVocab(vocab)
    }
    setPicker({ type: 'tags' })
  }

  const handleTagsConfirm = ({ selected }) => {
    setTags(selected)
    setPicker(null)
  }

  const handleAttrConfirm = async (attrId, { selected, created }) => {
    const val = selected[0]
    if (created.includes(val)) {
      // Opțiune nouă de schemă — se persistă prin RPC la confirmare
      // (echivalentul fluxului inline anterior, mutat în picker).
      const res = await addAttributeOption(attrId, val)
      if (!res.ok) {
        showToast(res.error)
        setPicker(null)
        return
      }
    }
    setValue(attrId, val)
    setPicker(null)
  }

  const handleGenerateRandomName = async () => {
    const candidate = await generateRandomNameId(products)
    setNameId(candidate)
  }

  const handleGenerateRandomBarcode = () => {
    const candidate = generateRandomBarcode(products)
    setBarcode(candidate)
  }

  const handleSave = async () => {
    const trimmedNameId = nameId.trim()
    const trimmedBarcode = barcode.trim()

    if (!isEdit && !trimmedNameId) {
      showToast('Introduceți un Name ID sau generați unul aleatoriu')
      return
    }

    if (!isEdit && !isNameIdAvailable(trimmedNameId, products)) {
      showToast(`Name ID-ul „${trimmedNameId}” este deja utilizat de un alt produs`)
      return
    }

    if (trimmedBarcode && !isBarcodeAvailable(trimmedBarcode, products.filter(p => !isEdit || p.id !== product?.id))) {
      showToast(`Codul de bare „${trimmedBarcode}” este deja utilizat de un alt produs`)
      return
    }

    // Păstrăm doar atributele completate (nu trimitem chei goale).
    const cleaned = Object.fromEntries(
      Object.entries(values).filter(([, v]) => v != null && String(v).trim() !== '')
    )
    setSaving(true)
    let res
    if (isEdit) {
      res = await updateProduct(product.id, cleaned, listPrice, tags, trimmedBarcode)
    } else {
      res = await addProduct(effectiveCategoryId, cleaned, listPrice, tags, trimmedNameId, trimmedBarcode)
    }
    setSaving(false)
    if (!res.ok) {
      showToast(res.error)
      return
    }
    showToast(isEdit ? 'Produs actualizat' : (res.data ? `Produs creat: ${res.data}` : 'Produs creat'))
    if (isEdit) {
      onSaved?.()
    } else {
      onCreated?.()
    }
    onClose()
  }

  // ── SWAP: cât e deschis un picker, formularul nu se randează ─────────────
  if (picker?.type === 'tags') {
    // Tag-urile create în sesiunea curentă a formularului (încă în afara
    // vocabularului derivat) rămân vizibile la redeschidere (SPEC_Tags §4.1).
    const items = [
      ...(tagVocab ?? []),
      ...tags
        .filter((t) => !(tagVocab ?? []).some((v) => v.value === t))
        .map((t) => ({ value: t, count: 0 })),
    ]

    // Sortăm: 1) Bifate sus, 2) Active (count > 0) vs Inactive (count == 0), 3) Count desc, 4) Alfabetic
    items.sort((a, b) => {
      const isSelA = tags.includes(a.value) ? 1 : 0
      const isSelB = tags.includes(b.value) ? 1 : 0
      if (isSelA !== isSelB) return isSelB - isSelA

      const hasA = a.count > 0 ? 1 : 0
      const hasB = b.count > 0 ? 1 : 0
      if (hasA !== hasB) return hasB - hasA

      if (a.count !== b.count) return b.count - a.count

      return normalize(a.value).localeCompare(normalize(b.value))
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
        restorePlaceholder="Caută produs în categorie..."
        emptyLabel="Niciun tag încă — scrie în bara de căutare pentru a adăuga"
        onConfirm={handleTagsConfirm}
        onClose={() => setPicker(null)}
      />
    )
  }

  if (picker?.type === 'attr') {
    const attr = attrs.find((a) => a.id === picker.attrId)
    return (
      <PickerSheet
        open
        title={attr?.name ?? ''}
        items={optionsOf(picker.attrId).map((o) => ({ value: o.value }))}
        selected={values[picker.attrId] ? [values[picker.attrId]] : []}
        allowCreate
        searchPlaceholder={`Caută ${attr?.name ?? 'valoare'}...`}
        restorePlaceholder="Caută produs în categorie..."
        emptyLabel="Nicio opțiune încă — scrie în bara de căutare pentru a adăuga"
        onConfirm={(sel) => handleAttrConfirm(picker.attrId, sel)}
        onClose={() => setPicker(null)}
      />
    )
  }

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="px-4 pb-6 overflow-y-auto max-h-[80dvh]">
        {/* Name ID — Primul câmp din formular (fără titlu de dialog) */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-zinc-400 font-medium flex items-center gap-1.5">
              Name ID
              {isEdit && <span className="text-[10px] text-zinc-500 font-normal">· imuabil</span>}
            </label>
            {!isEdit && (
              <button
                type="button"
                onClick={handleGenerateRandomName}
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 active:opacity-70 transition-opacity py-0.5 px-1 rounded-md"
                title="Generează Name ID aleatoriu"
              >
                <Dices size={14} />
                <span>Aleatoriu</span>
              </button>
            )}
          </div>

          {isEdit ? (
            <div className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 h-11 flex items-center text-sm font-semibold text-zinc-300 select-none">
              {nameId}
            </div>
          ) : (
            <input
              type="text"
              value={nameId}
              onChange={(e) => setNameId(e.target.value)}
              placeholder="ex: pantofi-sport sau generează aleatoriu"
              autoComplete="off"
              className="w-full bg-zinc-800 rounded-xl px-3 h-11 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:ring-1 focus:ring-blue-500"
            />
          )}
        </div>

        {/* Barcode (EAN-13) */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-zinc-400 font-medium flex items-center gap-1.5">
              Barcode
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => useAppStore.getState().openScanner()}
                className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 active:opacity-70 transition-opacity py-0.5 px-1 rounded-md"
                title="Scanează cod de bare"
              >
                <ScanBarcodeIcon size={14} />
                <span>Scan</span>
              </button>
              <button
                type="button"
                onClick={handleGenerateRandomBarcode}
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 active:opacity-70 transition-opacity py-0.5 px-1 rounded-md"
                title="Generează EAN-13 automat"
              >
                <Dices size={14} />
                <span>EAN-13</span>
              </button>
            </div>
          </div>

          <input
            type="tel"
            inputMode="numeric"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            placeholder="Barcode scan"
            autoComplete="off"
            className="w-full bg-zinc-800 rounded-xl px-3 h-11 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {attrs.map((a) => (
          <div key={a.id} className="mt-4">
            <label className="block text-xs text-zinc-500 mb-1">{a.name}</label>
            {a.type === 'text' ? (
              <input
                type="text"
                value={values[a.id] ?? ''}
                onChange={(e) => setValue(a.id, e.target.value)}
                autoComplete="off"
                className="w-full bg-zinc-800 rounded-xl px-3 h-11 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:ring-1 focus:ring-blue-500"
              />
            ) : (
              // Valoare unică, afișată ca text simplu (nu chip/pill): un chip
              // colorat cu „×" sugerează multi-select, dar single_choice
              // permite o singură valoare — schimbarea se face redeschizând
              // picker-ul, nu eliminând un „tag".
              <div
                onClick={() => setPicker({ type: 'attr', attrId: a.id })}
                className="w-full flex items-center gap-2 bg-zinc-800 rounded-xl px-3 h-11 cursor-pointer active:bg-zinc-700"
              >
                <span className={['flex-1 text-sm truncate', values[a.id] ? 'text-zinc-100' : 'text-zinc-500'].join(' ')}>
                  {values[a.id] ?? 'Alege...'}
                </span>
                {values[a.id] && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setValue(a.id, undefined) }}
                    className="flex items-center justify-center w-6 h-6 rounded-full text-zinc-500 active:bg-zinc-700 active:text-zinc-300"
                  >
                    <X size={14} />
                  </button>
                )}
                <ChevronRight size={16} className="text-zinc-600 shrink-0" />
              </div>
            )}
          </div>
        ))}

        {/* Tags — atribut de sistem, prezent pe orice produs; valoarea e
            opțională (SPEC_Tags §3). */}
        <label className="flex items-center gap-1.5 text-xs text-zinc-500 mb-1 mt-4">
          <Tag size={12} /> Tags <span className="text-zinc-600">· de sistem</span>
        </label>
        <div
          onClick={openTagsPicker}
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
          <ChevronRight size={16} className="ml-auto text-zinc-600 shrink-0" />
        </div>

        <label className="block text-xs text-zinc-500 mb-1 mt-4">Preț de listă (RON, opțional)</label>
        <input
          type="number"
          inputMode="decimal"
          value={listPrice}
          onChange={(e) => setListPrice(e.target.value)}
          placeholder="ex: 249"
          autoComplete="off"
          className="w-full bg-zinc-800 rounded-xl px-3 h-11 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:ring-1 focus:ring-blue-500"
        />

        <div className="flex gap-3 mt-5">
          <button
            onClick={onClose}
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
            {isEdit ? 'Salvează' : 'Creează'}
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}
