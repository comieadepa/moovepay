'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useCart } from '@/store/cart'
import {
  CreditCard,
  QrCode,
  FileText,
  ShieldCheck,
  Lock,
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react'

type PaymentMethod = 'pix' | 'card' | 'boleto'

// ── Funções de Máscara ────────────────────────────────────────────────────────
function maskCpf(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

function maskCardNumber(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 16)
  return d.replace(/(\d{4})(?=\d)/g, '$1 ')
}

function maskCardExpiry(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 4)
  if (d.length <= 2) return d
  return `${d.slice(0, 2)}/${d.slice(2)}`
}

function maskCep(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 8)
  if (d.length <= 5) return d
  return `${d.slice(0, 5)}-${d.slice(5)}`
}

export default function CheckoutPage() {
  const router = useRouter()
  const {
    items,
    getSubtotal,
    getDiscount,
    getTotal,
    clear: clearCart,
  } = useCart()

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Formulário do Cartão de Crédito ─────────────────────────────────────────
  const [cardNumber, setCardNumber] = useState('')
  const [cardHolderName, setCardHolderName] = useState('')
  const [cardExpiry, setCardExpiry] = useState('')
  const [cardCvv, setCardCvv] = useState('')
  const [installments, setInstallments] = useState(1)

  // Dados do titular para antifraude do ASAAS
  const [holderCpf, setHolderCpf] = useState('')
  const [holderPostalCode, setHolderPostalCode] = useState('')
  const [holderAddress, setHolderAddress] = useState('')
  const [holderNumber, setHolderNumber] = useState('')
  const [holderProvince, setHolderProvince] = useState('')
  const [holderCity, setHolderCity] = useState('')

  // Preenchimento automático do primeiro participante nos dados do titular
  useEffect(() => {
    const first = items[0]?.participants?.[0]
    if (first) {
      if (!cardHolderName && first.fullName) setCardHolderName(first.fullName)
      if (!holderCpf && first.cpf) setHolderCpf(maskCpf(first.cpf))
    }
  }, [items])

  const navigatingRef = useRef(false)

  const subtotal = getSubtotal()
  const discount = getDiscount()
  const total = getTotal()

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

  useEffect(() => {
    if (items.length === 0 && !navigatingRef.current) {
      router.push('/')
    }
  }, [items, router])

  const handleProcessPayment = async () => {
    setLoading(true)
    setError(null)

    try {
      if (items.length === 0) {
        setError('Seu carrinho está vazio')
        return
      }

      // Validar dados dos participantes
      for (const item of items) {
        if (!item.eventId) {
          setError('Não foi possível identificar o evento. Volte ao carrinho e tente novamente.')
          return
        }
        if (!item.participants || item.participants.length === 0) {
          setError('Por favor, preencha os dados de todos os participantes')
          return
        }
        if (item.participants.length !== item.quantity) {
          setError('A quantidade de participantes não confere com a quantidade selecionada')
          return
        }
        for (const participant of item.participants) {
          if (!participant.fullName || !participant.email || !participant.cpf) {
            setError('Dados incompletos dos participantes')
            return
          }
        }
      }

      // Validação dos dados do cartão se método selecionado for 'card'
      if (paymentMethod === 'card' && total > 0) {
        const rawCardNum = cardNumber.replace(/\D/g, '')
        if (rawCardNum.length < 13 || rawCardNum.length > 19) {
          setError('Número de cartão de crédito inválido')
          return
        }
        if (!cardHolderName.trim() || cardHolderName.trim().length < 3) {
          setError('Informe o nome impresso no cartão')
          return
        }
        const expiryParts = cardExpiry.split('/')
        if (expiryParts.length !== 2 || expiryParts[0].length !== 2 || expiryParts[1].length !== 2) {
          setError('Data de validade do cartão inválida (formato MM/AA)')
          return
        }
        const rawCvv = cardCvv.trim()
        if (rawCvv.length < 3 || rawCvv.length > 4) {
          setError('Código CVV inválido')
          return
        }
        const rawCpf = holderCpf.replace(/\D/g, '')
        if (rawCpf.length !== 11) {
          setError('CPF do titular do cartão é obrigatório e deve ter 11 dígitos')
          return
        }
        const rawCep = holderPostalCode.replace(/\D/g, '')
        if (rawCep.length !== 8) {
          setError('CEP do endereço da fatura é obrigatório (8 dígitos)')
          return
        }
        if (!holderAddress.trim()) {
          setError('Endereço/Logradouro do titular é obrigatório')
          return
        }
        if (!holderNumber.trim()) {
          setError('Número do endereço é obrigatório')
          return
        }
        if (!holderProvince.trim()) {
          setError('Bairro do endereço é obrigatório')
          return
        }
        if (!holderCity.trim()) {
          setError('Cidade do endereço é obrigatória')
          return
        }
      }

      // 1. Criar inscrições no backend
      const registrations: any[] = []
      for (const item of items) {
        const response = await fetch('/api/registrations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventId: item.eventId,
            inscriptionTypeId: item.inscriptionTypeId,
            quantity: item.quantity,
            participants: item.participants,
          }),
        })

        const data = await response.json().catch(() => ({} as any))

        if (!response.ok) {
          throw new Error(data.error || data.message || 'Erro ao criar inscrição')
        }

        if (Array.isArray(data.registrations)) {
          registrations.push(...data.registrations)
        } else if (data.registration) {
          registrations.push(data.registration)
        }
      }

      // 2. Preparar payload de checkout
      const allIds = registrations.map((r: any) => r.id)
      const firstCartId = registrations.find((r: any) => r.cartId)?.cartId
      const firstPayer = items[0]?.participants?.[0]

      // Evento gratuito: confirma direto e redireciona
      if (total === 0) {
        const qs = new URLSearchParams({
          registrations: String(allIds.length),
          total: '0.00',
          method: 'free',
        })
        navigatingRef.current = true
        router.push(`/confirmacao?${qs.toString()}`)
        clearCart()
        return
      }

      const checkoutPayload: any = {
        cartId: firstCartId,
        registrationIds: allIds,
        method: paymentMethod,
        totalValue: total,
        payer: {
          name: firstPayer.fullName,
          email: firstPayer.email,
          cpf: firstPayer.cpf,
          whatsapp: firstPayer.whatsapp,
        },
      }

      if (paymentMethod === 'card') {
        const [expMonth, expYear] = cardExpiry.split('/')
        checkoutPayload.creditCard = {
          holderName: cardHolderName.trim(),
          number: cardNumber.replace(/\D/g, ''),
          expiryMonth: expMonth,
          expiryYear: expYear,
          ccv: cardCvv.trim(),
        }
        checkoutPayload.creditCardHolderInfo = {
          name: cardHolderName.trim(),
          email: firstPayer.email,
          cpfCnpj: holderCpf.replace(/\D/g, ''),
          phone: firstPayer.whatsapp || '11999999999',
          mobilePhone: firstPayer.whatsapp || '11999999999',
          postalCode: holderPostalCode.replace(/\D/g, ''),
          address: holderAddress.trim(),
          addressNumber: holderNumber.trim(),
          province: holderProvince.trim(),
          city: holderCity.trim(),
        }
        checkoutPayload.installments = installments
      }

      // 3. Chamar POST /api/checkout com ASAAS REAL
      const checkoutRes = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(checkoutPayload),
      })

      const checkoutData = await checkoutRes.json().catch(() => ({} as any))
      if (!checkoutRes.ok) {
        throw new Error(checkoutData?.error || 'Erro ao criar pagamento')
      }

      navigatingRef.current = true
      clearCart()

      const qs = new URLSearchParams({
        registrations: String(allIds.length),
        total: String(Number(total || 0).toFixed(2)),
        method: paymentMethod,
        paymentId: checkoutData.payment?.id || '',
        ...(checkoutData.payment?.pixCopyPaste ? { pixCopyPaste: checkoutData.payment.pixCopyPaste } : {}),
        ...(checkoutData.payment?.pixQrCodeBase64 ? { pixQrCodeBase64: checkoutData.payment.pixQrCodeBase64 } : {}),
        ...(checkoutData.payment?.boletoUrl ? { boletoUrl: checkoutData.payment.boletoUrl } : {}),
      })
      router.push(`/confirmacao?${qs.toString()}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao processar pagamento')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50/60 py-10">
      <div className="max-w-4xl mx-auto px-4">
        {/* Top Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Finalizar compra</h1>
            <p className="text-sm text-slate-500 mt-0.5">Revise seu pedido e escolha a forma de pagamento</p>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 bg-white border border-slate-200 px-3 py-1.5 rounded-full shadow-sm">
            <Lock className="w-3.5 h-3.5 text-emerald-600" />
            <span>Ambiente seguro SSL</span>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-sm text-rose-800 animate-in fade-in">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">Atenção</p>
              <p>{error}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Métodos de Pagamento */}
          <div className="lg:col-span-2 space-y-5">
            {total === 0 ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-8 text-center shadow-sm">
                <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-emerald-900 mb-1">Inscrição Gratuita</h3>
                <p className="text-sm text-emerald-700 max-w-md mx-auto">
                  Este evento não possui cobrança. Basta clicar no botão &quot;Confirmar Inscrição Gratuita&quot; para emitir seu voucher.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-sm font-semibold text-slate-800 uppercase tracking-wide px-1">
                  Selecione a forma de pagamento
                </div>

                {/* Opção PIX */}
                <Card
                  onClick={() => setPaymentMethod('pix')}
                  className={`cursor-pointer transition-all duration-200 border ${
                    paymentMethod === 'pix'
                      ? 'border-emerald-600 ring-2 ring-emerald-500/20 bg-emerald-50/20 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="pt-0.5">
                        <input
                          type="radio"
                          name="paymentMethod"
                          value="pix"
                          checked={paymentMethod === 'pix'}
                          onChange={() => setPaymentMethod('pix')}
                          className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                        />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900 text-base">PIX</span>
                            <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2 py-0.5 rounded-full">
                              Instantâneo
                            </span>
                          </div>
                          <QrCode className="w-5 h-5 text-emerald-600" />
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          Aprovação imediata. O QR Code dinâmico do ASAAS e o código Copia e Cola serão gerados ao confirmar.
                        </p>

                        {paymentMethod === 'pix' && (
                          <div className="mt-4 p-3.5 bg-white border border-emerald-200 rounded-xl text-xs text-slate-600 flex items-center gap-3">
                            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                            <span>
                              Ao clicar em confirmar, conectaremos diretamente ao ASAAS para criar sua cobrança PIX com QR Code real e seguro.
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Opção Cartão de Crédito */}
                <Card
                  onClick={() => setPaymentMethod('card')}
                  className={`cursor-pointer transition-all duration-200 border ${
                    paymentMethod === 'card'
                      ? 'border-emerald-600 ring-2 ring-emerald-500/20 bg-emerald-50/10 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="pt-0.5">
                        <input
                          type="radio"
                          name="paymentMethod"
                          value="card"
                          checked={paymentMethod === 'card'}
                          onChange={() => setPaymentMethod('card')}
                          className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                        />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900 text-base">Cartão de Crédito</span>
                            <span className="bg-slate-100 text-slate-700 text-[11px] font-medium px-2 py-0.5 rounded-full">
                              Até 12x
                            </span>
                          </div>
                          <CreditCard className="w-5 h-5 text-slate-600" />
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          Processamento seguro diretamente pelo ASAAS.
                        </p>

                        {paymentMethod === 'card' && (
                          <div className="mt-5 pt-4 border-t border-slate-100 space-y-4" onClick={(e) => e.stopPropagation()}>
                            <div>
                              <label className="block text-xs font-semibold text-slate-700 mb-1">
                                Número do Cartão
                              </label>
                              <Input
                                type="text"
                                placeholder="0000 0000 0000 0000"
                                maxLength={19}
                                value={cardNumber}
                                onChange={(e) => setCardNumber(maskCardNumber(e.target.value))}
                                className="bg-white font-mono text-sm"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-slate-700 mb-1">
                                Nome impresso no Cartão
                              </label>
                              <Input
                                type="text"
                                placeholder="NOME COMO ESTÁ NO CARTÃO"
                                value={cardHolderName}
                                onChange={(e) => setCardHolderName(e.target.value.toUpperCase())}
                                className="bg-white uppercase text-sm"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                  Validade (MM/AA)
                                </label>
                                <Input
                                  type="text"
                                  placeholder="MM/AA"
                                  maxLength={5}
                                  value={cardExpiry}
                                  onChange={(e) => setCardExpiry(maskCardExpiry(e.target.value))}
                                  className="bg-white font-mono text-sm"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                  CVV / Código de Segurança
                                </label>
                                <Input
                                  type="password"
                                  placeholder="123"
                                  maxLength={4}
                                  value={cardCvv}
                                  onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, ''))}
                                  className="bg-white font-mono text-sm"
                                />
                              </div>
                            </div>

                            {/* Parcelamento */}
                            <div>
                              <label className="block text-xs font-semibold text-slate-700 mb-1">
                                Parcelas
                              </label>
                              <select
                                value={installments}
                                onChange={(e) => setInstallments(Number(e.target.value))}
                                className="w-full h-10 px-3 py-2 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                              >
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                                  <option key={n} value={n}>
                                    {n}x de {money(total / n)} {n === 1 ? '(à vista)' : ''}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Endereço de Fatura (Obrigatório pelo ASAAS) */}
                            <div className="pt-3 border-t border-slate-100">
                              <p className="text-xs font-bold text-slate-700 mb-2.5">
                                Endereço de Cobrança do Titular
                              </p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                                    CPF do Titular
                                  </label>
                                  <Input
                                    type="text"
                                    placeholder="000.000.000-00"
                                    value={holderCpf}
                                    maxLength={14}
                                    onChange={(e) => setHolderCpf(maskCpf(e.target.value))}
                                    className="bg-white text-xs"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                                    CEP
                                  </label>
                                  <Input
                                    type="text"
                                    placeholder="00000-000"
                                    value={holderPostalCode}
                                    maxLength={9}
                                    onChange={(e) => setHolderPostalCode(maskCep(e.target.value))}
                                    className="bg-white text-xs"
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-3 gap-2 mt-2">
                                <div className="col-span-2">
                                  <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                                    Logradouro (Rua / Av.)
                                  </label>
                                  <Input
                                    type="text"
                                    placeholder="Nome da rua"
                                    value={holderAddress}
                                    onChange={(e) => setHolderAddress(e.target.value)}
                                    className="bg-white text-xs"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                                    Número
                                  </label>
                                  <Input
                                    type="text"
                                    placeholder="123"
                                    value={holderNumber}
                                    onChange={(e) => setHolderNumber(e.target.value)}
                                    className="bg-white text-xs"
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-2 mt-2">
                                <div>
                                  <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                                    Bairro
                                  </label>
                                  <Input
                                    type="text"
                                    placeholder="Bairro"
                                    value={holderProvince}
                                    onChange={(e) => setHolderProvince(e.target.value)}
                                    className="bg-white text-xs"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                                    Cidade
                                  </label>
                                  <Input
                                    type="text"
                                    placeholder="Cidade"
                                    value={holderCity}
                                    onChange={(e) => setHolderCity(e.target.value)}
                                    className="bg-white text-xs"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Opção Boleto */}
                <Card
                  onClick={() => setPaymentMethod('boleto')}
                  className={`cursor-pointer transition-all duration-200 border ${
                    paymentMethod === 'boleto'
                      ? 'border-emerald-600 ring-2 ring-emerald-500/20 bg-emerald-50/20 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="pt-0.5">
                        <input
                          type="radio"
                          name="paymentMethod"
                          value="boleto"
                          checked={paymentMethod === 'boleto'}
                          onChange={() => setPaymentMethod('boleto')}
                          className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                        />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-900 text-base">Boleto Bancário</span>
                          <FileText className="w-5 h-5 text-slate-600" />
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          Vencimento em 1 dia útil. O link oficial do boleto gerado no ASAAS será disponibilizado logo após a confirmação.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>

          {/* Resumo do Pedido */}
          <div className="lg:col-span-1">
            <Card className="sticky top-6 border-slate-200 shadow-sm bg-white">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-base font-bold text-slate-900">Resumo do Pedido</CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                  {items.map((item, index) => (
                    <div key={index} className="flex justify-between items-start text-xs">
                      <div>
                        <p className="font-medium text-slate-800">
                          {item.quantity}x {item.inscriptionTypeName}
                        </p>
                        {item.eventName && (
                          <p className="text-[11px] text-slate-400">{item.eventName}</p>
                        )}
                      </div>
                      <span className="font-semibold text-slate-900">
                        {money(item.value * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-slate-100 pt-3 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal</span>
                    <span>{money(subtotal)}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-emerald-700 font-medium">
                      <span>Desconto</span>
                      <span>- {money(discount)}</span>
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-200 pt-3 flex justify-between items-baseline">
                  <span className="text-sm font-bold text-slate-900">Total a pagar</span>
                  <span className="text-2xl font-extrabold text-emerald-700">
                    {money(total)}
                  </span>
                </div>

                <div className="pt-2 space-y-2">
                  <Button
                    onClick={handleProcessPayment}
                    disabled={loading}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-12 text-sm font-bold shadow-sm transition-all"
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Processando no ASAAS...
                      </span>
                    ) : total === 0 ? (
                      'Confirmar Inscrição Gratuita'
                    ) : (
                      `Pagar ${money(total)}`
                    )}
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => router.back()}
                    disabled={loading}
                    className="w-full h-10 text-xs font-semibold text-slate-600 hover:text-slate-900 border-slate-200"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                    Voltar ao Carrinho
                  </Button>
                </div>

                <div className="pt-2 flex items-center justify-center gap-2 text-[11px] text-slate-400">
                  <Lock className="w-3 h-3" />
                  <span>Pagamento criptografado & auditado</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

