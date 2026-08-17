import { useState, useEffect, useRef } from 'react'
import {
  Upload,
  FileUp,
  CheckCircle,
  AlertTriangle,
  ChevronLeft,
  Type,
  List,
  Tag,
  Coins,
  Key,
  EyeOff,
  FileText,
  Loader2,
  X,
} from 'lucide-react'
import BottomSheet from './BottomSheet'
import { parseFileForImport } from '../../lib/excel'
import {
  buildInitialColumnConfigs,
  validateImportConfigs,
  executeProductImport,
} from '../../lib/importers/productImporter'
import { useCatalogStore } from '../../store/useCatalogStore'
import { useAppStore } from '../../store/useAppStore'

export default function ImportProductsSheet({ open, onClose, categoryId, showToast }) {
  const fileInputRef = useRef(null)

  const nodes = useCatalogStore((s) => s.nodes)
  const products = useCatalogStore((s) => s.products)
  const categoryAttributes = useCatalogStore((s) => s.categoryAttributes)
  const attributeOptions = useCatalogStore((s) => s.attributeOptions)
  const addAttribute = useCatalogStore((s) => s.addAttribute)
  const addAttributeOption = useCatalogStore((s) => s.addAttributeOption)
  const addProduct = useCatalogStore((s) => s.addProduct)
  const addProductsBulk = useCatalogStore((s) => s.addProductsBulk)
  const fetchCatalog = useCatalogStore((s) => s.fetchCatalog)

  const setBottomBarHidden = useAppStore((s) => s.setBottomBarHidden)

  // Stări flux: 'upload' | 'mapping' | 'progress' | 'result'
  const [step, setStep] = useState('upload')
  const [file, setFile] = useState(null)
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState(null)
  const [headers, setHeaders] = useState([])
  const [rows, setRows] = useState([])
  const [columnConfigs, setColumnConfigs] = useState([])
  const [fallbackOnCollision, setFallbackOnCollision] = useState(true)

  // Stare progres import
  const [progress, setProgress] = useState({ percent: 0, label: '', current: 0, total: 0 })
  // Rezultat final import
  const [importResult, setImportResult] = useState(null)
  const [showErrorsList, setShowErrorsList] = useState(false)

  const category = nodes.find((n) => n.id === categoryId)
  const currentCategoryAttrs = categoryAttributes.filter((a) => a.categoryId === categoryId)

  // Ascunde BottomBar pe durata deschiderii sheet-ului
  useEffect(() => {
    setBottomBarHidden(open)
    if (open) {
      setStep('upload')
      setFile(null)
      setParsing(false)
      setParseError(null)
      setHeaders([])
      setRows([])
      setColumnConfigs([])
      setFallbackOnCollision(true)
      setProgress({ percent: 0, label: '', current: 0, total: 0 })
      setImportResult(null)
      setShowErrorsList(false)
    }
  }, [open, setBottomBarHidden])

  useEffect(() => () => setBottomBarHidden(false), [setBottomBarHidden])

  if (!open) return null

  // ── Gestionare fișier încărcat ────────────────────────────────────────────
  const handleFileSelected = async (selectedFile) => {
    if (!selectedFile) return
    setFile(selectedFile)
    setParsing(true)
    setParseError(null)

    try {
      const { headers: parsedHeaders, rows: parsedRows } = await parseFileForImport(selectedFile)

      if (!parsedHeaders || parsedHeaders.length === 0 || !parsedRows || parsedRows.length === 0) {
        setParseError('Fișierul nu conține date valide sau este gol.')
        setParsing(false)
        return
      }

      setHeaders(parsedHeaders)
      setRows(parsedRows)

      // Inițializare automată a configurării coloanelor
      const initialConfigs = buildInitialColumnConfigs(
        parsedHeaders,
        parsedRows,
        currentCategoryAttrs
      )
      setColumnConfigs(initialConfigs)
      setParsing(false)
      setStep('mapping')
    } catch (err) {
      console.error('Eroare parsare fisier:', err)
      setParseError('Nu s-a putut citi fișierul. Asigurați-vă că este un fișier CSV sau XLSX valid.')
      setParsing(false)
    }
  }

  // ── Modificare mapare coloană ─────────────────────────────────────────────
  const updateColumnConfig = (colKey, updates) => {
    setColumnConfigs((prev) =>
      prev.map((cfg) => {
        if (cfg.key !== colKey) return cfg
        return { ...cfg, ...updates }
      })
    )
  }

  // ── Pornire execuție import ───────────────────────────────────────────────
  const handleStartImport = async () => {
    setStep('progress')
    setProgress({ percent: 5, label: 'Inițializare import...', current: 0, total: rows.length })

    const result = await executeProductImport({
      categoryId,
      rows,
      columnConfigs,
      fallbackRandomNameIdOnCollision: fallbackOnCollision,
      store: {
        categoryAttributes,
        attributeOptions,
        products,
        addAttribute,
        addAttributeOption,
        addProduct,
        addProductsBulk,
        fetchCatalog,
      },
      onProgress: ({ percent, label, current, total }) => {
        setProgress({ percent, label, current, total })
      },
    })

    setImportResult(result)
    setStep('result')
  }

  const issues = step === 'mapping' ? validateImportConfigs(columnConfigs, rows, products) : []

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="px-4 pb-6 max-h-[85dvh] overflow-y-auto">
        {/* ────────────────── PAS 1: ÎNCĂRCARE FIȘIER ────────────────── */}
        {step === 'upload' && (
          <div className="space-y-4">
            <div className="text-center">
              <h2 className="text-base font-semibold text-zinc-100">Încarcă produse</h2>
              <p className="text-xs text-zinc-400 mt-1">
                Adaugă produse în categoria <span className="text-amber-400 font-medium">{category?.name}</span> dintr-un fișier.
              </p>
            </div>

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-zinc-700 hover:border-blue-500/70 bg-zinc-900/60 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer active:bg-zinc-800/80 transition-colors"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv, .xlsx, .xls, text/csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handleFileSelected(f)
                }}
              />
              <div className="w-12 h-12 rounded-full bg-blue-600/10 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-3">
                {parsing ? <Loader2 size={24} className="animate-spin" /> : <FileUp size={24} />}
              </div>
              <p className="text-sm font-medium text-zinc-200 text-center">
                {parsing ? 'Se analizează fișierul...' : 'Apasă pentru a alege fișierul'}
              </p>
              <p className="text-xs text-zinc-500 mt-1 text-center">
                Formate acceptate: <strong>.CSV</strong> sau <strong>.XLSX</strong>
              </p>
            </div>

            {parseError && (
              <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-xl flex items-start gap-2.5 text-xs text-red-300">
                <AlertTriangle size={16} className="shrink-0 text-red-400 mt-0.5" />
                <span>{parseError}</span>
              </div>
            )}

            <div className="bg-zinc-800/50 rounded-xl p-3.5 border border-zinc-800 space-y-1.5 text-xs text-zinc-400">
              <p className="font-medium text-zinc-300">Cum funcționează importul:</p>
              <ul className="list-disc list-inside space-y-1 text-zinc-400 pl-1">
                <li>Anteturile de coloană vor deveni atribute în categorie.</li>
                <li>Puteți alege tipul de date (Text sau Listă cu o alegere) pentru fiecare coloană.</li>
                <li>Puteți asocia orice coloană ca Name ID, Preț sau Tags.</li>
              </ul>
            </div>

            <button
              onClick={onClose}
              className="w-full h-11 rounded-xl bg-zinc-800 text-sm text-zinc-300 active:bg-zinc-700"
            >
              Anulează
            </button>
          </div>
        )}

        {/* ────────────────── PAS 2: MAPARE COLOANE ────────────────── */}
        {step === 'mapping' && (
          <div className="space-y-4">
            <div className="flex items-center">
              <button
                onClick={() => setStep('upload')}
                className="text-zinc-400 active:text-zinc-100 p-1 -ml-1"
              >
                <ChevronLeft size={20} />
              </button>
              <div className="flex-1 text-center pr-6">
                <h2 className="text-sm font-semibold text-zinc-100">Configurare Coloane</h2>
                <p className="text-[11px] text-zinc-400 truncate">
                  {file?.name} · {rows.length} {rows.length === 1 ? 'rând' : 'rânduri'}
                </p>
              </div>
            </div>

            {issues.length > 0 && (
              <div className="space-y-2">
                {issues.map((iss, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-amber-950/40 border border-amber-800/60 rounded-xl flex items-start gap-2 text-xs text-amber-300"
                  >
                    <AlertTriangle size={15} className="shrink-0 text-amber-400 mt-0.5" />
                    <span>{iss.message}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-3 max-h-[50dvh] overflow-y-auto pr-1">
              {columnConfigs.map((col) => {
                const sampleVals = rows
                  .slice(0, 3)
                  .map((r) => r[col.key])
                  .filter((v) => v !== null && v !== undefined && String(v).trim() !== '')

                return (
                  <div
                    key={col.key}
                    className={[
                      'p-3 rounded-xl border transition-colors space-y-2.5',
                      col.target === 'ignore'
                        ? 'bg-zinc-900/40 border-zinc-800/50 opacity-60'
                        : 'bg-zinc-800/80 border-zinc-700/60',
                    ].join(' ')}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText size={15} className="text-zinc-400 shrink-0" />
                        <span className="text-sm font-medium text-zinc-100 truncate">
                          {col.key}
                        </span>
                      </div>
                      {col.existingAttrId && col.target === 'attribute' && (
                        <span className="shrink-0 text-[10px] font-medium bg-blue-950 border border-blue-800 text-blue-300 px-2 py-0.5 rounded-full">
                          Existent în categorie
                        </span>
                      )}
                    </div>

                    {/* Previzualizare mostre din coloană */}
                    <div className="text-[11px] text-zinc-400 truncate">
                      <span className="text-zinc-500">Mostre: </span>
                      {sampleVals.length > 0 ? (
                        sampleVals.map((s, i) => (
                          <span key={i} className="text-zinc-300">
                            {i > 0 && ', '}„{String(s)}”
                          </span>
                        ))
                      ) : (
                        <span className="italic text-zinc-600">celule goale</span>
                      )}
                    </div>

                    {/* Selector destinație / tip */}
                    <div className="pt-1">
                      <label className="block text-[11px] text-zinc-400 mb-1.5">Destinație coloană:</label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {/* Opțiunea 1: Atribut Text */}
                        <button
                          type="button"
                          onClick={() =>
                            updateColumnConfig(col.key, { target: 'attribute', attrType: 'text' })
                          }
                          className={[
                            'flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium transition-colors',
                            col.target === 'attribute' && col.attrType === 'text'
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'bg-zinc-700/60 text-zinc-300 hover:bg-zinc-700',
                          ].join(' ')}
                        >
                          <Type size={13} /> Text
                        </button>

                        {/* Opțiunea 2: Atribut Listă */}
                        <button
                          type="button"
                          onClick={() =>
                            updateColumnConfig(col.key, {
                              target: 'attribute',
                              attrType: 'single_choice',
                            })
                          }
                          className={[
                            'flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium transition-colors',
                            col.target === 'attribute' && col.attrType === 'single_choice'
                              ? 'bg-amber-600 text-white shadow-sm'
                              : 'bg-zinc-700/60 text-zinc-300 hover:bg-zinc-700',
                          ].join(' ')}
                        >
                          <List size={13} /> Listă
                        </button>

                        {/* Opțiunea 3: Name ID */}
                        <button
                          type="button"
                          onClick={() => updateColumnConfig(col.key, { target: 'name_id' })}
                          className={[
                            'flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium transition-colors',
                            col.target === 'name_id'
                              ? 'bg-purple-600 text-white shadow-sm'
                              : 'bg-zinc-700/60 text-zinc-300 hover:bg-zinc-700',
                          ].join(' ')}
                        >
                          <Key size={13} /> Name ID
                        </button>

                        {/* Opțiunea 4: Preț de listă */}
                        <button
                          type="button"
                          onClick={() => updateColumnConfig(col.key, { target: 'list_price' })}
                          className={[
                            'flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium transition-colors',
                            col.target === 'list_price'
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : 'bg-zinc-700/60 text-zinc-300 hover:bg-zinc-700',
                          ].join(' ')}
                        >
                          <Coins size={13} /> Preț
                        </button>

                        {/* Opțiunea 5: Tags */}
                        <button
                          type="button"
                          onClick={() => updateColumnConfig(col.key, { target: 'tags' })}
                          className={[
                            'flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium transition-colors',
                            col.target === 'tags'
                              ? 'bg-cyan-600 text-white shadow-sm'
                              : 'bg-zinc-700/60 text-zinc-300 hover:bg-zinc-700',
                          ].join(' ')}
                        >
                          <Tag size={13} /> Tags
                        </button>

                        {/* Opțiunea 6: Ignoră */}
                        <button
                          type="button"
                          onClick={() => updateColumnConfig(col.key, { target: 'ignore' })}
                          className={[
                            'flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium transition-colors',
                            col.target === 'ignore'
                              ? 'bg-zinc-600 text-zinc-100 shadow-sm'
                              : 'bg-zinc-700/60 text-zinc-400 hover:bg-zinc-700',
                          ].join(' ')}
                        >
                          <EyeOff size={13} /> Ignoră
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Setare coliziune Name ID */}
            {columnConfigs.some((c) => c.target === 'name_id') && (
              <label className="flex items-center gap-2.5 p-3 rounded-xl bg-zinc-800/60 border border-zinc-700/60 text-xs text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={fallbackOnCollision}
                  onChange={(e) => setFallbackOnCollision(e.target.checked)}
                  className="rounded bg-zinc-900 border-zinc-700 text-blue-600 focus:ring-0 w-4 h-4"
                />
                <span>Generează automat NameID dacă valoarea din fișier e duplicată sau există deja</span>
              </label>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setStep('upload')}
                className="flex-1 h-11 rounded-xl bg-zinc-800 text-sm text-zinc-300 active:bg-zinc-700"
              >
                Înapoi
              </button>
              <button
                onClick={handleStartImport}
                className="flex-1 h-11 rounded-xl bg-blue-600 text-sm font-medium text-white active:bg-blue-700"
              >
                Importă {rows.length} {rows.length === 1 ? 'produs' : 'produse'}
              </button>
            </div>
          </div>
        )}

        {/* ────────────────── PAS 3: PROGRES IMPORT ────────────────── */}
        {step === 'progress' && (
          <div className="py-8 text-center space-y-5">
            <div className="w-16 h-16 rounded-full bg-blue-600/10 border border-blue-500/30 flex items-center justify-center text-blue-400 mx-auto animate-pulse">
              <Loader2 size={32} className="animate-spin" />
            </div>

            <div className="space-y-1">
              <h2 className="text-base font-semibold text-zinc-100">Se importă datele...</h2>
              <p className="text-xs text-zinc-400">{progress.label}</p>
            </div>

            <div className="w-full bg-zinc-800 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${progress.percent}%` }}
              />
            </div>

            <p className="text-xs text-zinc-500 font-mono">{progress.percent}%</p>
          </div>
        )}

        {/* ────────────────── PAS 4: REZULTAT FINAL ────────────────── */}
        {step === 'result' && importResult && (
          <div className="py-4 space-y-4 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-600/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
              <CheckCircle size={30} />
            </div>

            <div className="space-y-1">
              <h2 className="text-base font-semibold text-zinc-100">Import Finalizat!</h2>
              <p className="text-xs text-zinc-400">
                Produsele au fost adăugate cu succes în categoria {category?.name}.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-left pt-1">
              <div className="p-3 bg-zinc-800/80 rounded-xl border border-zinc-700/60">
                <span className="text-[11px] text-zinc-400 block">Produse create</span>
                <span className="text-lg font-bold text-emerald-400">
                  {importResult.createdCount}
                </span>
              </div>
              <div className="p-3 bg-zinc-800/80 rounded-xl border border-zinc-700/60">
                <span className="text-[11px] text-zinc-400 block">Atribute noi</span>
                <span className="text-lg font-bold text-zinc-100">
                  {importResult.newAttrsCount}
                </span>
              </div>
              <div className="p-3 bg-zinc-800/80 rounded-xl border border-zinc-700/60">
                <span className="text-[11px] text-zinc-400 block">Opțiuni listă create</span>
                <span className="text-lg font-bold text-zinc-100">
                  {importResult.newOptionsCount}
                </span>
              </div>
              <div className="p-3 bg-zinc-800/80 rounded-xl border border-zinc-700/60">
                <span className="text-[11px] text-zinc-400 block">Rânduri omise</span>
                <span
                  className={[
                    'text-lg font-bold',
                    importResult.skippedCount > 0 ? 'text-amber-400' : 'text-zinc-500',
                  ].join(' ')}
                >
                  {importResult.skippedCount}
                </span>
              </div>
            </div>

            {importResult.errors.length > 0 && (
              <div className="text-left pt-1">
                <button
                  onClick={() => setShowErrorsList(!showErrorsList)}
                  className="text-xs text-amber-400 hover:text-amber-300 underline"
                >
                  {showErrorsList
                    ? 'Ascunde detaliile erorilor'
                    : `Vezi detaliile pentru ${importResult.errors.length} erori / avertismente`}
                </button>
                {showErrorsList && (
                  <div className="mt-2 max-h-36 overflow-y-auto space-y-1.5 p-2 bg-zinc-900/90 rounded-xl border border-zinc-800 text-[11px] text-zinc-300">
                    {importResult.errors.map((err, i) => (
                      <div key={i} className="flex items-start gap-1.5">
                        <span className="text-zinc-500 shrink-0">
                          {err.row > 0 ? `Rând ${err.row}:` : 'Info:'}
                        </span>
                        <span className="text-amber-300">{err.error}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => {
                onClose()
                showToast?.(
                  `Import realizat: ${importResult.createdCount} ${
                    importResult.createdCount === 1 ? 'produs' : 'produse'
                  }`
                )
              }}
              className="w-full h-11 rounded-xl bg-blue-600 text-sm font-medium text-white active:bg-blue-700 mt-2"
            >
              Închide și Vezi Produsele
            </button>
          </div>
        )}
      </div>
    </BottomSheet>
  )
}
