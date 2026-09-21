'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import jsQR from 'jsqr'
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Camera,
  CameraOff,
  RefreshCw,
  Search,
  Users,
  UserCheck,
  Percent,
  ArrowLeft,
  ScanLine,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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

type ParticipantItem = {
  id: string
  fullName: string
  cpf: string
  email: string
  status: string
  voucher?: { id: string; used: boolean; usedAt: string | null } | null
  inscriptionType?: { name: string } | null
}

export default function CheckinPage() {
  const { id: eventId } = useParams<{ id: string }>()
  const router = useRouter()

  const videoRef   = useRef<HTMLVideoElement>(null)
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const streamRef  = useRef<MediaStream | null>(null)
  const rafRef     = useRef<number | null>(null)
  const lastScanTs = useRef<number>(0)

  const [activeTab, setActiveTab] = useState<'camera' | 'manual'>('camera')
  const [cameraOn, setCameraOn]   = useState(false)
  const [cameraErr, setCameraErr] = useState<string | null>(null)
  const [scanning, setScanning]   = useState(false)
  const [result, setResult]       = useState<ScanResult | null>(null)

  // Lista de participantes e busca manual
  const [registrations, setRegistrations] = useState<ParticipantItem[]>([])
  const [loadingRegistrations, setLoadingRegistrations] = useState(true)
  const [manualQuery, setManualQuery] = useState('')
  const [manualSubmittingId, setManualSubmittingId] = useState<string | null>(null)
  const [eventName, setEventName] = useState<string>('')

  // ─── Carregar participantes do evento ───────────────────────────────────────
  const fetchParticipants = useCallback(async () => {
    if (!eventId) return
    try {
      setLoadingRegistrations(true)
      const res = await fetch(`/api/registrations?eventId=${eventId}`)
      const data = await res.json()
      if (res.ok && data.registrations) {
        setRegistrations(data.registrations)
        if (data.registrations[0]?.event?.name) {
          setEventName(data.registrations[0].event.name)
        }
      }
    } catch {
      // Falha silenciosa de sincronização de participantes
    } finally {
      setLoadingRegistrations(false)
    }
  }, [eventId])

  useEffect(() => {
    fetchParticipants()
  }, [fetchParticipants])

  // ─── Métricas de Presença ──────────────────────────────────────────────────
  // Considera apenas inscrições válidas ('paid' ou 'confirmed')
  const metrics = useMemo(() => {
    const validRegistrations = registrations.filter(
      (r) => r.status === 'paid' || r.status === 'confirmed'
    )
    const presentCount = validRegistrations.filter((r) => r.voucher?.used === true).length
    const totalValid = validRegistrations.length
    const attendancePercent = totalValid > 0 ? Math.round((presentCount / totalValid) * 100) : 0

    return {
      totalValid,
      presentCount,
      attendancePercent,
    }
  }, [registrations])

  // ─── Câmera ────────────────────────────────────────────────────────────────
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

  // ─── Loop de decodificação ─────────────────────────────────────────────────
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
        handleCheckinPayload({ qrPayload: decoded.data })
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

  // ─── Envio unificado para API de check-in ───────────────────────────────────
  const handleCheckinPayload = async (payload: { qrPayload?: string; registrationId?: string }) => {
    if (scanning) return
    setScanning(true)
    setResult(null)
    try {
      const res = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      setResult(data as ScanResult)
      if (data.result === 'ok') {
        // Atualiza estado local da lista de participantes imediatamente
        setRegistrations((prev) =>
          prev.map((r) => {
            const isMatch = payload.registrationId
              ? r.id === payload.registrationId
              : payload.qrPayload?.includes(r.id)
            if (isMatch) {
              return {
                ...r,
                voucher: {
                  id: r.voucher?.id || 'v_new',
                  used: true,
                  usedAt: data.checkedInAt || new Date().toISOString(),
                },
              }
            }
            return r
          })
        )
      }
    } catch {
      setResult({ result: 'error', message: 'Erro de conexão. Tente novamente.' })
    } finally {
      setScanning(false)
    }
  }

  // ─── Check-in Manual ───────────────────────────────────────────────────────
  const handleManualCheckin = async (reg: ParticipantItem) => {
    setManualSubmittingId(reg.id)
    await handleCheckinPayload({ registrationId: reg.id })
    setManualSubmittingId(null)
  }

  // Filtro de busca manual
  const filteredParticipants = useMemo(() => {
    const q = manualQuery.toLowerCase().trim()
    if (!q) return []
    const cleanQ = q.replace(/\D/g, '')

    return registrations.filter((r) => {
      const nameMatch = r.fullName.toLowerCase().includes(q)
      const cpfMatch = cleanQ.length >= 3 && r.cpf.replace(/\D/g, '').includes(cleanQ)
      return nameMatch || cpfMatch
    }).slice(0, 8)
  }, [registrations, manualQuery])

  const cfg = result ? RESULT_CONFIG[result.result] : null

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-5">
      {/* ── Top Header com navegação ── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => router.push(`/eventos/${eventId}`)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-slate-900 truncate">Portaria & Check-in</h1>
            <p className="text-xs text-slate-500 truncate">{eventName || 'Validação de acesso'}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/eventos/${eventId}/inscritos`)}
            className="text-xs gap-1"
          >
            <Users className="w-3.5 h-3.5" />
            Inscritos
          </Button>
        </div>
      </div>

      {/* ── Painel de Métricas de Presença ── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm text-center">
          <div className="flex items-center justify-center gap-1 text-slate-500 text-xs mb-1">
            <Users className="w-3.5 h-3.5" />
            <span>Válidos</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900">{metrics.totalValid}</div>
        </div>

        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 shadow-sm text-center">
          <div className="flex items-center justify-center gap-1 text-emerald-700 text-xs mb-1">
            <UserCheck className="w-3.5 h-3.5" />
            <span>Presentes</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-emerald-700">{metrics.presentCount}</div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 shadow-sm text-center">
          <div className="flex items-center justify-center gap-1 text-blue-700 text-xs mb-1">
            <Percent className="w-3.5 h-3.5" />
            <span>Presença</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-blue-700">{metrics.attendancePercent}%</div>
        </div>
      </div>

      {/* ── Tabs de Modo de Validação ── */}
      <div className="flex bg-slate-100 p-1 rounded-xl">
        <button
          onClick={() => {
            setActiveTab('camera')
            setResult(null)
          }}
          className={cn(
            'flex-1 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5',
            activeTab === 'camera'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          )}
        >
          <ScanLine className="w-4 h-4" />
          Leitor de QR Code
        </button>
        <button
          onClick={() => {
            stopCamera()
            setActiveTab('manual')
            setResult(null)
          }}
          className={cn(
            'flex-1 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5',
            activeTab === 'manual'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          )}
        >
          <Search className="w-4 h-4" />
          Busca Manual (Nome/CPF)
        </button>
      </div>

      {/* ── FEEDBACK DO SCAN / CHECK-IN ── */}
      {result && cfg && (
        <Card className={cn('border-2 transition-all shadow-sm animate-in fade-in', cfg.bg)}>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-start gap-3.5">
              <cfg.icon className={cn('w-7 h-7 flex-shrink-0 mt-0.5', cfg.iconClass)} />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-900 text-base">{cfg.title}</p>
                <p className="text-sm text-slate-600 mt-0.5">{result.message}</p>

                {'participant' in result && result.participant && (
                  <p className="text-sm font-semibold text-slate-900 mt-2 flex items-center gap-1.5">
                    <span>👤</span> {result.participant}
                  </p>
                )}
                {'event' in result && result.event && (
                  <p className="text-xs text-slate-500 mt-0.5">🎟 {result.event}</p>
                )}
                {'usedAt' in result && result.usedAt && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    Entrada registrada em: {new Date(result.usedAt).toLocaleTimeString('pt-BR')}
                  </p>
                )}
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="mt-3.5 w-full text-slate-500 hover:bg-white/50 text-xs"
              onClick={() => setResult(null)}
            >
              Fechar aviso
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── ABA 1: CÂMERA QR CODE ── */}
      {activeTab === 'camera' && (
        <div className="space-y-4">
          <div className="relative bg-black rounded-2xl overflow-hidden aspect-[4/3] shadow-inner">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
            />
            {cameraOn && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-52 h-52 relative">
                  <span className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
                  <span className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
                  <span className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
                  <span className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />
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
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              {cameraErr}
            </p>
          )}

          <div className="flex gap-3">
            {!cameraOn ? (
              <Button onClick={startCamera} className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700 font-semibold h-11">
                <Camera className="w-4 h-4" /> Ativar câmera para ler QR Code
              </Button>
            ) : (
              <Button onClick={stopCamera} variant="outline" className="flex-1 gap-2 border-slate-300 font-semibold h-11">
                <CameraOff className="w-4 h-4" /> Pausar câmera
              </Button>
            )}
          </div>
        </div>
      )}

      {/* ── ABA 2: BUSCA MANUAL POR NOME OU CPF ── */}
      {activeTab === 'manual' && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Digite o nome ou CPF do participante..."
              value={manualQuery}
              onChange={(e) => setManualQuery(e.target.value)}
              className="pl-10 h-11 bg-white rounded-xl text-sm"
              autoFocus
            />
          </div>

          {loadingRegistrations ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500 text-sm flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
              <span>Carregando participantes...</span>
            </div>
          ) : manualQuery.trim() === '' ? (
            <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-8 text-center text-slate-400 text-xs">
              Digite ao menos 3 caracteres do nome ou dígitos do CPF para localizar o participante.
            </div>
          ) : filteredParticipants.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500 text-sm">
              Nenhum participante encontrado para &quot;{manualQuery}&quot;.
            </div>
          ) : (
            <div className="space-y-2">
              {filteredParticipants.map((reg) => {
                const isValid = reg.status === 'paid' || reg.status === 'confirmed'
                const isCheckedIn = reg.voucher?.used === true
                const isSubmitting = manualSubmittingId === reg.id

                return (
                  <div
                    key={reg.id}
                    className="bg-white border border-slate-200 rounded-xl p-3.5 flex items-center justify-between gap-3 shadow-sm hover:border-slate-300 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-900 text-sm truncate">
                          {reg.fullName}
                        </span>
                        {isCheckedIn ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            ✓ Check-in Feito
                          </span>
                        ) : isValid ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                            Válido
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">
                            Pagamento Pendente
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-3">
                        <span>CPF: {reg.cpf || 'Não informado'}</span>
                        {reg.inscriptionType?.name && (
                          <span>• {reg.inscriptionType.name}</span>
                        )}
                      </div>
                    </div>

                    <div>
                      {isCheckedIn ? (
                        <span className="text-xs text-slate-400 font-medium px-2 py-1">
                          Entrada confirmada
                        </span>
                      ) : !isValid ? (
                        <span className="text-xs text-amber-600 font-medium px-2 py-1">
                          Pendente
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handleManualCheckin(reg)}
                          disabled={isSubmitting || scanning}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold gap-1.5 h-8"
                        >
                          {isSubmitting ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <CheckCircle className="w-3.5 h-3.5" />
                          )}
                          Validar Entrada
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Link de apoio ao rodapé ── */}
      <div className="pt-2 text-center text-xs text-slate-400">
        <Link href={`/eventos/${eventId}/inscritos`} className="hover:underline">
          ← Ver lista completa de participantes inscritos
        </Link>
      </div>
    </div>
  )
}

