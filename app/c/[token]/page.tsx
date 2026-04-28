'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import jsQR from 'jsqr'
import {
  CheckCircle, XCircle, AlertTriangle, Camera, CameraOff,
  RefreshCw, Lock, ScanLine, Eye, EyeOff,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type EventInfo = {
  linkId: string
  label: string
  expired: boolean
  event: { id: string; name: string; startDate: string; endDate: string | null; status: string }
}

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

// ─── Fase 1: gate de senha ────────────────────────────────────────────────────
function PasswordGate({
  eventInfo,
  onAuth,
}: {
  eventInfo: EventInfo
  onAuth: (password: string) => void
}) {
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    // Faz uma chamada de teste sem qrPayload para validar a senha antes de entrar
    try {
      const res = await fetch(`/api/c/${eventInfo.linkId}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, qrPayload: '__ping__' }),
      })
      const json = await res.json()
      // 401 = senha incorreta, qualquer outra coisa = senha OK (pode ser 422 etc)
      if (res.status === 401) {
        setError(json.error || 'Senha incorreta')
        return
      }
      onAuth(password)
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 text-white mb-2">
            <ScanLine className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">{eventInfo.event.name}</h1>
          <p className="text-sm text-slate-500">Área de check-in</p>
        </div>

        {eventInfo.expired ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center">
            <XCircle className="w-10 h-10 text-red-400 mx-auto mb-2" />
            <p className="font-semibold text-red-800">Evento encerrado</p>
            <p className="text-sm text-red-600 mt-1">Este link de check-in expirou.</p>
          </div>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5" /> Senha de acesso
                  </label>
                  <div className="relative">
                    <Input
                      type={showPw ? 'text' : 'password'}
                      placeholder="Digite a senha"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pr-10"
                      required
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}

                <Button type="submit" disabled={loading} className="w-full gap-2">
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ScanLine className="w-4 h-4" />}
                  {loading ? 'Verificando...' : 'Acessar check-in'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

// ─── Fase 2: scanner QR ───────────────────────────────────────────────────────
function CheckInScanner({
  eventInfo,
  password,
}: {
  eventInfo: EventInfo
  password: string
}) {
  const videoRef   = useRef<HTMLVideoElement>(null)
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const streamRef  = useRef<MediaStream | null>(null)
  const rafRef     = useRef<number | null>(null)
  const lastScanTs = useRef<number>(0)

  const [cameraOn, setCameraOn]     = useState(false)
  const [cameraErr, setCameraErr]   = useState<string | null>(null)
  const [scanning, setScanning]     = useState(false)
  const [result, setResult]         = useState<ScanResult | null>(null)
  const [totalToday, setTotalToday] = useState(0)

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

  useEffect(() => () => { stopCamera() }, [stopCamera])

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

  const handleQrDetected = async (qrPayload: string) => {
    if (scanning) return
    setScanning(true)
    setResult(null)
    try {
      const res = await fetch(`/api/c/${eventInfo.linkId}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, qrPayload }),
      })
      const data = await res.json()
      setResult(data as ScanResult)
      if (data.result === 'ok') setTotalToday((n) => n + 1)
    } catch {
      setResult({ result: 'error', message: 'Erro de conexão. Tente novamente.' })
    } finally {
      setScanning(false)
    }
  }

  const cfg = result ? RESULT_CONFIG[result.result] : null

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 truncate">{eventInfo.event.name}</h1>
          <p className="text-sm text-slate-500">Check-in · {eventInfo.label}</p>
        </div>
        <div className="text-center bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2 flex-shrink-0">
          <div className="text-2xl font-bold text-emerald-600">{totalToday}</div>
          <div className="text-xs text-emerald-500">hoje</div>
        </div>
      </div>

      {/* Visor */}
      <div className="relative bg-black rounded-2xl overflow-hidden aspect-[4/3]">
        <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
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
        {!cameraOn && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900">
            <CameraOff className="w-10 h-10 text-slate-500" />
            <p className="text-slate-400 text-sm">Câmera desativada</p>
          </div>
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {cameraErr && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {cameraErr}
        </p>
      )}

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

      {result && cfg && (
        <Card className={cn('border-2 transition-all', cfg.bg)}>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-start gap-4">
              <cfg.icon className={cn('w-8 h-8 flex-shrink-0 mt-0.5', cfg.iconClass)} />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-900 text-base">{cfg.title}</p>
                <p className="text-sm text-slate-600 mt-0.5">{result.message}</p>
                {'participant' in result && result.participant && (
                  <p className="text-sm font-medium text-slate-800 mt-2">👤 {result.participant}</p>
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
            <Button variant="ghost" size="sm" className="mt-4 w-full text-slate-500" onClick={() => setResult(null)}>
              Limpar e escanear novamente
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function PublicCheckInPage() {
  const { token } = useParams<{ token: string }>()

  const [phase, setPhase]       = useState<'loading' | 'gate' | 'scanner' | 'error'>('loading')
  const [eventInfo, setEventInfo] = useState<EventInfo | null>(null)
  const [authPassword, setAuthPassword] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    fetch(`/api/c/${token}/info`)
      .then((r) => r.json())
      .then((json) => {
        if (!json.success) {
          setErrorMsg(json.error || 'Link inválido')
          setPhase('error')
          return
        }
        setEventInfo(json.data)
        setPhase('gate')
      })
      .catch(() => {
        setErrorMsg('Erro de conexão. Verifique sua internet.')
        setPhase('error')
      })
  }, [token])

  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    )
  }

  if (phase === 'error' || !eventInfo) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center space-y-3 max-w-sm">
          <XCircle className="w-14 h-14 text-red-400 mx-auto" />
          <h1 className="text-lg font-bold text-slate-900">Link inválido</h1>
          <p className="text-sm text-slate-500">{errorMsg}</p>
        </div>
      </div>
    )
  }

  if (phase === 'gate') {
    return (
      <PasswordGate
        eventInfo={eventInfo}
        onAuth={(pw) => {
          setAuthPassword(pw)
          setPhase('scanner')
        }}
      />
    )
  }

  return <CheckInScanner eventInfo={eventInfo} password={authPassword} />
}
