// [ITEMS FEATURE] — Componentă izolată, removable.
// TagTypeSheet — setează tipul tag-urilor (AND / OR) pentru fiecare folder.
//
// Props:
//   open     {boolean}
//   onClose  {fn}
//
// Comutarea AND → OR este imediată dacă nicio înregistrare nu intră în conflict.
// Dacă există înregistrări afectate (2+ tag-uri din folder), utilizatorul trebuie să
// tasteze numărul lor pentru a confirma (mutație cu impact retroactiv).

import { useState, useMemo } from 'react'
import { Folder } from 'lucide-react'
import BottomSheet from '../catalog/BottomSheet'
import { NO_AUTOFILL_PROPS } from '../../utils/formProps'
import { useItemsStore } from '../../store/useItemsStore'
import { countItemsConflictingInGroup } from '../../utils/tagConflicts'

export default function TagTypeSheet({ open, onClose }) {
  const tagGroups = useItemsStore((s) => s.tagGroups)
  const tagGroupMembers = useItemsStore((s) => s.tagGroupMembers)
  const items = useItemsStore((s) => s.items)
  const setTagGroupType = useItemsStore((s) => s.setTagGroupType)

  const [pending, setPending] = useState(null) // { group, affected }
  const [typed, setTyped] = useState('')

  const sortedGroups = useMemo(
    () => [...tagGroups].sort((a, b) => a.position - b.position),
    [tagGroups]
  )

  const handleToggle = (group) => {
    if (group.tagType === 'OR') {
      setTagGroupType(group.id, 'AND')
      return
    }
    const affected = countItemsConflictingInGroup(items, tagGroupMembers[group.id] ?? [])
    if (affected === 0) {
      setTagGroupType(group.id, 'OR')
      return
    }
    setTyped('')
    setPending({ group, affected })
  }

  const closeConfirm = () => {
    setPending(null)
    setTyped('')
  }

  const confirmOk = pending && typed.trim() === String(pending.affected)

  const handleConfirm = () => {
    if (!confirmOk) return
    setTagGroupType(pending.group.id, 'OR')
    closeConfirm()
  }

  return (
    <>
      <BottomSheet open={open} onClose={onClose}>
        <div className="pb-6">
          <h3 className="px-4 pt-2 pb-3 text-sm font-medium text-zinc-400 text-center border-b border-zinc-800/50">
            Tags type
          </h3>
          {sortedGroups.length === 0 ? (
            <p className="px-6 py-6 text-sm text-zinc-600 italic text-center">Niciun folder creat</p>
          ) : (
            <div className="max-h-[60dvh] overflow-y-auto">
              {sortedGroups.map((g) => {
                const isOr = g.tagType === 'OR'
                return (
                  <div
                    key={g.id}
                    className="flex items-center gap-3 px-5 py-3 border-b border-zinc-800/50 last:border-b-0"
                  >
                    <Folder size={16} className="text-zinc-500 shrink-0" />
                    <span className="flex-1 text-sm text-zinc-200 font-medium truncate">{g.name}</span>
                    <button
                      onClick={() => handleToggle(g)}
                      className={[
                        'w-16 h-8 rounded-lg text-xs font-bold transition-colors shrink-0',
                        isOr
                          ? 'bg-orange-500 text-white active:bg-orange-600'
                          : 'bg-zinc-800 text-zinc-300 active:bg-zinc-700',
                      ].join(' ')}
                      aria-label={`Tip tag-uri ${g.name}: ${isOr ? 'OR' : 'AND'}`}
                    >
                      {isOr ? 'OR' : 'AND'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </BottomSheet>

      {/* Confirmare AND → OR cu impact retroactiv */}
      {pending && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm overflow-hidden flex flex-col shadow-2xl">
            <div className="px-5 pt-5 pb-4 border-b border-zinc-800/50">
              <h3 className="font-bold text-lg text-orange-400">⚠ Schimbare în OR</h3>
              <p className="text-sm text-zinc-400 mt-2">
                În folderul „{pending.group.name}” sunt{' '}
                <span className="font-bold text-zinc-100">{pending.affected}</span>{' '}
                {pending.affected === 1 ? 'înregistrare' : 'înregistrări'} cu mai multe tag-uri din
                acest folder. {pending.affected === 1 ? 'Va fi marcată' : 'Vor fi marcate'} ca
                nefinalizate (portocalii) până la rezolvarea conflictelor.
              </p>
              <p className="text-sm text-zinc-400 mt-2">
                Pentru confirmare tastează numărul{' '}
                <span className="font-bold text-zinc-100">{pending.affected}</span>.
              </p>
            </div>
            <div className="p-5">
              <input
                autoFocus
                type="search"
                inputMode="numeric"
                name="tag-type-confirm"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                {...NO_AUTOFILL_PROPS}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleConfirm()
                  if (e.key === 'Escape') closeConfirm()
                }}
                placeholder={`Tastează ${pending.affected}`}
                className="w-full bg-zinc-950 text-base px-4 py-3 rounded-xl outline-none border border-zinc-800 focus:border-orange-500 text-zinc-100 placeholder-zinc-600 transition-colors"
              />
            </div>
            <div className="p-3 flex items-center justify-end gap-2 bg-zinc-950/30">
              <button
                onClick={closeConfirm}
                className="px-5 py-2.5 rounded-xl text-sm font-medium text-zinc-400 hover:text-zinc-200 active:bg-zinc-800 transition-colors"
              >
                Anulează
              </button>
              <button
                onClick={handleConfirm}
                disabled={!confirmOk}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-orange-500 text-white active:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Setează OR
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
