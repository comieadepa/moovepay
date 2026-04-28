import { notFound } from 'next/navigation'
import { QRCodeSVG } from 'qrcode.react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { supabase } from '@/lib/supabase-server'

interface Props {
  params: { id: string }
}

export default async function VoucherPage({ params }: Props) {
  const { data: reg } = await supabase
    .from('Registration')
    .select(`
      id, fullName, email, cpf, status, totalValue, createdAt,
      event:Event ( id, name, startDate, endDate, location ),
      inscriptionType:InscriptionType ( id, name, value ),
      voucher:Voucher ( id, used, usedAt )
    `)
    .eq('id', params.id)
    .maybeSingle()

  if (!reg) notFound()

  const event = Array.isArray(reg.event) ? reg.event[0] : (reg.event as any)
  const inscriptionType = Array.isArray(reg.inscriptionType) ? reg.inscriptionType[0] : (reg.inscriptionType as any)
  const voucher = Array.isArray(reg.voucher) ? reg.voucher[0] : (reg.voucher as any)

  const qrPayload = `congregapay:voucher:${reg.id}`
  const isPaid = reg.status === 'paid'
  const isUsed = voucher?.used === true

  const startDate = event?.startDate
    ? format(new Date(event.startDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
    : null

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 pt-8 pb-6 text-white text-center">
          <div className="text-xs font-semibold tracking-widest uppercase opacity-80 mb-1">CongregaPay</div>
          <h1 className="text-xl font-bold leading-tight">{event?.name ?? 'Evento'}</h1>
          {startDate && (
            <p className="text-sm opacity-80 mt-1">{startDate}</p>
          )}
          {event?.location && (
            <p className="text-xs opacity-70 mt-0.5">{event.location}</p>
          )}
        </div>

        {/* Status badge */}
        <div className="flex justify-center -mt-4 mb-2 relative z-10">
          {isUsed ? (
            <span className="bg-gray-500 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow">
              ✓ UTILIZADO
            </span>
          ) : isPaid ? (
            <span className="bg-emerald-500 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow">
              ✓ VÁLIDO
            </span>
          ) : (
            <span className="bg-amber-400 text-gray-900 text-xs font-bold px-4 py-1.5 rounded-full shadow">
              AGUARDANDO PAGAMENTO
            </span>
          )}
        </div>

        {/* QR Code */}
        <div className="flex justify-center px-6 py-4">
          <div className={`p-3 rounded-2xl border-2 ${isPaid && !isUsed ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 bg-gray-50'}`}>
            <QRCodeSVG
              value={qrPayload}
              size={192}
              level="H"
              includeMargin={false}
              fgColor={isPaid && !isUsed ? '#065f46' : '#6b7280'}
            />
          </div>
        </div>

        {/* ID curto */}
        <p className="text-center text-xs text-gray-400 font-mono tracking-wider mb-4">
          {reg.id.slice(0, 8).toUpperCase()}
        </p>

        {/* Dados do participante */}
        <div className="px-6 pb-2 space-y-2">
          <Row label="Participante" value={reg.fullName} />
          {inscriptionType?.name && (
            <Row label="Tipo de inscrição" value={inscriptionType.name} />
          )}
          {reg.totalValue > 0 && (
            <Row
              label="Valor pago"
              value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(reg.totalValue)}
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-5 mt-2 border-t border-gray-100 text-center">
          {isUsed && voucher?.usedAt && (
            <p className="text-xs text-gray-500 mb-2">
              Check-in realizado em{' '}
              {format(new Date(voucher.usedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </p>
          )}
          <p className="text-xs text-gray-400">
            Apresente este QR Code na entrada do evento.
          </p>
        </div>

      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-baseline gap-2">
      <span className="text-xs text-gray-500 shrink-0">{label}</span>
      <span className="text-sm font-medium text-gray-800 text-right truncate">{value}</span>
    </div>
  )
}
