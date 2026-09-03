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

  // Catalog context menu trigger (BottomBar -> CatalogPage)
  catalogMenuOpen: false,
  openCatalogMenu: () => set({ catalogMenuOpen: true }),
  closeCatalogMenu: () => set({ catalogMenuOpen: false }),

  // StockHub context menu trigger (BottomBar -> StockHubPage)
  stockHubMenuOpen: false,
  openStockHubMenu: () => set({ stockHubMenuOpen: true }),
  closeStockHubMenu: () => set({ stockHubMenuOpen: false }),

  // Space context menu trigger (BottomBar -> SpacePage)
  spaceMenuOpen: false,
  openSpaceMenu: () => set({ spaceMenuOpen: true }),
  closeSpaceMenu: () => set({ spaceMenuOpen: false }),

  // Cart context menu trigger (BottomBar -> CartPage)
  cartMenuOpen: false,
  openCartMenu: () => set({ cartMenuOpen: true }),
  closeCartMenu: () => set({ cartMenuOpen: false }),

  // Setare vizualizare cos (simplu sau grupat pe categorii)
  cartGroupByCategory: false,
  toggleCartGroupByCategory: () => set((s) => ({ cartGroupByCategory: !s.cartGroupByCategory })),

  // Stare Pagina Virtuala pentru Cos
  cartOpen: false,
  openCart: () => set({ cartOpen: true }),
  closeCart: () => set({ cartOpen: false }),

  // Forteaza ascunderea BottomBar-ului (sheet fara cautare - ex: GroupNameSheet)
  bottomBarHidden: false,
  setBottomBarHidden: (v) => set({ bottomBarHidden: v }),

  // Ascundere la scroll-down (AppShell)
  bottomBarScrollHidden: false,
  setBottomBarScrollHidden: (v) => set({ bottomBarScrollHidden: v }),

  globalNameIdSearch: false,
  setGlobalNameIdSearch: (v) => set({ globalNameIdSearch: v }),

  // Barcode scan mode - activat de ScannerOverlay (scanare camera sau input manual)
  // Motor de cautare: exact match (===) pe products[].barcode - NU fuzzy/picker.
  barcodeScanMode: false,
  activateBarcodeScan: (code) => set({ barcodeScanMode: true, searchQuery: code }),
  clearBarcodeScan: () => set({ barcodeScanMode: false, searchQuery: '' }),

  // Scanner overlay state
  scannerOpen: false,
  scannerOnScan: null,
  openScanner: (onScan = null) => set({ scannerOpen: true, scannerOnScan: onScan }),
  closeScanner: () => set({ scannerOpen: false, scannerOnScan: null }),

  // Draft formular produs (Local-First — persistă starea când utilizatorul navighează să inspecteze un duplicat)
  productFormDraft: null,
  setProductFormDraft: (draft) => set({ productFormDraft: draft }),
  clearProductFormDraft: () => set({ productFormDraft: null }),
}))

export const useActiveSearchQuery = (contextId = 'global') => {
  return useAppStore((s) => {
    const activeContext = s.searchContextStack[s.searchContextStack.length - 1]
    return activeContext === contextId ? s.searchQuery : ''
  })
}
