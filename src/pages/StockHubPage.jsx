import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, AlertTriangle, Check } from 'lucide-react'
import { useStockStore } from '../store/useStockStore'

export default function StockHubPage() {
  const { spaces, alerts, isLoading, fetchSpaces, fetchAlerts, resolveAlert } = useStockStore()
  const [expandedAlerts, setExpandedAlerts] = useState({})

  useEffect(() => {
    if (spaces.length === 0) fetchSpaces()
    fetchAlerts()
  }, [spaces.length, fetchSpaces, fetchAlerts])

  const toggleAlerts = (spaceId) => {
    setExpandedAlerts(prev => ({
      ...prev,
      [spaceId]: !prev[spaceId]
    }))
  }

  const handleResolve = async (alertId) => {
    await resolveAlert(alertId)
    fetchAlerts()
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100 mb-1">StockHub</h1>
        <p className="text-sm text-zinc-500">Gestiunea spațiilor de stoc.</p>
      </div>

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-3">
          Spaces · {spaces.length}
        </h2>
        
        {isLoading && spaces.length === 0 ? (
          <div className="space-y-2">
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
        ) : (
          <ul className="space-y-2">
            {spaces.map((space) => {
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
                    <span
                      className={space.total_units < 0 ? 'text-red-400' : ''}
                    >
                      {space.total_units} unități
                    </span>
                  </div>

                  {/* Inline Alerts (Option C) */}
                  {hasAlerts && (
                    <div className="mt-3 pt-3 border-t border-red-500/20">
                      <button 
                        onClick={() => toggleAlerts(space.id)}
                        className="flex items-center gap-2 text-xs font-medium text-red-400 hover:text-red-300 transition-colors"
                      >
                        <AlertTriangle size={14} />
                        <span>{spaceAlerts.length} produse cu stoc negativ</span>
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
        )}
      </section>

      <div className="h-64" />
    </div>
  )
}
