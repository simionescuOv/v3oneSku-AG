import BottomSheet from '../catalog/BottomSheet'

/**
 * Componentă unificată pentru Meniurile de Context din aplicație.
 * Folosește standardul BottomSheet pentru interceptarea gestului Back
 * și afișează o listă de butoane uniform stilizate.
 * 
 * @param {boolean} open
 * @param {function} onClose
 * @param {Array} options - [{ label, icon, badge, onClick, danger }]
 */
export default function ContextMenu({ open, onClose, options = [] }) {
  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="px-4 pb-6 space-y-1">
        {options.map((opt, idx) => (
          opt === 'divider' ? (
            <div key={`div-${idx}`} className="h-px bg-zinc-800/50 my-1 mx-2" />
          ) : (
            <button
              key={idx}
              onClick={opt.onClick}
              disabled={opt.disabled}
              className={[
                "w-full flex items-center gap-3 px-3 py-3.5 rounded-xl text-sm transition-colors",
                opt.disabled ? "opacity-50 cursor-not-allowed" : "active:bg-zinc-700",
                opt.active 
                  ? (opt.activeColor === 'amber' ? "bg-amber-950/40 text-amber-400" : "bg-blue-950/40 text-blue-400")
                  : "text-zinc-200 hover:bg-zinc-800"
              ].join(' ')}
            >
              <span className={opt.active ? '' : (opt.danger ? "text-red-400" : "text-zinc-400")}>
                {opt.icon}
              </span>
              <span className="flex-1 text-left">{opt.label}</span>
              {opt.badge && (
                <span className="text-[10px] font-semibold bg-blue-600 text-white px-2 py-0.5 rounded-full">
                  {opt.badge}
                </span>
              )}
            </button>
          )
        ))}
      </div>
    </BottomSheet>
  )
}
