import { create } from 'zustand'

export const useAppStore = create((set) => ({
  sideMenuOpen: false,
  openSideMenu: () => set({ sideMenuOpen: true }),
  closeSideMenu: () => set({ sideMenuOpen: false }),
  toggleSideMenu: () => set((s) => ({ sideMenuOpen: !s.sideMenuOpen })),

  // ── Scroll Restoration Cache ─────────────────────────────────────────
  scrollCache: {},
  setScrollCache: (key, val) => set((s) => ({ scrollCache: { ...s.scrollCache, [key]: val } })),

  // BottomBar search shared between bar and active sheets
  searchQuery: '',
  searchContextStack: [{ id: 'global', placeholder: 'Caută...' }],
  autocompleteSuggestion: null,
  setSearchQuery: (q) => set({ searchQuery: q }),
  
  // Adăugăm/actualizăm contextul de căutare
  pushSearchContext: (id, placeholder) => set((s) => ({ 
    searchContextStack: [
      ...s.searchContextStack.filter(c => c.id !== id), 
      { id, placeholder: placeholder || 'Caută...' }
    ] 
  })),
  updateSearchContext: (id, placeholder) => set((s) => ({
    searchContextStack: s.searchContextStack.map(c => c.id === id ? { ...c, placeholder } : c)
  })),
  popSearchContext: (id) => set((s) => {
    const newStack = s.searchContextStack.filter(c => c.id !== id);
    if (newStack.length === 0) newStack.push({ id: 'global', placeholder: 'Caută...' });
    return { searchContextStack: newStack };
  }),

  setAutocompleteSuggestion: (val) => set((s) => {
    const prev = s.autocompleteSuggestion;
    if (prev === val) return s;
    if (prev && val && prev.text === val.text && prev.isPrefix === val.isPrefix) return s;
    return { autocompleteSuggestion: val };
  }),
  clearSearch: () => set({ searchQuery: '', autocompleteSuggestion: null }),

  // BottomBar override (pentru BottomSheet-uri de tip aboveBottomBar)
  bottomBarOverrides: [],
  pushBottomBarOverride: (override) => set((s) => ({ bottomBarOverrides: [...s.bottomBarOverrides, override] })),
  popBottomBarOverride: (id) => set((s) => ({ bottomBarOverrides: s.bottomBarOverrides.filter(o => o.id !== id) })),

  // BottomBar filter action injectat de pagini (ex: SpacePage)
  bottomBarFilterAction: null,
  setBottomBarFilterAction: (action) => set({ bottomBarFilterAction: action }),

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
  scannedBarcode: null,
  activateBarcodeScan: (code) => set({ barcodeScanMode: true, scannedBarcode: code, searchQuery: code }),
  clearBarcodeScan: () => set({ barcodeScanMode: false, scannedBarcode: null, searchQuery: '' }),

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
    const currentId = activeContext?.id || 'global'
    return currentId === contextId ? s.searchQuery : ''
  })
}
