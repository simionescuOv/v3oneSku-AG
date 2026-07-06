import { useCallback } from 'react'
import TopBar from './TopBar'
import MainContent from './MainContent'
import BottomBar from './BottomBar'
import SideMenu from '../nav/SideMenu'
import { useAppStore } from '../../store/useAppStore'
import { useViewportHeight } from '../../hooks/useViewportHeight'

export default function AppShell() {
  const bottomHidden = useAppStore((s) => s.bottomBarScrollHidden)
  const setBottomHidden = useAppStore((s) => s.setBottomBarScrollHidden)
  const { height, offsetTop } = useViewportHeight()

  const handleScrollDown = useCallback(() => setBottomHidden(true), [setBottomHidden])
  const handleScrollUp = useCallback(() => setBottomHidden(false), [setBottomHidden])

  return (
    <div
      className="fixed inset-x-0 flex flex-col bg-zinc-950 text-zinc-100 overflow-hidden"
      style={{ height: `${height}px`, top: `${offsetTop}px` }}
    >
      <TopBar />
      <MainContent onScrollDown={handleScrollDown} onScrollUp={handleScrollUp} />
      <BottomBar hidden={bottomHidden} />
      <SideMenu />
    </div>
  )
}
