import { Package, ShoppingCart } from 'lucide-react'
import { useCartStore } from '../../store/useCartStore'

// Rând de produs în pagina categoriei. Stil consecvent cu NodeCard.
// `meta` = atributele-cheie rezumate (ex: „Negru · 128GB"); `listPrice` opțional.
export default function ProductCard({ product, meta, onTap }) {
  const addItem = useCartStore((s) => s.addItem)
  
  // Selector optimizat: componenta se va re-randa DOAR dacă `quantityInCart` se modifică pentru ACEST produs.
  const quantityInCart = useCartStore((s) => {
    const cartItem = s.items.find((item) => item.product.id === product.id)
    return cartItem ? cartItem.quantity : 0
  })

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
        {product.barcode && (
          <span className="block text-[10px] text-zinc-600 font-mono truncate">{product.barcode}</span>
        )}
        {meta && <span className="block text-xs text-zinc-500 truncate">{meta}</span>}
      </span>
      <div className="flex items-center gap-3 shrink-0">
        {product.listPrice != null && (
          <span className="text-sm font-medium text-zinc-200">{product.listPrice} RON</span>
        )}
        <button 
          onClick={handleAddToCart}
          className="relative p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 active:bg-zinc-700 transition-colors"
        >
          <ShoppingCart size={18} />
          {quantityInCart > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-bold min-w-[16px] h-[16px] px-1 flex items-center justify-center rounded-full pointer-events-none border border-zinc-900">
              {quantityInCart > 99 ? '99+' : quantityInCart}
            </span>
          )}
        </button>
      </div>
    </div>
  )
}
