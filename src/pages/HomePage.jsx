import { useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'

// Cuvinte de validare generare build (se actualizează la fiecare push / commit major)
const BUILD_WORD = 'clepsidra'
const COMMIT_WORD = 'busuioc'

export default function HomePage() {
  const openSideMenu = useAppStore((s) => s.openSideMenu)

  useEffect(() => {
    // Deschide automat meniul lateral la montarea paginii (de ex. la navigarea spre Home)
    openSideMenu()
  }, [openSideMenu])

  return (
    <div className="flex-1 flex flex-col items-center justify-center">
      <h1 className="text-xl font-semibold text-zinc-100 tracking-wide">oneSku</h1>
      <p className="mt-2 text-2xl font-bold text-zinc-50">build: {BUILD_WORD}</p>
      <p className="mt-1 text-lg font-medium text-zinc-400">commit: {COMMIT_WORD}</p>
    </div>
  )
}
