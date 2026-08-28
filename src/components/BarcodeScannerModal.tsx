import React, { useEffect, useRef, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Camera,
  CameraOff,
  Barcode,
  Search,
  Loader2,
  RefreshCw,
  AlertCircle,
  Keyboard,
  Sparkles,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { fetchBookByIsbn, BookMetadata, sanitizeIsbn } from '@/services/isbn'

interface BarcodeScannerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onBookFound: (book: BookMetadata) => void
}

export function BarcodeScannerModal({ open, onOpenChange, onBookFound }: BarcodeScannerModalProps) {
  const { toast } = useToast()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationFrameId = useRef<number | null>(null)

  const [mode, setMode] = useState<'camera' | 'manual'>('camera')
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null)
  const [manualIsbn, setManualIsbn] = useState('')
  const [searching, setSearching] = useState(false)
  const [scanningActive, setScanningActive] = useState(false)
  const [detectedCode, setDetectedCode] = useState<string | null>(null)
  const [hasNativeBarcode, setHasNativeBarcode] = useState(false)

  // Stop camera stream safely
  const stopCamera = () => {
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current)
      animationFrameId.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop()
      })
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setScanningActive(false)
  }

  // Lookup ISBN book data
  const handleLookup = async (code: string) => {
    const clean = sanitizeIsbn(code)
    if (!clean) {
      toast({
        title: 'Código inválido',
        description: 'Digite ou escaneie um código de barras / ISBN numérico.',
        variant: 'destructive',
      })
      return
    }

    setSearching(true)
    try {
      const bookData = await fetchBookByIsbn(clean)
      toast({
        title: 'Livro encontrado!',
        description: `"${bookData.titulo_de_livro}" preenchido automaticamente.`,
      })
      stopCamera()
      onBookFound(bookData)
      onOpenChange(false)
    } catch (err: any) {
      toast({
        title: 'Não foi possível obter dados',
        description: err.message || 'Livro não localizado pelo ISBN.',
        variant: 'destructive',
      })
    } finally {
      setSearching(false)
    }
  }

  // Start Camera
  const startCamera = async () => {
    stopCamera()
    setCameraError(null)
    setDetectedCode(null)

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Seu navegador não possui suporte para acesso à câmera.')
      setHasCameraPermission(false)
      setMode('manual')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      })

      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => {})
      }
      setHasCameraPermission(true)
      setScanningActive(true)

      // Start BarcodeDetector loop if supported
      initBarcodeDetector()
    } catch (err: any) {
      console.warn('Erro ao acessar a câmera:', err)
      let message = 'Não foi possível acessar a câmera do dispositivo.'
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        message = 'Acesso à câmera foi recusado pelo usuário ou bloqueado no navegador.'
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        message = 'Nenhuma câmera encontrada neste dispositivo.'
      }
      setCameraError(message)
      setHasCameraPermission(false)
      setMode('manual')
    }
  }

  // Barcode detection using standard Web API BarcodeDetector (Chrome/Android/Safari iOS 17+)
  const initBarcodeDetector = () => {
    const BarcodeDetectorClass = (window as any).BarcodeDetector

    if (BarcodeDetectorClass) {
      setHasNativeBarcode(true)
      try {
        const barcodeDetector = new BarcodeDetectorClass({
          formats: ['ean_13', 'ean_8', 'isbn', 'code_128', 'qr_code', 'upc_a', 'upc_e'],
        })

        const detectFrame = async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) {
            animationFrameId.current = requestAnimationFrame(detectFrame)
            return
          }

          try {
            const barcodes = await barcodeDetector.detect(videoRef.current)
            if (barcodes && barcodes.length > 0) {
              const rawValue = barcodes[0].rawValue || ''
              const clean = sanitizeIsbn(rawValue)
              if (clean && (clean.length === 10 || clean.length === 13)) {
                setDetectedCode(clean)
                stopCamera()
                handleLookup(clean)
                return
              }
            }
          } catch {
            // Frame detection error, continue next frame
          }

          animationFrameId.current = requestAnimationFrame(detectFrame)
        }

        animationFrameId.current = requestAnimationFrame(detectFrame)
      } catch (err) {
        console.warn('BarcodeDetector initialization error:', err)
      }
    } else {
      setHasNativeBarcode(false)
    }
  }

  useEffect(() => {
    if (open) {
      setMode('camera')
      setDetectedCode(null)
      startCamera()
    } else {
      stopCamera()
    }

    return () => {
      stopCamera()
    }
  }, [open])

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleLookup(manualIsbn)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900">
            <Barcode className="w-5 h-5 text-emerald-600" />
            Leitor de Código de Barras / ISBN
          </DialogTitle>
          <DialogDescription>
            Aponte a câmera para o código de barras (EAN/ISBN) no verso do livro para preencher os
            dados automaticamente.
          </DialogDescription>
        </DialogHeader>

        {/* Tab switcher: Camera or Manual */}
        <div className="flex border-b border-slate-200">
          <button
            type="button"
            onClick={() => {
              setMode('camera')
              startCamera()
            }}
            className={`flex-1 py-2 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
              mode === 'camera'
                ? 'border-emerald-600 text-emerald-700 bg-emerald-50/40'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Camera className="w-4 h-4" />
            Câmera do Dispositivo
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('manual')
              stopCamera()
            }}
            className={`flex-1 py-2 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
              mode === 'manual'
                ? 'border-emerald-600 text-emerald-700 bg-emerald-50/40'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Keyboard className="w-4 h-4" />
            Digitar ISBN Manualmente
          </button>
        </div>

        {mode === 'camera' ? (
          <div className="space-y-4 py-2">
            <div className="relative aspect-4/3 w-full bg-slate-950 rounded-lg overflow-hidden border border-slate-300 flex items-center justify-center">
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className="w-full h-full object-cover"
              />

              {/* Scanning visual guide frame */}
              {scanningActive && (
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6">
                  <div className="w-64 h-32 border-2 border-emerald-400 rounded-lg shadow-lg relative bg-emerald-500/10 flex items-center justify-center">
                    <div className="w-full h-0.5 bg-rose-500/80 animate-pulse shadow-sm" />
                    <span className="absolute -bottom-6 text-[11px] text-white font-medium bg-slate-900/80 px-2 py-0.5 rounded backdrop-blur-xs">
                      Enquadre o código de barras aqui
                    </span>
                  </div>
                </div>
              )}

              {/* Camera Error / Fallback State */}
              {cameraError && (
                <div className="absolute inset-0 bg-slate-900/90 text-white p-6 flex flex-col items-center justify-center text-center space-y-3">
                  <CameraOff className="w-10 h-10 text-rose-400" />
                  <p className="text-xs font-medium text-slate-200">{cameraError}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setMode('manual')}
                    className="text-xs bg-white text-slate-900 border-none hover:bg-slate-100"
                  >
                    <Keyboard className="w-3.5 h-3.5 mr-1.5" />
                    Digitar ISBN no teclado
                  </Button>
                </div>
              )}

              {searching && (
                <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-xs text-white flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
                  <p className="text-xs font-semibold">Consultando informações do livro...</p>
                  {detectedCode && (
                    <span className="text-[11px] font-mono text-emerald-300">
                      ISBN: {detectedCode}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Hint or fallback button if native barcode isn't auto-firing */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-600 bg-slate-50 p-2.5 rounded border border-slate-200">
              <div className="flex items-center gap-1.5 text-[11px]">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>
                  {hasNativeBarcode
                    ? 'Leitor automático ativo. Aproxime o livro da câmera.'
                    : 'Dica: Se a câmera não detectar, digite o ISBN abaixo.'}
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={startCamera}
                className="h-7 text-xs text-slate-700 hover:text-emerald-700"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Reiniciar Câmera
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleManualSubmit} className="space-y-4 py-3">
            <div className="space-y-2">
              <Label htmlFor="manualIsbnInput" className="text-xs font-semibold text-slate-700">
                Código ISBN ou Código de Barras (EAN-13)
              </Label>
              <div className="flex gap-2">
                <Input
                  id="manualIsbnInput"
                  autoFocus
                  placeholder="Ex: 9788535902778 ou 8535902775"
                  value={manualIsbn}
                  onChange={(e) => setManualIsbn(e.target.value)}
                  className="font-mono text-sm"
                />
                <Button
                  type="submit"
                  disabled={searching || !manualIsbn.trim()}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shrink-0"
                >
                  {searching ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  Buscar Livro
                </Button>
              </div>
              <p className="text-[11px] text-slate-500">
                O ISBN possui 10 ou 13 dígitos numéricos e pode ser encontrado no verso ou na ficha
                catalográfica do livro.
              </p>
            </div>

            <div className="bg-amber-50/70 border border-amber-200 rounded p-3 text-xs text-amber-900 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Serviço de busca bibliográfica</p>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  Os dados são buscados automaticamente na base pública do Google Books e Open
                  Library.
                </p>
              </div>
            </div>
          </form>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              stopCamera()
              onOpenChange(false)
            }}
          >
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
