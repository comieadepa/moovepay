import { compressImageFile } from './image-client'

export type UploadKind = 'avatar' | 'banner'

export type UploadImageOptions = {
  kind: UploadKind
  eventId?: string
  previousUrl?: string
}

export async function compressAndUploadImage(file: File, options: UploadImageOptions) {
  const compressed = await compressImageFile(file, {
    maxWidth: options.kind === 'avatar' ? 512 : 1600,
    maxHeight: options.kind === 'avatar' ? 512 : 900,
    maxBytes: options.kind === 'avatar' ? 450 * 1024 : 1100 * 1024,
    mimeType: 'image/webp',
    quality: options.kind === 'avatar' ? 0.82 : 0.8,
    minQuality: 0.55,
  })

  const form = new FormData()
  form.set('kind', options.kind)
  if (options.eventId) form.set('eventId', options.eventId)
  if (options.previousUrl) form.set('previousUrl', options.previousUrl)
  form.set('file', compressed)

  const res = await fetch('/api/media/upload', {
    method: 'POST',
    body: form,
  })

  const data = await res.json().catch(() => ({} as any))
  if (!res.ok) {
    throw new Error(data?.error || 'Erro ao enviar imagem')
  }

  return {
    url: String(data?.url || ''),
    path: String(data?.path || ''),
    bucket: String(data?.bucket || ''),
    compressedBytes: compressed.size,
  }
}
