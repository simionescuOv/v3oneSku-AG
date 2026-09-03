import { useEffect, useRef, useState, useCallback } from 'react'

/**
 * useBarcodeScanner — abstractizare cameră + detecție barcode.
 * 
 * Strategie hibridă:
 *   1. BarcodeDetector API nativ (Chrome/Android) — performanță maximă, 0 dependențe extra
 *   2. Fallback @zxing/browser (Safari/Firefox) — lazy import, 0 impact la bundle inițial
 * 
 * @param {function} onDetected - callback(code: string) apelat la prima detecție
 * @param {boolean} active - activează/dezactivează scannerul
 */
export function useBarcodeScanner({ onDetected, active }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const readerRef = useRef(null)
  const controlsRef = useRef(null)
  const animFrameRef = useRef(null)
  const detectorRef = useRef(null)
  const detectedRef = useRef(false)
  const onDetectedRef = useRef(onDetected)

  useEffect(() => {
    onDetectedRef.current = onDetected
  })

  // Suprimare avertisment fals intern @zxing cauzat de verificarea instanceof defectuoasă
  useEffect(() => {
    const origWarn = console.warn
    console.warn = (...args) => {
      if (typeof args[0] === 'string' && args[0].includes('MultiFormatReader: non-ReaderException')) {
        return
      }
      origWarn.apply(console, args)
    }
    return () => {
      console.warn = origWarn
    }
  }, [])

  const [isReady, setIsReady] = useState(false)
  const [permissionDenied, setPermissionDenied] = useState(false)
  const [error, setError] = useState(null)

  const stopScanner = useCallback(() => {
    // Oprire rAF loop (native path)
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }
    // Oprire buclă asincronă ZXing (fallback path)
    if (controlsRef.current) {
      try { controlsRef.current.stop() } catch (_) {}
      controlsRef.current = null
    }
    // Resetare ZXing reader
    if (readerRef.current) {
      try { readerRef.current.reset() } catch (_) {}
      readerRef.current = null
    }
    // Oprire stream cameră
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    detectedRef.current = false
    setIsReady(false)
  }, [])

  useEffect(() => {
    if (!active) {
      stopScanner()
      return
    }

    let cancelled = false

    async function startCamera() {
      try {
        const constraints = {
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        }
        const stream = await navigator.mediaDevices.getUserMedia(constraints)
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
          setIsReady(true)
          startDetection()
        }
      } catch (err) {
        if (cancelled) return
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setPermissionDenied(true)
        } else {
          setError(err.message || 'Eroare cameră')
        }
      }
    }

    function handleDetected(code) {
      if (detectedRef.current) return
      detectedRef.current = true
      // Haptic feedback
      if (navigator.vibrate) navigator.vibrate(200)
      onDetectedRef.current?.(code)
    }

    async function startDetection() {
      const FORMATS = ['ean_13', 'ean_8', 'code_128', 'qr_code', 'upc_a', 'upc_e']

      // ── Native BarcodeDetector (Chromium/Android) ──
      if ('BarcodeDetector' in window) {
        try {
          const detector = new window.BarcodeDetector({ formats: FORMATS })
          detectorRef.current = detector

          const detect = async () => {
            if (!videoRef.current || detectedRef.current || !streamRef.current) return
            if (videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
              try {
                const barcodes = await detector.detect(videoRef.current)
                if (barcodes.length > 0) {
                  handleDetected(barcodes[0].rawValue)
                  return
                }
              } catch (_) {}
            }
            animFrameRef.current = requestAnimationFrame(detect)
          }
          animFrameRef.current = requestAnimationFrame(detect)
          return
        } catch (_) {
          // BarcodeDetector existent dar eșuează → fallback ZXing
        }
      }

      // ── Fallback ZXing (Safari, Firefox, Windows Desktop) ──
      try {
        const [{ BrowserMultiFormatReader }, { DecodeHintType, BarcodeFormat }] = await Promise.all([
          import('@zxing/browser'),
          import('@zxing/library'),
        ])
        if (cancelled || !videoRef.current) return

        const hints = new Map()
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.CODE_128,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.QR_CODE,
        ])

        const reader = new BrowserMultiFormatReader(hints)
        readerRef.current = reader

        const controls = await reader.decodeFromVideoElement(videoRef.current, (result, err) => {
          if (result && !detectedRef.current) {
            handleDetected(result.getText())
          }
        })

        if (cancelled) {
          try { controls?.stop() } catch (_) {}
        } else {
          controlsRef.current = controls
        }
      } catch (importErr) {
        if (!cancelled) {
          setError('Scanarea nu este suportată pe acest dispozitiv')
        }
      }
    }

    startCamera()

    return () => {
      cancelled = true
      stopScanner()
    }
  }, [active, stopScanner])

  return { videoRef, isReady, permissionDenied, error, stopScanner }
}
