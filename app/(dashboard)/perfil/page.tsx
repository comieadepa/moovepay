'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Upload } from 'lucide-react'

import { profileUpdateSchema, type ProfileUpdateInput } from '@/lib/validations'
import { compressAndUploadImage } from '@/lib/media-client'
import { canvasToFile, drawImageToSquareCanvas, loadImageFromFile } from '@/lib/image-editor-client'

type ProfileResponseUser = {
  id: string
  email: string
  name: string
  whatsapp?: string
  role?: string
  defaultTenantId?: string
  avatarUrl?: string
  address?: any
}

export default function PerfilPage() {
  const router = useRouter()
  const avatarInputRef = useRef<HTMLInputElement | null>(null)
  const avatarPreviewCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [pickedAvatarName, setPickedAvatarName] = useState<string>('')
  const [avatarUrlInput, setAvatarUrlInput] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [email, setEmail] = useState<string>('')

  const [avatarEditorOpen, setAvatarEditorOpen] = useState(false)
  const [avatarEditorFile, setAvatarEditorFile] = useState<File | null>(null)
  const [avatarEditorImage, setAvatarEditorImage] = useState<HTMLImageElement | null>(null)
  const [avatarZoom, setAvatarZoom] = useState(1)
  const [avatarRotate, setAvatarRotate] = useState(0)
  const [avatarOffset, setAvatarOffset] = useState({ x: 0, y: 0 })
  const [avatarIsDragging, setAvatarIsDragging] = useState(false)
  const avatarDragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null)

  const form = useForm<ProfileUpdateInput>({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues: {
      name: '',
      whatsapp: '',
      avatarUrl: '',
      address: {
        cep: '',
        logradouro: '',
        numero: '',
        complemento: '',
        bairro: '',
        cidade: '',
        uf: '',
      },
    },
  })

  const avatarPreview = useMemo(() => {
    const url = form.getValues('avatarUrl')
    return typeof url === 'string' && url.trim() ? url.trim() : ''
  }, [form.watch('avatarUrl')])

  const onPickAvatar = async (file: File | null) => {
    if (!file) return
    setUploadingAvatar(true)
    setError(null)
    setSuccess(null)
    setPickedAvatarName(file.name)
    setAvatarUrlInput('')

    try {
      const previousUrl = form.getValues('avatarUrl')
      const uploaded = await compressAndUploadImage(file, { kind: 'avatar', previousUrl: previousUrl || undefined })
      form.setValue('avatarUrl', uploaded.url, { shouldDirty: true })
      setSuccess(`Foto enviada (${Math.round(uploaded.compressedBytes / 1024)}KB)`)
    } catch (e: any) {
      setError(e?.message || 'Erro ao enviar foto')
    } finally {
      setUploadingAvatar(false)
    }
  }

  const openAvatarEditor = async (file: File | null) => {
    if (!file) return
    setError(null)
    setSuccess(null)
    setPickedAvatarName(file.name)
    setAvatarUrlInput('')
    setAvatarEditorFile(file)
    setAvatarZoom(1)
    setAvatarRotate(0)
    setAvatarOffset({ x: 0, y: 0 })
    setAvatarEditorOpen(true)

    try {
      const img = await loadImageFromFile(file)
      setAvatarEditorImage(img)
    } catch (e: any) {
      setAvatarEditorOpen(false)
      setAvatarEditorFile(null)
      setAvatarEditorImage(null)
      setError(e?.message || 'Não foi possível abrir a imagem')
    }
  }

  const closeAvatarEditor = () => {
    setAvatarEditorOpen(false)
    setAvatarEditorFile(null)
    setAvatarEditorImage(null)
    setAvatarIsDragging(false)
    avatarDragRef.current = null
  }

  useEffect(() => {
    if (!avatarEditorOpen) return
    if (!avatarEditorImage) return

    const canvas = avatarPreviewCanvasRef.current
    if (!canvas) return

    try {
      drawImageToSquareCanvas(canvas, avatarEditorImage, {
        canvasSize: 420,
        zoom: avatarZoom,
        rotateDeg: avatarRotate,
        offsetX: avatarOffset.x,
        offsetY: avatarOffset.y,
      })
    } catch {
      // ignore preview errors
    }
  }, [avatarEditorOpen, avatarEditorImage, avatarZoom, avatarRotate, avatarOffset])

  const applyAvatarEditsAndUpload = async () => {
    if (!avatarEditorFile || !avatarEditorImage) return

    try {
      setUploadingAvatar(true)
      setError(null)
      setSuccess(null)

      const exportCanvas = document.createElement('canvas')
      drawImageToSquareCanvas(exportCanvas, avatarEditorImage, {
        canvasSize: 512,
        zoom: avatarZoom,
        rotateDeg: avatarRotate,
        offsetX: avatarOffset.x,
        offsetY: avatarOffset.y,
      })

      const editedFile = await canvasToFile(exportCanvas, avatarEditorFile.name, 'image/png')
      closeAvatarEditor()
      await onPickAvatar(editedFile)
    } catch (e: any) {
      setError(e?.message || 'Erro ao aplicar ajustes')
    } finally {
      setUploadingAvatar(false)
    }
  }

  useEffect(() => {
    let active = true

    const load = async () => {
      try {
        setLoading(true)
        setError(null)

        const res = await fetch('/api/auth/profile', { cache: 'no-store' })
        const data = await res.json().catch(() => ({}))

        if (res.status === 401) {
          router.replace('/login')
          return
        }

        if (!res.ok) {
          setError(data?.error || 'Erro ao carregar perfil')
          return
        }

        const u = data?.user as ProfileResponseUser
        if (!active) return

        setEmail(u?.email || '')

        form.reset({
          name: u?.name || '',
          whatsapp: u?.whatsapp || '',
          avatarUrl: u?.avatarUrl || '',
          address: {
            cep: u?.address?.cep || '',
            logradouro: u?.address?.logradouro || '',
            numero: u?.address?.numero || '',
            complemento: u?.address?.complemento || '',
            bairro: u?.address?.bairro || '',
            cidade: u?.address?.cidade || '',
            uf: u?.address?.uf || '',
          },
        })

        setAvatarUrlInput('')
      } catch {
        if (!active) return
        setError('Erro ao conectar com o servidor')
      } finally {
        if (!active) return
        setLoading(false)
      }
    }

    load()
    return () => {
      active = false
    }
  }, [router, form])

  const onSubmit = async (values: ProfileUpdateInput) => {
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })

      const data = await res.json().catch(() => ({}))

      if (res.status === 401) {
        router.replace('/login')
        return
      }

      if (!res.ok) {
        setError(data?.error || 'Erro ao salvar perfil')
        return
      }

      const u = data?.user as ProfileResponseUser

      // Mantém compatibilidade com o restante do app
      try {
        const raw = localStorage.getItem('user')
        const existing = raw ? JSON.parse(raw) : {}
        localStorage.setItem(
          'user',
          JSON.stringify({
            ...existing,
            id: u.id,
            email: u.email,
            name: u.name,
            role: u.role || 'user',
            defaultTenantId: u.defaultTenantId || u.id,
            avatarUrl: u.avatarUrl,
          })
        )
      } catch {
        // ignore
      }

      setEmail(u?.email || email)
      setSuccess('Perfil atualizado com sucesso')
    } catch {
      setError('Erro ao conectar com o servidor')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Meu Perfil</h1>
          <p className="text-slate-600">Atualize seus dados cadastrais.</p>
        </div>

        <Link href="/dashboard" className="text-sm text-blue-600 hover:text-blue-700">
          ← Voltar
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Editar perfil</CardTitle>
          <CardDescription>Esses dados aparecem nas suas operações e relatórios.</CardDescription>
        </CardHeader>

        <CardContent>
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-md text-sm">
              {success}
            </div>
          )}

          {loading ? (
            <div className="py-10 text-center text-slate-600">Carregando...</div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="md:col-span-2 space-y-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome</FormLabel>
                          <FormControl>
                            <Input placeholder="Seu nome" {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                      <Input value={email} disabled className="opacity-80" />
                    </div>

                    <FormField
                      control={form.control}
                      name="whatsapp"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Celular (WhatsApp)</FormLabel>
                          <FormControl>
                            <Input placeholder="(99) 99999-9999" {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="avatarUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Foto do Perfil</FormLabel>
                          <FormControl>
                            <div className="space-y-2">
                              <input
                                ref={avatarInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0] || null
                                  void openAvatarEditor(file)
                                  // permite selecionar o mesmo arquivo novamente
                                  e.currentTarget.value = ''
                                }}
                              />

                              <div className="flex items-center gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  disabled={uploadingAvatar}
                                  onClick={() => avatarInputRef.current?.click()}
                                >
                                  <Upload className="h-4 w-4 mr-2" />
                                  {uploadingAvatar ? 'Enviando foto...' : 'Adicionar foto'}
                                </Button>
                                <span className="text-xs text-slate-600 truncate">
                                  {pickedAvatarName || 'Nenhum arquivo selecionado'}
                                </span>
                              </div>

                              <p className="text-xs text-slate-500">
                                Envie uma foto do seu dispositivo (você pode ajustar antes de enviar). Se preferir, cole uma URL pública abaixo.
                              </p>

                              <div className="flex items-center gap-2">
                                <Input
                                  placeholder="(opcional) URL da foto"
                                  value={avatarUrlInput}
                                  onChange={(e) => setAvatarUrlInput(e.target.value)}
                                  disabled={uploadingAvatar}
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  disabled={uploadingAvatar || !avatarUrlInput.trim()}
                                  onClick={() => {
                                    const next = avatarUrlInput.trim()
                                    field.onChange(next)
                                    setPickedAvatarName('URL informada')
                                  }}
                                >
                                  Usar URL
                                </Button>
                              </div>
                              <p className="text-xs text-slate-500">
                                A imagem é otimizada automaticamente.
                              </p>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="md:col-span-1">
                    <div className="text-sm font-medium text-slate-700 mb-2">Pré-visualização</div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 flex items-center justify-center aspect-square overflow-hidden">
                      {avatarPreview ? (
                        <Image
                          src={avatarPreview}
                          alt="Foto do perfil"
                          width={320}
                          height={320}
                          className="h-full w-full object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="text-center text-slate-500 text-sm">
                          Sem foto
                        </div>
                      )}
                    </div>
                    <p className="mt-2 text-xs text-slate-500">Use uma URL pública (ex.: imagem no Drive/Dropbox com link direto). Ou adicione direto do seu dispositivo.</p>
                  </div>
                </div>

                {avatarEditorOpen && (
                  <div
                    className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') closeAvatarEditor()
                    }}
                  >
                    <div className="w-full max-w-3xl rounded-lg bg-white shadow-lg border border-slate-200 overflow-hidden">
                      <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                        <div>
                          <div className="text-base font-semibold text-slate-900">Ajustar foto</div>
                          <div className="text-xs text-slate-500">Zoom e giro.</div>
                        </div>
                        <Button type="button" variant="ghost" onClick={closeAvatarEditor}>
                          Fechar
                        </Button>
                      </div>

                      <div className="grid md:grid-cols-2 gap-0">
                        <div className="p-5 border-b md:border-b-0 md:border-r border-slate-200">
                          <div className="text-sm font-medium text-slate-700 mb-2">Pré-visualização</div>
                          <div
                            className="rounded-lg border border-slate-200 bg-slate-50 p-3 flex items-center justify-center"
                            onPointerDown={(e) => {
                              if (!avatarEditorImage) return
                              setAvatarIsDragging(true)
                              avatarDragRef.current = {
                                startX: e.clientX,
                                startY: e.clientY,
                                baseX: avatarOffset.x,
                                baseY: avatarOffset.y,
                              }
                              ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
                            }}
                            onPointerMove={(e) => {
                              if (!avatarIsDragging) return
                              const drag = avatarDragRef.current
                              if (!drag) return
                              const dx = e.clientX - drag.startX
                              const dy = e.clientY - drag.startY
                              setAvatarOffset({ x: drag.baseX + dx, y: drag.baseY + dy })
                            }}
                            onPointerUp={(e) => {
                              setAvatarIsDragging(false)
                              avatarDragRef.current = null
                              try {
                                ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
                              } catch {
                                // ignore
                              }
                            }}
                          >
                            <canvas ref={avatarPreviewCanvasRef} className="w-full max-w-[420px] aspect-square rounded-md" />
                          </div>
                          <p className="mt-2 text-xs text-slate-500">Arraste a imagem para reposicionar.</p>
                        </div>

                        <div className="p-5">
                          <div className="space-y-4">
                            <div>
                              <div className="flex items-center justify-between">
                                <label className="text-sm font-medium text-slate-700">Zoom</label>
                                <span className="text-xs text-slate-500">{Math.round(avatarZoom * 100)}%</span>
                              </div>
                              <input
                                type="range"
                                min={100}
                                max={300}
                                step={5}
                                value={Math.round(avatarZoom * 100)}
                                onChange={(e) => setAvatarZoom(Number(e.target.value) / 100)}
                                className="w-full"
                              />
                            </div>

                            <div>
                              <div className="flex items-center justify-between">
                                <label className="text-sm font-medium text-slate-700">Giro</label>
                                <span className="text-xs text-slate-500">{avatarRotate}°</span>
                              </div>
                              <input
                                type="range"
                                min={-180}
                                max={180}
                                step={1}
                                value={avatarRotate}
                                onChange={(e) => setAvatarRotate(Number(e.target.value))}
                                className="w-full"
                              />
                            </div>

                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                  setAvatarZoom(1)
                                  setAvatarRotate(0)
                                  setAvatarOffset({ x: 0, y: 0 })
                                }}
                              >
                                Resetar
                              </Button>
                              <div className="flex-1" />
                              <Button type="button" variant="outline" onClick={closeAvatarEditor} disabled={uploadingAvatar}>
                                Cancelar
                              </Button>
                              <Button type="button" onClick={() => void applyAvatarEditsAndUpload()} disabled={uploadingAvatar || !avatarEditorImage}>
                                {uploadingAvatar ? 'Enviando...' : 'Aplicar e enviar'}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="border-t pt-6">
                  <h2 className="text-lg font-semibold text-slate-900 mb-4">Endereço</h2>

                  <div className="grid md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="address.cep"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CEP</FormLabel>
                          <FormControl>
                            <Input placeholder="00000-000" {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="address.uf"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>UF</FormLabel>
                          <FormControl>
                            <Input placeholder="PA" {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="address.cidade"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cidade</FormLabel>
                          <FormControl>
                            <Input placeholder="Sua cidade" {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="address.bairro"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bairro</FormLabel>
                          <FormControl>
                            <Input placeholder="Seu bairro" {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="address.logradouro"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>Logradouro</FormLabel>
                          <FormControl>
                            <Input placeholder="Rua/Avenida" {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="address.numero"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Número</FormLabel>
                          <FormControl>
                            <Input placeholder="123" {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="address.complemento"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Complemento</FormLabel>
                          <FormControl>
                            <Input placeholder="Apto, bloco, etc." {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Button type="submit" disabled={saving} className="bg-slate-900 hover:bg-slate-800">
                    {saving ? 'Salvando...' : 'Salvar alterações'}
                  </Button>
                  <Button type="button" variant="outline" disabled={saving} onClick={() => router.push('/dashboard')}>
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
