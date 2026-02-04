import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

function toNumber(v: any) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams

    const limit = Math.max(1, Math.min(24, Number(searchParams.get('limit') || 8)))
    const open = searchParams.get('open') === '1' || searchParams.get('open') === 'true'

    let query = supabase
      .from('Event')
      .select(
        `
        *,
        inscriptionTypes:InscriptionType(value)
      `
      )
      .eq('status', 'published')
      .order('startDate', { ascending: true })
      .limit(limit)

    if (open) {
      query = query.gte('startDate', new Date().toISOString())
    }

    const { data, error } = await query
    if (error) throw error

    const events = (data ?? []).map((e: any) => {
      const prices = Array.isArray(e.inscriptionTypes)
        ? e.inscriptionTypes.map((t: any) => toNumber(t?.value))
        : []

      const minPrice = prices.length ? Math.min(...prices) : 0
      const maxPrice = prices.length ? Math.max(...prices) : 0

      return {
        id: e.id,
        slug: e.slug,
        name: e.name,
        startDate: e.startDate,
        location: e.location ?? '',
        bannerUrl: e.banner ?? '',
        minPrice,
        maxPrice,
      }
    })

    return NextResponse.json({ success: true, events }, { status: 200 })
  } catch (error) {
    console.error('Erro ao listar eventos públicos:', error)
    return NextResponse.json(
      { error: 'Erro ao listar eventos' },
      { status: 500 }
    )
  }
}
