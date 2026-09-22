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

  const [printDate, setPrintDate] = useState('')

  useEffect(() => {
    try {
      setPrintDate(
        new Intl.DateTimeFormat('pt-BR', {
          dateStyle: 'long',
          timeStyle: 'short',
        }).format(new Date())
      )
    } catch {
      setPrintDate(new Date().toLocaleDateString('pt-BR'))
    }
  }, [])

  return (
    <>
      <style>{`
        @page {
          size: A4 portrait;
          margin: 12mm 14mm 14mm 14mm;
        }
        @media print {
          html, body {
            background: #ffffff !important;
            color: #0f172a !important;
            font-size: 10.5pt !important;
            line-height: 1.4 !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print,
          button,
          a.no-print,
          nav,
          header,
          footer,
          .polling-indicator {
            display: none !important;
          }
          .print-full-width {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            box-shadow: none !important;
            border: none !important;
          }
          .print-card-border {
            border: 1px solid #cbd5e1 !important;
            border-radius: 8px !important;
            box-shadow: none !important;
            background: #ffffff !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .print-avoid-break {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      <div className="min-h-screen bg-slate-50 py-8 sm:py-12 print:bg-white print:py-0 print:min-h-0">
        <div className="max-w-2xl mx-auto px-4 print:max-w-none print:px-0 print-full-width">
          
          {/* Cabeçalho exclusivo para impressão A4 */}
          <div className="hidden print:block mb-6 border-b border-slate-300 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-black tracking-tight text-slate-900">CongregaPay</span>
                  <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-semibold border border-slate-300">
                    Comprovante Oficial
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">Plataforma de Inscrições & Gestão de Eventos</p>
              </div>
              <div className="text-right text-xs text-slate-500">
                <p className="font-semibold text-slate-700">Data de emissão</p>
                <p>{printDate}</p>
              </div>
            </div>
          </div>

          <Card id="confirmacao-card" className={`${headerInfo.cardBg} print-card-border print:bg-white print:border-slate-300`}>
            <CardContent className="pt-8 sm:pt-12 text-center pb-8 sm:pb-12 print:pt-4 print:pb-4">
              
              {/* Status Icon */}
              <div className="mb-4 flex justify-center print:mb-2">
                <div className={`w-14 h-14 sm:w-16 sm:h-16 ${headerInfo.iconBg} rounded-full flex items-center justify-center shadow-sm transition-all duration-300 print:w-12 print:h-12`}>
                  {headerInfo.icon}
                </div>
              </div>

              <div className="mb-3 print:mb-2">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${headerInfo.badgeColor} print:border-slate-400 print:bg-slate-100 print:text-slate-900`}>
                  {headerInfo.badgeText}
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2 print:text-2xl">{headerInfo.title}</h1>

              <p className="text-slate-700 text-sm sm:text-base mb-5 max-w-lg mx-auto print:text-xs print:mb-4">
                {headerInfo.subtitle}
              </p>

              {/* Aviso de Polling / Sincronização em tempo real (Oculto na impressão) */}
              {isPending && isPolling && (
                <div className="mb-6 inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-full text-xs text-blue-700 animate-pulse no-print">
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
                  <span>Sincronizando com o banco... A página atualizará assim que o PIX for detectado.</span>
                </div>
              )}

              {/* Timeout de Polling com botão de re-checagem manual (Oculto na impressão) */}
              {isPending && pollingTimeoutReached && (
                <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 text-left flex items-start gap-3 no-print">
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

              {/* Resumo da Transação & Dados de Pagamento */}
              <div className="mb-6 print:mb-4 print-avoid-break">
                <Card className="bg-white shadow-sm border-slate-200 print:border-slate-300">
                  <CardContent className="p-4 sm:p-5">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 text-left">
                      {code && (
                        <div>
                          <p className="text-xs text-slate-500 font-medium">Código do Pedido</p>
                          <p className="text-sm sm:text-base font-bold font-mono text-slate-900">{code}</p>
                        </div>
                      )}
                      {method && (
                        <div>
                          <p className="text-xs text-slate-500 font-medium">Método</p>
                          <p className="text-sm sm:text-base font-bold text-slate-900">{methodLabel(method)}</p>
                        </div>
                      )}
                      {total && (
                        <div>
                          <p className="text-xs text-slate-500 font-medium">Valor Total</p>
                          <p className="text-sm sm:text-base font-bold text-emerald-700">
                            {money(Number(total))}
                          </p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs text-slate-500 font-medium">Inscrições</p>
                        <p className="text-sm sm:text-base font-bold text-slate-900">
                          {count} {count === 1 ? 'vaga' : 'vagas'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* SE CONFIRMADO / PAGO: Exibir lista de Vouchers com QR Code */}
              {status === 'paid' && vouchers.length > 0 && (
                <Card className="mb-6 bg-white border-emerald-300 shadow-sm text-left print:border-slate-300 print-avoid-break">
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex items-center gap-2 mb-2">
                      <QrCode className="w-5 h-5 text-emerald-600 print:text-slate-800" />
                      <h3 className="font-bold text-slate-900 text-base">Vouchers de Entrada & Credenciamento</h3>
                    </div>
                    <p className="text-xs text-slate-600 mb-4">
                      Apresente os QR Codes abaixo na recepção do evento para realizar o check-in.
                    </p>
                    <div className="space-y-3">
                      {vouchers.map((v, idx) => (
                        <div
                          key={v.registrationId || idx}
                          className="p-3.5 sm:p-4 border border-slate-200 rounded-xl bg-slate-50/80 flex flex-col sm:flex-row items-center justify-between gap-4 print:bg-white print:border-slate-300 print-avoid-break"
                        >
                          <div className="min-w-0 flex-1 text-left">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center print:border print:border-slate-400">
                                {idx + 1}
                              </span>
                              <p className="font-bold text-sm sm:text-base text-slate-900 truncate">{v.fullName}</p>
                            </div>
                            <p className="text-xs text-slate-600 font-medium ml-7">
                              Categoria: <span className="text-slate-900 font-semibold">{v.inscriptionTypeName}</span>
                            </p>
                            <p className="text-[11px] text-slate-400 font-mono ml-7 mt-0.5">
                              ID: #{v.registrationId.slice(0, 8).toUpperCase()}
                            </p>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            {/* QR Code SVG direto para leitura no papel ou tela */}
                            <div className="p-2 bg-white border border-slate-200 rounded-lg shadow-2xs flex flex-col items-center">
                              <QRCodeSVG
                                value={`congregapay:voucher:${v.registrationId}`}
                                size={72}
                                level="M"
                              />
                              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mt-1">Check-in</span>
                            </div>

                            <Link
                              href={v.voucherUrl}
                              target="_blank"
                              className="no-print inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
                            >
                              <QrCode className="w-3.5 h-3.5" />
                              <span>Abrir Voucher</span>
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* PIX: Só exibe se ainda estiver pendente (oculto na impressão se já pago) */}
              {isPending && method === 'pix' && pixCopyPaste && (
                <Card className="mb-6 bg-white border-blue-200 print:border-slate-300 print-avoid-break">
                  <CardContent className="pt-6">
                    <h3 className="font-semibold text-slate-900 mb-4 text-left">Pague via PIX</h3>
                    <div className="flex flex-col items-center gap-4">
                      <div className="p-3 bg-white border rounded-lg flex items-center justify-center min-w-[180px] min-h-[180px]">
                        {pixQrCodeBase64 ? (
                          <img
                            src={`data:image/png;base64,${pixQrCodeBase64}`}
                            alt="QR Code PIX"
                            className="w-[160px] h-[160px] object-contain"
                          />
                        ) : (
                          <QRCodeSVG value={pixCopyPaste} size={160} level="H" />
                        )}
                      </div>
                      <p className="text-sm text-slate-600 text-center">
                        Escaneie o QR Code ou copie o código abaixo
                      </p>
                      <div className="w-full no-print">
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
                <Card className="mb-6 bg-white border-amber-200 print:border-slate-300 print-avoid-break">
                  <CardContent className="pt-6">
                    <h3 className="font-semibold text-slate-900 mb-3 text-left">Pague via Boleto</h3>
                    <p className="text-sm text-slate-600 mb-4 text-left">
                      O boleto vence em 1 dia útil. Após o pagamento, seu voucher será enviado por e-mail.
                    </p>
                    <a
                      href={boletoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="no-print block w-full py-3 px-4 bg-amber-500 hover:bg-amber-600 text-white text-center font-semibold rounded-md transition-colors"
                    >
                      Abrir Boleto
                    </a>
                  </CardContent>
                </Card>
              )}

              {/* Próximas Etapas e Orientações */}
              <Card className="mb-6 bg-white border-slate-200 print:border-slate-300 print-avoid-break">
                <CardContent className="p-4 sm:p-6">
                  <div className="space-y-4 text-left">
                    <div>
                      <h3 className="font-semibold text-slate-900 text-sm sm:text-base mb-3 flex items-center justify-between">
                        <span>Próximas etapas</span>
                        <span className="hidden print:inline text-xs font-serif italic text-emerald-800">
                          Te esperamos no evento!
                        </span>
                      </h3>
                      <ul className="space-y-2 text-xs sm:text-sm text-slate-700">
                        {isPending ? (
                          <>
                            <li className="flex gap-2.5 items-start">
                              <span className="font-bold text-amber-700 bg-amber-100 rounded-full w-4 h-4 flex items-center justify-center text-[10px] shrink-0 mt-0.5">1</span>
                              <span>Efetue o pagamento utilizando o QR Code, PIX Copia e Cola ou boleto acima.</span>
                            </li>
                            <li className="flex gap-2.5 items-start">
                              <span className="font-bold text-amber-700 bg-amber-100 rounded-full w-4 h-4 flex items-center justify-center text-[10px] shrink-0 mt-0.5">2</span>
                              <span>Assim que o banco confirmar, sua inscrição será validada automaticamente.</span>
                            </li>
                            <li className="flex gap-2.5 items-start">
                              <span className="font-bold text-amber-700 bg-amber-100 rounded-full w-4 h-4 flex items-center justify-center text-[10px] shrink-0 mt-0.5">3</span>
                              <span>Você receberá por e-mail a confirmação e seu voucher/QR Code para check-in.</span>
                            </li>
                            <li className="flex gap-2.5 items-start">
                              <span className="font-bold text-amber-700 bg-amber-100 rounded-full w-4 h-4 flex items-center justify-center text-[10px] shrink-0 mt-0.5">4</span>
                              <span>Compareça ao local do evento com antecedência na data programada.</span>
                            </li>
                          </>
                        ) : (
                          <>
                            <li className="flex gap-2.5 items-start">
                              <span className="font-bold text-emerald-700 bg-emerald-100 rounded-full w-4 h-4 flex items-center justify-center text-[10px] shrink-0 mt-0.5">1</span>
                              <span>Você receberá um e-mail com o comprovante e os detalhes da sua inscrição.</span>
                            </li>
                            <li className="flex gap-2.5 items-start">
                              <span className="font-bold text-emerald-700 bg-emerald-100 rounded-full w-4 h-4 flex items-center justify-center text-[10px] shrink-0 mt-0.5">2</span>
                              <span>Guarde este comprovante ou salve o voucher no celular para agilizar sua entrada.</span>
                            </li>
                            <li className="flex gap-2.5 items-start">
                              <span className="font-bold text-emerald-700 bg-emerald-100 rounded-full w-4 h-4 flex items-center justify-center text-[10px] shrink-0 mt-0.5">3</span>
                              <span>Apresente o QR Code no credenciamento/portaria do evento para validação de entrada.</span>
                            </li>
                            <li className="flex gap-2.5 items-start">
                              <span className="font-bold text-emerald-700 bg-emerald-100 rounded-full w-4 h-4 flex items-center justify-center text-[10px] shrink-0 mt-0.5">4</span>
                              <span>Chegue com antecedência ao local especificado e aproveite a programação!</span>
                            </li>
                          </>
                        )}
                      </ul>
                    </div>

                    <hr className="my-3 border-slate-200" />

                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-slate-500">
                      <p>Dúvidas? Entre em contato com o organizador do evento.</p>
                      <p className="font-medium text-slate-700">CongregaPay • Inscrições Concluídas</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Botões de Ação na Tela (Ocultos na Impressão) */}
              <div className="space-y-3 no-print">
                <Button
                  onClick={() => router.push('/')}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white h-11 font-semibold shadow-sm"
                >
                  Voltar para Home
                </Button>

                <Button
                  variant="outline"
                  onClick={() => window.print()}
                  className="w-full h-11 font-semibold border-slate-300 text-slate-700 hover:bg-slate-100"
                >
                  Imprimir Comprovante / Salvar PDF
                </Button>
              </div>

              <p className="text-xs text-slate-500 mt-6 no-print">
                Obrigado por escolher o CongregaPay para suas inscrições!
              </p>

              {/* Rodapé Oficial Exclusivo para Impressão */}
              <div className="hidden print:block mt-6 pt-4 border-t border-slate-300 text-center text-[10px] text-slate-500">
                <p className="font-semibold text-slate-700">PESSOAS • EVENTOS • PROPÓSITO</p>
                <p className="mt-0.5">Documento gerado eletronicamente pela plataforma CongregaPay (www.congregapay.com.br).</p>
                <p className="text-[9px] text-slate-400 mt-0.5">A autenticidade deste documento pode ser confirmada pela leitura do QR Code do check-in.</p>
              </div>

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

