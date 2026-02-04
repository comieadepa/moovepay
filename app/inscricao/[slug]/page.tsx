'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useFieldArray } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'

type CustomField = {
  key: string
  label: string
  type: 'text' | 'textarea' | 'number' | 'date' | 'select' | 'checkbox'
  required?: boolean
  placeholder?: string
  options?: string[]
}

type InscriptionType = {
  id: string
  name: string
  value: number
  available?: number | null
  current?: number | null
}

type PublicEvent = {
  id: string
  name: string
  description?: string | null
  bannerUrl?: string
  customFields?: CustomField[]
  inscriptionTypes: InscriptionType[]
}

const participantSchema = z.object({
  fullName: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  cpf: z.string().regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, 'CPF inválido (use 000.000.000-00)'),
  email: z.string().email('Email inválido'),
  whatsapp: z.string().optional(),
  customData: z.record(z.any()).optional(),
})

const registrationFormSchema = z.object({
  inscriptionTypeId: z.string().min(1, 'Selecione um tipo de inscrição'),
  quantity: z.coerce.number().int().min(1).max(50).default(1),
  participants: z.array(participantSchema).min(1),
}).superRefine((val, ctx) => {
  if (val.participants.length !== val.quantity) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Quantidade não confere com participantes', path: ['participants'] })
  }
})

type RegistrationForm = z.infer<typeof registrationFormSchema>

