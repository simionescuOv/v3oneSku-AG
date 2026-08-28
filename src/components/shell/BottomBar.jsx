import { Menu, Search, BookOpen, Package, X } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useAppStore } from '../../store/useAppStore'
import { NAV_ITEMS } from '../../lib/navItems'

export default function BottomBar({ hidden }) {
  const toggleSideMenu = useAppStore((s) => s.toggleSideMenu)
  const searchQuery = useAppStore((s) => s.searchQuery)
  const setSearchQuery = useAppStore((s) => s.setSearchQuery)
  const searchPlaceholder = useAppStore((s) => s.searchPlaceholder)
  const openCatalogMenu = useAppStore((s) => s.openCatalogMenu)
  const openStockHubMenu = useAppStore((s) => s.openStockHubMenu)
  const openSpaceMenu = useAppStore((s) => s.openSpaceMenu)
  const bottomBarHidden = useAppStore((s) => s.bottomBarHidden)

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

  return (
    <footer
      className={[
        'flex-none flex items-center gap-3 px-4 h-16',
        'bg-zinc-900 border-t border-zinc-800',
        'transition-transform duration-300 ease-in-out',
        hidden || bottomBarHidden ? 'translate-y-full' : 'translate-y-0',
      ].join(' ')}
    >
      <div className="flex-1 flex items-center gap-2 bg-zinc-800 rounded-xl px-3 h-10">
        <Search size={16} className="text-zinc-500 shrink-0" />
        <input
          type="search"
          name="search"
          id="search"
          placeholder={searchPlaceholder}
          autoComplete="off"
          enterKeyHint="search"
          data-lpignore="true"
          data-1p-ignore="true"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 bg-transparent text-sm text-zinc-100 placeholder-zinc-500 outline-none"
        />
      </div>

      <button
        onClick={handleMenuPress}
        className="shrink-0 flex items-center justify-center w-10 h-10 rounded-xl bg-zinc-800 text-zinc-300 active:bg-zinc-700 transition-all duration-200"
      >
        <FinalIcon size={20} className={currentOverride ? "text-red-400" : ""} />
      </button>
    </footer>
  )
}
