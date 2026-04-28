'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import jsQR from 'jsqr'
import { CheckCircle, XCircle, AlertTriangle, Camera, CameraOff, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type ScanResult =
  | { result: 'ok';           message: string; participant: string; event: string; checkedInAt: string }
  | { result: 'already_used'; message: string; participant: string; usedAt: string }
  | { result: 'not_paid';     message: string; participant: string }
  | { result: 'not_found';    message: string }
  | { result: 'error';        message: string }

const RESULT_CONFIG = {
  ok:           { bg: 'bg-emerald-50 border-emerald-300', icon: CheckCircle,    iconClass: 'text-emerald-500', title: 'Check-in OK!' },
  already_used: { bg: 'bg-amber-50 border-amber-300',    icon: AlertTriangle,  iconClass: 'text-amber-500',   title: 'Já utilizado' },
  not_paid:     { bg: 'bg-red-50 border-red-300',        icon: XCircle,        iconClass: 'text-red-500',     title: 'Não pago' },
  not_found:    { bg: 'bg-red-50 border-red-300',        icon: XCircle,        iconClass: 'text-red-500',     title: 'Não encontrado' },
  error:        { bg: 'bg-red-50 border-red-300',        icon: XCircle,        iconClass: 'text-red-500',     title: 'Erro' },
}

const SCAN_COOLDOWN_MS = 3000

export default function CheckinPage() {
  const { id: eventId } = useParams<{ id: string }>()

  const videoRef   = useRef<HTMLVideoElement>(null)
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const streamRef  = useRef<MediaStream | null>(null)
  const rafRef     = useRef<number | null>(null)
  const lastScanTs = useRef<number>(0)

  const [cameraOn, setCameraOn]   = useState(false)
  const [cameraErr, setCameraErr] = useState<string | null>(null)
  const [scanning, setScanning]   = useState(false)
  const [result, setResult]       = useState<ScanResult | null>(null)
  const [totalToday, setTotalToday] = useState<number | null>(null)

  // ─── câmera ────────────────────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setCameraOn(false)
  }, [])

  const startCamera = useCallback(async () => {
    setCameraErr(null)
    setResult(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setCameraOn(true)
    } catch (err: any) {
      setCameraErr('Câmera não disponível: ' + (err?.message ?? 'permissão negada'))
    }
  }, [])

  // Cleanup ao desmontar
  useEffect(() => () => { stopCamera() }, [stopCamera])

  // ─── loop de decodificação ─────────────────────────────────────────────────
  const processFrame = useCallback(() => {
    const video  = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(processFrame)
      return
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return

    canvas.width  = video.videoWidth
    canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const decoded = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert',
    })

    if (decoded?.data) {
      const now = Date.now()
      if (now - lastScanTs.current > SCAN_COOLDOWN_MS) {
        lastScanTs.current = now
        handleQrDetected(decoded.data)
      }
    }

    rafRef.current = requestAnimationFrame(processFrame)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (cameraOn) {
      rafRef.current = requestAnimationFrame(processFrame)
    } else {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [cameraOn, processFrame])

  // ─── envio para API ────────────────────────────────────────────────────────
  const handleQrDetected = async (qrPayload: string) => {
    if (scanning) return
    setScanning(true)
    setResult(null)
    try {
      const res = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ qrPayload }),
      })
      const data = await res.json()
      setResult(data as ScanResult)
      if (data.result === 'ok') {
        setTotalToday((n) => (n ?? 0) + 1)
      }
    } catch {
      setResult({ result: 'error', message: 'Erro de conexão. Tente novamente.' })
    } finally {
      setScanning(false)
    }
  }

  // ─── render ────────────────────────────────────────────────────────────────
  const cfg = result ? RESULT_CONFIG[result.result] : null

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Check-in</h1>
          <p className="text-sm text-slate-500">Aponte a câmera para o QR Code do voucher</p>
        </div>
        {totalToday !== null && (
          <div className="text-center bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2">
            <div className="text-2xl font-bold text-emerald-600">{totalToday}</div>
            <div className="text-xs text-emerald-500">hoje</div>
          </div>
        )}
      </div>

      {/* Visor da câmera */}
      <div className="relative bg-black rounded-2xl overflow-hidden aspect-[4/3]">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          muted
        />
        {/* Mira */}
        {cameraOn && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-52 h-52 relative">
              <span className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-lg" />
              <span className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-lg" />
              <span className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-lg" />
              <span className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-lg" />
              {scanning && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <RefreshCw className="w-8 h-8 text-white animate-spin opacity-80" />
                </div>
              )}
            </div>
          </div>
        )}
        {/* Estado sem câmera */}
        {!cameraOn && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900">
            <CameraOff className="w-10 h-10 text-slate-500" />
            <p className="text-slate-400 text-sm">Câmera desativada</p>
          </div>
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Erro de câmera */}
      {cameraErr && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {cameraErr}
        </p>
      )}

      {/* Controles */}
      <div className="flex gap-3">
        {!cameraOn ? (
          <Button onClick={startCamera} className="flex-1 gap-2 bg-blue-600 hover:bg-blue-700">
            <Camera className="w-4 h-4" /> Ativar câmera
          </Button>
        ) : (
          <Button onClick={stopCamera} variant="outline" className="flex-1 gap-2">
            <CameraOff className="w-4 h-4" /> Parar câmera
          </Button>
        )}
      </div>

      {/* Resultado do scan */}
      {result && cfg && (
        <Card className={cn('border-2 transition-all', cfg.bg)}>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-start gap-4">
              <cfg.icon className={cn('w-8 h-8 flex-shrink-0 mt-0.5', cfg.iconClass)} />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-900 text-base">{cfg.title}</p>
                <p className="text-sm text-slate-600 mt-0.5">{result.message}</p>

                {'participant' in result && result.participant && (
                  <p className="text-sm font-medium text-slate-800 mt-2">
                    👤 {result.participant}
                  </p>
                )}
                {'event' in result && result.event && (
                  <p className="text-xs text-slate-500 mt-0.5">🎟 {result.event}</p>
                )}
                {'usedAt' in result && result.usedAt && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    Usado em: {new Date(result.usedAt).toLocaleString('pt-BR')}
                  </p>
                )}
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="mt-4 w-full text-slate-500"
              onClick={() => setResult(null)}
            >
              Limpar e escanear novamente
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Link para inscritos */}
      <p className="text-center text-xs text-slate-400">
        <a href={`/eventos/${eventId}/inscritos`} className="hover:underline">
          ← Ver lista de inscritos
        </a>
      </p>
    </div>
  )
}
