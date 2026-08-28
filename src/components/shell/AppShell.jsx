import { useCallback } from 'react'
import { ShoppingCart } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import TopBar from './TopBar'
import MainContent from './MainContent'
import BottomBar from './BottomBar'
import SideMenu from '../nav/SideMenu'
import { useAppStore } from '../../store/useAppStore'
import { useCartStore } from '../../store/useCartStore'
import { useViewportHeight } from '../../hooks/useViewportHeight'

export default function AppShell() {
  const navigate = useNavigate()
  const location = useLocation()
  const bottomHidden = useAppStore((s) => s.bottomBarScrollHidden)
  const setBottomHidden = useAppStore((s) => s.setBottomBarScrollHidden)
  const { height, offsetTop } = useViewportHeight()

  const handleScrollDown = useCallback(() => setBottomHidden(true), [setBottomHidden])
  const handleScrollUp = useCallback(() => setBottomHidden(false), [setBottomHidden])

  const { items } = useCartStore()
  const totalItems = items.reduce((acc, item) => acc + item.quantity, 0)

  const openCart = useAppStore((s) => s.openCart)
  const cartOpen = useAppStore((s) => s.cartOpen)

  return (
    <div
      className="fixed inset-x-0 flex flex-col bg-zinc-950 text-zinc-100 overflow-hidden"
      style={{ height: `${height}px`, top: `${offsetTop}px` }}
    >
      <TopBar />
      <MainContent onScrollDown={handleScrollDown} onScrollUp={handleScrollUp} />
      <BottomBar hidden={bottomHidden} />
      <SideMenu />

      {/* Global Cart FAB */}
      {items.length > 0 && !cartOpen && (
        <button
          onClick={() => openCart()}
          className={[
            'absolute right-4 z-40 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white p-3.5 rounded-full shadow-lg shadow-black/50 transition-all duration-300',
            bottomHidden ? 'bottom-6' : 'bottom-20'
          ].join(' ')}
        >
          <div className="relative">
            <ShoppingCart size={24} />
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full border-2 border-blue-600">
              {totalItems > 99 ? '99+' : totalItems}
            </span>
          </div>
        </button>
      )}
    </div>
  )
}

