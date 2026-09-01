import { useEffect, useRef } from 'react'
import { useAppStore } from '../../store/useAppStore'

// ═══ Global Sheet Stack Manager ═══════════════════════════════════
// Singleton — gestionează centralizat toate intrările de history ale
// BottomSheet-urilor. Fiecare sheet primește propriul pushState, iar
// gestul Back închide mereu sheet-ul din vârful stivei (LIFO).
if (!window.__sheetStack) {
  window.__sheetStack = {
    stack: [],          // [{ id, onBack }]
    _ignoreNext: false,
    _pendingPop: false,
    _popTimer: null,

    push(id, onBack) {
      clearTimeout(this._popTimer)
      this.stack.push({ id, onBack })

      if (this._pendingPop) {
        // Tranziție: sheet A se închide → sheet B se deschide în același tick.
        // Înlocuim intrarea existentă din history în loc să adăugăm una nouă.
        window.history.replaceState({ sheet: id }, '')
        this._pendingPop = false
      } else {
        window.history.pushState({ sheet: id }, '')
      }
    },

    pop(id) {
      const wasTop = this.stack.length > 0 &&
        this.stack[this.stack.length - 1].id === id
      this.stack = this.stack.filter(s => s.id !== id)

      if (!wasTop) return

      this._pendingPop = true
      clearTimeout(this._popTimer)
      this._popTimer = setTimeout(() => {
        if (this._pendingPop) {
          this._pendingPop = false
          this._ignoreNext = true
          window.history.back()
        }
      }, 50)
    },
  }

  // Un singur listener global pe popstate — dispatch către sheet-ul din vârf
  window.addEventListener('popstate', (e) => {
    const mgr = window.__sheetStack

    if (mgr._ignoreNext) {
      mgr._ignoreNext = false
      e.stopImmediatePropagation()
      return
    }

    if (mgr.stack.length === 0) return // Cart / alte handlere gestionează

    e.stopImmediatePropagation()
    const top = mgr.stack[mgr.stack.length - 1]
    top.onBack()
  })
}

// aboveBottomBar: sheet-urile „cu căutare" (SPEC_Picker_v2 §4.5)
// — panoul și backdrop-ul se opresc deasupra BottomBar-ului (h-16), ca bara să
// rămână vizibilă ȘI tappabilă (backdrop-ul nu o acoperă). Fără el, ancora
// `bottom-0` (relativă la rădăcina AppShell) acoperă complet footer-ul.
//
// onBackIntercept: dacă returnează true, Back navighează INTERN în sheet
// (ex: SchemaSheet sub-view-uri) fără să închidă sheet-ul.
export default function BottomSheet({ open, onClose, children, className = '', aboveBottomBar = false, bottomBarMenu, onBackIntercept }) {
  const setBottomBarScrollHidden = useAppStore((s) => s.setBottomBarScrollHidden)
  const pushBottomBarOverride = useAppStore((s) => s.pushBottomBarOverride)
  const popBottomBarOverride = useAppStore((s) => s.popBottomBarOverride)

  const sheetId = useRef(Math.random().toString(36).substr(2, 9))
  const prevOpen = useRef(false)
  const pushedRef = useRef(false)

  // Refs pentru ultimele valori (evită recaptarea closure-urilor în handleBack)
  const onCloseRef = useRef(onClose)
  const onBackInterceptRef = useRef(onBackIntercept)
  useEffect(() => { onCloseRef.current = onClose }, [onClose])
  useEffect(() => { onBackInterceptRef.current = onBackIntercept }, [onBackIntercept])

  const bottomBarMenuRef = useRef(bottomBarMenu)
  useEffect(() => { bottomBarMenuRef.current = bottomBarMenu }, [bottomBarMenu])

  // Suprascriere Meniu BottomBar pentru ferestrele care lasă bara vizibilă
  useEffect(() => {
    if (!open || !aboveBottomBar) return
    
    // Implicit, butonul de meniu devine un "X" care închide fereastra
    const override = {
      id: sheetId.current,
      icon: bottomBarMenuRef.current?.icon || 'X',
      onClick: () => {
        if (bottomBarMenuRef.current?.onClick) {
          bottomBarMenuRef.current.onClick()
        } else {
          onCloseRef.current?.()
        }
      }
    }
    
    pushBottomBarOverride(override)
    return () => popBottomBarOverride(sheetId.current)
  }, [open, aboveBottomBar, pushBottomBarOverride, popBottomBarOverride])

  // ═══ History Stack Management ═══
  useEffect(() => {
    if (open && !prevOpen.current) {
      // OPENED — înregistrare în stiva globală
      pushedRef.current = true

      const handleBack = () => {
        if (onBackInterceptRef.current?.()) {
          // Sub-view-ul a gestionat Back — re-push intrarea de history
          window.history.pushState({ sheet: sheetId.current }, '')
          return
        }
        // Popstate a consumat deja intrarea — curățăm
        pushedRef.current = false
        window.__sheetStack.stack = window.__sheetStack.stack.filter(
          s => s.id !== sheetId.current
        )
        onCloseRef.current?.()
      }

      window.__sheetStack.push(sheetId.current, handleBack)
    } else if (!open && prevOpen.current && pushedRef.current) {
      // CLOSED programmatic (buton / backdrop) — eliminăm din history
      pushedRef.current = false
      window.__sheetStack.pop(sheetId.current)
    }
    prevOpen.current = open

    return () => {
      // Cleanup: unmount sau React 18 Strict Mode double-mount
      if (pushedRef.current) {
        pushedRef.current = false
        const isInStack = window.__sheetStack.stack.some(
          s => s.id === sheetId.current
        )
        if (isInStack) {
          window.__sheetStack.pop(sheetId.current)
        }
      }
      prevOpen.current = false
    }
  }, [open])

  // Escape key
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
        {children}
      </div>
    </>
  )
}
