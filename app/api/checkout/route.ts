import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabase } from '@/lib/supabase-server'
import {
  findOrCreateCustomer,
  createPixPayment,
  createBoletoPayment,
  createCardPayment,
  getPixQrCode,
  listPayments,
} from '@/lib/asaas'
import { addDays, format } from 'date-fns'

const creditCardSchema = z.object({
  holderName: z.string().min(3, 'Nome no cartão é obrigatório'),
  number: z.string().min(13, 'Número de cartão inválido').max(19),
  expiryMonth: z.string().min(1).max(2),
  expiryYear: z.string().min(2).max(4),
  ccv: z.string().min(3).max(4),
})

const creditCardHolderInfoSchema = z.object({
  name: z.string().min(3),
  email: z.string().email(),
  cpfCnpj: z.string().min(11),
  phone: z.string().optional(),
  mobilePhone: z.string().optional(),
  postalCode: z.string().min(8),
  address: z.string().min(2),
  addressNumber: z.string().min(1),
  complement: z.string().optional(),
  province: z.string().min(2),
  city: z.string().min(2),
})

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
  creditCard: creditCardSchema.optional(),
  creditCardHolderInfo: creditCardHolderInfoSchema.optional(),
  installments: z.number().int().min(1).max(12).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validated = checkoutSchema.parse(body)

    // 1. Buscar inscrições com InscriptionType e Event do banco
    const { data: registrations, error: regError } = await supabase
      .from('Registration')
      .select('id, eventId, inscriptionTypeId, cartId, status, totalValue, inscriptionType:InscriptionType(id, value, name), event:Event(id, name)')
      .in('id', validated.registrationIds)

    if (regError || !registrations?.length) {
      return NextResponse.json({ error: 'Inscrições não encontradas' }, { status: 404 })
    }

    if (registrations.length !== validated.registrationIds.length) {
      return NextResponse.json({ error: 'Uma ou mais inscrições não foram encontradas' }, { status: 400 })
    }

    const eventId = registrations[0].eventId
    const eventName = (registrations[0] as any).event?.name || 'Evento'
    const cartId = validated.cartId || registrations.find((r) => r.cartId)?.cartId || null

    // Validar se todas as inscrições pertencem ao mesmo evento
    const differentEvent = registrations.some((r) => r.eventId !== eventId)
    if (differentEvent) {
      return NextResponse.json({ error: 'Todas as inscrições do checkout devem pertencer ao mesmo evento' }, { status: 400 })
    }

    // 2. RECÁLCULO SEVERAMENTE NO SERVIDOR (Fonte única da verdade)
    // O valor deve vir dos registros de InscriptionType no banco, jamais do payload do cliente
    let calculatedTotal = 0
    for (const reg of registrations) {
      const itValue = Number((reg as any).inscriptionType?.value ?? reg.totalValue ?? 0)
      calculatedTotal += itValue
    }
    // Arredondar para 2 casas decimais para evitar imprecisão de ponto flutuante
    calculatedTotal = Math.round(calculatedTotal * 100) / 100

    // Se o cliente enviou um totalValue discrepante do valor calculado pelo banco, rejeitar
    const clientTotal = Math.round(Number(validated.totalValue || 0) * 100) / 100
    if (Math.abs(clientTotal - calculatedTotal) > 0.01) {
      return NextResponse.json(
        {
          error: `Divergência de valores. O valor calculado no servidor é R$ ${calculatedTotal.toFixed(2)}, mas foi enviado R$ ${clientTotal.toFixed(2)}. Atualize a página e tente novamente.`,
          serverTotal: calculatedTotal,
        },
        { status: 400 }
      )
    }

    // ── EVENTO GRATUITO: pula Asaas e confirma direto ──────────────────────
    if (calculatedTotal === 0 || validated.method === 'free') {
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

    // 3. IDENTIFICADOR DETERMINÍSTICO E PROTEÇÃO DE CONCORRÊNCIA (CLAIM PRÉ-ASAAS)
    // Se existir cartId, usa-o. Se for participante único sem cartId, gera chave determinística com registrationIds ordenados.
    const orderReference = cartId || `order:${[...validated.registrationIds].sort().join(':')}`

    // 3.1 Verificar se já existe pagamento pago para este pedido
    const { data: paidPayment } = await supabase
      .from('Payment')
      .select('id, status')
      .eq('cartId', orderReference)
      .eq('status', 'paid')
      .maybeSingle()

    if (paidPayment) {
      return NextResponse.json({ error: 'Este pedido já foi pago e confirmado.' }, { status: 400 })
    }

    // 3.2 Verificar pagamento ativo existente ('creating' ou 'pending')
    const { data: existingActive } = await supabase
      .from('Payment')
      .select('id, externalId, method, value, status, createdAt')
      .eq('cartId', orderReference)
      .in('status', ['creating', 'pending'])
      .order('createdAt', { ascending: false })
      .limit(1)
      .maybeSingle()

    let activeClaimId: string | null = null

    if (existingActive) {
      const createdAtMs = new Date(existingActive.createdAt).getTime()
      const ageInSeconds = (Date.now() - createdAtMs) / 1000

      // Caso A: Existe pagamento 'pending' válido
      if (existingActive.status === 'pending') {
        if (existingActive.method === 'pix' && existingActive.externalId) {
          try {
            const qr = await getPixQrCode(existingActive.externalId)
            return NextResponse.json({
              success: true,
              payment: {
                id: existingActive.id,
                externalId: existingActive.externalId,
                method: 'pix',
                status: 'pending',
                value: calculatedTotal,
                pixCopyPaste: qr.payload,
                pixQrCodeBase64: qr.encodedImage,
                pixExpirationDate: qr.expirationDate,
              },
            })
          } catch (qrErr) {
            console.warn('[checkout] Falha ao recuperar QR code de pagamento pendente:', qrErr)
          }
        }
        return NextResponse.json(
          { error: 'Uma cobrança para este pedido já está aguardando pagamento.' },
          { status: 409 }
        )
      }

      // Caso B: Existe claim 'creating'
      // Se foi criado há menos de 25 segundos, outra requisição está ativamente em contato com o ASAAS
      if (existingActive.status === 'creating' && ageInSeconds < 25) {
        return NextResponse.json(
          { error: 'Uma cobrança para este pedido já está sendo processada neste momento. Aguarde alguns instantes.' },
          { status: 409 }
        )
      }

      // Caso C: Existe claim 'creating' órfão (> 25 segundos)
      // Executa reconciliação consultando o ASAAS por externalReference
      if (existingActive.status === 'creating' && ageInSeconds >= 25) {
        try {
          const asaasList = await listPayments({ externalReference: orderReference, limit: 5 })
          const paymentsFound = asaasList?.data || []
          // Procura cobrança correspondente com mesmo valor
          const matched = paymentsFound.find((p: any) => Math.abs(Number(p.value) - calculatedTotal) < 0.01)

          if (matched && matched.id) {
            // Reconciliação com sucesso: atualiza Payment local para 'pending'
            await supabase
              .from('Payment')
              .update({
                externalId: matched.id,
                status: 'pending',
                updatedAt: new Date().toISOString(),
              })
              .eq('id', existingActive.id)

            if (validated.method === 'pix') {
              try {
                const qr = await getPixQrCode(matched.id)
                return NextResponse.json({
                  success: true,
                  payment: {
                    id: existingActive.id,
                    externalId: matched.id,
                    method: 'pix',
                    status: 'pending',
                    value: calculatedTotal,
                    pixCopyPaste: qr.payload,
                    pixQrCodeBase64: qr.encodedImage,
                    pixExpirationDate: qr.expirationDate,
                  },
                })
              } catch {}
            }

            return NextResponse.json({
              success: true,
              payment: {
                id: existingActive.id,
                externalId: matched.id,
                method: validated.method,
                status: 'pending',
                value: calculatedTotal,
                boletoUrl: matched.bankSlipUrl ?? null,
                boletoBarCode: matched.nossoNumero ?? null,
                invoiceUrl: matched.invoiceUrl ?? null,
              },
            })
          } else {
            // Nenhuma cobrança criada no Asaas: libera o claim órfão marcando como 'failed'
            await supabase
              .from('Payment')
              .update({ status: 'failed', updatedAt: new Date().toISOString() })
              .eq('id', existingActive.id)
          }
        } catch (recErr) {
          console.error('[checkout] Erro durante reconciliação de claim órfão:', recErr)
        }
      }
    }

    // 3.3 CLAIM ATÔMICO NO BANCO ANTES DE CHAMAR O ASAAS
    // Insere o registro em estado provisório 'creating'.
    // Se outra requisição simultânea tentar ao mesmo tempo, a constraint ou a verificação prévia barra.
    const { data: claimPayment, error: claimError } = await supabase
      .from('Payment')
      .insert({
        eventId,
        cartId: orderReference,
        externalId: null,
        method: validated.method,
        status: 'creating',
        value: calculatedTotal,
      })
      .select()
      .single()

    if (claimError || !claimPayment) {
      // Violação de concorrência ou duplicate key
      return NextResponse.json(
        { error: 'Não foi possível iniciar o pagamento deste pedido porque outra tentativa concorrente está em andamento.' },
        { status: 409 }
      )
    }

    activeClaimId = claimPayment.id

    // 4. Criar/buscar cliente no ASAAS
    if (!validated.payer) {
      await supabase.from('Payment').update({ status: 'failed' }).eq('id', activeClaimId)
      return NextResponse.json({ error: 'Dados do pagador são obrigatórios' }, { status: 400 })
    }

    let customer: any
    try {
      customer = await findOrCreateCustomer({
        name: validated.payer.name,
        email: validated.payer.email,
        cpfCnpj: validated.payer.cpf,
        mobilePhone: validated.payer.whatsapp,
      })
    } catch (custErr: any) {
      await supabase.from('Payment').update({ status: 'failed' }).eq('id', activeClaimId)
      throw custErr
    }

    const dueDate = format(addDays(new Date(), 1), 'yyyy-MM-dd')
    const description = `Inscrição em ${eventName} (${registrations.length} participante${registrations.length !== 1 ? 's' : ''})`
    const externalReference = orderReference

    let asaasPayment: any = null
    let pixCopyPaste: string | null = null
    let pixQrCodeBase64: string | null = null
    let pixExpirationDate: string | null = null

    try {
      // 5. Executar chamada específica por método no ASAAS usando estritamente calculatedTotal
      if (validated.method === 'pix') {
        asaasPayment = await createPixPayment({
          customer: customer.id,
          billingType: 'PIX',
          value: calculatedTotal,
          dueDate,
          description,
          externalReference,
        })

        try {
          const qr = await getPixQrCode(asaasPayment.id)
          pixCopyPaste = qr.payload
          pixQrCodeBase64 = qr.encodedImage
          pixExpirationDate = qr.expirationDate
        } catch (qrErr) {
          console.error('[checkout/pix] Erro ao buscar QR Code PIX do ASAAS:', qrErr)
        }
      } else if (validated.method === 'boleto') {
        asaasPayment = await createBoletoPayment({
          customer: customer.id,
          billingType: 'BOLETO',
          value: calculatedTotal,
          dueDate,
          description,
          externalReference,
        })
      } else if (validated.method === 'card') {
        if (!validated.creditCard) {
          await supabase.from('Payment').update({ status: 'failed' }).eq('id', activeClaimId)
          return NextResponse.json({ error: 'Dados do cartão de crédito são obrigatórios' }, { status: 400 })
        }
        if (!validated.creditCardHolderInfo) {
          await supabase.from('Payment').update({ status: 'failed' }).eq('id', activeClaimId)
          return NextResponse.json({ error: 'Dados do titular do cartão são obrigatórios' }, { status: 400 })
        }

        let expiryMonth = validated.creditCard.expiryMonth.padStart(2, '0')
        let expiryYear = validated.creditCard.expiryYear.trim()
        if (expiryYear.length === 2) {
          expiryYear = `20${expiryYear}`
        }

        const holderInfo = validated.creditCardHolderInfo
        const holderPhone = holderInfo.phone || holderInfo.mobilePhone || validated.payer.whatsapp || '11999999999'
        const remoteIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || undefined

        asaasPayment = await createCardPayment({
          customer: customer.id,
          billingType: 'CREDIT_CARD',
          value: calculatedTotal,
          dueDate,
          description,
          externalReference,
          installmentCount: validated.installments || 1,
          creditCard: {
            holderName: validated.creditCard.holderName.trim(),
            number: validated.creditCard.number.replace(/\D/g, ''),
            expiryMonth,
            expiryYear,
            ccv: validated.creditCard.ccv.trim(),
          },
          creditCardHolderInfo: {
            name: holderInfo.name.trim(),
            email: holderInfo.email.trim(),
            cpfCnpj: holderInfo.cpfCnpj.replace(/\D/g, ''),
            phone: holderPhone.replace(/\D/g, ''),
            mobilePhone: holderPhone.replace(/\D/g, ''),
            address: holderInfo.address.trim(),
            addressNumber: holderInfo.addressNumber.trim(),
            complement: holderInfo.complement?.trim() || undefined,
            province: holderInfo.province.trim(),
            city: holderInfo.city.trim(),
            postalCode: holderInfo.postalCode.replace(/\D/g, ''),
          },
          ...(remoteIp ? { remoteIp } : {}),
        } as any)
      }

      if (!asaasPayment?.id) {
        throw new Error('Falha ao registrar cobrança no ASAAS')
      }

      // 6. Atualizar Payment de 'creating' para 'pending' associando o externalId
      const { error: updateError } = await supabase
        .from('Payment')
        .update({
          externalId: asaasPayment.id,
          status: 'pending',
          updatedAt: new Date().toISOString(),
        })
        .eq('id', activeClaimId)

      if (updateError) {
        console.error('[checkout] Erro ao atualizar status para pending:', updateError)
      }

      return NextResponse.json(
        {
          success: true,
          payment: {
            id: activeClaimId,
            externalId: asaasPayment.id,
            method: validated.method,
            status: 'pending',
            value: calculatedTotal,
            dueDate,
            pixCopyPaste,
            pixQrCodeBase64,
            pixExpirationDate,
            boletoUrl: asaasPayment?.bankSlipUrl ?? null,
            boletoBarCode: asaasPayment?.nossoNumero ?? null,
            invoiceUrl: asaasPayment?.invoiceUrl ?? null,
          },
        },
        { status: 201 }
      )
    } catch (asaasErr: any) {
      // Em caso de falha na chamada ao Asaas (recusa de cartão, timeout etc.), libera o claim provisório marcando como failed
      if (activeClaimId) {
        await supabase
          .from('Payment')
          .update({ status: 'failed', updatedAt: new Date().toISOString() })
          .eq('id', activeClaimId)
      }
      throw asaasErr
    }
  } catch (error: any) {
    console.error('[checkout] Erro no processamento:', error?.response?.data || error?.message || error)

    if (error?.name === 'ZodError') {
      const firstMsg = error.errors?.[0]?.message || 'Dados inválidos'
      return NextResponse.json({ error: firstMsg, details: error.errors }, { status: 400 })
    }

    // Tratar erros específicos retornados pela API do ASAAS
    const asaasErrors = error?.response?.data?.errors
    if (Array.isArray(asaasErrors) && asaasErrors.length > 0) {
      const errorMsg = asaasErrors.map((e: any) => e.description || e.message).join('; ')
      return NextResponse.json({ error: errorMsg, asaasErrors }, { status: 400 })
    }

    const message = error?.response?.data?.message || error?.message || 'Erro ao processar pagamento'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
