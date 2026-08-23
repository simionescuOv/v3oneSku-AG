import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShoppingCart, Trash2, Package, Loader2, ArrowLeft } from 'lucide-react'
import { useCartStore } from '../store/useCartStore'
import { useStockStore } from '../store/useStockStore'
import { useAppStore } from '../store/useAppStore'
import { usePicker } from '../hooks/usePicker'
import BottomSheet from '../components/catalog/BottomSheet'
import { filterAndSort } from '../lib/search'

export default function CartPage() {
  const navigate = useNavigate()
  const { items, updateQuantity, removeItem, source, setSource, destination, setDestination, clearCart } = useCartStore()
  const { spaces, fetchSpaces, commitCart } = useStockStore()
  const { searchQuery, setSearchQuery } = useAppStore()
  
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [toast, setToast] = useState(null)
  
  // 'source' | 'destination' | null
  const [pickerType, setPickerType] = useState(null)

  useEffect(() => {
    if (spaces.length === 0) {
      fetchSpaces()
    }
  }, [spaces.length, fetchSpaces])

  const totalItems = items.reduce((acc, item) => acc + item.quantity, 0)

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
    
    clearCart()
    navigate('/catalog') // go back to catalog after success
  }

  // --- Logica pentru Picker ---
  const onlySpaces = spaces.filter(s => s.type === 'space')
  const pickerItems = pickerType === 'source' 
    ? [{ id: 'catalog', name: 'Catalog (Aprovizionare)' }, ...onlySpaces]
    : onlySpaces

  const { filteredItems } = usePicker({
    mode: 'inline', // Căutarea va citi din BottomBar (searchQuery din app store)
    items: pickerItems,
    labelFn: (s) => s.name,
    query: searchQuery,
    allowCreate: false,
  })

  const handleSelectPickerItem = (item) => {
    if (pickerType === 'source') {
      setSource(item.id)
    } else {
      setDestination(item.id)
    }
    setPickerType(null)
    setSearchQuery('')
  }

  const getSpaceName = (id) => {
    if (id === 'catalog') return 'Catalog (Aprovizionare)'
    const s = spaces.find(s => s.id === id)
    return s ? s.name : 'Alege...'
  }

  const visibleCartItems = pickerType === null && searchQuery.trim()
    ? filterAndSort(items, searchQuery, (item) => item.product.nameId)
    : items

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-100">
      {/* Header */}
      <div className="flex-none flex items-center gap-3 px-4 py-4 shrink-0 border-b border-zinc-800">
        <button 
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 text-zinc-400 hover:text-zinc-100 bg-zinc-900 rounded-xl active:bg-zinc-800"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-zinc-100 leading-tight">Coș Tranzacție</h1>
          <p className="text-xs text-zinc-500">{items.length} produse • {totalItems} unități</p>
        </div>
      </div>

      {/* Selectors Form */}
      <div className="flex-none px-4 py-5 flex flex-col gap-4 border-b border-zinc-800 relative">
        {toast && (
          <div className="absolute top-2 left-4 right-4 z-10 bg-red-500/90 text-white text-xs px-3 py-2 rounded-lg text-center shadow-lg animate-in fade-in zoom-in-95">
            {toast}
          </div>
        )}
        
        {/* Source Button */}
        <div className="flex items-center gap-3">
          <span className="w-16 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Sursă</span>
          <button 
            onClick={() => setPickerType('source')}
            className="flex-1 text-left bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-200 active:bg-zinc-800 transition-colors"
          >
            {getSpaceName(source)}
          </button>
        </div>

        {/* Destination Button */}
        <div className="flex items-center gap-3">
          <span className="w-16 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Dest</span>
          <button 
            onClick={() => setPickerType('destination')}
            className={[
              'flex-1 text-left rounded-xl px-4 py-3 text-sm transition-colors border',
              destination ? 'bg-zinc-900 border-zinc-800 text-zinc-200 active:bg-zinc-800' : 'bg-blue-950/20 border-dashed border-blue-900/50 text-blue-400 active:bg-blue-950/40'
            ].join(' ')}
          >
            {destination ? getSpaceName(destination) : 'Alege destinația...'}
          </button>
        </div>
      </div>

      {/* Product List */}
      <div className="flex-1 overflow-y-auto no-scrollbar relative pb-24">
        {checkoutLoading && (
          <div className="absolute inset-0 z-10 bg-zinc-950/50 backdrop-blur-sm flex items-center justify-center">
            <Loader2 size={32} className="text-blue-500 animate-spin" />
          </div>
        )}
        
        {visibleCartItems.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-zinc-500 gap-3 py-16">
            <ShoppingCart size={48} className="opacity-20" />
            <p className="text-sm">Coșul este gol sau n-am găsit nimic.</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/70">
            {visibleCartItems.map((item) => (
              <div
                key={item.product.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-900/30 transition-colors"
              >
                {/* Icon */}
                <div className="text-blue-400 shrink-0">
                  <Package size={20} />
                </div>

                {/* Name & price */}
                <div className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-zinc-100 truncate">
                    {item.product.nameId}
                  </span>
                  {item.product.listPrice != null && (
                    <span className="block text-xs text-zinc-500 mt-0.5">
                      {item.product.listPrice} RON
                    </span>
                  )}
                </div>

                {/* Compact Quantity Controls */}
                <div className="flex items-center bg-zinc-900 rounded-lg border border-zinc-800 shrink-0 overflow-hidden">
                  <button
                    onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                    className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-zinc-100 active:bg-zinc-800 text-base"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={item.quantity || ''}
                    onChange={(e) => updateQuantity(item.product.id, e.target.value)}
                    className="w-10 h-8 bg-transparent text-center text-sm font-semibold text-zinc-100 outline-none hide-arrows"
                    onFocus={(e) => e.target.select()}
                  />
                  <button
                    onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                    className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-zinc-100 active:bg-zinc-800 text-base"
                  >
                    +
                  </button>
                </div>

                {/* Remove button */}
                <button
                  onClick={() => removeItem(item.product.id)}
                  className="p-2 ml-1 text-zinc-600 hover:text-red-400 rounded-lg active:bg-zinc-900 transition-colors shrink-0"
                  title="Elimină"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        )}
        
        {/* Confirm Button Area - Inside scroll area but at the bottom, so BottomBar stays visible */}
        {items.length > 0 && (
          <div className="p-4 mt-4">
            <button 
              onClick={handleCheckout}
              disabled={!destination || checkoutLoading || source === destination}
              className="w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 disabled:pointer-events-none text-white font-semibold text-base transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20"
            >
              {checkoutLoading ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  Se procesează...
                </>
              ) : (
                `Confirmă tranzacția cu ${totalItems} bucăți`
              )}
            </button>
          </div>
        )}
      </div>

      {/* Picker BottomSheet */}
      <BottomSheet 
        open={pickerType !== null} 
        aboveBottomBar={true}
        onClose={() => {
          setPickerType(null)
          setSearchQuery('')
        }}
      >
        <div className="px-4 pb-4">
          <div className="text-sm font-semibold text-zinc-400 mb-4 px-2 uppercase tracking-wider">
            {pickerType === 'source' ? 'Selectează Sursa' : 'Selectează Destinația'}
          </div>
          
          <div className="max-h-[60vh] overflow-y-auto no-scrollbar space-y-1">
            {filteredItems.map(item => (
              <button
                key={item.id}
                onClick={() => handleSelectPickerItem(item)}
                className="w-full text-left px-4 py-3.5 rounded-xl text-sm font-medium text-zinc-200 hover:bg-zinc-800 active:bg-zinc-700 transition-colors"
              >
                {item.name}
              </button>
            ))}
            
            {filteredItems.length === 0 && (
              <div className="py-8 text-center text-sm text-zinc-500">
                Niciun rezultat.
              </div>
            )}
          </div>
        </div>
      </BottomSheet>

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
