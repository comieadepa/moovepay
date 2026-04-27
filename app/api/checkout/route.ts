import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabase } from '@/lib/supabase-server'
import { findOrCreateCustomer, createPayment, getPixQrCode } from '@/lib/asaas'
import { addDays, format } from 'date-fns'

const checkoutSchema = z.object({
  cartId: z.string().optional(),
  registrationIds: z.array(z.string().min(1)).min(1),
  method: z.enum(['pix', 'boleto', 'card', 'free']),
  totalValue: z.number().min(0),
  payer: z.object({
    name: z.string().min(2),
    email: z.string().email(),
    cpf: z.string().min(11),
    whatsapp: z.string().optional(),
  }).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validated = checkoutSchema.parse(body)

    // 1. Buscar registrations e validar
    const { data: registrations, error: regError } = await supabase
      .from('Registration')
      .select('id, eventId, cartId, status, event:Event(id, name)')
      .in('id', validated.registrationIds)

    if (regError || !registrations?.length) {
      return NextResponse.json({ error: 'Inscrições não encontradas' }, { status: 404 })
    }

    const eventId = registrations[0].eventId
    const eventName = (registrations[0] as any).event?.name || 'Evento'
    const cartId = validated.cartId || registrations.find((r) => r.cartId)?.cartId || null

    // ── EVENTO GRATUITO: pula Asaas e confirma direto ──────────────────────
    if (validated.totalValue === 0) {
      await supabase
        .from('Registration')
        .update({ status: 'confirmed' })
        .in('id', validated.registrationIds)

      const { data: freePayment, error: fpErr } = await supabase
        .from('Payment')
        .insert({
          eventId,
          cartId: cartId || null,
          externalId: null,
          method: 'free',
          status: 'paid',
          value: 0,
        })
        .select()
        .single()

      if (fpErr) throw fpErr

      return NextResponse.json(
        { success: true, payment: { id: freePayment.id, method: 'free', status: 'paid', value: 0 } },
        { status: 201 }
      )
    }
    // ──────────────────────────────────────────────────────────────────────

    // 2. Idempotência: se já existe pagamento pago para este carrinho, rejeita
    if (cartId) {
      const { data: existingPayment } = await supabase
        .from('Payment')
        .select('id, status')
        .eq('cartId', cartId)
        .eq('status', 'paid')
        .maybeSingle()

      if (existingPayment) {
        return NextResponse.json({ error: 'Este carrinho já foi pago' }, { status: 400 })
      }
    }

    // 3. Criar/buscar cliente no ASAAS
    if (!validated.payer) {
      return NextResponse.json({ error: 'Dados do pagador são obrigatórios' }, { status: 400 })
    }
    const customer = await findOrCreateCustomer({
      name: validated.payer.name,
      email: validated.payer.email,
      cpfCnpj: validated.payer.cpf,
      mobilePhone: validated.payer.whatsapp,
    })

    // 4. Criar pagamento no ASAAS
    const billingType = validated.method === 'pix'
      ? 'PIX'
      : validated.method === 'boleto'
        ? 'BOLETO'
        : 'CREDIT_CARD'

    const dueDate = format(addDays(new Date(), 1), 'yyyy-MM-dd')

    const asaasPayment = await createPayment({
      customer: customer.id,
      billingType,
      value: validated.totalValue,
      dueDate,
      description: `Inscrição em ${eventName} (${registrations.length} participante${registrations.length !== 1 ? 's' : ''})`,
      externalReference: cartId || validated.registrationIds[0],
    })

    // 5. Salvar Payment no banco
    const { data: payment, error: paymentError } = await supabase
      .from('Payment')
      .insert({
        eventId,
        cartId: cartId || null,
        externalId: asaasPayment.id,
        method: validated.method,
        status: 'pending',
        value: validated.totalValue,
      })
      .select()
      .single()

    if (paymentError) throw paymentError

    // 6. Buscar QR Code PIX
    let pixCopyPaste: string | null = null
    if (validated.method === 'pix') {
      try {
        const qr = await getPixQrCode(asaasPayment.id)
        pixCopyPaste = qr.payload
      } catch {
        // best-effort: não bloqueia o checkout
      }
    }

    return NextResponse.json(
      {
        success: true,
        payment: {
          id: payment.id,
          externalId: asaasPayment.id,
          method: validated.method,
          status: 'pending',
          value: validated.totalValue,
          dueDate,
          pixCopyPaste,
          boletoUrl: asaasPayment?.bankSlipUrl ?? null,
          boletoBarCode: asaasPayment?.nossoNumero ?? null,
        },
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Erro no checkout:', error)
    if (error?.name === 'ZodError') {
      return NextResponse.json({ error: 'Dados inválidos', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Erro ao processar pagamento' }, { status: 500 })
  }
}
