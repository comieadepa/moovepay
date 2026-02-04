import { NextRequest, NextResponse } from 'next/server'

import { verifyToken } from '@/lib/auth'
import { supabase } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const BUCKET = 'moovepay-media'

type Kind = 'avatar' | 'banner'

function sanitizePathSegment(input: string) {
  return input.replace(/[^a-zA-Z0-9._-]+/g, '_')
}

function extFromMime(mime: string) {
  if (mime === 'image/webp') return 'webp'
  if (mime === 'image/jpeg') return 'jpg'
  if (mime === 'image/png') return 'png'
  return 'bin'
}

function extractPathFromPublicUrl(url: string) {
  // Esperado:
  // https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
  try {
    const u = new URL(url)
    const parts = u.pathname.split('/').filter(Boolean)
    const idx = parts.findIndex((p) => p === 'public')
    if (idx < 0) return null
    const bucket = parts[idx + 1]
    const rest = parts.slice(idx + 2)
    if (!bucket || rest.length === 0) return null
    return { bucket, path: rest.join('/') }
  } catch {
    return null
  }
}

async function tryRemovePrevious(params: {
  kind: Kind
  userId: string
  eventId: string
  previousPath?: string
  previousUrl?: string
}) {
  const { kind, userId, eventId, previousPath, previousUrl } = params

  let path = (previousPath || '').trim()
  if (!path && previousUrl) {
    const extracted = extractPathFromPublicUrl(String(previousUrl))
    if (extracted && extracted.bucket === BUCKET) {
      path = extracted.path
    }
  }

  if (!path) return

  const allowedPrefix =
    kind === 'avatar'
      ? `avatars/${userId}/`
      : eventId
        ? `banners/${eventId}/`
        : 'banners/no-event/'

  if (!path.startsWith(allowedPrefix)) return

  const removed = await supabase.storage.from(BUCKET).remove([path])
  if (removed.error) {
    // best-effort (não bloquear upload)
    console.warn('Falha ao remover arquivo anterior:', removed.error)
  }
}

async function ensureBucket() {
  const listed = await supabase.storage.listBuckets()
  if (listed.error) throw listed.error

  const exists = (listed.data || []).some((b) => b.name === BUCKET)
  if (exists) return

  const created = await supabase.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: '2MB',
  })

  // se deu race e já existe, não bloquear
  if (created.error && !String(created.error.message || '').toLowerCase().includes('already exists')) {
    throw created.error
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const verified = verifyToken(token)
    if (!verified) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

    const form = await request.formData()

    const kindRaw = String(form.get('kind') || '')
    const kind = (kindRaw === 'avatar' || kindRaw === 'banner') ? (kindRaw as Kind) : null
    if (!kind) return NextResponse.json({ error: 'Campo kind inválido' }, { status: 400 })

    const eventIdRaw = String(form.get('eventId') || '')
    const eventId = eventIdRaw ? sanitizePathSegment(eventIdRaw) : ''

    const previousPath = String(form.get('previousPath') || '').trim()
    const previousUrl = String(form.get('previousUrl') || '').trim()

    const file = form.get('file')
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'Arquivo ausente' }, { status: 400 })
    }

    const mime = String(file.type || '')
    const allowed = new Set(['image/webp', 'image/jpeg', 'image/png'])
    if (!allowed.has(mime)) {
      return NextResponse.json({ error: 'Formato não suportado. Use WEBP, JPG ou PNG.' }, { status: 400 })
    }

    const maxBytes = kind === 'avatar' ? 600 * 1024 : 1400 * 1024
    if (file.size > maxBytes) {
      return NextResponse.json(
        { error: `Imagem acima do limite (${Math.round(maxBytes / 1024)}KB). Comprima antes de enviar.` },
        { status: 413 }
      )
    }

    await ensureBucket()

    const userId = sanitizePathSegment(verified.userId)
    const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`

    const ext = extFromMime(mime)
    const prefix = kind === 'avatar'
      ? `avatars/${userId}`
      : `banners/${eventId || 'no-event'}`

    const path = `${prefix}/${id}.${ext}`

    const bytes = new Uint8Array(await file.arrayBuffer())

    const uploaded = await supabase.storage
      .from(BUCKET)
      .upload(path, bytes, {
        contentType: mime,
        upsert: true,
        cacheControl: '31536000',
      })

    if (uploaded.error) {
      return NextResponse.json({ error: 'Erro ao enviar arquivo' }, { status: 500 })
    }

    // best-effort: remove arquivo anterior (se for nosso e do prefixo permitido)
    await tryRemovePrevious({ kind, userId, eventId, previousPath, previousUrl })

    const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(path)

    return NextResponse.json(
      {
        success: true,
        bucket: BUCKET,
        path,
        url: publicUrl.data.publicUrl,
      },
      { status: 200 }
    )
  } catch (e) {
    console.error('Erro em /api/media/upload:', e)
    return NextResponse.json({ error: 'Erro ao enviar arquivo' }, { status: 500 })
  }
}
