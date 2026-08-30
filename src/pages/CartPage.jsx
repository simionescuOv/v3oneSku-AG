import { useState, useEffect, useMemo, useRef } from 'react'

import { ShoppingCart, Trash2, RotateCcw, Package, Loader2, ArrowLeft, FolderTree, List, Folder, Tag } from 'lucide-react'
import { useCartStore } from '../store/useCartStore'
import { useStockStore } from '../store/useStockStore'
import { useAppStore } from '../store/useAppStore'
import { useCatalogStore } from '../store/useCatalogStore'
import { usePicker } from '../hooks/usePicker'
import BottomSheet from '../components/catalog/BottomSheet'
import ContextMenu from '../components/shell/ContextMenu'
import { filterAndSort, buildSearchTree, sortTreeFolders } from '../lib/search'

export default function CartPage() {
  const { items, updateQuantity, removeItem, source, sourceLocked, setSource, destination, setDestination, clearCart, restoreCart } = useCartStore()
  const closeCart = useAppStore(s => s.closeCart)

  // Helper pentru a închide curat coșul din UI fără să lase stări în browser
  const handleUIClose = () => {
    if (window.history.state?.virtualPage === 'cart') {
      window.history.back()
    } else {
      closeCart()
    }
  }

  useEffect(() => {
    if (window.history.state?.virtualPage !== 'cart') {
      window.history.pushState({ virtualPage: 'cart' }, '')
    }

    const handlePopState = (e) => {
      e.preventDefault()
      closeCart()
    }
    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [closeCart])
  const { spaces, fetchSpaces, commitCart } = useStockStore()
  const { searchQuery, setSearchQuery, clearSearch } = useAppStore()

  useEffect(() => {
    clearSearch()
  }, [clearSearch])
  
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [toast, setToast] = useState(null)
  
  // 'source' | 'destination' | null
  const [pickerType, setPickerType] = useState(null)
  
  const cartMenuOpen = useAppStore((s) => s.cartMenuOpen)
  const closeCartMenu = useAppStore((s) => s.closeCartMenu)
  const cartGroupByCategory = useAppStore((s) => s.cartGroupByCategory)
  const toggleCartGroupByCategory = useAppStore((s) => s.toggleCartGroupByCategory)
  const [deleteMode, setDeleteMode] = useState(false)
  const [treeSheetOpen, setTreeSheetOpen] = useState(false)
  const [deletedCartSnapshot, setDeletedCartSnapshot] = useState(null)
  const [isActionCooldown, setIsActionCooldown] = useState(false)
  const lastActionTimeRef = useRef(0)

  const handleClearCart = () => {
    const now = Date.now()
    if (now - lastActionTimeRef.current < 600 || isActionCooldown) return
    lastActionTimeRef.current = now
    if (items.length === 0) return

    setIsActionCooldown(true)
    setTimeout(() => setIsActionCooldown(false), 600)

    setDeletedCartSnapshot({ items, source, sourceLocked, destination })
    clearCart()
  }

  const handleRestoreCart = () => {
    const now = Date.now()
    if (now - lastActionTimeRef.current < 600 || isActionCooldown) return
    lastActionTimeRef.current = now
    if (!deletedCartSnapshot) return

    setIsActionCooldown(true)
    setTimeout(() => setIsActionCooldown(false), 600)

    restoreCart(deletedCartSnapshot)
    setDeletedCartSnapshot(null)
  }

  // Dacă meniul principal este invocat cât timp Arborele e deschis, îl tratăm ca pe o comandă de ieșire
  useEffect(() => {
    if (cartMenuOpen && treeSheetOpen) {
      closeCartMenu()
      setTreeSheetOpen(false)
    }
  }, [cartMenuOpen, treeSheetOpen, closeCartMenu])

  const nodes = useCatalogStore((s) => s.nodes)
  const liveProducts = useCatalogStore((s) => s.products)

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
    handleUIClose() // go back to catalog after success
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

  // 1. Grupare plană (doar pe categorii) pentru vizualizarea principală
  const groupedCartItems = useMemo(() => {
    if (!cartGroupByCategory) return null
    const groups = {}
    visibleCartItems.forEach(item => {
      const liveProduct = liveProducts.find(p => p.id === item.product.id)
      const cid = liveProduct ? liveProduct.categoryId : item.product.categoryId
      
      if (!groups[cid]) {
        const node = nodes.find(n => n.id === cid)
        groups[cid] = { node, items: [] }
      }
      groups[cid].items.push(item)
    })
    
    return Object.values(groups).sort((a, b) => (a.node?.name || '').localeCompare(b.node?.name || ''))
  }, [visibleCartItems, cartGroupByCategory, liveProducts, nodes])

  // 2. Arbore ierarhic complet (calculat lazy, doar când BottomSheet e deschis)
  const treeData = useMemo(() => {
    if (!treeSheetOpen) return null
    const grouped = {}
    const activeCids = new Set()

    visibleCartItems.forEach(item => {
      const liveProduct = liveProducts.find(p => p.id === item.product.id)
      const cid = liveProduct ? liveProduct.categoryId : item.product.categoryId
      if (!grouped[cid]) grouped[cid] = []
      grouped[cid].push(item)
      activeCids.add(cid)
    })

    const activeCatNodes = nodes.filter(n => n.type === 'category' && activeCids.has(n.id))
    const root = buildSearchTree(nodes, activeCatNodes)
    const orderOf = (id) => nodes.findIndex((n) => n.id === id)
    sortTreeFolders(root, orderOf)

    return { root, grouped }
  }, [visibleCartItems, nodes, liveProducts, treeSheetOpen])

  const CartItemRow = ({ item, indent = 16 }) => (
    <div className="flex items-center gap-3 py-3 hover:bg-zinc-900/30 transition-colors" style={{ paddingLeft: indent, paddingRight: 16 }}>
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
      {deleteMode && (
        <button
          onClick={() => removeItem(item.product.id)}
          className="p-2 ml-1 text-red-500 hover:text-red-400 rounded-lg bg-red-500/10 active:bg-red-500/20 transition-colors shrink-0 animate-in fade-in slide-in-from-right-2"
          title="Elimină"
        >
          <Trash2 size={18} />
        </button>
      )}
    </div>
  )

  const ReadonlyCartTree = ({ group, depth = 0 }) => {
    const indent = 16 + depth * 16
    return (
      <div key={group.node ? group.node.id : 'root'}>
        {group.node && (
          <div className="flex items-center gap-2 py-2 text-amber-400 bg-zinc-900/60 border-b border-zinc-900" style={{ paddingLeft: indent, paddingRight: 16 }}>
            <Folder size={14} className="shrink-0" />
            <span className="text-xs font-bold uppercase tracking-wider truncate">{group.node.name}</span>
          </div>
        )}

        {group.categories.map(cat => (
          <div key={cat.id}>
            <div className="flex items-center gap-2 py-1.5 text-blue-400 bg-zinc-900/20 border-b border-zinc-900/50" style={{ paddingLeft: indent + (group.node ? 16 : 0), paddingRight: 16 }}>
              <Tag size={13} className="shrink-0" />
              <span className="text-xs font-semibold truncate">{cat.name}</span>
            </div>
            <div className="divide-y divide-zinc-800/70 border-b border-zinc-800/70">
              {(treeData?.grouped[cat.id] || []).map(item => (
                <div key={item.product.id} className="flex items-center gap-2 py-2" style={{ paddingLeft: indent + (group.node ? 32 : 16), paddingRight: 16 }}>
                  <Package size={14} className="text-zinc-600 shrink-0" />
                  <span className="flex-1 text-sm text-zinc-300 truncate">{item.product.nameId}</span>
                  <span className="text-xs font-medium text-zinc-500 shrink-0 px-2 py-0.5 bg-zinc-900 rounded-md">
                    x{item.quantity}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}

        {group.children.map(child => (
          <ReadonlyCartTree key={child.node.id} group={child} depth={depth + 1} />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-100">
      {/* Header */}
      <div className="flex-none flex items-center gap-3 px-4 py-4 shrink-0 border-b border-zinc-800">
        <button 
          onClick={() => handleUIClose()}
          className="p-2 -ml-2 text-zinc-400 hover:text-zinc-100 bg-zinc-900 rounded-xl active:bg-zinc-800"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-zinc-100 leading-tight truncate">
            Coș Tranzacție {source && source !== 'catalog' ? `— ${getSpaceName(source)}` : ''}
          </h1>
          <p className="text-xs text-zinc-500">{items.length} produse • {totalItems} unități</p>
        </div>
        {items.length > 0 ? (
          <button
            key="btn-clear-cart"
            onClick={handleClearCart}
            disabled={isActionCooldown}
            className={`p-2 -mr-2 text-zinc-400 hover:text-red-400 bg-zinc-900 rounded-xl active:bg-zinc-800 transition-colors ${
              isActionCooldown ? 'pointer-events-none opacity-50' : ''
            }`}
            title="Golește coșul"
            aria-label="Golește coșul"
          >
            <Trash2 size={20} />
          </button>
        ) : deletedCartSnapshot ? (
          <button
            key="btn-restore-cart"
            onClick={handleRestoreCart}
            disabled={isActionCooldown}
            className={`p-2 -mr-2 text-amber-400 hover:text-amber-300 bg-zinc-900 rounded-xl active:bg-zinc-800 transition-colors ${
              isActionCooldown ? 'pointer-events-none opacity-50' : ''
            }`}
            title="Recuperează coșul"
            aria-label="Recuperează coșul"
          >
            <RotateCcw size={20} />
          </button>
        ) : null}
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
            onClick={() => {
              if (!sourceLocked) setPickerType('source')
            }}
            disabled={sourceLocked}
            className={`flex-1 text-left bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-200 transition-colors ${sourceLocked ? 'opacity-70 cursor-not-allowed' : 'active:bg-zinc-800'}`}
          >
            {getSpaceName(source)}
            {sourceLocked && <span className="ml-2 text-[10px] bg-zinc-800 px-2 py-0.5 rounded text-zinc-500 font-semibold uppercase">Blocat</span>}
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
          <div className="pb-4">
            {cartGroupByCategory && groupedCartItems ? (
              <div className="flex flex-col">
                {groupedCartItems.map((group) => (
                  <div key={group.node ? group.node.id : 'unknown'}>
                    <div className="flex items-center gap-2 py-2 px-4 text-blue-400 bg-zinc-900/40 border-b border-t border-zinc-900/80 mt-2 first:mt-0">
                      <Tag size={13} className="shrink-0" />
                      <span className="text-sm font-semibold truncate">{group.node ? group.node.name : 'Necategorizat'}</span>
                    </div>
                    <div className="divide-y divide-zinc-800/70 border-b border-zinc-800/70">
                      {group.items.map(item => (
                        <CartItemRow key={item.product.id} item={item} indent={16} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="divide-y divide-zinc-800/70 border-b border-zinc-800/70">
                {visibleCartItems.map((item) => (
                  <CartItemRow key={item.product.id} item={item} indent={16} />
                ))}
              </div>
            )}
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

      {/* Context Menu pentru Coș */}
      <ContextMenu
        open={cartMenuOpen}
        onClose={closeCartMenu}
        options={[
          {
            label: cartGroupByCategory ? 'Afișare: Listă Simplă' : 'Afișare: Pe Categorii',
            icon: cartGroupByCategory ? <List size={18} /> : <Tag size={18} />,
            onClick: () => {
              toggleCartGroupByCategory()
              closeCartMenu()
            }
          },
          {
            label: 'Vezi structura ierarhică (Tree)',
            icon: <FolderTree size={18} />,
            onClick: () => {
              setTreeSheetOpen(true)
              closeCartMenu()
            }
          },
          'divider',
          {
            label: 'Activează Ștergerea Multiplă',
            icon: <Trash2 size={18} />,
            danger: true,
            onClick: () => {
              setDeleteMode(!deleteMode)
              closeCartMenu()
            }
          }
        ]}
      />

      {/* Tree View Bottom Sheet */}
      <BottomSheet 
        open={treeSheetOpen} 
        onClose={() => setTreeSheetOpen(false)}
        aboveBottomBar={true}
      >
        <div className="flex flex-col h-[85vh]">
          <div className="flex-none px-4 pb-4 border-b border-zinc-800/50">
            <h2 className="text-lg font-semibold text-zinc-100">Structura Ierarhică</h2>
            <p className="text-xs text-zinc-500 mt-1">Conținutul coșului grupat pe foldere și categorii.</p>
          </div>
          <div className="flex-1 overflow-y-auto no-scrollbar pb-24">
            {treeData && treeData.root && treeData.root.children.length > 0 ? (
              <ReadonlyCartTree group={treeData.root} />
            ) : (
              <div className="py-12 text-center text-sm text-zinc-500">
                Nu există produse afișabile.
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
