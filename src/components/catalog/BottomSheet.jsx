import { useEffect } from 'react'
import { useAppStore } from '../../store/useAppStore'

// aboveBottomBar: pentru sheet-urile în modul „cu căutare" (SPEC_Picker_v2 §4.5)
// — panoul și backdrop-ul se opresc deasupra BottomBar-ului (h-16), ca bara să
// rămână vizibilă ȘI tappabilă (backdrop-ul nu o acoperă). Fără el, ancora
// `bottom-0` (relativă la rădăcina AppShell) acoperă complet footer-ul.
export default function BottomSheet({ open, onClose, children, className = '', aboveBottomBar = false }) {
  const setBottomBarScrollHidden = useAppStore((s) => s.setBottomBarScrollHidden)

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Sheet cu căutare: bara trebuie să fie efectiv vizibilă — anulează și
  // ascunderea provocată de scroll-down înainte de deschiderea sheet-ului.
  useEffect(() => {
    if (open && aboveBottomBar) setBottomBarScrollHidden(false)
  }, [open, aboveBottomBar, setBottomBarScrollHidden])

  if (!open) return null

  return (
    <>
      <div
        className={[
          'absolute inset-x-0 top-0 z-30 bg-black/50',
          aboveBottomBar ? 'bottom-16' : 'bottom-0',
        ].join(' ')}
        onPointerDown={onClose}
      />
      <div
        className={[
          'absolute left-0 right-0 z-40',
          aboveBottomBar ? 'bottom-16' : 'bottom-0',
          'bg-zinc-900 rounded-t-2xl',
          'flex flex-col',
          'max-h-[90dvh]',
          className,
        ].join(' ')}
        style={aboveBottomBar ? undefined : { paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-zinc-700" />
        </div>
        {children}
      </div>
    </>
  )
}
