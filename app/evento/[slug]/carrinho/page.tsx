'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useCart, CartItem } from '@/store/cart'

interface CartItemWithEvent extends CartItem {
  eventName?: string
}

export default function CartPage() {
  const router = useRouter()
  const { items, removeItem, updateQuantity, updateParticipant, clear: clearCart } = useCart()

  const [couponCode, setCouponCode] = useState('')
  const [couponDiscount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [showParticipantForm, setShowParticipantForm] = useState<{
    [key: string]: boolean
  }>({})

  const money = (value: number) => {
    try {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0))
    } catch {
      return `R$ ${Number(value || 0).toFixed(2)}`
    }
  }

  const handleRemoveItem = (inscriptionTypeId: string) => {
    removeItem(inscriptionTypeId)
  }

  const handleUpdateQuantity = (inscriptionTypeId: string, quantity: number) => {
    updateQuantity(inscriptionTypeId, quantity)
  }

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return

    setLoading(true)
    try {
      // TODO: Implementar validação de cupom no backend
      // const response = await fetch('/api/coupons/validate', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ code: couponCode }),
      // })
      // const data = await response.json()
      // if (data.valid) {
      //   setCouponDiscount(data.percentage)
      // }

      alert('Validação de cupom ainda não implementada')
    } catch (error) {
      alert('Erro ao validar cupom')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const subtotal = items.reduce((sum, item) => sum + item.value * item.quantity, 0)
  const discount = (subtotal * couponDiscount) / 100
  const platformFee = (subtotal - discount) * 0.1
  const total = subtotal - discount + platformFee

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 py-12">
        <div className="max-w-4xl mx-auto px-4">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Carrinho</h1>
          <p className="text-slate-600 mb-8">Revise seus itens e preencha os participantes</p>
          <Card>
            <CardContent className="pt-12 text-center pb-12">
              <p className="text-slate-600 text-lg mb-6">Seu carrinho está vazio</p>
              <Button onClick={() => router.push('/')}>
                Continuar Comprando
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Carrinho</h1>
            <p className="text-slate-600 mt-1">Confira os itens e finalize o pagamento</p>
          </div>
          <Button variant="outline" onClick={() => router.push('/')}>Continuar comprando</Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            {(items as CartItemWithEvent[]).map((item, index) => (
              <Card key={`${item.inscriptionTypeId}-${index}`}>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    {/* Item Header */}
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-slate-900">{item.inscriptionTypeName}</h3>
                        <p className="text-sm text-slate-600">{item.eventName || 'Evento'}</p>
                      </div>
                      <button
                        onClick={() =>
                          handleRemoveItem(item.inscriptionTypeId)
                        }
                        className="text-red-600 hover:text-red-800 text-sm font-medium"
                      >
                        Remover
                      </button>
                    </div>

                    {/* Item Details */}
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                      <div className="flex justify-between items-center mb-4">
                        <span className="text-slate-700">Preço unitário</span>
                        <span className="font-semibold text-slate-900">{Number(item.value || 0) <= 0 ? 'Gratuito' : money(item.value)}</span>
                      </div>

                      {/* Quantity Selector */}
                      <div className="flex items-center justify-between">
                        <span className="text-slate-700">Quantidade</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              handleUpdateQuantity(
                                item.inscriptionTypeId,
                                Math.max(1, (item.quantity || 1) - 1)
                              )
                            }
                            className="h-9 w-10 rounded-md border border-input bg-white text-slate-700 hover:bg-slate-50"
                          >
                            −
                          </button>
                          <span className="w-12 text-center font-semibold">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() =>
                              handleUpdateQuantity(
                                item.inscriptionTypeId,
                                Math.min(50, (item.quantity || 1) + 1)
                              )
                            }
                            className="h-9 w-10 rounded-md border border-input bg-white text-slate-700 hover:bg-slate-50"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Subtotal */}
                      <div className="mt-4 pt-4 border-t flex justify-between items-center">
                        <span className="text-slate-900 font-semibold">Subtotal</span>
                        <span className="text-lg font-bold text-slate-900">{money(item.value * item.quantity)}</span>
                      </div>
                    </div>

                    {/* Participant Data Form */}
                    {showParticipantForm[item.inscriptionTypeId] && (
                      <div className="bg-white p-4 rounded-lg border border-slate-200 space-y-3">
                        <h4 className="font-semibold text-slate-900 mb-4">
                          Dados dos Participantes ({item.quantity})
                        </h4>
                        {item.participants.map((participant, pIdx) => (
                          <div key={pIdx} className="border-b pb-4 last:border-b-0">
                            <h5 className="text-sm font-medium text-slate-700 mb-2">
                              Participante {pIdx + 1}
                            </h5>
                            <div className="space-y-2">
                              <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">
                                  Nome Completo
                                </label>
                                <Input
                                  type="text"
                                  placeholder="João Silva"
                                  value={participant.fullName}
                                  className="w-full"
                                  onChange={(e) => updateParticipant(item.inscriptionTypeId, pIdx, { fullName: e.target.value })}
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">
                                  Email
                                </label>
                                <Input
                                  type="email"
                                  placeholder="joao@email.com"
                                  value={participant.email}
                                  className="w-full"
                                  onChange={(e) => updateParticipant(item.inscriptionTypeId, pIdx, { email: e.target.value })}
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">
                                  CPF
                                </label>
                                <Input
                                  type="text"
                                  placeholder="000.000.000-00"
                                  value={participant.cpf}
                                  className="w-full"
                                  onChange={(e) => updateParticipant(item.inscriptionTypeId, pIdx, { cpf: e.target.value })}
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">
                                  WhatsApp
                                </label>
                                <Input
                                  type="tel"
                                  placeholder="(11) 99999-9999"
                                  value={participant.whatsapp || ''}
                                  className="w-full"
                                  onChange={(e) => updateParticipant(item.inscriptionTypeId, pIdx, { whatsapp: e.target.value })}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Toggle Participant Form */}
                    <button
                      onClick={() =>
                        setShowParticipantForm((prev) => ({
                          ...prev,
                          [item.inscriptionTypeId]:
                            !prev[item.inscriptionTypeId],
                        }))
                      }
                      className="text-slate-900 hover:text-slate-950 text-sm font-medium"
                    >
                      {showParticipantForm[item.inscriptionTypeId]
                        ? 'Ocultar dados'
                        : 'Preencher dados dos participantes'}
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle>Resumo do Pedido</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Subtotal */}
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-700">Subtotal:</span>
                    <span>R$ {subtotal.toFixed(2)}</span>
                  </div>

                  {/* Coupon */}
                  <div>
                    <div className="flex gap-2 mb-2">
                      <Input
                        type="text"
                        placeholder="Código do cupom"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value)}
                        className="flex-1"
                        disabled={loading}
                      />
                      <Button
                        onClick={handleApplyCoupon}
                        variant="outline"
                        disabled={loading || !couponCode.trim()}
                        className="whitespace-nowrap"
                      >
                        {loading ? 'Validando...' : 'Aplicar'}
                      </Button>
                    </div>
                    {couponDiscount > 0 && (
                      <p className="text-sm text-green-600 font-medium">
                        Desconto: {couponDiscount}%
                      </p>
                    )}
                  </div>

                  {couponDiscount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Desconto:</span>
                      <span>-R$ {discount.toFixed(2)}</span>
                    </div>
                  )}

                  {/* Platform Fee */}
                  <div className="flex justify-between">
                    <span className="text-slate-700">Taxa de plataforma (10%):</span>
                    <span>{money(platformFee)}</span>
                  </div>

                  {/* Total */}
                  <div className="pt-3 border-t-2 border-gray-200">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-semibold">Total:</span>
                      <span className="text-2xl font-bold text-slate-900">{money(total)}</span>
                    </div>
                  </div>
                </div>

                {/* Checkout Button */}
                <Button
                  onClick={() => router.push('/checkout')}
                  className="w-full h-11 font-semibold"
                >
                  Ir para Pagamento
                </Button>

                <Button
                  variant="outline"
                  onClick={() => router.push('/')}
                  className="w-full"
                >
                  Continuar Comprando
                </Button>

                <button
                  onClick={() => clearCart()}
                  className="w-full text-red-600 hover:text-red-800 text-sm font-medium py-2"
                >
                  Limpar Carrinho
                </button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
