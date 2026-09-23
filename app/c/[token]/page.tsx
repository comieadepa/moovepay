'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import jsQR from 'jsqr'
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Camera,
  CameraOff,
  RefreshCw,
  Lock,
  ScanLine,
  Eye,
  EyeOff,
  Search,
  Clock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type EventInfo = {
  linkId: string
  label: string
  requiresPassword?: boolean
  expired: boolean
  expiresAt: string
  event: { id: string; name: string; startDate: string; endDate: string | null; status: string }
}

type ScanResult =
  | { result: 'ok';           message: string; participant: string; inscriptionType?: string; event: string; checkedInAt: string }
  | { result: 'already_used'; message: string; participant: string; inscriptionType?: string; usedAt: string }
  | { result: 'not_paid';     message: string; participant: string; inscriptionType?: string }
  | { result: 'not_found';    message: string }
  | { result: 'error';        message: string }

type SearchParticipant = {
  id: string
  fullName: string
  maskedCpf: string
  inscriptionTypeName: string
  status: string
  isValid: boolean
  isCheckedIn: boolean
  usedAt: string | null
}

const RESULT_CONFIG = {
  ok:           { bg: 'bg-emerald-50 border-emerald-400 text-emerald-950', icon: CheckCircle,    iconClass: 'text-emerald-600', title: 'Check-in Confirmado!' },
  already_used: { bg: 'bg-amber-50 border-amber-400 text-amber-950',       icon: AlertTriangle,  iconClass: 'text-amber-600',   title: 'Voucher Já Utilizado' },
  not_paid:     { bg: 'bg-red-50 border-red-400 text-red-950',             icon: XCircle,        iconClass: 'text-red-600',     title: 'Pagamento Pendente' },
  not_found:    { bg: 'bg-rose-50 border-rose-300 text-rose-950',          icon: XCircle,        iconClass: 'text-rose-500',    title: 'Voucher Não Encontrado' },
  error:        { bg: 'bg-slate-50 border-slate-300 text-slate-900',       icon: XCircle,        iconClass: 'text-slate-500',   title: 'Aviso' },
}

const SCAN_COOLDOWN_MS = 2500

// Helper para tocar feedback tátil/vibração no mobile
function triggerFeedback(type: 'success' | 'warning' | 'error') {
  if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
    if (type === 'success') navigator.vibrate([60, 40, 60])
    else if (type === 'warning') navigator.vibrate([100, 50, 100])
    else navigator.vibrate(200)
  }
}

