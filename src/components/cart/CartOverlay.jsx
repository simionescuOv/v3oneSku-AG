import { useState, useEffect } from 'react'
import { ShoppingCart, X, Trash2, Package, Loader2 } from 'lucide-react'
import { useCartStore } from '../../store/useCartStore'
import { useStockStore } from '../../store/useStockStore'

export default function CartOverlay() {
  const { isOpen, closeCart, items, updateQuantity, removeItem, source, setSource, destination, setDestination, clearCart } = useCartStore()
  const { spaces, fetchSpaces, commitCart } = useStockStore()
  
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    if (isOpen && spaces.length === 0) {
      fetchSpaces()
    }
  }, [isOpen, spaces.length, fetchSpaces])

  if (!isOpen) return null

  const totalItems = items.reduce((acc, item) => acc + item.quantity, 0)

  // Show temporary toast inside overlay if needed, but normally we'd want a global toast.
  // For simplicity, we just use a small overlay toast.
  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const handleCheckout = async () => {
    if (!destination) {
      showToast('Te rog să selectezi o destinație!')
      return
    }

    if (source === destination) {
      showToast('Sursa și destinația nu pot fi identice!')
      return
    }

    setCheckoutLoading(true)

    const sourceType = source === 'catalog' ? 'catalog' : 'space'
    const sourceSpaceId = source === 'catalog' ? null : source
    
    const res = await commitCart(sourceType, sourceSpaceId, destination, items)
    
    setCheckoutLoading(false)

    if (!res.ok) {
      showToast(`Eroare: ${res.error}`)
      return
    }

    const destName = spaces.find(s => s.id === destination)?.name || 'Destinație'
    
    clearCart()
    closeCart()
    
    // We could emit a global event or rely on a global store for toast, but alert is removed.
    // Using native console log for debugging, but in a real app a global toast provider is better.
    console.log(`✓ Tranzacție confirmată! ${totalItems} unități mutate spre ${destName}.`)
    
    if (res.alerts && res.alerts.length > 0) {
      console.log(`⚠ ${res.alerts.length} spații cu stoc negativ — verifică StockHub`)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950 flex flex-col animate-in slide-in-from-bottom-4 duration-300">
      {/* Sticky Header */}
      <div className="flex-none flex items-center justify-between px-4 py-3 bg-zinc-900 border-b border-zinc-800">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">Coș Tranzacție</h2>
          <p className="text-xs text-zinc-400">{items.length} produse • {totalItems} unități</p>
        </div>
        <button 
          onClick={closeCart}
          className="p-2 text-zinc-400 hover:text-zinc-100 bg-zinc-800 hover:bg-zinc-700 rounded-full transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      {/* Selectors Area (Sticky below header) */}
      <div className="flex-none p-4 bg-zinc-900/50 border-b border-zinc-800/80 flex flex-col gap-3 relative">
        {toast && (
          <div className="absolute -bottom-10 left-4 right-4 z-10 bg-red-500/90 text-white text-xs px-3 py-2 rounded-lg text-center shadow-lg">
            {toast}
          </div>
        )}
        
        <div className="flex items-center gap-3">
          <span className="w-16 text-xs font-medium text-zinc-500 uppercase tracking-wider">Sursă</span>
          <select 
            value={source} 
            onChange={(e) => setSource(e.target.value)}
            className="flex-1 bg-zinc-800 border border-zinc-700 text-sm rounded-lg px-3 py-2 text-zinc-200 outline-none focus:border-blue-500 appearance-none"
          >
            <option value="catalog">Catalog (Aprovizionare)</option>
            {spaces.map(s => (
              <option key={s.id} value={s.id}>Space: {s.name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3">
          <span className="w-16 text-xs font-medium text-zinc-500 uppercase tracking-wider">Dest</span>
          <select 
            value={destination || ''} 
            onChange={(e) => setDestination(e.target.value)}
            className="flex-1 bg-zinc-800 border border-zinc-700 text-sm rounded-lg px-3 py-2 text-zinc-200 outline-none focus:border-blue-500 appearance-none"
          >
            <option value="" disabled>Selectează destinația...</option>
            {spaces.map(s => (
              <option key={s.id} value={s.id}>Space: {s.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Product List */}
      <div className="flex-1 overflow-y-auto no-scrollbar relative">
        {checkoutLoading && (
          <div className="absolute inset-0 z-10 bg-zinc-950/50 backdrop-blur-sm flex items-center justify-center">
            <Loader2 size={32} className="text-blue-500 animate-spin" />
          </div>
        )}
        
        {items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-zinc-500 gap-3 py-16">
            <ShoppingCart size={48} className="opacity-20" />
            <p className="text-sm">Coșul este gol.</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/70">
            {items.map((item) => (
              <div
                key={item.product.id}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-900/30 transition-colors"
              >
                {/* Icon */}
                <div className="text-blue-400 shrink-0">
                  <Package size={18} />
                </div>

                {/* Name & price */}
                <div className="flex-1 min-w-0">
                  <span className="block text-sm text-zinc-100 truncate">
                    {item.product.nameId}
                  </span>
                  {item.product.listPrice != null && (
                    <span className="block text-xs text-zinc-500">
                      {item.product.listPrice} RON
                    </span>
                  )}
                </div>

                {/* Compact Quantity Controls */}
                <div className="flex items-center bg-zinc-900 rounded-lg border border-zinc-800 shrink-0 overflow-hidden">
                  <button
                    onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                    className="w-7 h-7 flex items-center justify-center text-zinc-400 hover:text-zinc-100 active:bg-zinc-800 text-sm"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={item.quantity || ''}
                    onChange={(e) => updateQuantity(item.product.id, e.target.value)}
                    className="w-9 h-7 bg-transparent text-center text-xs font-semibold text-zinc-100 outline-none hide-arrows"
                    onFocus={(e) => e.target.select()}
                  />
                  <button
                    onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                    className="w-7 h-7 flex items-center justify-center text-zinc-400 hover:text-zinc-100 active:bg-zinc-800 text-sm"
                  >
                    +
                  </button>
                </div>

                {/* Remove button */}
                <button
                  onClick={() => removeItem(item.product.id)}
                  className="p-1 text-zinc-600 hover:text-red-400 transition-colors shrink-0"
                  title="Elimină"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sticky Footer */}
      <div className="flex-none p-4 bg-zinc-900 border-t border-zinc-800 pb-safe">
        <button 
          onClick={handleCheckout}
          disabled={items.length === 0 || !destination || checkoutLoading || source === destination}
          className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 disabled:pointer-events-none text-white font-semibold text-base transition-colors flex items-center justify-center gap-2"
        >
          {checkoutLoading ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              Se procesează...
            </>
          ) : (
            'Confirmă Tranzacția'
          )}
        </button>
      </div>

      {/* Global styles for hiding number input arrows */}
      <style dangerouslySetInnerHTML={{__html: `
        .hide-arrows::-webkit-inner-spin-button, 
        .hide-arrows::-webkit-outer-spin-button { 
          -webkit-appearance: none; 
          margin: 0; 
        }
        .hide-arrows {
          -moz-appearance: textfield;
        }
      `}} />
    </div>
  )
}
