import { create } from 'zustand'

export const useCartStore = create((set, get) => ({
  items: [],
  source: 'catalog', // Default source is catalog
  sourceLocked: false,
  destination: null,

  setSource: (source) => set({ source }),
  setDestination: (destination) => set({ destination }),

  addItem: (product, sourceId = 'catalog') => {
    const { items, source, sourceLocked } = get()
    
    // If cart has items and the new item comes from a different source,
    // we can either block it or warn. Let's just block it or maybe clear and start over?
    // The user said "Only the products added to the cart are from the space we are in".
    // Let's prevent adding if it doesn't match the current source.
    if (items.length > 0 && source !== sourceId) {
      alert(`Coșul conține deja produse din ${source === 'catalog' ? 'Catalog' : 'alt spațiu'}. Finalizează tranzacția sau golește coșul înainte de a adăuga din ${sourceId === 'catalog' ? 'Catalog' : 'acest spațiu'}.`)
      return
    }

    const existingItem = items.find((item) => item.product.id === product.id)
    
    // If cart is empty, lock the source to where the item was added from
    if (items.length === 0) {
      set({ source: sourceId, sourceLocked: true })
    }
    
    if (existingItem) {
      set((state) => ({
        items: state.items.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        ),
      }))
    } else {
      set((state) => ({ items: [...state.items, { product, quantity: 1 }] }))
    }
  },

  updateQuantity: (productId, quantity) => {
    const qty = Math.max(1, parseInt(quantity) || 1)
    set((state) => ({
      items: state.items.map((item) =>
        item.product.id === productId ? { ...item, quantity: qty } : item
      ),
    }))
  },

  removeItem: (productId) => {
    set((state) => {
      const newItems = state.items.filter((item) => item.product.id !== productId)
      // If we removed the last item, unlock the source and reset to catalog
      if (newItems.length === 0) {
        return { items: [], source: 'catalog', sourceLocked: false, destination: null }
      }
      return { items: newItems }
    })
  },

  clearCart: () => set({ items: [], source: 'catalog', sourceLocked: false, destination: null }),
}))