// ─── Fase 1: Gate de Senha (Condicional) ───────────────────────────────────────
function PasswordGate({
  token,
  eventInfo,
  onAuth,
}: {
  token: string
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
    try {
      const res = await fetch(`/api/c/${token}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, qrPayload: '__ping__' }),
      })
      const json = await res.json()
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
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-900/40 mb-2">
            <ScanLine className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">{eventInfo.event.name}</h1>
          <p className="text-xs text-slate-400">Credenciamento & Portaria Móvel</p>
        </div>

        {eventInfo.expired ? (
          <div className="bg-red-950/60 border border-red-800 rounded-2xl p-6 text-center text-red-200">
            <XCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
            <p className="font-bold text-base text-white">Evento Encerrado</p>
            <p className="text-xs text-red-300 mt-1">Este link de check-in expirou após o término da programação.</p>
          </div>
        ) : (
          <Card className="bg-slate-800/90 border-slate-700 shadow-2xl text-slate-100">
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
                    <Lock className="w-3.5 h-3.5 text-emerald-400" /> Senha de Acesso
                  </label>
                  <div className="relative">
                    <Input
                      type={showPw ? 'text' : 'password'}
                      placeholder="Digite a senha da portaria"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pr-10 bg-slate-900/90 border-slate-600 text-white placeholder:text-slate-500 rounded-xl h-11"
                      required
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    >
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <p className="text-xs text-red-300 bg-red-950/80 border border-red-800 rounded-xl px-3.5 py-2.5">
                    {error}
                  </p>
                )}

                <Button type="submit" disabled={loading} className="w-full h-11 font-semibold gap-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-md">
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ScanLine className="w-4 h-4" />}
                  {loading ? 'Verificando...' : 'Acessar Portaria'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

// ─── Fase 2: Interface de Check-in Móvel ────────────────────────────────────────
function MobileCheckInDashboard({
  token,
  eventInfo,
  password,
}: {
  token: string
  eventInfo: EventInfo
  password?: string
}) {
  const videoRef   = useRef<HTMLVideoElement>(null)
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const streamRef  = useRef<MediaStream | null>(null)
  const rafRef     = useRef<number | null>(null)
  const lastScanTs = useRef<number>(0)

  const [activeTab, setActiveTab]   = useState<'camera' | 'search'>('camera')
  const [cameraOn, setCameraOn]     = useState(false)
  const [cameraErr, setCameraErr]   = useState<string | null>(null)
  const [scanning, setScanning]     = useState(false)
  const [result, setResult]         = useState<ScanResult | null>(null)
  const [totalSession, setTotalSession] = useState(0)

  // Busca manual
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching]     = useState(false)
  const [searchResults, setSearchResults] = useState<SearchParticipant[]>([])
  const [submittingManualId, setSubmittingManualId] = useState<string | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)

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
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setCameraOn(true)
    } catch (err: any) {
      setCameraErr('Não foi possível acessar a câmera. Conceda permissão nas configurações do navegador.')
    }
  }, [])

  useEffect(() => () => { stopCamera() }, [stopCamera])

  // Processamento contínuo de quadros da câmera
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
        handleProcessScan({ qrPayload: decoded.data })
      }
    }

    rafRef.current = requestAnimationFrame(processFrame)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (cameraOn && activeTab === 'camera') {
      rafRef.current = requestAnimationFrame(processFrame)
    } else {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [cameraOn, activeTab, processFrame])

  // Submissão unificada de Check-in (Câmera ou Manual)
  const handleProcessScan = async (payload: { qrPayload?: string; registrationId?: string }) => {
    if (scanning) return
    setScanning(true)
    setResult(null)

    try {
      const res = await fetch(`/api/c/${token}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: password || undefined,
          ...payload,
        }),
      })

      const data = await res.json()
      setResult(data as ScanResult)

      if (data.result === 'ok') {
        triggerFeedback('success')
        setTotalSession((n) => n + 1)
        // Atualiza estado na lista de busca se estiver na aba de busca
        if (payload.registrationId) {
          setSearchResults((prev) =>
            prev.map((item) =>
              item.id === payload.registrationId
                ? { ...item, isCheckedIn: true, usedAt: data.checkedInAt || new Date().toISOString() }
                : item
            )
          )
        }
      } else if (data.result === 'already_used') {
        triggerFeedback('warning')
      } else {
        triggerFeedback('error')
      }
    } catch {
      setResult({ result: 'error', message: 'Erro de conexão com o servidor. Tente novamente.' })
      triggerFeedback('error')
    } finally {
      setScanning(false)
    }
  }

  // Busca manual com proteção contra enumeração (mín. 3 chars)
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const q = searchQuery.trim()
    if (q.length < 3) {
      setSearchError('Digite ao menos 3 caracteres para pesquisar.')
      return
    }

    setSearchError(null)
    setSearching(true)
    try {
      const qs = new URLSearchParams({ q })
      const res = await fetch(`/api/c/${token}/search?${qs.toString()}`)
      const json = await res.json()
      if (res.ok && json.data) {
        setSearchResults(json.data)
      } else {
        setSearchError(json.error || 'Nenhum resultado encontrado.')
        setSearchResults([])
      }
    } catch {
      setSearchError('Erro ao buscar participantes. Verifique sua conexão.')
    } finally {
      setSearching(false)
    }
  }

  const handleManualCheckInClick = async (p: SearchParticipant) => {
    setSubmittingManualId(p.id)
    await handleProcessScan({ registrationId: p.id })
    setSubmittingManualId(null)
  }

  const cfg = result ? RESULT_CONFIG[result.result] : null

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
      {/* ── Top Bar ── */}
      <header className="px-4 py-3 bg-slate-900/90 border-b border-slate-800 sticky top-0 z-30 backdrop-blur-md">
        <div className="max-w-md mx-auto flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-white truncate">{eventInfo.event.name}</h1>
            <p className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Portaria Ativa · {eventInfo.label}
            </p>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-center shrink-0">
            <div className="text-lg font-black text-emerald-400 leading-none">{totalSession}</div>
            <div className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold mt-0.5">Entradas</div>
          </div>
        </div>
      </header>

      {/* ── Conteúdo Principal ── */}
      <main className="flex-1 max-w-md w-full mx-auto p-4 space-y-4">
        {/* Alternância de Abas */}
        <div className="grid grid-cols-2 p-1 bg-slate-900 rounded-2xl border border-slate-800">
          <button
            onClick={() => {
              setActiveTab('camera')
              setResult(null)
            }}
            className={cn(
              'py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2',
              activeTab === 'camera'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            )}
          >
            <Camera className="w-4 h-4" />
            Leitor de Câmera
          </button>
          <button
            onClick={() => {
              stopCamera()
              setActiveTab('search')
              setResult(null)
            }}
            className={cn(
              'py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2',
              activeTab === 'search'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            )}
          >
            <Search className="w-4 h-4" />
            Busca por Nome/CPF
          </button>
        </div>

        {/* ── FEEDBACK DO RESULTADO ── */}
        {result && cfg && (
          <div className={cn('p-4 rounded-2xl border-2 shadow-lg transition-all animate-in fade-in zoom-in-95', cfg.bg)}>
            <div className="flex items-start gap-3.5">
              <cfg.icon className={cn('w-7 h-7 shrink-0 mt-0.5', cfg.iconClass)} />
              <div className="flex-1 min-w-0">
                <p className="font-black text-sm tracking-tight">{cfg.title}</p>
                <p className="text-xs opacity-90 mt-0.5 leading-relaxed">{result.message}</p>

                {'participant' in result && result.participant && (
                  <div className="mt-2.5 pt-2 border-t border-black/10">
                    <p className="font-bold text-sm truncate">{result.participant}</p>
                    {'inscriptionType' in result && result.inscriptionType && (
                      <span className="inline-block text-[10px] uppercase tracking-wider font-bold bg-black/10 px-2 py-0.5 rounded mt-1">
                        {result.inscriptionType}
                      </span>
                    )}
                  </div>
                )}

                {'usedAt' in result && result.usedAt && (
                  <p className="text-[11px] opacity-75 mt-1.5 flex items-center gap-1 font-mono">
                    <Clock className="w-3 h-3" />
                    Entrada anterior: {new Date(result.usedAt).toLocaleTimeString('pt-BR')}
                  </p>
                )}
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setResult(null)}
              className="w-full mt-3 text-xs font-semibold bg-black/5 hover:bg-black/10 h-8 rounded-lg"
            >
              Continuar Lendo
            </Button>
          </div>
        )}

        {/* ── ABA 1: CÂMERA ── */}
        {activeTab === 'camera' && (
          <div className="space-y-3">
            <div className="relative bg-black rounded-3xl overflow-hidden aspect-[3/4] sm:aspect-[4/3] border border-slate-800 shadow-2xl flex items-center justify-center">
              <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
              
              {cameraOn && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-56 h-56 relative">
                    <span className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-emerald-400 rounded-tl-xl" />
                    <span className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-emerald-400 rounded-tr-xl" />
                    <span className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-emerald-400 rounded-bl-xl" />
                    <span className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-emerald-400 rounded-br-xl" />
                    {scanning && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl">
                        <RefreshCw className="w-8 h-8 text-white animate-spin" />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {!cameraOn && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900/90 text-center p-6">
                  <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center text-slate-500 mb-1">
                    <CameraOff className="w-8 h-8" />
                  </div>
                  <p className="text-sm font-semibold text-slate-300">Câmera em Pausa</p>
                  <p className="text-xs text-slate-500 max-w-xs">
                    Toque no botão abaixo para ligar o scanner e apontar para os QR Codes dos vouchers.
                  </p>
                </div>
              )}
              <canvas ref={canvasRef} className="hidden" />
            </div>

            {cameraErr && (
              <p className="text-xs text-red-300 bg-red-950/80 border border-red-800 rounded-xl p-3 text-center">
                {cameraErr}
              </p>
            )}

            <div>
              {!cameraOn ? (
                <Button
                  onClick={startCamera}
                  className="w-full h-13 font-bold text-base gap-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl shadow-lg shadow-emerald-950/50"
                >
                  <Camera className="w-5 h-5" /> Ativar Câmera Traseira
                </Button>
              ) : (
                <Button
                  onClick={stopCamera}
                  variant="outline"
                  className="w-full h-11 text-xs font-semibold gap-2 border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 rounded-xl"
                >
                  <CameraOff className="w-4 h-4" /> Pausar Câmera
                </Button>
              )}
            </div>
          </div>
        )}

        {/* ── ABA 2: BUSCA MANUAL ── */}
        {activeTab === 'search' && (
          <div className="space-y-3">
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                <Input
                  type="text"
                  placeholder="Nome ou CPF (mín. 3 letras)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-11 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 rounded-xl text-sm"
                  autoFocus
                />
              </div>
              <Button type="submit" disabled={searching} className="h-11 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shrink-0">
                {searching ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Buscar'}
              </Button>
            </form>

            {searchError && (
              <p className="text-xs text-amber-300 bg-amber-950/60 border border-amber-800 rounded-xl p-3 text-center">
                {searchError}
              </p>
            )}

            <div className="space-y-2 pt-1">
              {searchResults.length > 0 && (
                <p className="text-[11px] text-slate-400 font-semibold px-1 uppercase tracking-wider">
                  Resultados Encontrados ({searchResults.length})
                </p>
              )}

              {searchResults.map((p) => {
                const isSubmitting = submittingManualId === p.id

                return (
                  <div
                    key={p.id}
                    className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between gap-3 shadow-md hover:border-slate-700 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-sm text-white truncate">{p.fullName}</p>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                        <span className="font-mono">{p.maskedCpf}</span>
                        <span>•</span>
                        <span className="text-emerald-400 font-medium truncate">{p.inscriptionTypeName}</span>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {p.isCheckedIn ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                          ✓ Já Entrou
                        </span>
                      ) : !p.isValid ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-950 text-red-400 border border-red-800">
                          Pendente
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handleManualCheckInClick(p)}
                          disabled={isSubmitting || scanning}
                          className="h-8 px-3 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg gap-1 shadow-sm"
                        >
                          {isSubmitting ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <CheckCircle className="w-3.5 h-3.5" />
                          )}
                          Validar
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="py-3 text-center text-[10px] text-slate-500 border-t border-slate-900">
        CongregaPay · Credenciamento Oficial de Portaria
      </footer>
    </div>
  )
}

// ─── Componente de Roteamento Principal ────────────────────────────────────────
export default function PublicCheckInPage() {
  const { token } = useParams<{ token: string }>()

  const [phase, setPhase]         = useState<'loading' | 'gate' | 'dashboard' | 'error'>('loading')
  const [eventInfo, setEventInfo] = useState<EventInfo | null>(null)
  const [authPassword, setAuthPassword] = useState<string>('')
  const [errorMsg, setErrorMsg]   = useState('')

  useEffect(() => {
    if (!token) return

    fetch(`/api/c/${token}/info`)
      .then((r) => r.json())
      .then((json) => {
        if (!json.success || !json.data) {
          setErrorMsg(json.error || 'Link de check-in inválido ou revogado.')
          setPhase('error')
          return
        }

        setEventInfo(json.data)

        if (json.data.requiresPassword) {
          setPhase('gate')
        } else {
          setPhase('dashboard')
        }
      })
      .catch(() => {
        setErrorMsg('Erro de conexão. Verifique sua internet.')
        setPhase('error')
      })
  }, [token])

  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-3 text-slate-400">
        <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
        <p className="text-xs">Carregando portaria do evento...</p>
      </div>
    )
  }

  if (phase === 'error' || !eventInfo) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center space-y-3 max-w-sm">
          <div className="w-14 h-14 rounded-2xl bg-red-950/80 border border-red-800 text-red-400 flex items-center justify-center mx-auto">
            <XCircle className="w-7 h-7" />
          </div>
          <h1 className="text-lg font-bold text-white">Acesso Indisponível</h1>
          <p className="text-xs text-slate-400 leading-relaxed">{errorMsg}</p>
        </div>
      </div>
    )
  }

  if (phase === 'gate') {
    return (
      <PasswordGate
        token={token}
        eventInfo={eventInfo}
        onAuth={(pw) => {
          setAuthPassword(pw)
          setPhase('dashboard')
        }}
      />
    )
  }

  return (
    <MobileCheckInDashboard
      token={token}
      eventInfo={eventInfo}
      password={authPassword}
    />
  )
}
