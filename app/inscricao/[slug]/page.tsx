'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useFieldArray } from 'react-hook-form'

import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { useCart } from '@/store/cart'

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
  const { addItem, clear: clearCart } = useCart()

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

  // Redireciona automaticamente após inscrição bem-sucedida
  useEffect(() => {
    if (!success || !event) return

    if (success.totalValue === 0) {
      // Gratuito: vai direto para confirmação
      const qs = new URLSearchParams({
        registrations: String(success.registrationIds.length),
        total: '0.00',
        method: 'free',
      })
      router.push(`/confirmacao?${qs.toString()}`)
    } else {
      // Pago: popula carrinho e vai para checkout
      clearCart()
      const values = form.getValues()
      const type = event.inscriptionTypes.find((t) => t.id === values.inscriptionTypeId)
      if (type) {
        addItem({
          eventId: event.id,
          eventName: event.name,
          inscriptionTypeId: type.id,
          inscriptionTypeName: type.name,
          value: type.value,
          quantity: values.quantity,
          participants: values.participants.map((p) => ({
            fullName: p.fullName,
            cpf: p.cpf,
            email: p.email,
            whatsapp: p.whatsapp || '',
          })),
        })
      }
      router.push('/checkout')
    }
  }, [success, router, event, form, addItem, clearCart])

  // ── Helpers ──────────────────────────────────────────────────────────────
  const money = (value: number) => {
    try {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0))
    } catch {
      return `R$ ${Number(value || 0).toFixed(2)}`
    }
  }

  function maskCpf(v: string) {
    const d = v.replace(/\D/g, '').slice(0, 11)
    if (d.length <= 3) return d
    if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
    if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
  }

  function maskPhone(v: string) {
    const d = v.replace(/\D/g, '').slice(0, 11)
    if (d.length <= 2) return d.length ? `(${d}` : ''
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">Carregando evento...</p>
        </div>
      </div>
    )
  }

  if (error && !event) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-bold text-slate-900">Evento indisponível</h2>
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-sm font-semibold"
          >
            Voltar ao início
          </button>
        </div>
      </div>
    )
  }

  if (!event) return null

  const isFree = Number(selectedType?.value || 0) <= 0

  // ── Step indicator ────────────────────────────────────────────────────────
  const steps = [
    { label: 'DADOS', num: '1' },
    { label: 'PAGAMENTO', num: '2' },
    { label: 'CONFIRMADO', icon: true },
  ]
  const currentStep = success ? 2 : 0

  // ── Success redirect ──────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm p-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900">Inscrição registrada!</h2>
          <p className="text-sm text-slate-500">Redirecionando para o pagamento...</p>
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Banner */}
      {event.bannerUrl ? (
        <div className="w-full max-h-56 overflow-hidden">
          <img src={event.bannerUrl} alt={event.name} className="w-full object-cover" />
        </div>
      ) : (
        <div className="h-32 bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900" />
      )}

      {/* Title bar */}
      <div className="bg-blue-800 px-4 py-4">
        <div className="max-w-lg mx-auto">
          <h1 className="text-white font-bold text-lg leading-tight">
            {event.name} — Inscrições
          </h1>
          <p className="text-blue-200 text-sm mt-0.5">
            {isFree
              ? 'Inscrição gratuita — garanta sua vaga!'
              : 'Complete o pagamento e garanta sua vaga no evento!'}
          </p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* Step indicator */}
        <div className="bg-white rounded-2xl px-6 py-4 shadow-sm">
          <div className="flex items-center justify-between">
            {steps.map((step, i) => (
              <div key={i} className="flex items-center flex-1">
                <div className="flex flex-col items-center gap-1 flex-shrink-0">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors ${
                      i === currentStep
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : i < currentStep
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-white border-slate-300 text-slate-400'
                    }`}
                  >
                    {step.icon ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      step.num
                    )}
                  </div>
                  <span
                    className={`text-[10px] font-semibold tracking-wide ${
                      i <= currentStep ? 'text-blue-600' : 'text-slate-400'
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-2 mb-4 ${
                      i < currentStep ? 'bg-blue-600' : 'bg-slate-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Como funciona */}
        <div className="bg-amber-50 border-l-4 border-amber-400 rounded-xl p-4">
          <p className="text-amber-800 font-semibold text-sm flex items-center gap-2 mb-1">
            <span>📋</span> Como funciona
          </p>
          <p className="text-amber-700 text-sm leading-relaxed">
            Preencha seus dados abaixo, clique em{' '}
            <em className="font-semibold">&quot;Ir para o Pagamento&quot;</em>
            {isFree
              ? ' e sua inscrição será confirmada automaticamente!'
              : ', complete o PIX/cartão e você voltará automaticamente com a inscrição liberada!'}
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Form */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Tipo de inscrição */}
            {event.inscriptionTypes.length > 1 && (
              <div className="bg-white rounded-2xl shadow-sm p-4 space-y-1">
                <FormField
                  control={form.control}
                  name="inscriptionTypeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold text-slate-700">Tipo de inscrição *</FormLabel>
                      <FormControl>
                        <Select
                          {...field}
                          className="h-12 rounded-xl border-slate-200 text-slate-800"
                        >
                          {event.inscriptionTypes.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name} — {Number(t.value) <= 0 ? 'Gratuito' : money(Number(t.value || 0))}
                            </option>
                          ))}
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* Participantes */}
            {participantFields.map((p, idx) => (
              <div key={p.id} className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
                {participantFields.length > 1 && (
                  <div className="flex items-center gap-2 pb-1 border-b border-slate-100">
                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                      {idx + 1}
                    </div>
                    <span className="text-sm font-semibold text-slate-700">Participante {idx + 1}</span>
                  </div>
                )}

                {/* Nome */}
                <FormField
                  control={form.control}
                  name={`participants.${idx}.fullName` as any}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold text-slate-700">Nome completo *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Seu nome completo"
                          className="h-12 rounded-xl border-slate-200"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Telefone + Email */}
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name={`participants.${idx}.whatsapp` as any}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold text-slate-700">Telefone</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="(91) 99999-9999"
                            inputMode="numeric"
                            className="h-12 rounded-xl border-slate-200"
                            value={field.value as string}
                            onChange={(e) => field.onChange(maskPhone(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`participants.${idx}.email` as any}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold text-slate-700">Email *</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="voce@email.com"
                            className="h-12 rounded-xl border-slate-200"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* CPF */}
                <FormField
                  control={form.control}
                  name={`participants.${idx}.cpf` as any}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold text-slate-700">CPF *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="000.000.000-00"
                          inputMode="numeric"
                          className="h-12 rounded-xl border-slate-200"
                          value={field.value as string}
                          onChange={(e) => field.onChange(maskCpf(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Campos personalizados */}
                {customFields.length > 0 && (
                  <div className="space-y-4 pt-2">
                    {customFields.map((f) => {
                      const baseName = `participants.${idx}.customData` as any
                      const current = (form.getValues(baseName) as any) || {}
                      const setField = (value: any) =>
                        form.setValue(baseName, { ...current, [f.key]: value }, { shouldDirty: true })

                      return (
                        <div key={f.key} className="space-y-1">
                          <label className="block text-sm font-semibold text-slate-700">
                            {f.label}{f.required ? ' *' : ''}
                          </label>
                          {f.type === 'textarea' ? (
                            <Textarea
                              className="rounded-xl border-slate-200"
                              placeholder={f.placeholder || ''}
                              value={current?.[f.key] ?? ''}
                              onChange={(e) => setField(e.target.value)}
                            />
                          ) : f.type === 'select' ? (
                            <Select
                              className="h-12 rounded-xl border-slate-200"
                              value={current?.[f.key] ?? ''}
                              onChange={(e) => setField(e.target.value)}
                            >
                              <option value="">Selecionar...</option>
                              {(f.options || []).map((opt) => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </Select>
                          ) : f.type === 'checkbox' ? (
                            <label className="flex items-center gap-2 mt-1 text-sm text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                className="w-4 h-4 accent-blue-600"
                                checked={Boolean(current?.[f.key])}
                                onChange={(e) => setField(e.target.checked)}
                              />
                              {f.placeholder || 'Marcar'}
                            </label>
                          ) : (
                            <Input
                              type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                              placeholder={f.placeholder || ''}
                              className="h-12 rounded-xl border-slate-200"
                              value={current?.[f.key] ?? ''}
                              onChange={(e) => setField(e.target.value)}
                            />
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}

            {/* Quantidade — só exibe se mais de 1 tipo permitir múltiplos */}
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold text-slate-700">Quantidade de inscrições</FormLabel>
                    <FormControl>
                      <div className="flex items-center gap-3 mt-1">
                        <button
                          type="button"
                          className="w-10 h-10 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 font-bold hover:bg-slate-100"
                          onClick={() => field.onChange(Math.max(1, Number(field.value || 1) - 1))}
                        >
                          −
                        </button>
                        <span className="w-10 text-center font-bold text-slate-900 text-lg">{field.value}</span>
                        <button
                          type="button"
                          className="w-10 h-10 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 font-bold hover:bg-slate-100"
                          onClick={() => field.onChange(Math.min(50, Number(field.value || 1) + 1))}
                        >
                          +
                        </button>
                        <span className="text-sm text-slate-500 ml-2">
                          {Number(quantity || 1) > 1 ? `${Number(quantity)} inscrições` : '1 inscrição'}
                        </span>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Valor da inscrição (readonly) */}
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <label className="block text-sm font-semibold text-slate-700 mb-1">Valor da inscrição</label>
              <input
                readOnly
                tabIndex={-1}
                value={isFree ? 'Gratuito' : money(totalValue)}
                className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-slate-500 text-sm cursor-default focus:outline-none"
              />
            </div>

            {/* CTA */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-14 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-base rounded-2xl shadow-md shadow-amber-500/30 flex items-center justify-center gap-2 transition-colors"
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                  {isFree ? 'Confirmar Inscrição Gratuita' : 'Ir para o Pagamento'}
                </>
              )}
            </button>

            <p className="text-center text-xs text-slate-400 pb-4">
              Ao continuar, você concorda em fornecer seus dados para fins de comunicação do evento.
            </p>
          </form>
        </Form>
      </div>
    </div>
  )
}
