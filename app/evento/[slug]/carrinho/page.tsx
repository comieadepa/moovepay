'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useCart, CartItem } from '@/store/cart'

interface CartItemWithEvent extends CartItem {
  eventName?: string
}

// ── Máscaras ──────────────────────────────────────────────────────────────────
function maskCpf(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

function maskPhone(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d.length ? `(${d}` : ''
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

// ── Validações ────────────────────────────────────────────────────────────────
function validarCpf(cpf: string): boolean {
  const d = cpf.replace(/\D/g, '')
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false
  let sum = 0
  for (let i = 0; i < 9; i++) sum += parseInt(d[i]) * (10 - i)
  let r = (sum * 10) % 11
  if (r >= 10) r = 0
  if (r !== parseInt(d[9])) return false
  sum = 0
  for (let i = 0; i < 10; i++) sum += parseInt(d[i]) * (11 - i)
  r = (sum * 10) % 11
  if (r >= 10) r = 0
  return r === parseInt(d[10])
}

function validarEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

function validarNome(nome: string): boolean {
  const partes = nome.trim().split(/\s+/)
  return partes.length >= 2 && partes.every((p) => p.length >= 2)
}

function validarPhone(phone: string): boolean {
  const d = phone.replace(/\D/g, '')
  return d.length >= 10 && d.length <= 11
}

export default function CartPage() {
  const router = useRouter()
  const { items, removeItem, updateQuantity, updateParticipant, clear: clearCart } = useCart()

  const [couponCode, setCouponCode] = useState('')
  const [couponDiscount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  const money = (value: number) => {
    try {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0))
    } catch {
      return `R$ ${Number(value || 0).toFixed(2)}`
    }
  }

  const subtotal = items.reduce((sum, item) => sum + item.value * item.quantity, 0)
  const discount = (subtotal * couponDiscount) / 100
  const platformFee = (subtotal - discount) * 0.1
  const total = subtotal - discount + platformFee

  const participantsValid = useMemo(() => {
    for (const item of items) {
      for (const p of item.participants) {
        if (!validarNome(p.fullName ?? '')) return false
        if (!validarEmail(p.email ?? '')) return false
        if (!validarCpf(p.cpf ?? '')) return false
        if (p.whatsapp?.trim() && !validarPhone(p.whatsapp)) return false
      }
    }
    return true
  }, [items])

  const handleCheckout = () => {
    if (!participantsValid) {
      setValidationError('Preencha nome, email e CPF de todos os participantes antes de continuar.')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    setValidationError(null)
    router.push('/checkout')
  }

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return
    setLoading(true)
    try {
      alert('Validacao de cupom ainda nao implementada')
    } catch (error) {
      alert('Erro ao validar cupom')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 py-12">
        <div className="max-w-4xl mx-auto px-4">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Carrinho</h1>
          <p className="text-slate-600 mb-8">Revise seus itens e preencha os participantes</p>
          <Card>
            <CardContent className="pt-12 text-center pb-12">
              <p className="text-slate-600 text-lg mb-6">Seu carrinho esta vazio</p>
              <Button onClick={() => router.push('/')}>Continuar Comprando</Button>
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
            <p className="text-slate-600 mt-1">Preencha os dados dos participantes e finalize o pedido</p>
          </div>
          <Button variant="outline" onClick={() => router.back()}>Voltar</Button>
        </div>

        {validationError && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl text-red-700 text-sm font-medium">
            {validationError}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {(items as CartItemWithEvent[]).map((item, index) => (
              <Card key={`${item.inscriptionTypeId}-${index}`}>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-base">{item.inscriptionTypeName}</CardTitle>
                      <p className="text-sm text-slate-500 mt-0.5">{item.eventName || 'Evento'}</p>
                    </div>
                    <button
                      onClick={() => removeItem(item.inscriptionTypeId)}
                      className="text-red-500 hover:text-red-700 text-xs font-medium"
                    >
                      Remover
                    </button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="flex items-center justify-between bg-slate-50 rounded-xl p-4 border border-slate-200">
                    <div>
                      <p className="text-xs text-slate-500 mb-0.5">Preco unitario</p>
                      <p className="font-semibold text-slate-900">
                        {Number(item.value || 0) <= 0 ? 'Gratuito' : money(item.value)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(item.inscriptionTypeId, Math.max(1, item.quantity - 1))}
                        className="h-9 w-9 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-bold"
                      >-</button>
                      <span className="w-10 text-center font-semibold text-slate-900">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.inscriptionTypeId, Math.min(50, item.quantity + 1))}
                        className="h-9 w-9 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-bold"
                      >+</button>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500 mb-0.5">Subtotal</p>
                      <p className="font-bold text-slate-900">{money(item.value * item.quantity)}</p>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-slate-800 mb-3">
                      Dados dos participantes
                      <span className="ml-2 text-xs font-normal text-slate-400">({item.quantity} participante{item.quantity !== 1 ? 's' : ''})</span>
                    </h4>
                    <div className="space-y-4">
                      {item.participants.map((participant, pIdx) => {
                        const missing = !participant.fullName?.trim() || !participant.email?.trim() || !participant.cpf?.trim()
                        return (
                          <div key={pIdx} className={`rounded-xl border p-4 space-y-3 ${missing && validationError ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'}`}>
                            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                              Participante {pIdx + 1}
                              {missing && validationError && <span className="ml-2 text-red-500 normal-case font-normal">dados incompletos</span>}
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {/* Nome completo */}
                              <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Nome completo *</label>
                                <Input
                                  placeholder="João Silva"
                                  value={participant.fullName}
                                  className={validationError && !validarNome(participant.fullName ?? '') ? 'border-red-400 focus-visible:ring-red-400' : ''}
                                  onChange={(e) => updateParticipant(item.inscriptionTypeId, pIdx, { fullName: e.target.value })}
                                />
                                {validationError && !validarNome(participant.fullName ?? '') && (
                                  <p className="text-xs text-red-500 mt-1">
                                    {!participant.fullName?.trim() ? 'Campo obrigatório' : 'Informe nome e sobrenome'}
                                  </p>
                                )}
                              </div>
                              {/* Email */}
                              <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Email *</label>
                                <Input
                                  type="email"
                                  placeholder="joao@email.com"
                                  value={participant.email}
                                  className={validationError && !validarEmail(participant.email ?? '') ? 'border-red-400 focus-visible:ring-red-400' : ''}
                                  onChange={(e) => updateParticipant(item.inscriptionTypeId, pIdx, { email: e.target.value })}
                                />
                                {validationError && !validarEmail(participant.email ?? '') && (
                                  <p className="text-xs text-red-500 mt-1">
                                    {!participant.email?.trim() ? 'Campo obrigatório' : 'Email inválido'}
                                  </p>
                                )}
                              </div>
                              {/* CPF com máscara */}
                              <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">CPF *</label>
                                <Input
                                  placeholder="000.000.000-00"
                                  inputMode="numeric"
                                  value={participant.cpf}
                                  className={validationError && !validarCpf(participant.cpf ?? '') ? 'border-red-400 focus-visible:ring-red-400' : ''}
                                  onChange={(e) => updateParticipant(item.inscriptionTypeId, pIdx, { cpf: maskCpf(e.target.value) })}
                                />
                                {validationError && !validarCpf(participant.cpf ?? '') && (
                                  <p className="text-xs text-red-500 mt-1">
                                    {!participant.cpf?.trim() ? 'Campo obrigatório' : 'CPF inválido'}
                                  </p>
                                )}
                              </div>
                              {/* WhatsApp com máscara */}
                              <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">WhatsApp</label>
                                <Input
                                  type="tel"
                                  placeholder="(11) 99999-9999"
                                  inputMode="numeric"
                                  value={participant.whatsapp || ''}
                                  className={validationError && participant.whatsapp?.trim() && !validarPhone(participant.whatsapp) ? 'border-red-400 focus-visible:ring-red-400' : ''}
                                  onChange={(e) => updateParticipant(item.inscriptionTypeId, pIdx, { whatsapp: maskPhone(e.target.value) })}
                                />
                                {validationError && participant.whatsapp?.trim() && !validarPhone(participant.whatsapp) && (
                                  <p className="text-xs text-red-500 mt-1">Número inválido</p>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="lg:col-span-1">
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle>Resumo do Pedido</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  {items.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="text-slate-600">{item.quantity}x {item.inscriptionTypeName}</span>
                      <span className="text-slate-900">{money(item.value * item.quantity)}</span>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Input
                    placeholder="Codigo do cupom"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    className="flex-1"
                    disabled={loading}
                  />
                  <Button
                    onClick={handleApplyCoupon}
                    variant="outline"
                    disabled={loading || !couponCode.trim()}
                  >
                    {loading ? '...' : 'Aplicar'}
                  </Button>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Subtotal:</span>
                    <span>{money(subtotal)}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-sm text-emerald-600">
                      <span>Desconto:</span>
                      <span>- {money(discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Taxa ({subtotal > 0 ? '10%' : 'gratuito'}):</span>
                    <span>{money(platformFee)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                    <span className="text-lg font-semibold text-slate-900">Total:</span>
                    <span className="text-2xl font-bold text-emerald-700">{money(total)}</span>
                  </div>
                </div>

                {!participantsValid && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    Preencha os dados de todos os participantes para continuar.
                  </p>
                )}

                <Button
                  onClick={handleCheckout}
                  className="w-full h-11 font-semibold bg-emerald-600 hover:bg-emerald-700"
                >
                  {total === 0 ? 'Confirmar Inscricao Gratuita' : 'Ir para Pagamento'}
                </Button>

                <button
                  onClick={() => clearCart()}
                  className="w-full text-red-500 hover:text-red-700 text-sm font-medium py-1"
                >
                  Limpar carrinho
                </button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}