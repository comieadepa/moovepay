'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useCart, CartItem } from '@/store/cart'
import { Badge } from '@/components/ui/badge'

interface InscriptionType {
  id: string
  name: string
  description: string
  value: number
  available?: number
  current: number
}

interface EventCreator {
  id: string
  name: string
  email: string
}

interface Event {
  id: string
  name: string
  description: string
  shortDescription: string
  bannerUrl: string
  startDate: string
  endDate: string
  location: string
  eventFormat: string
  creatorId: string
  creator: EventCreator
  inscriptionTypes: InscriptionType[]
  totalRegistrations: number
}

export default function EventPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string
  const cart = useCart()

  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/eventos/${slug}`)

        if (!response.ok) {
          if (response.status === 404) {
            setError('Evento não encontrado')
          } else {
            setError('Erro ao carregar evento')
          }
          return
        }

        const data = await response.json()
        setEvent(data.data)
        
        // Select first inscription type by default
        if (data.data.inscriptionTypes.length > 0) {
          setSelectedType(data.data.inscriptionTypes[0].id)
        }
      } catch (err) {
        setError('Erro ao conectar ao servidor')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    if (slug) {
      fetchEvent()
    }
  }, [slug])

  const handleAddToCart = () => {
    if (!event || !selectedType) return

    const type = event.inscriptionTypes.find((t) => t.id === selectedType)
    if (!type) return

    // Check availability
    if (type.available && type.current >= type.available) {
      alert('Este tipo de inscrição está cheio')
      return
    }

    // Create cart item based on inscription type
    const cartItem: CartItem = {
      eventId: event.id,
      eventName: event.name,
      inscriptionTypeId: type.id,
      inscriptionTypeName: type.name,
      value: type.value || 0,
      quantity: quantity,
      participants: [], // Empty array that user will fill
    }

    // Add to cart
    cart.addItem(cartItem)
    router.push(`/evento/${slug}/carrinho`)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando evento...</p>
        </div>
      </div>
    )
  }

  if (error || !event) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">{error || 'Evento não encontrado'}</h1>
          <Button onClick={() => router.push('/')}>Voltar para Home</Button>
        </div>
      </div>
    )
  }

  const startDate = new Date(event.startDate)
  const endDate = new Date(event.endDate)

  const money = (value: number) => {
    try {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0))
    } catch {
      return `R$ ${Number(value || 0).toFixed(2)}`
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="relative">
        {event.bannerUrl ? (
          <div className="h-80 bg-slate-200 overflow-hidden">
            <img src={event.bannerUrl} alt={event.name} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="h-48 bg-gradient-to-r from-slate-900 to-slate-700" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0">
          <div className="max-w-6xl mx-auto px-4 pb-10">
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="bg-white/10 text-white border-white/20">Evento</Badge>
                <Badge variant="outline" className="bg-white/10 text-white border-white/20">
                  {format(startDate, "dd 'de' MMMM", { locale: ptBR })} • {format(startDate, 'HH:mm', { locale: ptBR })}
                </Badge>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-white">{event.name}</h1>
              {event.shortDescription ? (
                <p className="text-white/80 max-w-3xl">{event.shortDescription}</p>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Event Details */}
          <div className="lg:col-span-2">
            {/* Event Info Cards */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-slate-500 mb-2">Início</p>
                  <p className="font-semibold">
                    {format(startDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </p>
                  <p className="text-sm text-slate-600">{format(startDate, 'HH:mm', { locale: ptBR })}</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-slate-500 mb-2">Término</p>
                  <p className="font-semibold">
                    {format(endDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </p>
                  <p className="text-sm text-slate-600">{format(endDate, 'HH:mm', { locale: ptBR })}</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-slate-500 mb-2">Local</p>
                  <p className="font-semibold">{event.location}</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-slate-500 mb-2">Formato</p>
                  <p className="font-semibold capitalize">{event.eventFormat}</p>
                </CardContent>
              </Card>
            </div>

            {/* Description */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Sobre o evento</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-700 whitespace-pre-wrap">{event.description}</p>
              </CardContent>
            </Card>

            {/* Organizer */}
            <Card>
              <CardHeader>
                <CardTitle>Organizador</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-semibold text-slate-900">{event.creator.name}</p>
                <p className="text-slate-600">{event.creator.email}</p>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - Registration */}
          <div className="lg:col-span-1">
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle>Inscrições</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Inscription Types */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-3">
                      Tipo de Inscrição
                    </label>
                    <div className="space-y-2">
                      {event.inscriptionTypes.map((type) => {
                        const isFull = type.available && type.current >= type.available
                        const spotsLeft = type.available ? type.available - type.current : null
                        const isFree = Number(type.value || 0) <= 0

                        return (
                          <div
                            key={type.id}
                            onClick={() => !isFull && setSelectedType(type.id)}
                            className={`p-4 border rounded-lg cursor-pointer transition ${
                              selectedType === type.id
                                ? 'border-slate-900 bg-slate-50'
                                : 'border-slate-200 hover:border-slate-300'
                            } ${isFull ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <p className="font-semibold text-slate-900">{type.name}</p>
                                {type.description && (
                                  <p className="text-xs text-slate-600 mt-1">{type.description}</p>
                                )}
                              </div>
                              {isFull ? (
                                <Badge variant="destructive">Completo</Badge>
                              ) : spotsLeft !== null ? (
                                <Badge variant="warning">{spotsLeft} vagas</Badge>
                              ) : (
                                <Badge variant="success">Disponível</Badge>
                              )}
                            </div>
                            <p className={isFree ? 'text-lg font-bold text-emerald-700' : 'text-lg font-bold text-slate-900'}>
                              {isFree ? 'Gratuito' : money(Number(type.value || 0))}
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Quantity */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Quantidade
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        className="h-10 w-10 rounded-md border border-input bg-white text-slate-700 hover:bg-slate-50"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        value={quantity}
                        onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                        className="flex-1 px-3 py-2 border border-input rounded-md text-center h-10 bg-white"
                        min="1"
                      />
                      <button
                        onClick={() => setQuantity(quantity + 1)}
                        className="h-10 w-10 rounded-md border border-input bg-white text-slate-700 hover:bg-slate-50"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Registration Count */}
                  <div className="pt-4 border-t">
                    <p className="text-sm text-slate-600">
                      {event.totalRegistrations} inscrições até agora
                    </p>
                  </div>

                  {/* Add to Cart Button */}
                  <Button
                    onClick={handleAddToCart}
                    disabled={!selectedType}
                    className="w-full h-11 font-semibold"
                  >
                    Adicionar ao Carrinho
                  </Button>

                  {/* Continue Shopping Link */}
                  <Button
                    variant="outline"
                    onClick={() => router.push('/')}
                    className="w-full"
                  >
                    Voltar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
