import { notFound } from 'next/navigation'
import { QRCodeSVG } from 'qrcode.react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { supabase } from '@/lib/supabase-server'
import { VoucherClientActions } from '@/components/voucher-client-actions'
import {
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  Hash,
  MapPin,
  ShieldCheck,
  Ticket,
  User,
  Sparkles,
} from 'lucide-react'

interface Props {
  params: { id: string }
}

export default async function VoucherPage({ params }: Props) {
  // 1. Consulta dados completos da Inscrição, Evento, Tenant, Tipo de Ingresso, Pagamento e Voucher
  const { data: reg } = await supabase
    .from('Registration')
    .select(`
      id, fullName, email, cpf, status, totalValue, cartId, createdAt, customData,
      event:Event (
        id, name, slug, description, banner, startDate, endDate, location, eventFormat, tenantId,
        ticketConfig:TicketConfig ( logoUrl, backgroundColor, ticketType )
      ),
      inscriptionType:InscriptionType ( id, name, value, description ),
      voucher:Voucher ( id, qrCode, used, usedAt )
    `)
    .eq('id', params.id)
    .maybeSingle()

  if (!reg) notFound()

  const event = Array.isArray(reg.event) ? reg.event[0] : (reg.event as any)
  const inscriptionType = Array.isArray(reg.inscriptionType) ? reg.inscriptionType[0] : (reg.inscriptionType as any)
  const voucher = Array.isArray(reg.voucher) ? reg.voucher[0] : (reg.voucher as any)
  const ticketConfig = Array.isArray(event?.ticketConfig) ? event?.ticketConfig[0] : (event?.ticketConfig as any)

  // 2. Buscar informações do Tenant (Organizador)
  let tenantName = 'Organização do Evento'
  if (event?.tenantId) {
    const { data: tenant } = await supabase
      .from('Tenant')
      .select('name')
      .eq('id', event.tenantId)
      .maybeSingle()
    if (tenant?.name) tenantName = tenant.name
  }

  // 3. Buscar método de pagamento real registrado no Payment
  let paymentMethodLabel = 'PIX'
  const { data: payment } = await supabase
    .from('Payment')
    .select('method, status, paidAt')
    .eq('eventId', event?.id)
    .or(`cartId.eq.${reg.cartId || ''},cartId.like.%${reg.id}%`)
    .order('createdAt', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (payment?.method) {
    const m = payment.method.toLowerCase()
    if (m === 'pix') paymentMethodLabel = 'PIX'
    else if (m === 'card' || m === 'credit_card') paymentMethodLabel = 'Cartão de Crédito'
    else if (m === 'boleto') paymentMethodLabel = 'Boleto Bancário'
    else if (m === 'free' || Number(reg.totalValue) === 0) paymentMethodLabel = 'Gratuito'
    else paymentMethodLabel = payment.method.toUpperCase()
  } else if (Number(reg.totalValue) === 0) {
    paymentMethodLabel = 'Gratuito'
  }

  // 4. Parâmetros de Validação e QR Code oficial
  const qrPayload = `congregapay:voucher:${reg.id}`
  const isValid = reg.status === 'paid' || reg.status === 'confirmed'
  const isUsed = voucher?.used === true

  // Formatação de Datas
  const registrationDate = reg.createdAt
    ? format(new Date(reg.createdAt), "dd 'de' MMM. 'de' yyyy", { locale: ptBR })
    : '-'

  let eventDateFormatted = ''
  if (event?.startDate) {
    const start = new Date(event.startDate)
    if (event?.endDate) {
      const end = new Date(event.endDate)
      if (format(start, 'yyyy-MM-dd') === format(end, 'yyyy-MM-dd')) {
        eventDateFormatted = `${format(start, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })} · das ${format(start, 'HH:mm')} às ${format(end, 'HH:mm')}`
      } else {
        eventDateFormatted = `${format(start, "dd", { locale: ptBR })} a ${format(end, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`
      }
    } else {
      eventDateFormatted = `${format(start, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })} · Início às ${format(start, 'HH:mm')}`
    }
  }

  const shortReferenceCode = reg.id.slice(0, 8).toUpperCase()
  const customFieldsData = reg.customData && typeof reg.customData === 'object' ? reg.customData : null

  return (
    <div className="min-h-screen bg-slate-900 text-slate-900 antialiased selection:bg-emerald-500 selection:text-white py-6 sm:py-12 px-3 sm:px-6 relative overflow-hidden flex flex-col justify-center items-center">
      {/* Background Decorativo com identidade visual sofisticada */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 pointer-events-none" />
      {event?.banner && (
        <div
          className="absolute inset-0 opacity-15 bg-cover bg-center filter blur-xl scale-110 pointer-events-none"
          style={{ backgroundImage: `url(${event.banner})` }}
        />
      )}

      {/* Estilos específicos de impressão A4 limpa e sem cortes */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm 12mm;
          }
          body {
            background: #ffffff !important;
            color: #0f172a !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .no-print {
            display: none !important;
          }
          .voucher-print-wrapper {
            box-shadow: none !important;
            border: 1.5px solid #cbd5e1 !important;
            margin: 0 auto !important;
            max-width: 100% !important;
            width: 100% !important;
            border-radius: 16px !important;
            background: #ffffff !important;
          }
        }
      `}</style>

      {/* Botões de Ação Cliente (Imprimir / Salvar PDF / Compartilhar) */}
      <VoucherClientActions fullName={reg.fullName} eventName={event?.name || 'Evento'} />

      {/* CARTÃO PRINCIPAL DO VOUCHER (Inspirado na referência visual) */}
      <div className="voucher-print-wrapper w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200/90 relative z-10 my-auto transition-all">
        {/* Cabeçalho Institucional do Evento / Banner Hero */}
        <div
          className="relative px-6 sm:px-10 pt-8 pb-7 text-white overflow-hidden"
          style={{
            backgroundColor: ticketConfig?.backgroundColor || '#042f2e',
            backgroundImage: event?.banner
              ? `linear-gradient(to bottom, rgba(15, 23, 42, 0.75), rgba(15, 23, 42, 0.92)), url(${event.banner})`
              : 'linear-gradient(135deg, #064e3b 0%, #0f172a 100%)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
            <div className="space-y-1 max-w-md">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                  {tenantName}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white leading-tight">
                {event?.name || 'Voucher de Inscrição'}
              </h1>
              {event?.description && (
                <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                  {event.description}
                </p>
              )}
            </div>

            {/* Logo / Badge institucional da plataforma ou do evento */}
            <div className="shrink-0 flex items-center gap-2 self-start sm:self-center bg-white/10 backdrop-blur-md border border-white/15 px-3.5 py-2 rounded-2xl shadow-inner">
              {ticketConfig?.logoUrl ? (
                <img src={ticketConfig.logoUrl} alt="Logo" className="w-7 h-7 object-contain rounded-lg" />
              ) : (
                <Sparkles className="w-5 h-5 text-emerald-400" />
              )}
              <div className="text-left">
                <p className="text-[10px] uppercase font-bold tracking-wider text-slate-300 leading-none">Voucher Oficial</p>
                <p className="text-xs font-black text-white leading-tight">CongregaPay</p>
              </div>
            </div>
          </div>
        </div>

        {/* Corpo Interno do Documento */}
        <div className="p-6 sm:p-8 space-y-6 bg-white">
          {/* 1. Alerta de Confirmação & Status */}
          <div
            className={`p-4 rounded-2xl flex items-center gap-3.5 border transition-all ${
              isUsed
                ? 'bg-slate-50 border-slate-200 text-slate-700'
                : isValid
                ? 'bg-emerald-50 border-emerald-200/90 text-emerald-900'
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}
          >
            <div
              className={`w-10 h-10 rounded-full shrink-0 flex items-center justify-center shadow-sm ${
                isUsed
                  ? 'bg-slate-200 text-slate-600'
                  : isValid
                  ? 'bg-emerald-600 text-white'
                  : 'bg-amber-500 text-white'
              }`}
            >
              {isUsed ? (
                <CheckCircle2 className="w-6 h-6" />
              ) : isValid ? (
                <CheckCircle2 className="w-6 h-6" />
              ) : (
                <Clock className="w-6 h-6" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base sm:text-lg font-bold leading-tight flex items-center gap-2">
                {isUsed ? (
                  <span>Check-in Realizado</span>
                ) : isValid ? (
                  <span>Inscrição Confirmada!</span>
                ) : (
                  <span>Aguardando Confirmação do Pagamento</span>
                )}
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                {isUsed && voucher?.usedAt
                  ? `Voucher utilizado para entrada em ${format(new Date(voucher.usedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}.`
                  : isValid
                  ? 'Seu voucher já está liberado. Apresente o QR Code na entrada do evento para realizar o check-in.'
                  : 'Efetue o pagamento para validar sua vaga e liberar o acesso ao evento.'}
              </p>
            </div>
          </div>

          {/* 2. Grade de Dados Principais & QR Code em Destaque */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            {/* Bloco Esquerdo: Informações do Participante e Ingresso (7 colunas) */}
            <div className="md:col-span-7 space-y-4">
              {/* Nome do Participante */}
              <div>
                <p className="text-[11px] font-bold tracking-wider text-slate-500 uppercase flex items-center gap-1.5 mb-1">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  Nome do Participante
                </p>
                <p className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-tight">
                  {reg.fullName}
                </p>
                {reg.cpf && (
                  <p className="text-xs font-mono text-slate-500 mt-0.5">
                    CPF: {reg.cpf}
                  </p>
                )}
              </div>

              {/* Linha dupla: Tipo de Ingresso e Código de Referência */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <p className="text-[10px] font-bold tracking-wider text-slate-500 uppercase flex items-center gap-1 mb-0.5">
                    <Ticket className="w-3 h-3 text-slate-400" />
                    Tipo de Ingresso
                  </p>
                  <p className="text-sm font-bold text-slate-900 leading-snug">
                    {inscriptionType?.name || 'Inscrição'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold tracking-wider text-slate-500 uppercase flex items-center gap-1 mb-0.5">
                    <Hash className="w-3 h-3 text-slate-400" />
                    Código de Referência
                  </p>
                  <p className="text-sm font-mono font-bold text-slate-900 bg-slate-100 border border-slate-200 rounded px-2 py-0.5 inline-block">
                    #{shortReferenceCode}
                  </p>
                </div>
              </div>

              {/* Linha dupla: Data da Inscrição e Método de Pagamento */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <p className="text-[10px] font-bold tracking-wider text-slate-500 uppercase flex items-center gap-1 mb-0.5">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    Data da Inscrição
                  </p>
                  <p className="text-xs font-semibold text-slate-800">
                    {registrationDate}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold tracking-wider text-slate-500 uppercase flex items-center gap-1 mb-0.5">
                    <CreditCard className="w-3 h-3 text-slate-400" />
                    Método de Pagamento
                  </p>
                  <p className="text-xs font-bold text-slate-800">
                    {paymentMethodLabel}
                  </p>
                </div>
              </div>

              {/* Dados Personalizados / Campos Adicionais (se existirem) */}
              {customFieldsData && Object.keys(customFieldsData).length > 0 && (
                <div className="pt-2 border-t border-slate-100 space-y-1">
                  <p className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">Informações Adicionais</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(customFieldsData).map(([key, value]) => {
                      if (!value || typeof value === 'object') return null
                      return (
                        <span key={key} className="inline-flex items-center text-[11px] bg-slate-100 text-slate-700 rounded-md px-2 py-0.5 border border-slate-200">
                          <strong className="mr-1 capitalize">{key}:</strong> {String(value)}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Bloco Direito: Caixa de Destaque do QR Code (5 colunas) */}
            <div className="md:col-span-5 flex flex-col items-center justify-center p-5 bg-slate-50/80 rounded-2xl border-2 border-dashed border-slate-300/80 text-center">
              <div className={`p-3.5 bg-white rounded-2xl border-2 shadow-sm ${isValid && !isUsed ? 'border-emerald-300' : 'border-slate-200'}`}>
                <QRCodeSVG
                  value={qrPayload}
                  size={168}
                  level="H"
                  includeMargin={false}
                  fgColor={isValid && !isUsed ? '#0f172a' : '#64748b'}
                />
              </div>

              {/* Tag de Voucher */}
              <div className="mt-3">
                <span className="inline-block px-3 py-1 bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold text-[11px] uppercase tracking-wider rounded-full shadow-xs">
                  Voucher de Entrada
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5 leading-tight">
                Apresente este QR Code no check-in do evento
              </p>
            </div>
          </div>

          {/* 3. Informações de Local e Data do Evento */}
          <div className="p-4 bg-slate-50/90 border border-slate-200 rounded-2xl space-y-2 text-left">
            <p className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">Informações do Evento</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-slate-900">{tenantName}</p>
                  <p className="text-slate-600">{event?.location || 'Local a definir / Divulgado pela organização'}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Calendar className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-slate-900">Data e Horário</p>
                  <p className="text-slate-600">{eventDateFormatted || 'Consulte o cronograma oficial'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* 4. Próximas Etapas e Orientações */}
          <div className="p-4 bg-emerald-50/60 border border-emerald-200/80 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1.5 text-xs text-emerald-950 flex-1">
              <div className="flex items-center gap-1.5 font-bold text-emerald-900 text-sm mb-1">
                <ShieldCheck className="w-4 h-4 text-emerald-700" />
                <span>Próximas etapas</span>
              </div>
              <p className="flex items-center gap-2 text-slate-700">
                <span className="w-4 h-4 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">1</span>
                Você recebeu a confirmação e os detalhes no e-mail <strong>{reg.email}</strong>
              </p>
              <p className="flex items-center gap-2 text-slate-700">
                <span className="w-4 h-4 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">2</span>
                Salve este voucher no seu celular ou imprima para facilitar o credenciamento
              </p>
              <p className="flex items-center gap-2 text-slate-700">
                <span className="w-4 h-4 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">3</span>
                Chegue com antecedência ao local do evento com um documento oficial
              </p>
            </div>

            {/* Assinatura visual elegante */}
            <div className="shrink-0 text-center sm:text-right hidden sm:block">
              <span className="font-serif italic text-xl sm:text-2xl text-emerald-800 font-bold tracking-tight block transform -rotate-3">
                Te esperamos!
              </span>
            </div>
          </div>

          {/* 5. Rodapé Institucional */}
          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-500 text-center sm:text-left">
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Realização & Gestão</p>
              <p className="font-bold text-slate-800 text-xs mt-0.5">CongregaPay · Tecnologia para Eventos</p>
            </div>
            <div className="font-mono text-[10px] text-slate-400">
              ID Único: {reg.id}
            </div>
          </div>
        </div>
      </div>

      {/* Frase institucional no rodapé externo */}
      <p className="text-center text-xs text-slate-500 mt-6 no-print">
        Juntos fazendo eventos que transformam vidas · CongregaPay
      </p>
    </div>
  )
}
