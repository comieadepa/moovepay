import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase-server'
import { getAuthContext } from '@/lib/rbac'
import { sendEmail, emailTemplates } from '@/lib/email'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = getAuthContext(request)
  if (!ctx) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const { data: reg, error: regErr } = await supabase
    .from('Registration')
    .select('id, fullName, email, status, event:Event(id, name, tenantId, creatorId)')
    .eq('id', params.id)
    .maybeSingle()

  if (regErr || !reg) {
    return NextResponse.json({ error: 'Inscrição não encontrada' }, { status: 404 })
  }

  const event = Array.isArray(reg.event) ? reg.event[0] : (reg.event as any)
  const ownsEvent =
    event?.tenantId === ctx.tenantId ||
    event?.creatorId === ctx.userId

  if (!ownsEvent) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  // Só envia voucher se a inscrição estiver paga; caso contrário envia confirmação pendente
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  const voucherUrl = `${appUrl}/voucher/${reg.id}`

  const template = reg.status === 'paid'
    ? emailTemplates.voucherEmail(reg.fullName, event?.name || 'Evento', voucherUrl)
    : emailTemplates.registrationConfirmation(reg.fullName, event?.name || 'Evento')

  try {
    await sendEmail({
      to: reg.email,
      subject: template.subject,
      html: template.html,
    })
  } catch (e) {
    console.error('Erro ao reenviar email:', e)
    return NextResponse.json({ error: 'Erro ao enviar email' }, { status: 500 })
  }

  return NextResponse.json({ success: true, sentTo: reg.email })
}
