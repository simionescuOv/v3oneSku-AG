import { create } from 'zustand'

export const useCartStore = create((set, get) => ({
  items: [],
  source: 'catalog', // Default source is catalog
  destination: null,
  isOpen: false,

  openCart: () => set({ isOpen: true }),
  closeCart: () => set({ isOpen: false }),

  setSource: (source) => set({ source }),
  setDestination: (destination) => set({ destination }),

  addItem: (product) => {
    const { items } = get()
    const existingItem = items.find((item) => item.product.id === product.id)
    
    if (existingItem) {
      set({
        items: items.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        ),
      })
    } else {
      set({ items: [...items, { product, quantity: 1 }] })
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
    set((state) => ({
      items: state.items.filter((item) => item.product.id !== productId),
    }))
  },

  clearCart: () => set({ items: [], source: 'catalog', destination: null }),
}))
