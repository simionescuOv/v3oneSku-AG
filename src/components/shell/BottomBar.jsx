import { Menu, Search, BookOpen, Package, X, ScanBarcode, ListFilter } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../../store/useAppStore'
import { NAV_ITEMS } from '../../lib/navItems'
import { normalize } from '../../lib/search'

export default function BottomBar({ hidden }) {
  const { t } = useTranslation()
  const toggleSideMenu = useAppStore((s) => s.toggleSideMenu)
  const searchQuery = useAppStore((s) => s.searchQuery)
  const setSearchQuery = useAppStore((s) => s.setSearchQuery)
  const searchContextStack = useAppStore((s) => s.searchContextStack)
  const activeContext = searchContextStack[searchContextStack.length - 1]
  const rawPlaceholder = activeContext?.placeholder
  const searchPlaceholder = (rawPlaceholder === 'Caută...' || !rawPlaceholder) 
    ? t('search.placeholder_fallback') 
    : rawPlaceholder
  
  const openCatalogMenu = useAppStore((s) => s.openCatalogMenu)
  const openStockHubMenu = useAppStore((s) => s.openStockHubMenu)
  const openSpaceMenu = useAppStore((s) => s.openSpaceMenu)
  const bottomBarHidden = useAppStore((s) => s.bottomBarHidden)
  const bottomBarFilterAction = useAppStore((s) => s.bottomBarFilterAction)

  const { pathname } = useLocation()
  // „Familia Catalog\" = pagina Catalog + pagina categoriei (/catalog/category/:id) + pagina produsului (/catalog/product/:nameId);
  const cartOpen = useAppStore((s) => s.cartOpen)
  
  const isProductPage = pathname.startsWith('/catalog/product')
  const isCatalogFamily = pathname.startsWith('/catalog')
  const isSpacePage = pathname.startsWith('/stockhub/space/')
  const isStockHub = pathname.startsWith('/stockhub') && !isSpacePage
  const isCartPage = cartOpen
  
  const bottomBarOverrides = useAppStore(s => s.bottomBarOverrides)
  const currentOverride = bottomBarOverrides.length > 0 ? bottomBarOverrides[bottomBarOverrides.length - 1] : null

  // Dacă e coșul deschis virtual, se ignoră pathname-ul pentru iconiță
  const matchingItem = NAV_ITEMS.find((item) => item.path === pathname)
  
  // Iconița finală de meniu (suprascriere > coș > ruta curentă > default)
  let FinalIcon = Menu
  if (currentOverride) {
    // Dacă am primit string 'X', folosim X din lucide-react (îl vom importa sus)
    FinalIcon = currentOverride.icon === 'X' ? X : currentOverride.icon
  } else if (isCartPage) {
    FinalIcon = NAV_ITEMS.find(i => i.path === '/cart')?.Icon || Menu
  } else {
    FinalIcon = matchingItem?.Icon ?? (isProductPage ? Package : isCatalogFamily ? BookOpen : Menu)
  }

  const handleMenuPress = () => {
    if (currentOverride) {
      currentOverride.onClick()
      return
    }
    
    if (isCartPage) useAppStore.getState().openCartMenu()
    else if (isCatalogFamily) openCatalogMenu()
    else if (isSpacePage) openSpaceMenu()
    else if (isStockHub) openStockHubMenu()
    else toggleSideMenu()
  }

  const globalNameIdSearch = useAppStore((s) => s.globalNameIdSearch)
  const setGlobalNameIdSearch = useAppStore((s) => s.setGlobalNameIdSearch)
  const openScanner = useAppStore((s) => s.openScanner)
  const barcodeScanMode = useAppStore((s) => s.barcodeScanMode)
  const clearBarcodeScan = useAppStore((s) => s.clearBarcodeScan)

  const handleToggleNameIdSearch = () => {
    const nextVal = !globalNameIdSearch
    setGlobalNameIdSearch(nextVal)
    if (nextVal) {
      setTimeout(() => document.getElementById('bottom-bar-search')?.focus(), 50)
    }
  }

  const autocompleteSuggestion = useAppStore((s) => s.autocompleteSuggestion)
  
  // Afișăm butonul NameID doar pe /catalog (rădăcina catalogului), nu și când coșul acoperă ecranul
  const showNameIdToggle = pathname === '/catalog' && !cartOpen

  // Butonul scanner: vizibil pe Catalog (/catalog), StockHub și SpacePage — exclus pe CategoryPage, ProductPage sau CartPage
  const isCatalogRoot = pathname === '/catalog'
  const showScanButton = !cartOpen && (isCatalogRoot || isStockHub || isSpacePage)

  // Logica pentru Ghost Text Autocomplete
  const q = searchQuery
  const hasSuggestion = autocompleteSuggestion && q.length > 0
  
  let ghostPrefix = ''
  let ghostMatch = ''
  let ghostSuffix = ''
  let typedPart = ''
  
  if (hasSuggestion) {
    if (autocompleteSuggestion.isPrefix) {
      typedPart = autocompleteSuggestion.text.slice(0, q.length)
      ghostSuffix = autocompleteSuggestion.text.slice(q.length)
    } else {
      typedPart = q
      const qNorm = normalize(q)
      const textNorm = normalize(autocompleteSuggestion.text)
      const matchIdx = textNorm.indexOf(qNorm)
      
      if (matchIdx !== -1) {
        const ctxStart = Math.max(0, matchIdx - 5)
        let prefix = autocompleteSuggestion.text.slice(ctxStart, matchIdx)
        if (ctxStart > 0) prefix = '..' + prefix
        
        ghostPrefix = ' ➔ ' + prefix
        ghostMatch = autocompleteSuggestion.text.slice(matchIdx, matchIdx + q.length)
        ghostSuffix = autocompleteSuggestion.text.slice(matchIdx + q.length)
      } else {
        ghostPrefix = ' ➔ '
        ghostSuffix = autocompleteSuggestion.text
      }
    }
  }

  const acceptSuggestion = (e) => {
    if (hasSuggestion) {
      e.preventDefault()
      setSearchQuery(autocompleteSuggestion.text)
      setTimeout(() => {
        const input = document.getElementById('bottom-bar-search')
        if (input) {
          input.focus()
          const len = autocompleteSuggestion.text.length
          input.setSelectionRange(len, len)
        }
      }, 0)
    }
  }

  return (
    <footer
      className={[
        'flex-none flex items-center gap-3 px-4 h-16',
        'bg-zinc-900 border-t border-zinc-800',
        'transition-transform duration-300 ease-in-out',
        hidden || bottomBarHidden ? 'translate-y-full' : 'translate-y-0',
      ].join(' ')}
    >
      <div 
        onClick={hasSuggestion ? acceptSuggestion : undefined}
        className={[
          "flex-1 flex items-center gap-2 bg-zinc-800 rounded-xl px-3 h-10 transition-colors focus-within:ring-1 focus-within:ring-zinc-600 relative overflow-hidden",
          hasSuggestion ? "cursor-pointer" : "cursor-text"
        ].join(' ')}
      >
        {/* Buton scanner barcode — la stânga inputului, vizibil pe Catalog/StockHub/Space */}
        {showScanButton && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); openScanner() }}
            className="shrink-0 p-0.5 text-zinc-400 active:text-amber-400 hover:text-zinc-200 relative z-20 transition-colors"
            aria-label="Scanează cod de bare"
          >
            <ScanBarcode size={18} />
          </button>
        )}
        <div className="relative flex-1 h-full flex items-center">
          {hasSuggestion && (
            <div className="absolute inset-0 pointer-events-none flex items-center whitespace-pre font-sans text-sm z-0 text-zinc-500 overflow-hidden" aria-hidden="true">
              <span className="invisible">{typedPart}</span>
              {ghostPrefix && <span>{ghostPrefix}</span>}
              {ghostMatch && <span className="text-blue-400">{ghostMatch}</span>}
              <span>{ghostSuffix}</span>
              <span className="text-blue-500/50"> autocomplete</span>
            </div>
          )}

          <label htmlFor="bottom-bar-search" className="sr-only">Căutare sau adăugare tag</label>
          <input
            type="search"
            name="bottom-bar-search"
            id="bottom-bar-search"
            placeholder={globalNameIdSearch ? t('search.name_id') : searchPlaceholder}
            autoComplete="off"
            enterKeyHint="search"
            data-lpignore="true"
            data-1p-ignore="true"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              if (barcodeScanMode && e.target.value === '') {
                clearBarcodeScan()
              }
            }}
            className="w-full h-full bg-transparent text-sm text-zinc-100 placeholder-zinc-500 outline-none relative z-10 [&::-webkit-search-cancel-button]:hidden"
          />
        </div>

        {searchQuery.length > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              if (barcodeScanMode) {
                clearBarcodeScan()
              } else {
                setSearchQuery('')
              }
              setTimeout(() => document.getElementById('bottom-bar-search')?.focus(), 0)
            }}
            className="shrink-0 p-1 text-zinc-400 active:text-zinc-100 hover:text-zinc-100 relative z-20"
            aria-label="Șterge căutarea"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {showNameIdToggle && (
        <button
          onClick={handleToggleNameIdSearch}
          className={[
            "shrink-0 flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200",
            globalNameIdSearch ? "bg-blue-600 text-white" : "bg-zinc-800 text-zinc-400 hover:text-zinc-300 active:bg-zinc-700"
          ].join(' ')}
          title="Căutare Globală NameID"
        >
          <Package size={20} />
        </button>
      )}

      {bottomBarFilterAction && (
        <button
          onClick={(e) => { e.stopPropagation(); bottomBarFilterAction.onClick(); }}
          className={[
            "shrink-0 flex items-center justify-center w-10 h-10 rounded-xl transition-colors",
            bottomBarFilterAction.active ? "bg-blue-600 text-white" : "bg-zinc-800 text-zinc-400 hover:text-zinc-300 active:bg-zinc-700"
          ].join(' ')}
          title="Filtrare"
        >
          <ListFilter size={20} />
        </button>
      )}

      <button
        onClick={handleMenuPress}
        className="shrink-0 flex items-center justify-center w-10 h-10 rounded-xl bg-zinc-800 text-zinc-300 active:bg-zinc-700 transition-all duration-200"
      >
        <FinalIcon size={20} className={currentOverride ? "text-red-400" : ""} />
      </button>
    </footer>
  )
}
