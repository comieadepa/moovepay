import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getAuthContext } from '@/lib/rbac'
import { supabase } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const BUCKET = 'moovepay-media'
const PREFIX = 'banners/no-event'

function extractPathFromPublicUrl(url: string) {
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

const querySchema = z.object({
  olderThanHours: z.coerce.number().int().min(1).max(24 * 90).default(48),
  dryRun: z.coerce.boolean().default(true),
  limit: z.coerce.number().int().min(1).max(1000).default(1000),
})

export async function POST(request: NextRequest) {
  try {
    const ctx = getAuthContext(request)
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (ctx.role !== 'admin') return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })

    const parsed = querySchema.parse({
      olderThanHours: request.nextUrl.searchParams.get('olderThanHours') ?? undefined,
      dryRun: request.nextUrl.searchParams.get('dryRun') ?? undefined,
      limit: request.nextUrl.searchParams.get('limit') ?? undefined,
    })

    // Busca banners referenciados que estão em banners/no-event
    const { data: referencedEvents, error: refErr } = await supabase
      .from('Event')
      .select('id, banner')
      .not('banner', 'is', null)
      .ilike('banner', `%/${BUCKET}/${PREFIX}/%`)

    if (refErr) throw refErr

    const referencedPaths = new Set<string>()
    for (const ev of referencedEvents || []) {
      const banner = String((ev as any).banner || '')
      const extracted = extractPathFromPublicUrl(banner)
      if (extracted && extracted.bucket === BUCKET) {
        referencedPaths.add(extracted.path)
      }
    }

    const now = Date.now()
    const cutoffMs = parsed.olderThanHours * 60 * 60 * 1000

    let offset = 0
    const candidates: Array<{ path: string; createdAt?: string | null; size?: number | null }> = []

    while (true) {
      const { data: objects, error: listErr } = await supabase.storage.from(BUCKET).list(PREFIX, {
        limit: parsed.limit,
        offset,
        sortBy: { column: 'created_at', order: 'asc' },
      })

      if (listErr) throw listErr
      const batch = objects || []
      if (batch.length === 0) break

      for (const obj of batch as any[]) {
        const name = String(obj?.name || '')
        if (!name) continue

        const path = `${PREFIX}/${name}`
        if (referencedPaths.has(path)) continue

        const createdAt = String(obj?.created_at || obj?.createdAt || '')
        const createdMs = createdAt ? Date.parse(createdAt) : NaN
        if (!Number.isFinite(createdMs)) continue

        if (now - createdMs >= cutoffMs) {
          candidates.push({ path, createdAt, size: obj?.metadata?.size ?? null })
        }
      }

      if (batch.length < parsed.limit) break
      offset += parsed.limit

      // safety: evita loop infinito
      if (offset > 20000) break
    }

    if (parsed.dryRun) {
      return NextResponse.json(
        {
          success: true,
          dryRun: true,
          bucket: BUCKET,
          prefix: PREFIX,
          olderThanHours: parsed.olderThanHours,
          referencedCount: referencedPaths.size,
          deleteCount: candidates.length,
          sample: candidates.slice(0, 50),
        },
        { status: 200 }
      )
    }

    const toDelete = candidates.map((c) => c.path)
    let deleted = 0

    // remove em lotes (Storage API aceita array)
    for (let i = 0; i < toDelete.length; i += 100) {
      const chunk = toDelete.slice(i, i + 100)
      const { error: rmErr } = await supabase.storage.from(BUCKET).remove(chunk)
      if (rmErr) throw rmErr
      deleted += chunk.length
    }

    return NextResponse.json(
      {
        success: true,
        dryRun: false,
        bucket: BUCKET,
        prefix: PREFIX,
        olderThanHours: parsed.olderThanHours,
        referencedCount: referencedPaths.size,
        deletedCount: deleted,
      },
      { status: 200 }
    )
  } catch (e: any) {
    console.error('Erro em /api/admin/media/cleanup:', e)
    if (e?.name === 'ZodError') {
      return NextResponse.json({ error: 'Parâmetros inválidos', details: e.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Erro ao executar limpeza' }, { status: 500 })
  }
}