export default function InscricaoEventoPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string

  const [event, setEvent] = useState<PublicEvent | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ registrationIds: string[]; cartId?: string; totalValue: number } | null>(null)

  const customFields = useMemo(() => {
    const raw = (event as any)?.customFields
    return Array.isArray(raw) ? (raw as CustomField[]) : []
  }, [event])

  const form = useForm<RegistrationForm>({
    resolver: zodResolver(registrationFormSchema),
    defaultValues: {
      inscriptionTypeId: '',
      quantity: 1,
      participants: [
        {
          fullName: '',
          cpf: '',
          email: '',
          whatsapp: '',
          customData: {},
        },
      ],
    },
  })

  const { fields: participantFields, replace } = useFieldArray({
    control: form.control,
    name: 'participants',
  })

  const quantity = form.watch('quantity')
  const inscriptionTypeId = form.watch('inscriptionTypeId')
  const selectedType = useMemo(() => event?.inscriptionTypes?.find((t) => t.id === inscriptionTypeId), [event, inscriptionTypeId])
  const totalValue = useMemo(() => Number(selectedType?.value || 0) * Number(quantity || 1), [selectedType?.value, quantity])

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        setIsLoading(true)
        setError(null)
        const res = await fetch(`/api/eventos/${slug}`)
        const json = await res.json()
        if (!res.ok) throw new Error(json?.error || 'Erro ao carregar evento')

        if (cancelled) return
        const ev = json?.data as PublicEvent
        setEvent(ev)
        const firstType = ev?.inscriptionTypes?.[0]?.id
        if (firstType) form.setValue('inscriptionTypeId', firstType)
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Erro ao carregar evento')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    if (slug) load()
    return () => {
      cancelled = true
    }
  }, [slug, form])

  useEffect(() => {
    // Mantém o array de participantes sincronizado com a quantidade
    const desired = Math.max(1, Math.min(50, Number(quantity || 1)))
    const current = participantFields.length
    if (current === desired) return

    const next = Array.from({ length: desired }).map((_, idx) => {
      const existing = (form.getValues(`participants.${idx}` as any) as any) || participantFields[idx]
      return {
        fullName: existing?.fullName || '',
        cpf: existing?.cpf || '',
        email: existing?.email || '',
        whatsapp: existing?.whatsapp || '',
        customData: existing?.customData || {},
      }
    })

    replace(next as any)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quantity])

  function validateCustomRequired(participants: any[]) {
    for (const [idx, p] of participants.entries()) {
      for (const f of customFields) {
        if (!f?.required) continue
        const val = p?.customData?.[f.key]
        const empty = val === undefined || val === null || val === '' || (f.type === 'checkbox' && val !== true)
        if (empty) {
          throw new Error(`Participante ${idx + 1}: preencha o campo obrigatório: ${f.label}`)
        }
      }
    }
  }

  async function onSubmit(values: RegistrationForm) {
    try {
      if (!event) return
      setIsSubmitting(true)
      setError(null)
      setSuccess(null)

      validateCustomRequired(values.participants)

      const res = await fetch('/api/registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: event.id,
          inscriptionTypeId: values.inscriptionTypeId,
          quantity: values.quantity,
          participants: values.participants,
        }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Erro ao enviar inscrição')

      const ids = Array.isArray(json?.registrations) ? json.registrations.map((r: any) => r.id) : [json?.registration?.id].filter(Boolean)
      setSuccess({
        registrationIds: ids,
        cartId: json?.cartId,
        totalValue: Number(json?.totalValue || 0),
      })
    } catch (e: any) {
      setError(e?.message || 'Erro ao enviar inscrição')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-600">Carregando...</div>
      </div>
    )
  }

  if (error && !event) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>Evento indisponível</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">{error}</div>
            <Button onClick={() => router.push('/')}>Voltar</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!event) return null

  const money = (value: number) => {
    try {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0))
    } catch {
      return `R$ ${Number(value || 0).toFixed(2)}`
    }
  }

  const isFree = Number(selectedType?.value || 0) <= 0

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="relative">
        {event.bannerUrl ? (
          <div className="h-72 bg-slate-200 overflow-hidden">
            <img src={event.bannerUrl} alt={event.name} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="h-40 bg-gradient-to-r from-slate-900 to-slate-700" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0">
          <div className="max-w-6xl mx-auto px-4 pb-8">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-white/10 text-white border-white/20">Inscrição</Badge>
                {isFree ? (
                  <Badge variant="success" className="bg-emerald-500/15 text-emerald-50 border-emerald-200/20">Evento gratuito</Badge>
                ) : selectedType ? (
                  <Badge variant="outline" className="bg-white/10 text-white border-white/20">{money(Number(selectedType.value || 0))}</Badge>
                ) : null}
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-white">{event.name}</h1>
              {event.description ? (
                <p className="text-white/80 max-w-3xl">{event.description}</p>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-10">

        {success ? (
          <Card>
            <CardHeader>
              <CardTitle>Inscrição recebida</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-slate-700 text-sm">Inscrições: <span className="font-mono">{success.registrationIds.length}</span></div>
              {success.cartId ? (
                <div className="text-slate-700 text-sm">Lote: <span className="font-mono">{success.cartId}</span></div>
              ) : null}
              <div className="text-slate-700 text-sm">Total do lote: <span className="font-semibold">R$ {Number(success.totalValue || 0).toFixed(2)}</span></div>
              <div className="text-slate-600 text-sm">Próximo passo: pagamento via ASAAS (vamos integrar em seguida).</div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => router.push(`/evento/${slug}`)}>Ver página do evento</Button>
                <Button onClick={() => { setSuccess(null); form.reset(); }}>Nova inscrição</Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Dados da inscrição</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {error && (
                      <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">{error}</div>
                    )}

                    <div className="grid gap-4 md:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="inscriptionTypeId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tipo de inscrição</FormLabel>
                            <FormControl>
                              <Select {...field}>
                                {event.inscriptionTypes.map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.name} — {money(Number(t.value || 0))}
                                  </option>
                                ))}
                              </Select>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="quantity"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Quantidade</FormLabel>
                            <FormControl>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  className="h-10 w-10 rounded-md border border-input bg-white text-slate-700 hover:bg-slate-50"
                                  onClick={() => field.onChange(Math.max(1, Number(field.value || 1) - 1))}
                                  aria-label="Diminuir"
                                >
                                  −
                                </button>
                                <Input
                                  type="number"
                                  min={1}
                                  max={50}
                                  className="w-24 text-center"
                                  value={field.value as any}
                                  onChange={(e) => field.onChange(Number(e.target.value || 1))}
                                />
                                <button
                                  type="button"
                                  className="h-10 w-10 rounded-md border border-input bg-white text-slate-700 hover:bg-slate-50"
                                  onClick={() => field.onChange(Math.min(50, Number(field.value || 1) + 1))}
                                  aria-label="Aumentar"
                                >
                                  +
                                </button>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Participantes</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {participantFields.map((p, idx) => (
                      <div key={p.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <div className="text-sm font-semibold text-slate-900">Participante {idx + 1}</div>
                          <Badge variant="outline" className="text-slate-600">#{idx + 1}</Badge>
                        </div>

                          <FormField
                            control={form.control}
                            name={`participants.${idx}.fullName` as any}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Nome completo</FormLabel>
                                <FormControl>
                                  <Input placeholder="Seu nome" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <div className="grid gap-3 md:grid-cols-2 mt-3">
                            <FormField
                              control={form.control}
                              name={`participants.${idx}.email` as any}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Email</FormLabel>
                                  <FormControl>
                                    <Input type="email" placeholder="voce@email.com" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name={`participants.${idx}.cpf` as any}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>CPF</FormLabel>
                                  <FormControl>
                                    <Input placeholder="000.000.000-00" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <FormField
                            control={form.control}
                            name={`participants.${idx}.whatsapp` as any}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>WhatsApp (opcional)</FormLabel>
                                <FormControl>
                                  <Input placeholder="(11) 99999-9999" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          {customFields.length > 0 && (
                            <div className="pt-3">
                              <div className="text-sm font-semibold text-slate-900 mb-2">Informações adicionais</div>
                              <div className="space-y-3">
                                {customFields.map((f) => {
                                  const baseName = `participants.${idx}.customData` as any
                                  const current = (form.getValues(baseName) as any) || {}
                                  const setField = (value: any) => {
                                    form.setValue(baseName, { ...current, [f.key]: value }, { shouldDirty: true })
                                  }

                                  return (
                                    <div key={f.key}>
                                      <label className="text-sm font-medium text-slate-700">
                                        {f.label}{f.required ? ' *' : ''}
                                      </label>

                                      {f.type === 'textarea' ? (
                                        <Textarea
                                          className="h-24"
                                          placeholder={f.placeholder || ''}
                                          value={current?.[f.key] ?? ''}
                                          onChange={(e) => setField(e.target.value)}
                                        />
                                      ) : f.type === 'select' ? (
                                        <Select
                                          value={current?.[f.key] ?? ''}
                                          onChange={(e) => setField(e.target.value)}
                                        >
                                          <option value="">Selecione...</option>
                                          {(f.options || []).map((opt) => (
                                            <option key={opt} value={opt}>{opt}</option>
                                          ))}
                                        </Select>
                                      ) : f.type === 'checkbox' ? (
                                        <label className="flex items-center gap-2 mt-2 text-sm text-slate-700">
                                          <input
                                            type="checkbox"
                                            checked={Boolean(current?.[f.key])}
                                            onChange={(e) => setField(e.target.checked)}
                                          />
                                          {f.placeholder || 'Marcar'}
                                        </label>
                                      ) : (
                                        <Input
                                          type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                                          placeholder={f.placeholder || ''}
                                          value={current?.[f.key] ?? ''}
                                          onChange={(e) => setField(e.target.value)}
                                        />
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              <div className="lg:col-span-1">
                <div className="lg:sticky lg:top-6 space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Resumo</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600">Tipo</span>
                        <span className="font-medium text-slate-900">{selectedType?.name || '—'}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600">Valor unitário</span>
                        <span className={isFree ? 'font-semibold text-emerald-700' : 'font-medium text-slate-900'}>
                          {isFree ? 'Gratuito' : money(Number(selectedType?.value || 0))}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600">Quantidade</span>
                        <span className="font-medium text-slate-900">{Number(quantity || 1)}</span>
                      </div>
                      <div className="h-px bg-slate-200" />
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-900">Total do lote</span>
                        <span className="text-lg font-bold text-slate-900">{money(totalValue)}</span>
                      </div>

                      <Button type="submit" className="w-full" disabled={isSubmitting}>
                        {isSubmitting ? 'Enviando...' : 'Confirmar inscrição'}
                      </Button>

                      <div className="text-xs text-slate-500">
                        Ao continuar, você concorda em fornecer os dados para emissão de pagamento (ASAAS) e comunicação do evento.
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </form>
          </Form>
        )}
      </div>
    </div>
  )
}
