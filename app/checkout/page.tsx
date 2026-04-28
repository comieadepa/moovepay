'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useCart } from '@/store/cart'

type PaymentMethod = 'pix' | 'card' | 'boleto'

export default function CheckoutPage() {
  const router = useRouter()
  const {
    items,
    getSubtotal,
    getDiscount,
    getPlatformFee,
    getTotal,
    clear: clearCart,
  } = useCart()

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const subtotal = getSubtotal()
  const discount = getDiscount()
  const platformFee = getPlatformFee()
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
    if (items.length === 0) {
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

      // Criar inscrições em lote (por tipo) no backend
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

      // Criar pagamento no ASAAS (somente se total > 0)
      const allIds = registrations.map((r: any) => r.id)
      const firstCartId = registrations.find((r: any) => r.cartId)?.cartId
      const firstPayer = items[0]?.participants?.[0]

      // Evento gratuito: pula o checkout financeiro e redireciona direto
      if (total === 0) {
        clearCart()
        const qs = new URLSearchParams({
          registrations: String(allIds.length),
          total: '0.00',
          method: 'free',
        })
        router.push(`/confirmacao?${qs.toString()}`)
        return
      }

      const checkoutRes = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
        }),
      })

      const checkoutData = await checkoutRes.json().catch(() => ({} as any))
      if (!checkoutRes.ok) {
        throw new Error(checkoutData?.error || 'Erro ao criar pagamento')
      }

      clearCart()

      const qs = new URLSearchParams({
        registrations: String(allIds.length),
        total: String(Number(total || 0).toFixed(2)),
        method: paymentMethod,
        paymentId: checkoutData.payment?.id || '',
        ...(checkoutData.payment?.pixCopyPaste ? { pixCopyPaste: checkoutData.payment.pixCopyPaste } : {}),
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
    <div className="min-h-screen bg-slate-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Finalizar compra</h1>
        <p className="text-slate-600 mb-8">Revise o pedido e confirme o pagamento</p>

        {error && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-lg">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Payment Methods — oculto em eventos gratuitos */}
          <div className="lg:col-span-2 space-y-6">
            {total === 0 ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center">
                <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-7 h-7 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-emerald-800 mb-1">Evento Gratuito</h3>
                <p className="text-sm text-emerald-700">
                  Nenhum pagamento necessário. Clique em &quot;Confirmar Inscrição&quot; para finalizar.
                </p>
              </div>
            ) : (
              <>
            {/* PIX */}
            <Card>
              <CardContent className="pt-6">
                <label className="flex items-start gap-4 cursor-pointer">
                  <input
                    type="radio"
                    name="payment"
                    value="pix"
                    checked={paymentMethod === 'pix'}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-2">PIX</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Pagamento instantâneo via PIX. Copie a chave e faça a transferência.
                    </p>
                    {paymentMethod === 'pix' && (
                      <div className="mt-4 p-4 bg-slate-50 rounded-lg">
                        <p className="text-sm text-gray-600 mb-2">Chave PIX (placeholder):</p>
                        <div className="flex gap-2">
                          <code className="flex-1 p-2 bg-white border rounded text-xs font-mono">
                            congregapay@teste.br
                          </code>
                          <button
                            className="px-3 py-2 bg-slate-900 text-white rounded text-sm font-medium hover:bg-slate-800"
                            onClick={() => navigator.clipboard.writeText('congregapay@teste.br')}
                          >
                            Copiar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </label>
              </CardContent>
            </Card>

            {/* Credit Card */}
            <Card>
              <CardContent className="pt-6">
                <label className="flex items-start gap-4 cursor-pointer">
                  <input
                    type="radio"
                    name="payment"
                    value="card"
                    checked={paymentMethod === 'card'}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-2">Cartão de Crédito</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Parcelado em até 12 vezes sem juros (sujeito à análise).
                    </p>
                    {paymentMethod === 'card' && (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Número do Cartão
                          </label>
                          <Input
                            type="text"
                            placeholder="0000 0000 0000 0000"
                            disabled
                            className="opacity-50"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Validade
                            </label>
                            <Input
                              type="text"
                              placeholder="MM/AA"
                              disabled
                              className="opacity-50"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              CVV
                            </label>
                            <Input
                              type="text"
                              placeholder="000"
                              disabled
                              className="opacity-50"
                            />
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          ⚠️ Integração ASAAS pendente. Envie os dados com segurança após ativar.
                        </p>
                      </div>
                    )}
                  </div>
                </label>
              </CardContent>
            </Card>

            {/* Boleto */}
            <Card>
              <CardContent className="pt-6">
                <label className="flex items-start gap-4 cursor-pointer">
                  <input
                    type="radio"
                    name="payment"
                    value="boleto"
                    checked={paymentMethod === 'boleto'}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-2">Boleto Bancário</h3>
                    <p className="text-sm text-gray-600">
                      Boleto para pagamento até o vencimento. Você receberá o código do boleto por email.
                    </p>
                  </div>
                </label>
              </CardContent>
            </Card>
            </>
            )}
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle>Resumo do Pedido</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3 border-b pb-4">
                  {items.map((item, index) => (
                    <div key={index} className="flex justify-between text-sm">
                      <span className="text-slate-700">
                        {item.quantity}x {item.inscriptionTypeName}
                      </span>
                      <span className="text-slate-900">{money(item.value * item.quantity)}</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-700">Subtotal:</span>
                    <span className="text-slate-900">{money(subtotal)}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-700">Desconto:</span>
                      <span className="text-emerald-700">- {money(discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-700">Taxa da plataforma ({platformFee > 0 ? '10%' : 'gratuito'}):</span>
                    <span className="text-slate-900">{money(platformFee)}</span>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold">Total:</span>
                    <span className="text-2xl font-bold text-emerald-700">
                      {money(total)}
                    </span>
                  </div>
                </div>

                <Button
                  onClick={handleProcessPayment}
                  disabled={loading}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-12 font-semibold"
                >
                  {loading
                    ? 'Processando...'
                    : total === 0
                    ? 'Confirmar Inscrição Gratuita'
                    : 'Confirmar Pagamento'}
                </Button>

                <Button
                  variant="outline"
                  onClick={() => router.back()}
                  disabled={loading}
                  className="w-full"
                >
                  Voltar
                </Button>

                <p className="text-xs text-slate-500 text-center">
                  Seus dados estão seguros. Processado com segurança.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
