'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

function ConfirmacaoPageContent() {
  const router = useRouter()
  const [registrations, setRegistrations] = useState('0')
  const [total, setTotal] = useState<string | null>(null)
  const [method, setMethod] = useState<string | null>(null)

  useEffect(() => {
    // Get query params from window.location
    const params = new URLSearchParams(window.location.search)
    const reg = params.get('registrations') || '0'
    setRegistrations(reg)

    const t = params.get('total')
    const m = params.get('method')
    setTotal(t)
    setMethod(m)
  }, [])

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
    return m
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12">
      <div className="max-w-2xl mx-auto px-4">
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="pt-12 text-center pb-12">
            {/* Success Icon */}
            <div className="mb-6 flex justify-center">
              <div className="w-16 h-16 bg-emerald-600 rounded-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
            </div>

            <h1 className="text-3xl font-bold text-slate-900 mb-3">Inscrição confirmada</h1>

            <p className="text-slate-700 text-lg mb-6">
              {registrations} inscrição{parseInt(registrations) !== 1 ? 's' : ''} foi{parseInt(registrations) !== 1 ? 'ram' : ''} confirmada{parseInt(registrations) !== 1 ? 's' : ''}.
            </p>

            {(total || method) && (
              <Card className="mb-6 bg-white">
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

            <Card className="mb-8 bg-white">
              <CardContent className="pt-6">
                <div className="space-y-4 text-left">
                  <div>
                    <h3 className="font-semibold text-slate-900 mb-2">Próximas etapas</h3>
                    <ul className="space-y-2 text-slate-700">
                      <li className="flex gap-3">
                        <span className="font-bold text-emerald-700">1.</span>
                        <span>Você receberá um email com os detalhes da sua inscrição</span>
                      </li>
                      <li className="flex gap-3">
                        <span className="font-bold text-emerald-700">2.</span>
                        <span>Seu comprovante de pagamento será enviado por email</span>
                      </li>
                      <li className="flex gap-3">
                        <span className="font-bold text-emerald-700">3.</span>
                        <span>Você receberá um voucher/QR code para check-in no evento</span>
                      </li>
                      <li className="flex gap-3">
                        <span className="font-bold text-emerald-700">4.</span>
                        <span>Compareça no local, na data e hora especificados</span>
                      </li>
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
                className="w-full"
              >
                Imprimir Confirmação
              </Button>
            </div>

            <p className="text-sm text-slate-600 mt-6">
              Obrigado por escolher a MoovePay para suas inscrições!
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function ConfirmacaoPage() {
  return <ConfirmacaoPageContent />
}
