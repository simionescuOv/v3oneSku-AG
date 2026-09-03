import { useState, useCallback, useEffect } from 'react'
import { X, Keyboard, Search, Camera } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner'

/**
 * ScannerOverlay — ecran fullscreen de scanare coduri de bare.
 *
 * Două moduri de input:
 *   1. Scanare prin cameră (BarcodeDetector nativ sau ZXing fallback)
 *   2. Introducere manuală — input numeric, submit explicit (NU caracter-cu-caracter)
 *
 * Interceptare gest nativ Back / Return de pe telefon (popstate).
 * Controale unificate în bara inferioară (ergonomie one-handed).
 */
export default function ScannerOverlay() {
  const closeScanner = useAppStore((s) => s.closeScanner)
  const activateBarcodeScan = useAppStore((s) => s.activateBarcodeScan)
  const scannerOnScan = useAppStore((s) => s.scannerOnScan)

  const [manualMode, setManualMode] = useState(false)
  const [manualCode, setManualCode] = useState('')

  // Integrare cu stiva globală de ferestre (BottomSheet stack) pentru gestul de Back
  useEffect(() => {
    const sheetMgr = window.__sheetStack
    if (sheetMgr) {
      sheetMgr.push('scanner_overlay', () => {
        closeScanner()
      })
      return () => {
        sheetMgr.pop('scanner_overlay')
      }
    } else {
      window.history.pushState({ virtualPage: 'scanner' }, '')
      const handlePopState = () => closeScanner()
      window.addEventListener('popstate', handlePopState)
      return () => window.removeEventListener('popstate', handlePopState)
    }
  }, [closeScanner])

  const handleDetected = useCallback((code) => {
    if (scannerOnScan) {
      scannerOnScan(code)
    } else {
      activateBarcodeScan(code)
    }
    closeScanner()
  }, [scannerOnScan, activateBarcodeScan, closeScanner])

  const { videoRef, isReady, permissionDenied, error } = useBarcodeScanner({
    onDetected: handleDetected,
    active: !manualMode,
  })

  const handleManualSubmit = () => {
    const code = manualCode.trim()
    if (!code) return
    if (scannerOnScan) {
      scannerOnScan(code)
    } else {
      activateBarcodeScan(code)
    }
    closeScanner()
  }

  const handleClose = () => {
    closeScanner()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Corp principal */}
      <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden">

        {!manualMode ? (
          <>
            {/* Video fullscreen */}
            <video
              ref={videoRef}
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
            />

            {/* Overlay semi-transparent cu vizor */}
            <div className="absolute inset-0 pointer-events-none">
              {/* Zonă întunecată sus */}
              <div className="absolute inset-x-0 top-0 h-[28%] bg-black/60" />
              {/* Zona centrală: întunecată stânga + vizor + întunecată dreapta */}
              <div className="absolute inset-x-0 top-[28%] h-[44%] flex">
                <div className="w-[10%] bg-black/60" />
                <div className="flex-1 relative">
                  {/* Colțuri vizor */}
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-amber-400 rounded-tl-sm" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-amber-400 rounded-tr-sm" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-amber-400 rounded-bl-sm" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-amber-400 rounded-br-sm" />
                  {/* Linie de scanare animată */}
                  {isReady && (
                    <div
                      className="absolute inset-x-4 h-0.5 bg-amber-400/70 shadow-[0_0_8px_2px_rgba(251,191,36,0.4)] animate-scan-line"
                      style={{ top: '50%' }}
                    />
                  )}
                </div>
                <div className="w-[10%] bg-black/60" />
              </div>
              {/* Zona întunecată jos */}
              <div className="absolute inset-x-0 bottom-0 top-[72%] bg-black/60" />
            </div>

            {/* Text și stări */}
            <div className="absolute bottom-[20%] inset-x-0 text-center pointer-events-none z-10">
              {permissionDenied ? (
                <p className="text-red-400 text-sm px-8">
                  Accesul la cameră a fost refuzat.<br />
                  <span className="text-zinc-400 text-xs">Activează camera din setările browserului.</span>
                </p>
              ) : error ? (
                <p className="text-red-400 text-sm px-8">{error}</p>
              ) : !isReady ? (
                <p className="text-zinc-400 text-sm">Se inițializează camera...</p>
              ) : (
                <p className="text-zinc-400 text-sm">Îndreaptă camera spre codul de bare</p>
              )}
            </div>
          </>
        ) : (
          /* ── Mod input manual ── */
          <div className="w-full max-w-sm px-6 flex flex-col gap-4">
            <p className="text-center text-zinc-300 text-sm">Introdu codul de bare manual</p>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="ex: 1234567890123"
              autoFocus
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value.replace(/\D/g, ''))}
              onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
              className="w-full bg-zinc-800 rounded-xl px-4 h-12 text-center text-lg font-mono text-zinc-100 placeholder-zinc-600 outline-none focus:ring-2 focus:ring-amber-500 tracking-widest"
            />
            <button
              onClick={handleManualSubmit}
              disabled={!manualCode.trim()}
              className="w-full h-12 rounded-xl bg-amber-500 text-black font-semibold text-sm active:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Search size={18} />
              Caută
            </button>
          </div>
        )}
      </div>

      {/* Footer — Bară de control unificată jos */}
      <div className="flex-none flex items-center justify-between px-4 h-16 bg-black/80 backdrop-blur-sm border-t border-zinc-800/60 pb-safe">
        {/* Buton X (fără text) */}
        <button
          onClick={handleClose}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-zinc-800/80 text-zinc-300 active:text-white active:bg-zinc-700 transition-colors"
          aria-label="Închide"
        >
          <X size={20} />
        </button>

        {/* Toggle Manual / Cameră */}
        <button
          onClick={() => {
            setManualMode((v) => !v)
            setManualCode('')
          }}
          className="h-11 px-5 rounded-xl bg-zinc-800 text-zinc-200 active:bg-zinc-700 text-sm font-medium flex items-center gap-2 transition-colors shadow-sm"
        >
          {manualMode ? (
            <>
              <Camera size={18} />
              <span>Cameră</span>
            </>
          ) : (
            <>
              <Keyboard size={18} />
              <span>Manual</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
