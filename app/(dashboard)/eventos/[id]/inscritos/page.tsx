'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useReactToPrint } from 'react-to-print'
import { QRCodeSVG } from 'qrcode.react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ArrowLeft,
  Mail,
  Printer,
  Search,
  CheckCircle,
  Edit2,
  RefreshCw,
  ScanLine,
} from 'lucide-react'

type Registration = {
  id: string
  fullName: string
  email: string
  whatsapp?: string | null
  cpf: string
  customData?: Record<string, any> | null
  status: string
  totalValue: number
  createdAt: string
  cartId?: string | null
  inscriptionType?: { id: string; name: string; value: number } | null
  event?: { id: string; name: string; startDate: string; customFields?: any[] | null } | null
}

type StatusFilter = 'all' | 'paid' | 'pending' | 'cancelled'

const STATUS_LABELS: Record<string, string> = {
  paid: 'Pago',
  pending: 'Pendente',
  cancelled: 'Cancelado',
}

const STATUS_COLORS: Record<string, string> = {
  paid: 'bg-emerald-100 text-emerald-800',
  pending: 'bg-amber-100 text-amber-800',
  cancelled: 'bg-red-100 text-red-800',
}

export default function InscritosPage({ params }: { params: { id: string } }) {
  const router = useRouter()

  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [eventName, setEventName] = useState('')

  // Edit modal
  const [editReg, setEditReg] = useState<Registration | null>(null)
  const [editForm, setEditForm] = useState<{ fullName: string; email: string; whatsapp: string; cpf: string; customData: Record<string, any> }>({
    fullName: '', email: '', whatsapp: '', cpf: '', customData: {},
  })
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // Action feedback
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Voucher print
  const [voucherReg, setVoucherReg] = useState<Registration | null>(null)
  const voucherPrintTrigger = useRef(false)

  // Print refs
  const listPrintRef = useRef<HTMLDivElement>(null)
  const voucherPrintRef = useRef<HTMLDivElement>(null)

  const handlePrintList = useReactToPrint({
    content: () => listPrintRef.current,
    documentTitle: `Inscritos - ${eventName}`,
  })

  const handlePrintVoucher = useReactToPrint({
    content: () => voucherPrintRef.current,
    documentTitle: voucherReg ? `Voucher - ${voucherReg.fullName}` : 'Voucher',
    onAfterPrint: () => {
      setVoucherReg(null)
      voucherPrintTrigger.current = false
    },
  })

  // Trigger voucher print after DOM updates with the new voucherReg
  useEffect(() => {
    if (voucherReg && voucherPrintTrigger.current) {
      const t = setTimeout(() => {
        handlePrintVoucher()
      }, 80)
      return () => clearTimeout(t)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voucherReg])

  const fetchRegistrations = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/registrations?eventId=${params.id}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao carregar inscrições')
      const list: Registration[] = data.registrations || []
      setRegistrations(list)
      const firstName = list[0]?.event?.name
      if (firstName) setEventName(firstName)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [params.id])

  useEffect(() => {
    fetchRegistrations()
  }, [fetchRegistrations])

  const filtered = registrations.filter((r) => {
    const q = search.toLowerCase().trim()
    const matchSearch =
      !q ||
      r.fullName.toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q) ||
      (r.cpf || '').toLowerCase().replace(/\D/g, '').includes(q.replace(/\D/g, ''))
    const matchStatus = statusFilter === 'all' || r.status === statusFilter
    return matchSearch && matchStatus
  })

  const stats = {
    total: registrations.length,
    paid: registrations.filter((r) => r.status === 'paid').length,
    pending: registrations.filter((r) => r.status === 'pending').length,
    revenue: registrations
      .filter((r) => r.status === 'paid')
      .reduce((s, r) => s + Number(r.totalValue || 0), 0),
  }

  function showSuccess(msg: string) {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(null), 3000)
  }

  async function handleManualApprove(reg: Registration) {
    if (!confirm(`Confirmar baixa manual de pagamento para ${reg.fullName}?`)) return
    setActionLoading(reg.id)
    try {
      const res = await fetch(`/api/registrations/${reg.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'paid' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao confirmar pagamento')
      setRegistrations((prev) =>
        prev.map((r) => (r.id === reg.id ? { ...r, status: 'paid' } : r))
      )
      showSuccess(`Pagamento de ${reg.fullName} confirmado.`)
    } catch (e: any) {
      alert(e.message)
    } finally {
      setActionLoading(null)
    }
  }

  async function handleResendEmail(reg: Registration) {
    setActionLoading(`${reg.id}:email`)
    try {
      const res = await fetch(`/api/registrations/${reg.id}/resend-email`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao reenviar email')
      showSuccess(`Email reenviado para ${reg.email}.`)
    } catch (e: any) {
      alert(e.message)
    } finally {
      setActionLoading(null)
    }
  }

  function openEdit(reg: Registration) {
    setEditReg(reg)
    setEditForm({
      fullName: reg.fullName,
      email: reg.email,
      whatsapp: reg.whatsapp || '',
      cpf: reg.cpf || '',
      customData: (reg.customData as Record<string, any>) || {},
    })
    setEditError(null)
  }

  async function handleEditSave() {
    if (!editReg) return
    setEditSaving(true)
    setEditError(null)
    try {
      const res = await fetch(`/api/registrations/${editReg.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar')
      setRegistrations((prev) =>
        prev.map((r) =>
          r.id === editReg.id
            ? { ...r, fullName: editForm.fullName, email: editForm.email, whatsapp: editForm.whatsapp, cpf: editForm.cpf, customData: editForm.customData }
            : r
        )
      )
      setEditReg(null)
      showSuccess('Dados atualizados com sucesso.')
    } catch (e: any) {
      setEditError(e.message)
    } finally {
      setEditSaving(false)
    }
  }

  function triggerVoucherPrint(reg: Registration) {
    voucherPrintTrigger.current = true
    setVoucherReg(reg)
  }

  const totalRevenue = stats.revenue.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })

  return (
    <div className="max-w-6xl">
      {/* ── ÁREA DE IMPRESSÃO: Lista LGPD (sem dados sensíveis) ── */}
      <div style={{ overflow: 'hidden', height: 0 }}>
        <div ref={listPrintRef} style={{ padding: '16px', fontFamily: 'sans-serif' }}>
          <h1 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '4px' }}>
            Lista de Inscritos
          </h1>
          <p style={{ fontSize: '13px', marginBottom: '16px', color: '#555' }}>
            Evento: {eventName}
          </p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ background: '#f1f5f9' }}>
                {['Nome', 'Email', 'Tipo de Inscrição', 'Status', 'Valor', 'Data'].map(
                  (h) => (
                    <th
                      key={h}
                      style={{
                        border: '1px solid #cbd5e1',
                        padding: '6px 8px',
                        textAlign: 'left',
                      }}
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px' }}>
                    {r.fullName}
                  </td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px' }}>
                    {r.email}
                  </td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px' }}>
                    {r.inscriptionType?.name || '—'}
                  </td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px' }}>
                    {STATUS_LABELS[r.status] || r.status}
                  </td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px' }}>
                    {Number(r.totalValue || 0).toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px' }}>
                    {format(new Date(r.createdAt), 'dd/MM/yyyy', { locale: ptBR })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ fontSize: '10px', marginTop: '16px', color: '#888' }}>
            Total: {filtered.length} inscrito(s). Gerado em{' '}
            {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}. Dados
            sensíveis (CPF, WhatsApp) omitidos conforme LGPD.
          </p>
        </div>
      </div>

      {/* ── ÁREA DE IMPRESSÃO: Voucher individual ── */}
      <div style={{ overflow: 'hidden', height: 0 }}>
        <div ref={voucherPrintRef} style={{ padding: '12mm', fontFamily: 'sans-serif' }}>
          {voucherReg && (
            <div style={{ maxWidth: '90mm' }}>
              <div
                style={{
                  borderBottom: '2px solid #10b981',
                  paddingBottom: '8px',
                  marginBottom: '12px',
                }}
              >
                <h2
                  style={{ fontSize: '16px', fontWeight: 'bold', margin: '0 0 2px 0' }}
                >
                  {eventName}
                </h2>
                <p style={{ fontSize: '11px', color: '#555', margin: 0 }}>
                  {voucherReg.event?.startDate
                    ? format(
                        new Date(voucherReg.event.startDate),
                        "dd/MM/yyyy 'às' HH:mm",
                        { locale: ptBR }
                      )
                    : ''}
                </p>
              </div>
              <p
                style={{ fontSize: '15px', fontWeight: 'bold', margin: '0 0 2px 0' }}
              >
                {voucherReg.fullName}
              </p>
              <p style={{ fontSize: '11px', color: '#555', margin: '0 0 2px 0' }}>
                {voucherReg.email}
              </p>
              <p style={{ fontSize: '11px', margin: '0 0 12px 0' }}>
                <strong>Tipo:</strong> {voucherReg.inscriptionType?.name || 'Inscrição'}
                &nbsp;&nbsp;
                <strong>Status:</strong>{' '}
                {STATUS_LABELS[voucherReg.status] || voucherReg.status}
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', margin: '0 0 8px 0' }}>
                <QRCodeSVG value={`congregapay:reg:${voucherReg.id}`} size={160} />
              </div>
              <p
                style={{
                  fontSize: '9px',
                  textAlign: 'center',
                  color: '#888',
                  wordBreak: 'break-all',
                }}
              >
                ID: {voucherReg.id}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── CABEÇALHO ── */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Inscritos</h1>
          <p className="text-slate-600 mt-1">{eventName || 'Carregando...'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => router.push(`/eventos/${params.id}`)}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Voltar ao evento
          </Button>
          <Button
            onClick={() => router.push(`/eventos/${params.id}/checkin`)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
          >
            <ScanLine className="h-4 w-4" />
            Check-in
          </Button>
          <Button
            variant="outline"
            onClick={fetchRegistrations}
            disabled={loading}
            title="Atualizar lista"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            variant="outline"
            onClick={handlePrintList}
            disabled={filtered.length === 0}
            title="Imprimir lista sem dados sensíveis (LGPD)"
          >
            <Printer className="h-4 w-4 mr-1" />
            Lista (LGPD)
          </Button>
        </div>
      </div>

      {/* ── FEEDBACK DE SUCESSO ── */}
      {successMsg && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-md text-sm">
          {successMsg}
        </div>
      )}

      {/* ── CARDS DE RESUMO ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total', value: stats.total, color: 'text-slate-700' },
          { label: 'Pagos', value: stats.paid, color: 'text-emerald-700' },
          { label: 'Pendentes', value: stats.pending, color: 'text-amber-700' },
          { label: 'Receita confirmada', value: totalRevenue, color: 'text-blue-700' },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-slate-500 mb-1">{s.label}</p>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── FILTROS ── */}
      <Card className="mb-4">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
              <Input
                placeholder="Buscar por nome, email ou CPF..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { key: 'all', label: 'Todos' },
                  { key: 'paid', label: 'Pagos' },
                  { key: 'pending', label: 'Pendentes' },
                  { key: 'cancelled', label: 'Cancelados' },
                ] as { key: StatusFilter; label: string }[]
              ).map((s) => (
                <button
                  key={s.key}
                  onClick={() => setStatusFilter(s.key)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    statusFilter === s.key
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-300 hover:border-slate-500'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── TABELA ── */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-10 text-center text-slate-500">
              Carregando inscrições...
            </div>
          ) : error ? (
            <div className="p-10 text-center text-red-600">{error}</div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-slate-500">
              {registrations.length === 0
                ? 'Nenhuma inscrição registrada para este evento ainda.'
                : 'Nenhum resultado para os filtros aplicados.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className="px-4 py-3 text-left font-medium text-slate-600">
                      Participante
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">
                      Tipo
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-slate-600">
                      Valor
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">
                      Data
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-slate-600">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((reg) => {
                    const isLoading = actionLoading === reg.id
                    const isEmailLoading = actionLoading === `${reg.id}:email`
                    return (
                      <tr
                        key={reg.id}
                        className="border-b hover:bg-slate-50 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">
                            {reg.fullName}
                          </div>
                          <div className="text-xs text-slate-500">{reg.email}</div>
                          {reg.whatsapp && (
                            <div className="text-xs text-slate-400">{reg.whatsapp}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {reg.inscriptionType?.name || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              STATUS_COLORS[reg.status] || 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {STATUS_LABELS[reg.status] || reg.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-slate-700 tabular-nums">
                          {Number(reg.totalValue || 0).toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {format(new Date(reg.createdAt), 'dd/MM/yy', {
                            locale: ptBR,
                          })}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {/* Editar */}
                            <button
                              title="Editar dados do inscrito"
                              onClick={() => openEdit(reg)}
                              className="p-1.5 rounded hover:bg-slate-200 text-slate-600 transition-colors"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>

                            {/* Reenviar email */}
                            <button
                              title="Reenviar email de confirmação"
                              onClick={() => handleResendEmail(reg)}
                              disabled={isEmailLoading}
                              className="p-1.5 rounded hover:bg-blue-100 text-blue-600 disabled:opacity-40 transition-colors"
                            >
                              <Mail className="h-4 w-4" />
                            </button>

                            {/* Baixa manual — só para pendentes */}
                            {reg.status === 'pending' && (
                              <button
                                title="Confirmar pagamento manualmente"
                                onClick={() => handleManualApprove(reg)}
                                disabled={isLoading}
                                className="p-1.5 rounded hover:bg-emerald-100 text-emerald-600 disabled:opacity-40 transition-colors"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </button>
                            )}

                            {/* Imprimir voucher */}
                            <button
                              title="Imprimir voucher com QR Code"
                              onClick={() => triggerVoucherPrint(reg)}
                              className="p-1.5 rounded hover:bg-slate-200 text-slate-600 transition-colors"
                            >
                              <Printer className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <div className="px-4 py-3 text-xs text-slate-500 border-t bg-slate-50">
                Exibindo <strong>{filtered.length}</strong> de{' '}
                <strong>{registrations.length}</strong> inscrições
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── MODAL DE EDIÇÃO ── */}
      {editReg && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditReg(null)
          }}
        >
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Editar dados do inscrito</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {editError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
                  {editError}
                </div>
              )}

              {/* ── Campos fixos ── */}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-sm font-medium text-slate-700 block mb-1">
                    Nome completo
                  </label>
                  <Input
                    value={editForm.fullName}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, fullName: e.target.value }))
                    }
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium text-slate-700 block mb-1">
                    Email
                  </label>
                  <Input
                    type="email"
                    value={editForm.email}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, email: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">
                    CPF
                  </label>
                  <Input
                    value={editForm.cpf}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, cpf: e.target.value }))
                    }
                    placeholder="000.000.000-00"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">
                    WhatsApp
                  </label>
                  <Input
                    value={editForm.whatsapp}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, whatsapp: e.target.value }))
                    }
                    placeholder="(11) 99999-9999"
                  />
                </div>
              </div>

              {/* ── Campos personalizados do evento ── */}
              {(() => {
                const customFields: any[] = editReg?.event?.customFields || []
                if (customFields.length === 0) return null
                return (
                  <div className="space-y-3 border-t pt-3">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Campos personalizados
                    </p>
                    {customFields.map((f: any) => (
                      <div key={f.key}>
                        <label className="text-sm font-medium text-slate-700 block mb-1">
                          {f.label}{f.required ? ' *' : ''}
                        </label>
                        {f.type === 'textarea' ? (
                          <textarea
                            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                            rows={3}
                            placeholder={f.placeholder || ''}
                            value={(editForm.customData[f.key] as string) ?? ''}
                            onChange={(e) =>
                              setEditForm((form) => ({
                                ...form,
                                customData: { ...form.customData, [f.key]: e.target.value },
                              }))
                            }
                          />
                        ) : f.type === 'select' ? (
                          <select
                            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white"
                            value={(editForm.customData[f.key] as string) ?? ''}
                            onChange={(e) =>
                              setEditForm((form) => ({
                                ...form,
                                customData: { ...form.customData, [f.key]: e.target.value },
                              }))
                            }
                          >
                            <option value="">Selecionar...</option>
                            {(f.options || []).map((opt: string) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        ) : f.type === 'checkbox' ? (
                          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              className="w-4 h-4 accent-blue-600"
                              checked={Boolean(editForm.customData[f.key])}
                              onChange={(e) =>
                                setEditForm((form) => ({
                                  ...form,
                                  customData: { ...form.customData, [f.key]: e.target.checked },
                                }))
                              }
                            />
                            {f.placeholder || 'Marcar'}
                          </label>
                        ) : (
                          <Input
                            type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                            placeholder={f.placeholder || ''}
                            value={(editForm.customData[f.key] as string) ?? ''}
                            onChange={(e) =>
                              setEditForm((form) => ({
                                ...form,
                                customData: { ...form.customData, [f.key]: e.target.value },
                              }))
                            }
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )
              })()}

              <div className="flex gap-3 pt-2">
                <Button
                  onClick={handleEditSave}
                  disabled={editSaving}
                  className="flex-1"
                >
                  {editSaving ? 'Salvando...' : 'Salvar'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setEditReg(null)}
                  disabled={editSaving}
                  className="flex-1"
                >
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
