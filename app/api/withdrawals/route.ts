import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, hasGlobalRole, isTenantMember } from '@/lib/rbac'
import { supabase } from '@/lib/supabase-server'
import { withdrawalRequestSchema } from '@/lib/validations'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // 1. Autenticação
    const ctx = getAuthContext(request)
    if (!ctx) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const tenantId = ctx.tenantId || ctx.userId

    // 2. Validação de membro do tenant (RBAC)
    const membership = await isTenantMember(tenantId, ctx.userId)
    if (!membership && tenantId !== ctx.userId) {
      return NextResponse.json({ error: 'Não autorizado para este tenant' }, { status: 403 })
    }

    // 3. Validação do body (formato da chave PIX, tipo e valor)
    const body = await request.json().catch(() => ({}))
    const parsed = withdrawalRequestSchema.safeParse(body)
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || 'Dados inválidos'
      return NextResponse.json({ error: firstError, details: parsed.error.issues }, { status: 400 })
    }

    const { amount, pixKey, pixKeyType } = parsed.data

    // 4. Executar criação atômica no banco via RPC
    // Isso adquire um advisory lock por tenant, recalcula o saldo disponível e insere o saque
    // em uma única transação atômica no PostgreSQL, prevenindo race condition.
    // O fallback não atômico foi completamente removido para assegurar consistência financeira.
    const { data: rpcResult, error: rpcError } = await supabase.rpc('create_withdrawal_request_atomic', {
      p_tenant_id: tenantId,
      p_user_id: ctx.userId,
      p_amount: amount,
      p_pix_key: pixKey.trim(),
      p_pix_key_type: pixKeyType,
    })

    if (rpcError) {
      console.error('[withdrawals] Erro ao executar RPC atômica create_withdrawal_request_atomic:', rpcError)
      return NextResponse.json(
        {
          error: 'Serviço de saques temporariamente indisponível. A proteção transacional do banco de dados não pôde ser confirmada.',
        },
        { status: 500 }
      )
    }

    if (!rpcResult) {
      return NextResponse.json(
        {
          error: 'Resposta inválida do serviço de saques.',
        },
        { status: 500 }
      )
    }

    if (rpcResult.success === false) {
      return NextResponse.json(
        {
          error: rpcResult.message || 'Saldo insuficiente',
          availableBalance: rpcResult.availableBalance,
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Solicitação de saque criada com sucesso',
        withdrawal: rpcResult.withdrawal,
        previousBalance: rpcResult.previousBalance,
        newAvailableBalance: rpcResult.newAvailableBalance,
      },
      { status: 201 }
    )
  } catch (err: any) {
    console.error('[withdrawals] Erro inesperado:', err)
    return NextResponse.json({ error: 'Erro interno ao processar saque' }, { status: 500 })
  }
}

// GET /api/withdrawals:
// - Se chamado por admin/finance com ?admin=1: lista saques de todos os tenants
// - Se chamado por tenant: lista estritamente os saques do próprio tenant
export async function GET(request: NextRequest) {
  try {
    const ctx = getAuthContext(request)
    if (!ctx) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const isAdminView = searchParams.get('admin') === '1'
    const statusFilter = searchParams.get('status')

    if (isAdminView) {
      if (!hasGlobalRole(ctx, ['admin', 'finance'])) {
        return NextResponse.json({ error: 'Acesso restrito à administração' }, { status: 403 })
      }

      let query = supabase
        .from('WithdrawalRequest')
        .select(`
          *,
          tenant:Tenant(id, name),
          user:User(id, name, email),
          processor:User!WithdrawalRequest_processedBy_fkey(id, name, email)
        `)
        .order('createdAt', { ascending: false })

      if (statusFilter && ['pending', 'completed', 'rejected'].includes(statusFilter)) {
        query = query.eq('status', statusFilter)
      }

      const { data, error } = await query

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      const pendingTotal = (data || [])
        .filter((w) => w.status === 'pending')
        .reduce((s, w) => s + Number(w.amount || 0), 0)

      const completedTotal = (data || [])
        .filter((w) => w.status === 'completed')
        .reduce((s, w) => s + Number(w.amount || 0), 0)

      return NextResponse.json({
        success: true,
        withdrawals: data || [],
        totals: {
          pending: pendingTotal,
          completed: completedTotal,
        },
      })
    }

    // Visão do Tenant
    const tenantId = ctx.tenantId || ctx.userId

    let query = supabase
      .from('WithdrawalRequest')
      .select('*')
      .eq('tenantId', tenantId)
      .order('createdAt', { ascending: false })

    if (statusFilter && ['pending', 'completed', 'rejected'].includes(statusFilter)) {
      query = query.eq('status', statusFilter)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const pendingTotal = (data || [])
      .filter((w) => w.status === 'pending')
      .reduce((s, w) => s + Number(w.amount || 0), 0)

    const completedTotal = (data || [])
      .filter((w) => w.status === 'completed')
      .reduce((s, w) => s + Number(w.amount || 0), 0)

    return NextResponse.json({
      success: true,
      withdrawals: data || [],
      totals: {
        pending: pendingTotal,
        completed: completedTotal,
      },
    })
  } catch (err: any) {
    console.error('[withdrawals] Erro inesperado no GET:', err)
    return NextResponse.json({ error: 'Erro ao consultar saques' }, { status: 500 })
  }
}
