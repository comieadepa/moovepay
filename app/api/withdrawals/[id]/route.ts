import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, hasGlobalRole } from '@/lib/rbac'
import { supabase } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: { id: string }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const ctx = getAuthContext(request)
    if (!ctx) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // 1. Somente roles administrativas financeiras podem alterar status de saque
    if (!hasGlobalRole(ctx, ['admin', 'finance'])) {
      return NextResponse.json({ error: 'Acesso não autorizado. Apenas administradores financeiros podem processar saques.' }, { status: 403 })
    }

    const { id } = params
    if (!id) {
      return NextResponse.json({ error: 'ID do saque não informado' }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const { action, notes, receiptUrl } = body as {
      action?: 'complete' | 'reject'
      notes?: string
      receiptUrl?: string
    }

    if (!action || !['complete', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Ação inválida. Use action: "complete" ou "reject".' }, { status: 400 })
    }

    // 2. Buscar o saque atual
    const { data: currentWithdrawal, error: fetchErr } = await supabase
      .from('WithdrawalRequest')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (fetchErr || !currentWithdrawal) {
      return NextResponse.json({ error: 'Solicitação de saque não encontrada' }, { status: 404 })
    }

    if (currentWithdrawal.status !== 'pending') {
      return NextResponse.json({ error: `Este saque já foi processado anteriormente com status "${currentWithdrawal.status}".` }, { status: 400 })
    }

    // 3. Processar conforme a ação
    const processedAt = new Date().toISOString()
    const processedBy = ctx.userId

    if (action === 'reject') {
      if (!notes || !notes.trim()) {
        return NextResponse.json({ error: 'É obrigatório informar o motivo da rejeição nas observações.' }, { status: 400 })
      }

      const { data: updated, error: updateErr } = await supabase
        .from('WithdrawalRequest')
        .update({
          status: 'rejected',
          notes: notes.trim(),
          processedAt,
          processedBy,
          updatedAt: processedAt,
        })
        .eq('id', id)
        .select()
        .single()

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: 'Saque rejeitado com sucesso. O saldo foi restabelecido para o tenant.',
        withdrawal: updated,
      })
    }

    if (action === 'complete') {
      const { data: updated, error: updateErr } = await supabase
        .from('WithdrawalRequest')
        .update({
          status: 'completed',
          notes: notes?.trim() || null,
          receiptUrl: receiptUrl?.trim() || null,
          processedAt,
          processedBy,
          updatedAt: processedAt,
        })
        .eq('id', id)
        .select()
        .single()

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: 'Saque marcado como concluído (repasse manual registrado).',
        withdrawal: updated,
      })
    }
  } catch (err: any) {
    console.error('[withdrawals/patch] Erro:', err)
    return NextResponse.json({ error: 'Erro ao processar alteração de saque' }, { status: 500 })
  }
}
