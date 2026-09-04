import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Warehouse, RotateCcw, ChevronRight } from 'lucide-react'
import { useCatalogStore } from '../../store/useCatalogStore'
import { useStockStore } from '../../store/useStockStore'
import ProductCard from '../catalog/ProductCard'

export default function StockHubBarcodeResults({ barcode, onClear }) {
  const routerNavigate = useNavigate()
  const products = useCatalogStore((s) => s.products)
  const nodes = useCatalogStore((s) => s.nodes)
  const categoryAttributes = useCatalogStore((s) => s.categoryAttributes)
  const fetchProductStockAcrossSpaces = useStockStore((s) => s.fetchProductStockAcrossSpaces)

  const [loading, setLoading] = useState(true)
  const [spaceStocks, setSpaceStocks] = useState([])

  // Harta categoriilor pentru a afișa numele categoriei
  const categoryMap = useMemo(() => {
    return new Map(nodes.map((n) => [n.id, n.name]))
  }, [nodes])

  // Identificare produs prin exact match pe barcode
  const product = useMemo(() => {
    if (!barcode || !barcode.trim()) return null
    const code = barcode.trim().toLowerCase()
    return products.find((p) => !p.deletedAt && p.barcode?.toLowerCase() === code) || null
  }, [barcode, products])

  useEffect(() => {
    let isMounted = true

    async function loadStocks() {
      if (!product) {
        setSpaceStocks([])
        setLoading(false)
        return
      }

      setLoading(true)
      const res = await fetchProductStockAcrossSpaces(product.id)
      if (isMounted) {
        if (res.ok) {
          setSpaceStocks(res.data)
        } else {
          setSpaceStocks([])
        }
        setLoading(false)
      }
    }

    loadStocks()

    return () => {
      isMounted = false
    }
  }, [product, fetchProductStockAcrossSpaces])

  // Obținem meta-informații din atribute pentru ProductCard (preview)
  const productMeta = useMemo(() => {
    if (!product) return ''
    const catAttrs = categoryAttributes.filter(
      (a) => a.categoryId === product.categoryId && a.cardPreview
    )
    const attrString = catAttrs
      .map((a) => product.attributes?.[a.id])
      .filter(Boolean)
      .join(' · ')

    const catName = categoryMap.get(product.categoryId) || ''
    if (attrString) return attrString
    return catName
  }, [product, categoryAttributes, categoryMap])

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header Barcode activ */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-amber-950/30 border-b border-amber-900/40 text-xs shrink-0">
        <span className="text-amber-300 font-medium font-mono truncate">
          Barcode: {barcode}
        </span>
        {onClear && (
          <button
            onClick={onClear}
            className="shrink-0 ml-2 text-zinc-400 hover:text-zinc-200 flex items-center gap-1 font-medium bg-zinc-800 px-2.5 py-1 rounded-lg"
          >
            <RotateCcw size={13} />
            <span>Anulează</span>
          </button>
        )}
      </div>

      {/* Corpul rezultatelor */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {!product ? (
          <div className="px-4 py-16 text-center">
            <p className="text-zinc-400 text-sm mb-1">Niciun produs găsit în catalog</p>
            <p className="text-zinc-600 text-xs font-mono">{barcode}</p>
          </div>
        ) : loading ? (
          <div className="px-4 py-6 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse bg-zinc-900/60 rounded-xl p-4 h-24" />
            ))}
          </div>
        ) : spaceStocks.length === 0 ? (
          <div className="px-4 py-16 text-center text-zinc-500 text-sm">
            Produsul nu se află în niciun spațiu de depozitare.
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/80">
            {spaceStocks.map(({ space, quantity }) => {
              const hasStock = quantity > 0
              return (
                <div
                  key={space.id}
                  className={[
                    "transition-opacity duration-150",
                    !hasStock ? "opacity-50" : ""
                  ].join(' ')}
                >
                  {/* Tap pe Numele/Linkul Spațiului -> SpacePage */}
                  <button
                    onClick={() => routerNavigate(`/stockhub/space/${space.id}`, { state: { fromBarcodeScan: barcode } })}
                    className="w-full flex items-center justify-between px-4 pt-3 pb-1.5 text-left active:bg-zinc-900 group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Warehouse size={15} className="text-amber-400 shrink-0" />
                      <span className="text-xs font-semibold text-zinc-200 group-hover:text-amber-300 transition-colors truncate">
                        {space.name}
                      </span>
                    </div>
                    <ChevronRight size={14} className="text-zinc-500 shrink-0 ml-2" />
                  </button>

                  {/* Tap pe Cardul Produsului -> ProductPage cu state.sourceSpaceId */}
                  <div className="pb-1">
                    <ProductCard
                      product={product}
                      meta={
                        <span className="flex items-center gap-1.5">
                          <span className={hasStock ? "text-amber-400 font-semibold" : "text-zinc-500"}>
                            Stoc: {quantity} buc
                          </span>
                          {productMeta && <span>· {productMeta}</span>}
                        </span>
                      }
                      onTap={() => {
                        routerNavigate(
                          '/catalog/product/' + encodeURIComponent(product.nameId),
                          { state: { sourceSpaceId: space.id } }
                        )
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
