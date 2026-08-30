import { create } from 'zustand'

export const useAppStore = create((set) => ({
  sideMenuOpen: false,
  openSideMenu: () => set({ sideMenuOpen: true }),
  closeSideMenu: () => set({ sideMenuOpen: false }),
  toggleSideMenu: () => set((s) => ({ sideMenuOpen: !s.sideMenuOpen })),

  // BottomBar search shared between bar and active sheets
  searchQuery: '',
  searchPlaceholder: 'Caută...',
  autocompleteSuggestion: null,
  searchContextStack: ['global'],
  setSearchQuery: (q) => set({ searchQuery: q }),
  setSearchPlaceholder: (p) => set({ searchPlaceholder: p }),
  setAutocompleteSuggestion: (val) => set((s) => {
    const prev = s.autocompleteSuggestion;
    if (prev === val) return s;
    if (prev && val && prev.text === val.text && prev.isPrefix === val.isPrefix) return s;
    return { autocompleteSuggestion: val };
  }),
  clearSearch: () => set({ searchQuery: '', autocompleteSuggestion: null }),
  pushSearchContext: (ctx) => set((s) => ({ searchContextStack: [...s.searchContextStack, ctx] })),
  popSearchContext: (ctx) => set((s) => {
    const newStack = s.searchContextStack.filter(c => c !== ctx);
    if (newStack.length === 0) newStack.push('global');
    return { searchContextStack: newStack };
  }),

  // BottomBar override (pentru BottomSheet-uri de tip aboveBottomBar)
  bottomBarOverrides: [],
  pushBottomBarOverride: (override) => set((s) => ({ bottomBarOverrides: [...s.bottomBarOverrides, override] })),
  popBottomBarOverride: (id) => set((s) => ({ bottomBarOverrides: s.bottomBarOverrides.filter(o => o.id !== id) })),

  // Catalog context menu trigger (BottomBar → CatalogPage)
  catalogMenuOpen: false,
  openCatalogMenu: () => set({ catalogMenuOpen: true }),
  closeCatalogMenu: () => set({ catalogMenuOpen: false }),

  // StockHub context menu trigger (BottomBar → StockHubPage)
  stockHubMenuOpen: false,
  openStockHubMenu: () => set({ stockHubMenuOpen: true }),
  closeStockHubMenu: () => set({ stockHubMenuOpen: false }),

  // Space context menu trigger (BottomBar → SpacePage)
  spaceMenuOpen: false,
  openSpaceMenu: () => set({ spaceMenuOpen: true }),
  closeSpaceMenu: () => set({ spaceMenuOpen: false }),

  // Cart context menu trigger (BottomBar -> CartPage)
  cartMenuOpen: false,
  openCartMenu: () => set({ cartMenuOpen: true }),
  closeCartMenu: () => set({ cartMenuOpen: false }),

  // Setare vizualizare coș (simplu sau grupat pe categorii)
  cartGroupByCategory: false,
  toggleCartGroupByCategory: () => set((s) => ({ cartGroupByCategory: !s.cartGroupByCategory })),

  // Stare Pagină Virtuală pentru Coș
  cartOpen: false,
  openCart: () => set({ cartOpen: true }),
  closeCart: () => set({ cartOpen: false }),

  // Forțează ascunderea BottomBar-ului (sheet fără căutare — ex: GroupNameSheet)
  bottomBarHidden: false,
  setBottomBarHidden: (v) => set({ bottomBarHidden: v }),

  // Ascundere la scroll-down (AppShell) — în store ca sheet-urile „cu căutare"
  // să o poată reseta la deschidere (bara trebuie să fie vizibilă pentru ele).
  bottomBarScrollHidden: false,
  setBottomBarScrollHidden: (v) => set({ bottomBarScrollHidden: v }),

  globalNameIdSearch: false,
  setGlobalNameIdSearch: (v) => set({ globalNameIdSearch: v }),
}))

export const useActiveSearchQuery = (contextId = 'global') => {
  return useAppStore((s) => {
    const activeContext = s.searchContextStack[s.searchContextStack.length - 1]
    return activeContext === contextId ? s.searchQuery : ''
  })
}
