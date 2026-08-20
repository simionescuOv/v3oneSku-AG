import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, AlertTriangle, Check, Plus } from 'lucide-react'
import { useStockStore } from '../store/useStockStore'
import { useAppStore } from '../store/useAppStore'
import { usePicker } from '../hooks/usePicker'
import BottomSheet from '../components/catalog/BottomSheet'

export default function StockHubPage() {
  const { spaces, alerts, isLoading, fetchSpaces, fetchAlerts, resolveAlert, createSpace } = useStockStore()
  const { searchQuery, setSearchQuery, stockHubMenuOpen, closeStockHubMenu } = useAppStore()
  const [expandedAlerts, setExpandedAlerts] = useState({})
  
  // Închidem meniul automat pe unmount (safety)
  useEffect(() => {
    return () => closeStockHubMenu()
  }, [closeStockHubMenu])

  useEffect(() => {
    if (spaces.length === 0) fetchSpaces()
    fetchAlerts()
  }, [spaces.length, fetchSpaces, fetchAlerts])

  const { filteredItems, showCreate } = usePicker({
    mode: 'inline',
    items: spaces,
    labelFn: (s) => s.name,
    query: searchQuery,
    allowCreate: true,
  })

  const isSearching = searchQuery.trim().length > 0

  const toggleAlerts = (spaceId) => {
    setExpandedAlerts(prev => ({ ...prev, [spaceId]: !prev[spaceId] }))
  }

  const handleResolve = async (alertId) => {
    await resolveAlert(alertId)
    fetchAlerts()
  }

  const handleCreate = async () => {
    const trimmed = searchQuery.trim()
    if (!trimmed) return
    await createSpace(trimmed, false) // Default la creare manuală: fără stoc negativ
    setSearchQuery('')
  }

  const handleOrganize = () => {
    alert("Modul de organizare va fi disponibil curând!")
    closeStockHubMenu()
  }

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-100">
      {/* Header Page */}
      <div className="p-6 shrink-0 pb-4">
        <h1 className="text-2xl font-bold text-zinc-100 mb-1">StockHub</h1>
        <p className="text-sm text-zinc-500">Gestiunea spațiilor de stoc.</p>
      </div>

      {/* Main Content Area */}
      {isLoading && spaces.length === 0 ? (
        <div className="px-6 space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 animate-pulse">
              <div className="flex justify-between mb-2">
                <div className="h-4 bg-zinc-800 rounded w-1/3"></div>
                <div className="h-4 bg-zinc-800 rounded w-16"></div>
              </div>
              <div className="flex gap-4">
                <div className="h-3 bg-zinc-800 rounded w-20"></div>
                <div className="h-3 bg-zinc-800 rounded w-20"></div>
              </div>
            </div>
          ))}
        </div>
      ) : spaces.length === 0 && !isSearching ? (
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center min-h-[50vh]">
          <p className="text-zinc-400 text-sm leading-relaxed">
            Nu ai niciun spațiu de stocare.<br />
            Scrie un nume în bara de căutare ca să creezi primul spațiu.
          </p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-24">
          <ul className="space-y-2">
            {filteredItems.map((space) => {
              const spaceAlerts = alerts.filter(a => a.space_id === space.id)
              const hasAlerts = spaceAlerts.length > 0
              const isExpanded = expandedAlerts[space.id]

              return (
                <li
                  key={space.id}
                  className="px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-zinc-100">{space.name}</span>
                    {space.allow_negative_stock && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20">
                        negativ permis
                      </span>
                    )}
                  </div>
                  <div className="flex gap-4 text-xs text-zinc-500 mb-2">
                    <span>{space.product_count} produse</span>
                    <span className={space.total_units < 0 ? 'text-red-400' : ''}>
                      {space.total_units} unități
                    </span>
                  </div>

                  {hasAlerts && (
                    <div className="mt-3 pt-3 border-t border-red-500/20">
                      <button 
                        onClick={() => toggleAlerts(space.id)}
                        className="flex items-center gap-2 text-xs font-medium text-red-400 hover:text-red-300 transition-colors w-full"
                      >
                        <AlertTriangle size={14} className="shrink-0" />
                        <span className="flex-1 text-left">{spaceAlerts.length} produse cu stoc negativ</span>
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                      
                      {isExpanded && (
                        <div className="mt-2 space-y-1.5 pl-5">
                          {spaceAlerts.map(alert => (
                            <div key={alert.id} className="flex items-center justify-between text-xs bg-zinc-950/50 p-2 rounded-lg">
                              <span className="text-zinc-300 truncate mr-2">
                                <span className="text-zinc-500 mr-1">•</span>
                                {alert.products?.name_id || 'Produs sters'}: <span className="text-red-400 font-medium">{alert.stock_value} un.</span>
                              </span>
                              <button
                                onClick={() => handleResolve(alert.id)}
                                className="flex items-center gap-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2 py-1 rounded transition-colors shrink-0"
                              >
                                <Check size={12} className="text-green-400" />
                                Rezolvă
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>

          {isSearching && filteredItems.length === 0 && !showCreate && (
             <div className="py-8 text-center text-sm text-zinc-500">
               Niciun spațiu găsit.
             </div>
          )}

          {showCreate && (
            <button
              onClick={handleCreate}
              className="w-full flex items-center gap-3 px-4 py-3.5 mt-2 rounded-xl text-left text-blue-400 active:bg-zinc-900 border border-dashed border-blue-900/50"
            >
              <Plus size={18} className="shrink-0" />
              <span className="text-sm">Adaugă spațiul „{searchQuery.trim()}”</span>
            </button>
          )}
        </div>
      )}

      {/* FAB - Create shortcut if searching */}
      {showCreate && (
        <button
          onClick={handleCreate}
          className="absolute right-4 z-20 flex items-center justify-center w-14 h-14 rounded-full bg-blue-600 text-white shadow-xl active:bg-blue-700"
          style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
        >
          <Plus size={24} />
        </button>
      )}

      {/* Context Menu BottomSheet */}
      <BottomSheet open={stockHubMenuOpen} onClose={closeStockHubMenu}>
        <div className="px-4 pb-6 space-y-1">
           <button
            onClick={handleOrganize}
            className="w-full flex items-center gap-3 px-3 py-3.5 rounded-xl text-sm text-zinc-200 hover:bg-zinc-800 active:bg-zinc-700"
          >
            <span className="text-zinc-400">
              {/* Using a placeholder icon for Organize since Lucide doesn't have a direct 'Organize' name, List is good */}
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-list"><line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></svg>
            </span>
            <span className="flex-1 text-left">Organizează spațiile</span>
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}
