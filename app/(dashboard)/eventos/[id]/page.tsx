
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { createEventSchema, type CreateEventInput, type EventCustomFieldInput } from '@/lib/validations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { compressAndUploadImage } from '@/lib/media-client'
import { Upload } from 'lucide-react'
import { canvasToFile, drawImageToCanvas, loadImageFromFile } from '@/lib/image-editor-client'

type EventResponse = {
  success: boolean
  event: {
    id: string
    name: string
    description: string | null
    banner: string | null
    startDate: string
    endDate: string | null
    status: string
    slug?: string | null
    customFields?: EventCustomFieldInput[] | null
    inscriptionTypes?: { id: string; name: string; value: number }[]
  }
}

export default function EventDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const bannerInputRef = useRef<HTMLInputElement | null>(null)
  const bannerPreviewCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const searchParams = useSearchParams()
  const tab = useMemo(() => searchParams.get('tab') ?? 'edit', [searchParams])
  const created = useMemo(() => searchParams.get('created') === '1', [searchParams])

  const [isFetching, setIsFetching] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [eventMeta, setEventMeta] = useState<{ slug?: string | null; status?: string } | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [isFree, setIsFree] = useState(true)
  const [registrationValue, setRegistrationValue] = useState('0,00')
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const [pickedBannerName, setPickedBannerName] = useState<string>('')

  const [bannerEditorOpen, setBannerEditorOpen] = useState(false)
  const [bannerEditorFile, setBannerEditorFile] = useState<File | null>(null)
  const [bannerEditorImage, setBannerEditorImage] = useState<HTMLImageElement | null>(null)
  const [bannerZoom, setBannerZoom] = useState(1)
  const [bannerRotate, setBannerRotate] = useState(0)
  const [bannerOffset, setBannerOffset] = useState({ x: 0, y: 0 })
  const [bannerIsDragging, setBannerIsDragging] = useState(false)
  const bannerDragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null)

  const publicLink = useMemo(() => {
    if (!eventMeta?.slug) return ''
    if (typeof window === 'undefined') return ''
    return `${window.location.origin}/inscricao/${eventMeta.slug}`
  }, [eventMeta?.slug])

  const form = useForm<CreateEventInput>({
    resolver: zodResolver(createEventSchema),
    defaultValues: {
      name: '',
      description: '',
      banner: '',
      startDate: new Date(),
      endDate: undefined,
      customFields: [],
    },
  })

  const customFields = form.watch('customFields') || []

  const openBannerEditor = async (file: File | null) => {
    if (!file) return
    setError(null)
    setPickedBannerName(file.name)
    setBannerEditorFile(file)
    setBannerZoom(1)
    setBannerRotate(0)
    setBannerOffset({ x: 0, y: 0 })
    setBannerEditorOpen(true)

    try {
      const img = await loadImageFromFile(file)
      setBannerEditorImage(img)
    } catch (e: any) {
      setBannerEditorOpen(false)
      setBannerEditorFile(null)
      setBannerEditorImage(null)
      setError(e?.message || 'Não foi possível abrir a imagem')
    }
  }

  const closeBannerEditor = () => {
    setBannerEditorOpen(false)
    setBannerEditorFile(null)
    setBannerEditorImage(null)
    setBannerIsDragging(false)
    bannerDragRef.current = null
  }

  useEffect(() => {
    if (!bannerEditorOpen) return
    if (!bannerEditorImage) return
    const canvas = bannerPreviewCanvasRef.current
    if (!canvas) return

    try {
      drawImageToCanvas(canvas, bannerEditorImage, {
        canvasWidth: 560,
        canvasHeight: 315,
        zoom: bannerZoom,
        rotateDeg: bannerRotate,
        offsetX: bannerOffset.x,
        offsetY: bannerOffset.y,
      })
    } catch {
      // ignore preview errors
    }
  }, [bannerEditorOpen, bannerEditorImage, bannerZoom, bannerRotate, bannerOffset])

  const applyBannerEditsAndUpload = async () => {
    if (!bannerEditorFile || !bannerEditorImage) return

    try {
      setUploadingBanner(true)
      setError(null)

      const exportCanvas = document.createElement('canvas')
      drawImageToCanvas(exportCanvas, bannerEditorImage, {
        canvasWidth: 1600,
        canvasHeight: 900,
        zoom: bannerZoom,
        rotateDeg: bannerRotate,
        offsetX: bannerOffset.x,
        offsetY: bannerOffset.y,
      })

      const editedFile = await canvasToFile(exportCanvas, bannerEditorFile.name, 'image/webp', 0.92)

      const previousUrl = form.getValues('banner')
      const uploaded = await compressAndUploadImage(editedFile, {
        kind: 'banner',
        eventId: params.id,
        previousUrl: previousUrl || undefined,
      })
      form.setValue('banner', uploaded.url, { shouldDirty: true })
      closeBannerEditor()
    } catch (err: any) {
      setError(err?.message || 'Erro ao enviar banner')
    } finally {
      setUploadingBanner(false)
    }
  }

  function pad2(n: number) {
    return String(n).padStart(2, '0')
  }

  function toDateTimeLocalValue(date: Date) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`
  }

  function parseDateTimeLocal(value: string) {
    const [datePart, timePart] = value.split('T')
    if (!datePart || !timePart) return undefined
    const [y, m, d] = datePart.split('-').map((v) => Number(v))
    const [hh, mm] = timePart.split(':').map((v) => Number(v))
    if (!y || !m || !d || Number.isNaN(hh) || Number.isNaN(mm)) return undefined
    return new Date(y, m - 1, d, hh, mm)
  }

  function makeKeyFromLabel(label: string) {
    return label
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
  }

  function addCustomField() {
    const next: EventCustomFieldInput = {
      key: `campo_${customFields.length + 1}`,
      label: `Campo ${customFields.length + 1}`,
      type: 'text',
      required: false,
      placeholder: '',
      options: [],
    }
    form.setValue('customFields', [...customFields, next], { shouldDirty: true })
  }

  function updateCustomField(index: number, patch: Partial<EventCustomFieldInput>) {
    const next = customFields.map((f, i) => (i === index ? { ...f, ...patch } : f))
    form.setValue('customFields', next, { shouldDirty: true })
  }

  function removeCustomField(index: number) {
    const next = customFields.filter((_, i) => i !== index)
    form.setValue('customFields', next, { shouldDirty: true })
  }

  useEffect(() => {
    let cancelled = false

    async function fetchEvent() {
      setIsFetching(true)
      setError(null)

      try {
        const response = await fetch(`/api/events/${params.id}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        })

        const data = (await response.json()) as Partial<EventResponse> & { error?: string }

        if (!response.ok) {
          setError(data.error || 'Erro ao carregar evento')
          return
        }

        if (!data.event) {
          setError('Evento não encontrado')
          return
        }

        if (cancelled) return

        setEventMeta({ slug: (data.event as any).slug, status: (data.event as any).status })

        const types = ((data.event as any).inscriptionTypes || []) as any[]
        const first = types?.[0]
        if (first && typeof first.value === 'number') {
          const free = Number(first.value) === 0
          setIsFree(free)
          setRegistrationValue(free ? '0,00' : String(Number(first.value).toFixed(2)).replace('.', ','))
        } else {
          setIsFree(true)
          setRegistrationValue('0,00')
        }

        form.reset({
          name: data.event.name,
          description: data.event.description ?? '',
          banner: data.event.banner ?? '',
          startDate: new Date(data.event.startDate),
          endDate: data.event.endDate ? new Date(data.event.endDate) : undefined,
          customFields: ((data.event as any).customFields || []) as any,
        })
      } catch (err) {
        console.error(err)
        setError('Erro ao conectar com o servidor')
      } finally {
        if (!cancelled) setIsFetching(false)
      }
    }

    fetchEvent()

    return () => {
      cancelled = true
    }
  }, [params.id, form])

  async function onSubmit(data: CreateEventInput) {
    setIsSaving(true)
    setError(null)

    try {
      const response = await fetch(`/api/events/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      const parsedValue = Number(String(registrationValue).replace(',', '.'))
      if (!isFree && (!Number.isFinite(parsedValue) || parsedValue < 0)) {
        throw new Error('Informe um valor válido para a inscrição')
      }

      const pricingRes = await fetch(`/api/events/${params.id}/inscription-types`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isFree,
          value: isFree ? 0 : parsedValue,
          name: isFree ? 'Evento gratuito' : 'Inscrição',
        }),
      })

      const pricingJson = await pricingRes.json().catch(() => ({}))
      if (!pricingRes.ok) throw new Error(pricingJson?.error || 'Não foi possível salvar o valor da inscrição')

      const result = await response.json()

      if (!response.ok) {
        setError(result.error || 'Erro ao salvar evento')
        return
      }

      router.push('/eventos')
    } catch (err) {
      console.error(err)
      setError('Erro ao conectar com o servidor')
    } finally {
      setIsSaving(false)
    }
  }

  async function handlePublish() {
    try {
      setPublishing(true)
      setError(null)
      const res = await fetch(`/api/events/${params.id}/publish`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Erro ao publicar')
      setEventMeta((prev) => ({ ...(prev || {}), status: 'published' }))
    } catch (e: any) {
      setError(e?.message || 'Erro ao publicar')
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Evento</h1>
            <p className="text-slate-600 mt-1">
              {tab === 'registrations'
                ? 'Inscrições (em breve)'
                : tab === 'financial'
                ? 'Financeiro (em breve)'
                : 'Edite os dados do seu evento'}
            </p>
          </div>
          <Button variant="outline" onClick={() => router.push('/eventos')}>
            Voltar
          </Button>
        </div>
        <Link href="/">
          <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700">
            ← Voltar à home
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {tab === 'edit' ? 'Editar evento' : 'Detalhes'}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          {(created || eventMeta?.slug) && (
            <div className="mb-4 p-4 border rounded-md bg-slate-50">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-slate-900">Link de inscrição</div>
                  <div className="text-xs text-slate-600">
                    {eventMeta?.status === 'published'
                      ? 'Compartilhe este link para receber inscrições.'
                      : 'O link só funciona publicamente quando o evento estiver publicado.'}
                  </div>
                  <div className="text-sm text-slate-800 break-all">{publicLink || 'Carregando link...'}</div>
                </div>
                <div className="flex flex-col gap-2">
                  <Button
                    variant="outline"
                    onClick={() => publicLink && navigator.clipboard.writeText(publicLink)}
                    disabled={!publicLink}
                  >
                    Copiar link
                  </Button>
                  {eventMeta?.status !== 'published' && (
                    <Button onClick={handlePublish} disabled={publishing}>
                      {publishing ? 'Publicando...' : 'Publicar evento'}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
              {error}
            </div>
          )}

          {tab !== 'edit' ? (
            <div className="text-slate-600 text-sm">
              Esta aba ainda não foi implementada. Por enquanto, use “Editar”.
            </div>
          ) : isFetching ? (
            <div className="text-slate-500 text-sm">Carregando evento...</div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome do Evento *</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Workshop de React 2024" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição</FormLabel>
                      <FormControl>
                        <textarea
                          placeholder="Descreva seu evento..."
                          className="w-full h-24 px-3 py-2 border border-input rounded-md"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de Início *</FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          {...field}
                          value={
                            field.value
                              ? toDateTimeLocalValue(new Date(field.value))
                              : ''
                          }
                          onChange={(e) => {
                            const parsed = parseDateTimeLocal(e.target.value)
                            if (parsed) field.onChange(parsed)
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de Término</FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          {...field}
                          value={
                            field.value
                              ? toDateTimeLocalValue(new Date(field.value))
                              : ''
                          }
                          onChange={(e) => {
                            if (!e.target.value) return field.onChange(undefined)
                            const parsed = parseDateTimeLocal(e.target.value)
                            if (parsed) field.onChange(parsed)
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="banner"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Banner do Evento</FormLabel>
                      <FormControl>
                        <div className="space-y-2">
                          <input
                            ref={bannerInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0] || null
                              void openBannerEditor(file)
                              // permite selecionar o mesmo arquivo novamente
                              e.currentTarget.value = ''
                            }}
                          />

                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              disabled={uploadingBanner}
                              onClick={() => bannerInputRef.current?.click()}
                            >
                              <Upload className="h-4 w-4 mr-2" />
                              {uploadingBanner ? 'Enviando banner...' : 'Adicionar banner'}
                            </Button>
                            <span className="text-xs text-slate-600 truncate">
                              {pickedBannerName || 'Nenhum arquivo selecionado'}
                            </span>
                          </div>

                          <p className="text-xs text-slate-500">
                            Envie um banner do seu dispositivo (você pode ajustar antes de enviar). Se preferir, cole uma URL pública abaixo.
                          </p>

                          <Input
                            type="url"
                            placeholder="(opcional) URL do banner"
                            {...field}
                          />
                          {field.value ? (
                            <div className="rounded-md overflow-hidden border border-slate-200 bg-slate-50">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={field.value} alt="Prévia do banner" className="w-full h-44 object-cover" />
                            </div>
                          ) : null}
                          <p className="text-xs text-slate-500">A imagem é otimizada automaticamente para ocupar pouco espaço.</p>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {bannerEditorOpen && (
                  <div
                    className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') closeBannerEditor()
                    }}
                  >
                    <div className="w-full max-w-4xl rounded-lg bg-white shadow-lg border border-slate-200 overflow-hidden">
                      <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                        <div>
                          <div className="text-base font-semibold text-slate-900">Ajustar banner</div>
                          <div className="text-xs text-slate-500">Zoom e giro.</div>
                        </div>
                        <Button type="button" variant="ghost" onClick={closeBannerEditor}>
                          Fechar
                        </Button>
                      </div>

                      <div className="grid md:grid-cols-2 gap-0">
                        <div className="p-5 border-b md:border-b-0 md:border-r border-slate-200">
                          <div className="text-sm font-medium text-slate-700 mb-2">Pré-visualização (16:9)</div>
                          <div
                            className="rounded-lg border border-slate-200 bg-slate-50 p-3 flex items-center justify-center"
                            onPointerDown={(e) => {
                              if (!bannerEditorImage) return
                              setBannerIsDragging(true)
                              bannerDragRef.current = {
                                startX: e.clientX,
                                startY: e.clientY,
                                baseX: bannerOffset.x,
                                baseY: bannerOffset.y,
                              }
                              ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
                            }}
                            onPointerMove={(e) => {
                              if (!bannerIsDragging) return
                              const drag = bannerDragRef.current
                              if (!drag) return
                              const dx = e.clientX - drag.startX
                              const dy = e.clientY - drag.startY
                              setBannerOffset({ x: drag.baseX + dx, y: drag.baseY + dy })
                            }}
                            onPointerUp={(e) => {
                              setBannerIsDragging(false)
                              bannerDragRef.current = null
                              try {
                                ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
                              } catch {
                                // ignore
                              }
                            }}
                          >
                            <canvas ref={bannerPreviewCanvasRef} className="w-full max-w-[560px] rounded-md" />
                          </div>
                          <p className="mt-2 text-xs text-slate-500">Arraste a imagem para reposicionar.</p>
                        </div>

                        <div className="p-5">
                          <div className="space-y-4">
                            <div>
                              <div className="flex items-center justify-between">
                                <label className="text-sm font-medium text-slate-700">Zoom</label>
                                <span className="text-xs text-slate-500">{Math.round(bannerZoom * 100)}%</span>
                              </div>
                              <input
                                type="range"
                                min={100}
                                max={300}
                                step={5}
                                value={Math.round(bannerZoom * 100)}
                                onChange={(e) => setBannerZoom(Number(e.target.value) / 100)}
                                className="w-full"
                              />
                            </div>

                            <div>
                              <div className="flex items-center justify-between">
                                <label className="text-sm font-medium text-slate-700">Giro</label>
                                <span className="text-xs text-slate-500">{bannerRotate}°</span>
                              </div>
                              <input
                                type="range"
                                min={-180}
                                max={180}
                                step={1}
                                value={bannerRotate}
                                onChange={(e) => setBannerRotate(Number(e.target.value))}
                                className="w-full"
                              />
                            </div>

                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                  setBannerZoom(1)
                                  setBannerRotate(0)
                                  setBannerOffset({ x: 0, y: 0 })
                                }}
                              >
                                Resetar
                              </Button>
                              <div className="flex-1" />
                              <Button type="button" variant="outline" onClick={closeBannerEditor} disabled={uploadingBanner}>
                                Cancelar
                              </Button>
                              <Button type="button" onClick={() => void applyBannerEditsAndUpload()} disabled={uploadingBanner || !bannerEditorImage}>
                                {uploadingBanner ? 'Enviando...' : 'Aplicar e enviar'}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="pt-2">
                  <p className="text-sm font-semibold text-slate-900">Inscrição</p>
                  <p className="text-xs text-slate-600">Defina se o evento é gratuito ou o valor por inscrição.</p>

                  <div className="mt-3 space-y-3">
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={isFree}
                        onChange={(e) => {
                          setIsFree(e.target.checked)
                          if (e.target.checked) setRegistrationValue('0,00')
                        }}
                      />
                      Evento gratuito
                    </label>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <label className="text-sm font-medium text-slate-700">Valor da inscrição (R$)</label>
                        <Input
                          inputMode="decimal"
                          placeholder="Ex: 49,90"
                          value={registrationValue}
                          disabled={isFree}
                          onChange={(e) => setRegistrationValue(e.target.value)}
                        />
                        <p className="text-xs text-slate-500 mt-1">Para lote, o total será quantidade × valor.</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Formulário de inscrição</p>
                      <p className="text-xs text-slate-600">Campos extras que aparecerão na página pública.</p>
                    </div>
                    <Button type="button" variant="outline" onClick={addCustomField}>
                      + Adicionar campo
                    </Button>
                  </div>

                  {customFields.length === 0 ? (
                    <div className="mt-3 text-sm text-slate-500">Sem campos extras por enquanto.</div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {customFields.map((f, idx) => (
                        <div key={`${f.key}-${idx}`} className="rounded-md border p-4 bg-slate-50">
                          <div className="grid gap-3 md:grid-cols-2">
                            <div>
                              <label className="text-sm font-medium text-slate-700">Pergunta</label>
                              <Input
                                value={f.label}
                                onChange={(e) => {
                                  const label = e.target.value
                                  const nextKey = f.key?.startsWith('campo_') ? makeKeyFromLabel(label) || f.key : f.key
                                  updateCustomField(idx, { label, key: nextKey })
                                }}
                                placeholder="Ex: Qual é o seu celular?"
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium text-slate-700">Tipo de resposta</label>
                              <select
                                className="w-full px-3 py-2 border rounded-md"
                                value={f.type}
                                onChange={(e) => updateCustomField(idx, { type: e.target.value as any, options: e.target.value === 'select' ? (f.options || []) : [] })}
                              >
                                <option value="text">Texto (curto)</option>
                                <option value="textarea">Texto (longo)</option>
                                <option value="number">Número</option>
                                <option value="date">Data</option>
                                <option value="select">Lista de opções</option>
                                <option value="checkbox">Sim/Não (checkbox)</option>
                              </select>
                            </div>

                            {f.type === 'select' && (
                              <div className="md:col-span-2">
                                <label className="text-sm font-medium text-slate-700">Opções de resposta (separe por vírgula)</label>
                                <Input
                                  value={(f.options || []).join(', ')}
                                  onChange={(e) =>
                                    updateCustomField(idx, {
                                      options: e.target.value
                                        .split(',')
                                        .map((s) => s.trim())
                                        .filter(Boolean),
                                    })
                                  }
                                  placeholder="Ex: Masculino, Feminino"
                                />
                              </div>
                            )}

                            <div className="md:col-span-2">
                              <details className="rounded-md border bg-white px-3 py-2">
                                <summary className="cursor-pointer text-sm text-slate-700">Opções avançadas (não obrigatório)</summary>
                                <div className="mt-3 grid gap-3 md:grid-cols-2">
                                  <div>
                                    <label className="text-sm font-medium text-slate-700">Código interno</label>
                                    <p className="text-xs text-slate-500">Usado para relatórios/integrações. Pode deixar como está.</p>
                                    <Input
                                      value={f.key}
                                      onChange={(e) => updateCustomField(idx, { key: makeKeyFromLabel(e.target.value) || e.target.value })}
                                      placeholder="ex: celular"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-sm font-medium text-slate-700">Dica de preenchimento</label>
                                    <p className="text-xs text-slate-500">Um exemplo que aparece dentro do campo.</p>
                                    <Input
                                      value={f.placeholder || ''}
                                      onChange={(e) => updateCustomField(idx, { placeholder: e.target.value })}
                                      placeholder="Ex: (11) 99999-9999"
                                    />
                                  </div>
                                </div>
                              </details>
                            </div>

                            <div className="md:col-span-2 flex items-center justify-between">
                              <label className="flex items-center gap-2 text-sm text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={Boolean(f.required)}
                                  onChange={(e) => updateCustomField(idx, { required: e.target.checked })}
                                />
                                Obrigatório
                              </label>
                              <Button type="button" variant="ghost" className="text-red-600" onClick={() => removeCustomField(idx)}>
                                Remover
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-4">
                  <Button
                    type="submit"
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                    disabled={isSaving}
                  >
                    {isSaving ? 'Salvando...' : 'Salvar'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => router.push('/eventos')}
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
