import { NextRequest, NextResponse } from 'next/server'
import { registrationSchema } from '@/lib/validations'
import { supabase, createRegistration } from '@/lib/supabase-server'
import { sendEmail, emailTemplates } from '@/lib/email'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validar dados
    const validatedData = registrationSchema.parse(body) as any

    // Buscar o evento com tipos de inscrição
    const { data: event, error: eventError } = await supabase
      .from('Event')
      .select(`
        *,
        inscriptionTypes:InscriptionType(*)
      `)
      .eq('id', validatedData.eventId)
      .single()

    if (eventError || !event) {
      return NextResponse.json(
        { error: 'Evento não encontrado' },
        { status: 404 }
      )
    }

    // Validar tipo de inscrição
    const inscriptionType = event.inscriptionTypes.find((t: any) => t.id === validatedData.inscriptionTypeId)

    if (!inscriptionType) {
      return NextResponse.json(
        { error: 'Tipo de inscrição não encontrado' },
        { status: 404 }
      )
    }

    // Verificar disponibilidade
    const quantity = Array.isArray(validatedData.participants)
      ? Number(validatedData.quantity || validatedData.participants.length || 1)
      : 1

    if (inscriptionType.available !== null && inscriptionType.available !== undefined) {
      const { count } = await supabase
        .from('Registration')
        .select('*', { count: 'exact', head: true })
        .eq('inscriptionTypeId', inscriptionType.id)
        .neq('status', 'cancelled')

      const current = count ?? 0
      if (current + quantity > inscriptionType.available) {
        return NextResponse.json(
          { error: 'Tipo de inscrição esgotado' },
          { status: 400 }
        )
      }
    }

    const participants = Array.isArray(validatedData.participants)
      ? validatedData.participants
      : [
          {
            fullName: validatedData.fullName,
            email: validatedData.email,
            whatsapp: validatedData.whatsapp,
            cpf: validatedData.cpf,
            customData: validatedData.customData,
          },
        ]

    const cartId = participants.length > 1 ? globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}` : undefined

    const registrations = [] as any[]
    for (const p of participants) {
      const r = await createRegistration({
        eventId: event.id,
        inscriptionTypeId: inscriptionType.id,
        fullName: p.fullName,
        email: p.email,
        whatsapp: p.whatsapp,
        cpf: p.cpf,
        customData: p.customData,
        totalValue: inscriptionType.value,
        status: 'pending',
        cartId,
      } as any)
      registrations.push(r)
    }

    // Enviar email de confirmação
    try {
      const emailTemplate = emailTemplates.registrationConfirmation(
        participants[0].fullName,
        event.name
      )
      
      await sendEmail({
        to: participants[0].email,
        subject: emailTemplate.subject,
        html: emailTemplate.html,
      })
    } catch (emailError) {
      console.error('Erro ao enviar email de confirmação:', emailError)
      // Continuar mesmo se o email falhar
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Inscrição realizada com sucesso',
        registration: registrations[0],
        registrations,
        cartId,
        totalValue: Number(inscriptionType.value || 0) * registrations.length,
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Erro ao criar inscrição:', error)

    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Erro ao criar inscrição' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    // Buscar inscrições por email
    const searchParams = request.nextUrl.searchParams
    const email = searchParams.get('email')
    const eventId = searchParams.get('eventId')

    let query = supabase
      .from('Registration')
      .select(`
        *,
        event:Event(*),
        inscriptionType:InscriptionType(*)
      `)
      .order('createdAt', { ascending: false })

    if (email) query = query.eq('email', email)
    if (eventId) query = query.eq('eventId', eventId)

    const { data: registrations, error } = await query

    if (error) throw error

    return NextResponse.json(
      { success: true, registrations },
      { status: 200 }
    )
  } catch (error) {
    console.error('Erro ao listar inscrições:', error)
    return NextResponse.json(
      { error: 'Erro ao listar inscrições' },
      { status: 500 }
    )
  }
}
