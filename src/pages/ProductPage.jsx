import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, Package, Tag, Folder, ArrowLeft, Pencil } from 'lucide-react'
import { useCatalogStore } from '../store/useCatalogStore'
import { useAppStore } from '../store/useAppStore'
import { normalize } from '../lib/search'
import BottomSheet from '../components/catalog/BottomSheet'
import ProductFormSheet from '../components/catalog/ProductFormSheet'

export default function ProductPage() {
  const { nameId } = useParams()
  const navigate = useNavigate()

  const products = useCatalogStore((s) => s.products)
  const nodes = useCatalogStore((s) => s.nodes)
  const categoryAttributes = useCatalogStore((s) => s.categoryAttributes)
  const getAncestorFolders = useCatalogStore((s) => s.getAncestorFolders)
  const fetchProductDetails = useCatalogStore((s) => s.fetchProductDetails)
  const loaded = useCatalogStore((s) => s.loaded)

  const catalogMenuOpen = useAppStore((s) => s.catalogMenuOpen)
  const closeCatalogMenu = useAppStore((s) => s.closeCatalogMenu)

  const [editOpen, setEditOpen] = useState(false)
  const [toast, setToast] = useState(null)
  const toastTimer = useRef(null)

  const showToast = useCallback((message) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast(message)
    toastTimer.current = setTimeout(() => setToast(null), 3000)
  }, [])

  // Căutare produs după nameId (decodat și normalizat)
  const decodedNameId = useMemo(() => {
    try {
      return decodeURIComponent(nameId || '')
    } catch {
      return nameId || ''
    }
  }, [nameId])

  const product = useMemo(() => {
    if (!products.length) return null
    const targetNorm = normalize(decodedNameId)
    return products.find(
      (p) => !p.deletedAt && (p.nameId === decodedNameId || normalize(p.nameId) === targetNorm)
    )
  }, [products, decodedNameId])

  useEffect(() => {
    if (product?.id) {
      fetchProductDetails(product.id)
    }
  }, [product?.id, fetchProductDetails])

  const category = useMemo(() => {
    if (!product || !nodes.length) return null
    return nodes.find((n) => n.id === product.categoryId)
  }, [product, nodes])

  const attrs = useMemo(() => {
    if (!category) return []
    return categoryAttributes
      .filter((a) => a.categoryId === category.id)
      .sort((a, b) => a.position - b.position)
  }, [category, categoryAttributes])

  const breadcrumbs = useMemo(() => {
    if (!category) return []
    const ancestors = getAncestorFolders(category.id).map((f) => ({ id: f.id, name: f.name, isFolder: true }))
    return [
      { id: null, name: 'Catalog', isRoot: true },
      ...ancestors,
      { id: category.id, name: category.name, isCategory: true },
    ]
  }, [category, getAncestorFolders])

  // Dacă starea catalogului se încarcă încă din Supabase
  if (!loaded && !product) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-zinc-400">
        <p className="text-sm">Se încarcă detaliile produsului...</p>
      </div>
    )
  }

  // Produs negăsit
  if (!product) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <Package size={48} className="text-zinc-600 mb-4" />
        <h2 className="text-lg font-semibold text-zinc-100 mb-1">Produsul nu a fost găsit</h2>
        <p className="text-sm text-zinc-500 mb-6">
          Produsul cu identificatorul „{decodedNameId}” nu există sau a fost șters.
        </p>
        <button
          onClick={() => navigate('/catalog')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <ArrowLeft size={16} />
          Înapoi la Catalog
        </button>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-zinc-950 overflow-y-auto">
      {/* Head Top Bar cu buton de back și Breadcrumbs */}
      <div className="flex-none sticky top-0 z-10 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-900 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-1 -ml-1 text-zinc-400 hover:text-zinc-100 active:bg-zinc-900 rounded-lg transition-colors"
          title="Înapoi"
        >
          <ChevronLeft size={22} />
        </button>

        <div className="flex-1 min-w-0 flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs text-zinc-400">
          {breadcrumbs.map((crumb, idx) => (
            <span key={crumb.id ?? 'root'} className="flex items-center gap-1.5 shrink-0">
              {idx > 0 && <span className="text-zinc-600">/</span>}
              <button
                onClick={() => {
                  if (crumb.isRoot) navigate('/catalog')
                  else if (crumb.isCategory) navigate(`/catalog/category/${crumb.id}`)
                  else navigate('/catalog')
                }}
                className="hover:text-zinc-200 transition-colors truncate max-w-[120px]"
              >
                {crumb.name}
              </button>
            </span>
          ))}
          <span className="text-zinc-600">/</span>
          <span className="text-amber-400 font-semibold truncate max-w-[140px]">{product.nameId}</span>
        </div>
      </div>

      {/* Corpul Paginii */}
      <div className="p-4 space-y-5 max-w-2xl mx-auto w-full">
        {/* Card Header Produs */}
        <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-5 shadow-lg">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl shrink-0">
              <Package size={28} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-md">
                  NameID
                </span>
                {category && (
                  <span className="text-xs text-zinc-400 bg-zinc-800/80 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <Folder size={12} className="text-amber-400" />
                    {category.name}
                  </span>
                )}
              </div>

              <h1 className="text-2xl font-bold text-zinc-100 tracking-tight break-words">
                {product.nameId}
              </h1>

              <div className="mt-3 flex items-center gap-4 text-sm">
                <div>
                  <span className="text-xs text-zinc-500 block">Preț de listă</span>
                  <span className="font-semibold text-zinc-100">
                    {product.listPrice != null ? `${product.listPrice} RON` : 'Necompletat'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Secțiune Tag-uri */}
          {product.tags && product.tags.length > 0 && (
            <div className="mt-4 pt-4 border-t border-zinc-800/60 flex items-center gap-2 flex-wrap">
              <Tag size={14} className="text-blue-400 shrink-0" />
              {product.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs font-medium text-blue-300 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-lg"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Secțiunea Atribute & Valori */}
        <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
            <h2 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider">
              Atribute Produs
            </h2>
            <span className="text-xs text-zinc-500">
              {attrs.length} {attrs.length === 1 ? 'atribut' : 'atribute'} în schema categoriei
            </span>
          </div>

          {attrs.length === 0 ? (
            <p className="text-xs text-zinc-500 py-2 text-center">
              Categoria nu are atribute definite în schemă.
            </p>
          ) : (
            <div className="divide-y divide-zinc-800/50">
              {attrs.map((attr) => {
                const val = product.attributes?.[attr.id]
                const hasValue = val !== undefined && val !== null && String(val).trim() !== ''

                return (
                  <div key={attr.id} className="py-3 flex items-start justify-between gap-4 text-sm">
                    <span className="text-zinc-400 font-medium shrink-0">{attr.name}</span>
                    <span
                      className={
                        hasValue
                          ? 'text-zinc-100 font-semibold text-right break-words'
                          : 'text-zinc-600 text-right italic'
                      }
                    >
                      {hasValue ? String(val) : '-'}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Detalii Tehnice / Sistem */}
        <div className="bg-zinc-900/40 border border-zinc-800/40 rounded-xl p-4 text-xs text-zinc-500 space-y-1">
          <div className="flex justify-between">
            <span>ID intern (UUID):</span>
            <span className="font-mono text-zinc-400">{product.id}</span>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="absolute bottom-20 left-4 right-4 z-50 flex items-center gap-3 px-4 py-3 bg-zinc-800 rounded-2xl shadow-xl">
          <span className="flex-1 text-sm text-zinc-100">{toast}</span>
        </div>
      )}

      {/* Meniu contextual — Editare produs */}
      <BottomSheet open={catalogMenuOpen} onClose={closeCatalogMenu}>
        <div className="px-4 pb-6">
          <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider px-3 pb-3 mb-1 border-b border-zinc-800">
            {product.nameId}
          </div>
          <button
            onClick={() => { closeCatalogMenu(); setEditOpen(true) }}
            className="w-full flex items-center gap-3 px-3 py-3.5 rounded-xl text-sm text-zinc-200 hover:bg-zinc-800 active:bg-zinc-700"
          >
            <span className="text-zinc-400"><Pencil size={18} /></span>
            <span className="flex-1 text-left">Editează produsul</span>
          </button>
        </div>
      </BottomSheet>

      {/* Formular de editare produs — aceeași componentă unificată ca la adăugare */}
      <ProductFormSheet
        open={editOpen}
        onClose={() => setEditOpen(false)}
        categoryId={product.categoryId}
        product={product}
        showToast={showToast}
      />
    </div>
  )
}
