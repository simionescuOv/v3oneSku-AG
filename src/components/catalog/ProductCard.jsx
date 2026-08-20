import { Package, ShoppingCart } from 'lucide-react'
import { useCartStore } from '../../store/useCartStore'

// Rând de produs în pagina categoriei. Stil consecvent cu NodeCard.
// `meta` = atributele-cheie rezumate (ex: „Negru · 128GB"); `listPrice` opțional.
export default function ProductCard({ product, meta, onTap }) {
  const addItem = useCartStore((s) => s.addItem)

  const handleAddToCart = (e) => {
    e.stopPropagation()
    addItem(product)
    // Optional: a short toast or visual feedback here
  }

  return (
    <div
      onClick={() => onTap?.(product)}
      className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-zinc-900 cursor-pointer"
    >
      <Package size={18} className="text-blue-400 shrink-0" />
      <span className="flex-1 min-w-0">
        <span className="block text-sm text-zinc-100 truncate">{product.nameId}</span>
        {meta && <span className="block text-xs text-zinc-500 truncate">{meta}</span>}
      </span>
      <div className="flex items-center gap-3 shrink-0">
        {product.listPrice != null && (
          <span className="text-sm font-medium text-zinc-200">{product.listPrice} RON</span>
        )}
        <button 
          onClick={handleAddToCart}
          className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 active:bg-zinc-700 transition-colors"
        >
          <ShoppingCart size={18} />
        </button>
      </div>
    </div>
  )
}
