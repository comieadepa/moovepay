'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { QRCodeSVG } from 'qrcode.react'
import { CheckCircle2, Clock, FileText, QrCode, RefreshCw, AlertCircle } from 'lucide-react'

interface VoucherItem {
  registrationId: string
  fullName: string
  inscriptionTypeName: string
  voucherUrl: string
  isUsed: boolean
}

function ConfirmacaoPageContent() {
  const router = useRouter()
  const [registrations, setRegistrations] = useState('0')
  const [total, setTotal] = useState<string | null>(null)
  const [method, setMethod] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [paymentId, setPaymentId] = useState<string | null>(null)
  const [pixCopyPaste, setPixCopyPaste] = useState<string | null>(null)
  const [pixQrCodeBase64, setPixQrCodeBase64] = useState<string | null>(null)
  const [boletoUrl, setBoletoUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [code, setCode] = useState<string | null>(null)

  // Polling states
  const [isPolling, setIsPolling] = useState(false)
  const [isCheckingManual, setIsCheckingManual] = useState(false)
  const [pollingTimeoutReached, setPollingTimeoutReached] = useState(false)
  const [vouchers, setVouchers] = useState<VoucherItem[]>([])

  const pollingAttemptsRef = useRef(0)
  const isPollingRef = useRef(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setRegistrations(params.get('registrations') || '0')
    setTotal(params.get('total'))
    setMethod(params.get('method'))
    const initialStatus = params.get('status') || 'pending'
    setStatus(initialStatus)
    const pId = params.get('paymentId')
    setPaymentId(pId)
    setPixCopyPaste(params.get('pixCopyPaste'))
    setPixQrCodeBase64(params.get('pixQrCodeBase64'))
    setBoletoUrl(params.get('boletoUrl'))
    const rawCode = params.get('code')
    setCode(rawCode ? `#${rawCode}` : (pId ? `#${pId.slice(0, 8).toUpperCase()}` : `#${Math.random().toString(36).substring(2, 10).toUpperCase()}`))
  }, [])

  // Função para checar status no backend
  const checkPaymentStatus = useCallback(async (isManual = false) => {
    if (!paymentId && !code) return

    if (isManual) setIsCheckingManual(true)

    try {
      const qs = new URLSearchParams()
      if (paymentId) qs.set('paymentId', paymentId)

      const res = await fetch(`/api/checkout/status?${qs.toString()}`, {
        cache: 'no-store',
      })

      if (res.ok) {
        const data = await res.json()
        if (data.success && data.payment) {
          const currentStatus = data.payment.status
          if (currentStatus === 'paid') {
            setStatus('paid')
            if (Array.isArray(data.payment.vouchers) && data.payment.vouchers.length > 0) {
              setVouchers(data.payment.vouchers)
            }
            setIsPolling(false)
            isPollingRef.current = false
            return true
          }
        }
      }
    } catch (err) {
      console.warn('[confirmacao] Erro temporário ao consultar status do pagamento:', err)
    } finally {
      if (isManual) setIsCheckingManual(false)
    }
    return false
  }, [paymentId, code])

  // Efeito de Polling inteligente
  useEffect(() => {
    const shouldPoll =
      (method === 'pix' || method === 'boleto' || status === 'pending') &&
      status !== 'paid' &&
      paymentId

    if (!shouldPoll) {
      setIsPolling(false)
      isPollingRef.current = false
      return
    }

    setIsPolling(true)
    isPollingRef.current = true
    setPollingTimeoutReached(false)
    pollingAttemptsRef.current = 0

    // Intervalo de 3 segundos com máximo de 100 tentativas (~5 minutos)
    const MAX_ATTEMPTS = 100
    const INTERVAL_MS = 3000

    const interval = setInterval(async () => {
      if (!isPollingRef.current) {
        clearInterval(interval)
        return
      }

      pollingAttemptsRef.current += 1

      if (pollingAttemptsRef.current > MAX_ATTEMPTS) {
        clearInterval(interval)
        setIsPolling(false)
        isPollingRef.current = false
        setPollingTimeoutReached(true)
        return
      }

      const isConfirmed = await checkPaymentStatus()
      if (isConfirmed) {
        clearInterval(interval)
      }
    }, INTERVAL_MS)

    return () => {
      clearInterval(interval)
      isPollingRef.current = false
    }
  }, [method, status, paymentId, checkPaymentStatus])

  const isPending = status !== 'paid' && (method === 'pix' || method === 'boleto' || (status === 'pending' && method !== 'free'))
  const count = parseInt(registrations) || 1

  const money = (value: number) => {
    try {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(Number(value || 0))
    } catch {
      return `R$ ${Number(value || 0).toFixed(2)}`
    }
  }

  const methodLabel = (m: string | null) => {
    if (!m) return null
    if (m === 'pix') return 'PIX'
    if (m === 'card') return 'Cartão de crédito'
    if (m === 'boleto') return 'Boleto'
    if (m === 'free') return 'Gratuito'
    return m
  }

  const getHeaderInfo = () => {
    if (status === 'paid') {
      return {
        title: 'Pagamento confirmado!',
        subtitle: count === 1
          ? 'Sua inscrição foi confirmada com sucesso. Seu voucher já está liberado abaixo.'
          : `${count} inscrições foram confirmadas com sucesso. Os vouchers já estão liberados abaixo.`,
        badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        badgeText: 'Confirmado',
        cardBg: 'border-emerald-200 bg-emerald-50/60',
        iconBg: 'bg-emerald-600',
        icon: <CheckCircle2 className="w-8 h-8 text-white" />,
      }
    }

    if (method === 'pix') {
      return {
        title: 'Aguardando pagamento via PIX',
        subtitle: count === 1
          ? 'Sua vaga foi pré-reservada! Complete o pagamento via PIX para confirmar sua inscrição.'
          : `${count} vagas foram pré-reservadas! Complete o pagamento via PIX para confirmar as inscrições.`,
        badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
        badgeText: 'Pagamento pendente',
        cardBg: 'border-amber-200 bg-amber-50/50',
        iconBg: 'bg-amber-500',
        icon: <Clock className="w-8 h-8 text-white" />,
      }
    }

    if (method === 'boleto') {
      return {
        title: 'Aguardando pagamento do boleto',
        subtitle: count === 1
          ? 'Sua vaga foi pré-reservada! Realize o pagamento do boleto bancário para confirmar sua inscrição.'
          : `${count} vagas foram pré-reservadas! Realize o pagamento do boleto bancário para confirmar as inscrições.`,
        badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
        badgeText: 'Pagamento pendente',
        cardBg: 'border-amber-200 bg-amber-50/50',
        iconBg: 'bg-amber-500',
        icon: <FileText className="w-8 h-8 text-white" />,
      }
    }

    return {
      title: 'Inscrição confirmada',
      subtitle: count === 1
        ? '1 inscrição foi confirmada com sucesso.'
        : `${count} inscrições foram confirmadas com sucesso.`,
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      badgeText: 'Confirmado',
      cardBg: 'border-emerald-200 bg-emerald-50',
      iconBg: 'bg-emerald-600',
      icon: <CheckCircle2 className="w-8 h-8 text-white" />,
    }
  }

  const headerInfo = getHeaderInfo()

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #confirmacao-card, #confirmacao-card * { visibility: visible; }
          #confirmacao-card { position: fixed; top: 20px; left: 50%; transform: translateX(-50%); width: 600px; box-shadow: none !important; }
        }
      `}</style>
      <div className="min-h-screen bg-slate-50 py-12">
      <div className="max-w-2xl mx-auto px-4">
        <Card id="confirmacao-card" className={headerInfo.cardBg}>
          <CardContent className="pt-12 text-center pb-12">
            {/* Status Icon */}
            <div className="mb-4 flex justify-center">
              <div className={`w-16 h-16 ${headerInfo.iconBg} rounded-full flex items-center justify-center shadow-sm transition-all duration-300`}>
                {headerInfo.icon}
              </div>
            </div>

            <div className="mb-3">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${headerInfo.badgeColor}`}>
                {headerInfo.badgeText}
              </span>
            </div>

            <h1 className="text-3xl font-bold text-slate-900 mb-3">{headerInfo.title}</h1>

            <p className="text-slate-700 text-base sm:text-lg mb-4 max-w-lg mx-auto">
              {headerInfo.subtitle}
            </p>

            {/* Aviso de Polling / Sincronização em tempo real */}
            {isPending && isPolling && (
              <div className="mb-6 inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-full text-xs text-blue-700 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
                <span>Sincronizando com o banco... A página atualizará assim que o PIX for detectado.</span>
              </div>
            )}

            {/* Timeout de Polling com botão de re-checagem manual */}
            {isPending && pollingTimeoutReached && (
              <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 text-left flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-2">
                  <p className="font-semibold">O pagamento ainda está sendo processado pelo banco.</p>
                  <p>Se você já realizou a transferência, clique no botão abaixo para verificar novamente agora.</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => checkPaymentStatus(true)}
                    disabled={isCheckingManual}
                    className="bg-white border-amber-300 text-amber-900 hover:bg-amber-100/50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isCheckingManual ? 'animate-spin' : ''}`} />
                    {isCheckingManual ? 'Consultando...' : 'Verificar status do pagamento'}
                  </Button>
                </div>
              </div>
            )}

            {code && (
              <p className="text-sm font-mono text-slate-800 bg-white/80 border border-slate-300 rounded-md px-4 py-2 inline-block mb-6 shadow-sm">
                Código de referência: <span className="font-bold">{code}</span>
              </p>
            )}

            {(total || method) && (
              <Card className="mb-6 bg-white shadow-sm border-slate-200">
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
                    {total && (
                      <div>
                        <p className="text-sm text-slate-600">Total</p>
                        <p className="text-xl font-semibold text-slate-900">
                          {money(Number(total))}
                        </p>
                      </div>
                    )}
                    {method && (
                      <div>
                        <p className="text-sm text-slate-600">Método</p>
                        <p className="text-xl font-semibold text-slate-900">{methodLabel(method)}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* SE CONFIRMADO / PAGO: Exibir lista de Vouchers disponíveis */}
            {status === 'paid' && vouchers.length > 0 && (
              <Card className="mb-6 bg-white border-emerald-300 shadow-sm text-left">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-3">
                    <QrCode className="w-5 h-5 text-emerald-600" />
                    <h3 className="font-bold text-slate-900 text-base">Seus Vouchers de Entrada</h3>
                  </div>
                  <p className="text-xs text-slate-600 mb-4">
                    Apresente os QR Codes abaixo na entrada do evento para realizar o check-in.
                  </p>
                  <div className="space-y-2.5">
                    {vouchers.map((v, idx) => (
                      <div
                        key={v.registrationId || idx}
                        className="p-3.5 border border-slate-200 rounded-xl bg-slate-50 flex items-center justify-between gap-3 hover:border-emerald-300 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-slate-900 truncate">{v.fullName}</p>
                          <p className="text-xs text-slate-500">{v.inscriptionTypeName}</p>
                        </div>
                        <Link
                          href={v.voucherUrl}
                          target="_blank"
                          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          <span>Abrir Voucher</span>
                        </Link>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* PIX: Só exibe se ainda estiver pendente */}
            {isPending && method === 'pix' && pixCopyPaste && (
              <Card className="mb-6 bg-white border-blue-200">
                <CardContent className="pt-6">
                  <h3 className="font-semibold text-slate-900 mb-4 text-left">Pague via PIX</h3>
                  <div className="flex flex-col items-center gap-4">
                    <div className="p-3 bg-white border rounded-lg flex items-center justify-center min-w-[200px] min-h-[200px]">
                      {pixQrCodeBase64 ? (
                        <img
                          src={`data:image/png;base64,${pixQrCodeBase64}`}
                          alt="QR Code PIX"
                          className="w-[180px] h-[180px] object-contain"
                        />
                      ) : (
                        <QRCodeSVG value={pixCopyPaste} size={180} level="H" />
                      )}
                    </div>
                    <p className="text-sm text-slate-600 text-center">
                      Escaneie o QR Code ou copie o código abaixo
                    </p>
                    <div className="w-full">
                      <div className="flex gap-2 items-center">
                        <code className="flex-1 text-xs bg-slate-100 border rounded p-2 break-all text-left font-mono">
                          {pixCopyPaste}
                        </code>
                        <button
                          className="shrink-0 px-3 py-2 bg-slate-900 text-white rounded text-sm font-medium hover:bg-slate-800"
                          onClick={() => {
                            navigator.clipboard.writeText(pixCopyPaste!)
                            setCopied(true)
                            setTimeout(() => setCopied(false), 2000)
                          }}
                        >
                          {copied ? 'Copiado!' : 'Copiar'}
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 text-center w-full">
                      Após o pagamento, esta tela atualizará automaticamente e seu voucher será liberado.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Boleto */}
            {isPending && method === 'boleto' && boletoUrl && (
              <Card className="mb-6 bg-white border-amber-200">
                <CardContent className="pt-6">
                  <h3 className="font-semibold text-slate-900 mb-3 text-left">Pague via Boleto</h3>
                  <p className="text-sm text-slate-600 mb-4 text-left">
                    O boleto vence em 1 dia útil. Após o pagamento, seu voucher será enviado por e-mail.
                  </p>
                  <a
                    href={boletoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full py-3 px-4 bg-amber-500 hover:bg-amber-600 text-white text-center font-semibold rounded-md transition-colors"
                  >
                    Abrir Boleto
                  </a>
                </CardContent>
              </Card>
            )}

            <Card className="mb-8 bg-white">
              <CardContent className="pt-6">
                <div className="space-y-4 text-left">
                  <div>
                    <h3 className="font-semibold text-slate-900 mb-2">Próximas etapas</h3>
                    <ul className="space-y-2 text-slate-700">
                      {isPending ? (
                        <>
                          <li className="flex gap-3">
                            <span className="font-bold text-amber-600">1.</span>
                            <span>Efetue o pagamento utilizando o QR Code, Pix Copia e Cola ou boleto acima</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="font-bold text-amber-600">2.</span>
                            <span>Assim que o banco confirmar, sua inscrição será validada automaticamente</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="font-bold text-amber-600">3.</span>
                            <span>Você receberá por e-mail a confirmação e seu voucher/QR code para check-in</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="font-bold text-amber-600">4.</span>
                            <span>Compareça no local, na data e hora especificados</span>
                          </li>
                        </>
                      ) : (
                        <>
                          <li className="flex gap-3">
                            <span className="font-bold text-emerald-700">1.</span>
                            <span>Você receberá um email com os detalhes da sua inscrição</span>
                          </li>
                          {method !== 'free' && (
                            <li className="flex gap-3">
                              <span className="font-bold text-emerald-700">2.</span>
                              <span>Seu comprovante de pagamento foi enviado por email</span>
                            </li>
                          )}
                          <li className="flex gap-3">
                            <span className="font-bold text-emerald-700">{method !== 'free' ? '3' : '2'}.</span>
                            <span>Apresente o voucher gerado para check-in no evento</span>
                          </li>
                          <li className="flex gap-3">
                            <span className="font-bold text-emerald-700">{method !== 'free' ? '4' : '3'}.</span>
                            <span>Compareça no local, na data e hora especificados</span>
                          </li>
                        </>
                      )}
                    </ul>
                  </div>

                  <hr className="my-4" />

                  <div>
                    <h3 className="font-semibold text-slate-900 mb-2">Dúvidas?</h3>
                    <p className="text-slate-700">
                      Entre em contato com o organizador do evento. Todos os detalhes foram enviados por email.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-3">
              <Button
                onClick={() => router.push('/')}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white h-12 font-semibold"
              >
                Voltar para Home
              </Button>

              <Button
                variant="outline"
                onClick={() => window.print()}
                className="w-full no-print"
              >
                Imprimir Confirmação
              </Button>
            </div>

            <p className="text-sm text-slate-600 mt-6 no-print">
              Obrigado por escolher a CongregaPay para suas inscrições!
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
    </>
  )
}

export default function ConfirmacaoPage() {
  return <ConfirmacaoPageContent />
}

