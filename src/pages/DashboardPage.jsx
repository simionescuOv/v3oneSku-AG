// [ITEMS FEATURE] — importul de mai jos se șterge odată cu funcționalitatea
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { List, MoreVertical, Archive } from 'lucide-react'
import BottomSheet from '../components/catalog/BottomSheet'

export default function DashboardPage() {
  const navigate = useNavigate()
  const [itemsMenuOpen, setItemsMenuOpen] = useState(false)

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-zinc-100 mb-1">Dashboard</h1>
      <p className="text-sm text-zinc-500">Statistici și indicatori — neimplementat încă.</p>

      {/* [ITEMS FEATURE] — Șterge blocul de mai jos pentru a elimina funcționalitatea */}
      <div className="mt-6">
        <div className="flex items-center w-full bg-zinc-800 rounded-2xl overflow-hidden">
          <button
            onClick={() => navigate('/dashboard/items')}
            className="flex items-center gap-3 flex-1 px-5 py-4 hover:bg-zinc-700 active:bg-zinc-700 transition-colors text-left"
          >
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 shrink-0">
              <List size={20} />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-100">ITEMS</p>
              <p className="text-xs text-zinc-500 mt-0.5">Listă de elemente înregistrate</p>
            </div>
          </button>
          <button
            onClick={() => setItemsMenuOpen(true)}
            className="flex items-center justify-center w-12 h-full py-4 text-zinc-500 hover:text-zinc-300 active:text-zinc-100 active:bg-zinc-700 transition-colors"
            aria-label="Meniu Items"
          >
            <MoreVertical size={18} />
          </button>
        </div>
      </div>
      {/* [ITEMS FEATURE] — sfârșit bloc */}

      {/* Meniu contextual Items */}
      <BottomSheet open={itemsMenuOpen} onClose={() => setItemsMenuOpen(false)}>
        <div className="pb-6">
          <h2 className="px-4 text-sm font-medium text-zinc-400 mb-3 text-center">Items</h2>
          <button
            onClick={() => { setItemsMenuOpen(false); navigate('/dashboard/items/archive') }}
            className="w-full flex items-center gap-4 px-6 py-4 active:bg-zinc-800"
          >
            <Archive size={20} className="text-zinc-400 shrink-0" />
            <span className="text-sm text-zinc-100">Arhivă</span>
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}
