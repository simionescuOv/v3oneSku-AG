import { Package, ShoppingCart } from 'lucide-react'
import { useCartStore } from '../../store/useCartStore'

// Card de produs în pagina unui Space.
// Stocul din Space este elementul vizual principal (număr mare).
// Câmpurile afișate NU sunt hardcodate — structura e pregătită
// pentru configurabilitate viitoare (card_preview per atribut).
export default function SpaceProductCard({ spaceProduct, catalogProduct, meta, sourceId, onTap }) {
  const addItem = useCartStore((s) => s.addItem)

  const quantityInCart = useCartStore((s) => {
    const cartItem = s.items.find((item) => item.product.id === catalogProduct?.id)
    return cartItem ? cartItem.quantity : 0
  })

  const handleAddToCart = (e) => {
    e.stopPropagation()
    if (catalogProduct) addItem(catalogProduct, sourceId || 'catalog')
  }

  const stock = spaceProduct?.stock ?? 0
  const isNegative = stock < 0

  return (
    <div
      onClick={() => onTap?.(catalogProduct)}
      className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-zinc-900 cursor-pointer"
    >
      {/* Stoc — element principal, număr mare */}
      <div className={[
        'shrink-0 flex items-center justify-center w-12 h-12 rounded-xl font-bold text-lg tabular-nums',
        isNegative
          ? 'bg-red-950/60 text-red-400 border border-red-800/60'
          : 'bg-zinc-800 text-zinc-100',
      ].join(' ')}>
        {stock}
      </div>

      {/* Info produs */}
      <span className="flex-1 min-w-0">
        <span className="block text-sm text-zinc-100 truncate">
          {catalogProduct?.nameId ?? '—'}
        </span>
        {meta && (
          <span className="block text-xs text-zinc-500 truncate">{meta}</span>
        )}
        {/* Categoria — metadata, unul dintre câmpurile configurabile în viitor */}
        {spaceProduct?.categoryName && (
          <span className="block text-xs text-zinc-600 truncate">
            {spaceProduct.categoryName}
          </span>
        )}
      </span>

      {/* Acțiuni */}
      <div className="flex items-center gap-2 shrink-0">
        {catalogProduct?.listPrice != null && (
          <span className="text-sm font-medium text-zinc-400">
            {catalogProduct.listPrice} RON
          </span>
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
