// [ITEMS FEATURE] — importul de mai jos se șterge odată cu funcționalitatea
import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { List, MoreVertical, Archive, Tags, Download, Upload } from 'lucide-react'
import BottomSheet from '../components/catalog/BottomSheet'
import MultiTagSheet from '../components/items/MultiTagSheet'
import { useItemsStore } from '../store/useItemsStore'

export default function DashboardPage() {
  const navigate = useNavigate()
  const [itemsMenuOpen, setItemsMenuOpen] = useState(false)
  const [multiTagOpen, setMultiTagOpen] = useState(false)
  
  const fileInputRef = useRef(null)
  
  const handleExport = () => {
    const state = useItemsStore.getState()
    const exportData = {
      items: state.items,
      archivedItems: state.archivedItems,
      tagGroups: state.tagGroups,
      tagGroupMembers: state.tagGroupMembers,
      multiTags: state.multiTags
    }
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `onesku_items_backup_${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!window.confirm("ATENȚIE: Importul va suprascrie complet datele curente de items, tags și multitag. Ești sigur că vrei să continui?")) {
      e.target.value = '' // reset
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result)
        const success = useItemsStore.getState().importBackup(parsed)
        if (success) {
          alert("Datele au fost importate cu succes!")
        } else {
          alert("Eroare la import: formatul fișierului este invalid.")
        }
      } catch (err) {
        console.error("Eroare la parsarea JSON-ului", err)
        alert("Eroare: fișier corupt sau invalid.")
      }
      e.target.value = '' // reset
    }
    reader.readAsText(file)
  }

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

        {/* Card MultiTag — separat de cardul ITEMS */}
        <button
          onClick={() => setMultiTagOpen(true)}
          className="flex items-center gap-3 w-full bg-zinc-800 rounded-2xl px-5 py-4 mt-3 hover:bg-zinc-700 active:bg-zinc-700 transition-colors text-left"
        >
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-purple-600/20 text-purple-400 shrink-0">
            <Tags size={20} />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-100">MULTITAG</p>
            <p className="text-xs text-zinc-500 mt-0.5">Preset-uri reutilizabile de etichete</p>
          </div>
        </button>

        {/* GESTIUNE DATE */}
        <div className="mt-6 border-t border-zinc-800 pt-6">
          <h2 className="text-sm font-semibold text-zinc-400 mb-3 px-1">GESTIUNE DATE</h2>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleExport}
              className="flex flex-col items-center justify-center gap-2 bg-zinc-800 rounded-2xl p-4 hover:bg-zinc-700 active:bg-zinc-700 transition-colors"
            >
              <Download size={24} className="text-zinc-400" />
              <span className="text-xs font-medium text-zinc-300">Export Backup</span>
            </button>
            <button
              onClick={handleImportClick}
              className="flex flex-col items-center justify-center gap-2 bg-zinc-800 rounded-2xl p-4 hover:bg-zinc-700 active:bg-zinc-700 transition-colors"
            >
              <Upload size={24} className="text-zinc-400" />
              <span className="text-xs font-medium text-zinc-300">Import Backup</span>
            </button>
          </div>
          <input 
            type="file" 
            accept=".json" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            className="hidden" 
          />
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

      {/* MultiTag Sheet */}
      <MultiTagSheet
        isOpen={multiTagOpen}
        onClose={() => setMultiTagOpen(false)}
      />
    </div>
  )
}
