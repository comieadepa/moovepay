'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useReactToPrint } from 'react-to-print'
import { QRCodeSVG } from 'qrcode.react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import * as XLSX from 'xlsx'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ArrowLeft,
  BarChart3,
  CheckCircle,
  CheckCircle2,
  ClipboardList,
  Clock,
  Contact,
  Crown,
  Edit2,
  FileSpreadsheet,
  Mail,
  Printer,
  RefreshCw,
  Search,
  TrendingUp,
  Users,
  Users2,
  X,
  XCircle,
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
  paid: 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200',
  pending: 'bg-amber-100 text-amber-800 ring-1 ring-amber-200',
  cancelled: 'bg-red-100 text-red-800 ring-1 ring-red-200',
}

const STATUS_DOTS: Record<string, string> = {
  paid: 'bg-emerald-500',
  pending: 'bg-amber-500',
  cancelled: 'bg-red-500',
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  paid: <CheckCircle2 className="h-3 w-3" />,
  pending: <Clock className="h-3 w-3" />,
  cancelled: <XCircle className="h-3 w-3" />,
}

export default function InscritosPage({ params }: { params: { id: string } }) {
  const router = useRouter()

  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [eventName, setEventName] = useState('')
  const [eventStartDate, setEventStartDate] = useState<string | null>(null)
  const [hasPaidTypes, setHasPaidTypes] = useState(false)
  const [tenantPlanId, setTenantPlanId] = useState<string>('essencial')
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [badgesLoading, setBadgesLoading] = useState(false)
  const [badgesList, setBadgesList] = useState<{ id: string; fullName: string; cpf?: string; inscriptionTypeName: string; qrPayload: string }[]>([])

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
  const badgesPrintTrigger = useRef(false)

  // Print refs
  const voucherPrintRef = useRef<HTMLDivElement>(null)
  const attendanceListPrintRef = useRef<HTMLDivElement>(null)
  const badgesPrintRef = useRef<HTMLDivElement>(null)

  const handlePrintVoucher = useReactToPrint({
    content: () => voucherPrintRef.current,
    documentTitle: voucherReg ? `Voucher - ${voucherReg.fullName}` : 'Voucher',
    onAfterPrint: () => {
      setVoucherReg(null)
      voucherPrintTrigger.current = false
    },
  })

  const handlePrintAttendanceList = useReactToPrint({
    content: () => attendanceListPrintRef.current,
    documentTitle: `Lista-de-Chamada-${(eventName || params.id).replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-')}`,
  })

  const handlePrintBadges = useReactToPrint({
    content: () => badgesPrintRef.current,
    documentTitle: `Crachas-${(eventName || params.id).replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-')}`,
    onAfterPrint: () => {
      badgesPrintTrigger.current = false
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

  // Trigger badges print after DOM updates with the badgesList
  useEffect(() => {
    if (badgesList.length > 0 && badgesPrintTrigger.current) {
      const t = setTimeout(() => {
        handlePrintBadges()
      }, 120)
      return () => clearTimeout(t)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [badgesList])

  const fetchRegistrations = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [res, planRes] = await Promise.all([
        fetch(`/api/registrations?eventId=${params.id}`),
        fetch('/api/tenant/plan').catch(() => null),
      ])

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao carregar inscrições')
      const list: Registration[] = data.registrations || []
      setRegistrations(list)
      const firstEvent = list[0]?.event
      if (firstEvent?.name) setEventName(firstEvent.name)
      if (firstEvent?.startDate) setEventStartDate(firstEvent.startDate)

      if (planRes && planRes.ok) {
        const planData = await planRes.json().catch(() => null)
        if (planData?.planId) setTenantPlanId(planData.planId)
      }

      // Verifica se evento tem tipos pagos
      const typesRes = await fetch(`/api/events/${params.id}/inscription-types`)
      if (typesRes.ok) {
        const typesData = await typesRes.json()
        const types: { value: number }[] = typesData.inscriptionTypes ?? typesData.data ?? []
        setHasPaidTypes(types.some((t) => t.value > 0))
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [params.id])

  async function handleTriggerBadges() {
    setBadgesLoading(true)
    try {
      const res = await fetch(`/api/events/${params.id}/badges`)
      const data = await res.json()

      if (res.status === 403 && data.upgradeRequired) {
        setShowUpgradeModal(true)
        return
      }

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao consultar crachás')
      }

      if (!data.badges || data.badges.length === 0) {
        alert('Nenhum participante elegível (confirmado/pago) para emissão de crachás.')
        return
      }

      setBadgesList(data.badges)
      badgesPrintTrigger.current = true
    } catch (e: any) {
      alert(e.message || 'Erro ao carregar crachás')
    } finally {
      setBadgesLoading(false)
    }
  }

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

  const eligibleAttendanceList = useMemo(() => {
    return registrations
      .filter((r) => r.status === 'paid' || r.status === 'confirmed')
      .sort((a, b) => a.fullName.localeCompare(b.fullName, 'pt-BR', { sensitivity: 'base' }))
  }, [registrations])

  const stats = {
    total: registrations.length,
    paid: registrations.filter((r) => r.status === 'paid' || r.status === 'confirmed').length,
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

  function handleExportExcel() {
    const customKeys = Array.from(
      new Set(filtered.flatMap((r) => Object.keys(r.customData ?? {})))
    )

    const rows = filtered.map((r) => {
      const base: Record<string, unknown> = {
        'Nome': r.fullName,
        'Email': r.email,
        'CPF': r.cpf || '',
        'WhatsApp': r.whatsapp || '',
        'Tipo de Inscrição': r.inscriptionType?.name || '',
        'Status': STATUS_LABELS[r.status] || r.status,
        'Valor (R$)': Number(r.totalValue || 0),
        'Data de Inscrição': format(new Date(r.createdAt), 'dd/MM/yyyy HH:mm', { locale: ptBR }),
      }
      for (const key of customKeys) {
        base[key] = r.customData?.[key] ?? ''
      }
      return base
    })

    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Inscritos')
    const safeName = (eventName || params.id).replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-')
    const dateStr = format(new Date(), 'yyyyMMdd')
    XLSX.writeFile(wb, `inscritos-${safeName}-${dateStr}.xlsx`)
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

      {/* ── ÁREA DE IMPRESSÃO: Lista de Chamada (A4) ── */}
      <div style={{ overflow: 'hidden', height: 0 }}>
        <div ref={attendanceListPrintRef} className="print-container" style={{ padding: '15mm 12mm', fontFamily: 'Arial, Helvetica, sans-serif', color: '#111827', backgroundColor: '#fff' }}>
          <style>{`
            @media print {
              @page {
                size: A4 portrait;
                margin: 12mm 10mm;
              }
              body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .attendance-table {
                width: 100%;
                border-collapse: collapse;
                page-break-inside: auto;
              }
              .attendance-table tr {
                page-break-inside: avoid;
                page-break-after: auto;
              }
              .attendance-table thead {
                display: table-header-group;
              }
              .attendance-table tfoot {
                display: table-footer-group;
              }
            }
          `}</style>

          {/* Cabeçalho da Lista de Chamada */}
          <div style={{ borderBottom: '2px solid #0f172a', paddingBottom: '8px', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: 'bold', margin: '0 0 4px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Lista de Chamada & Presença
              </h1>
              <h2 style={{ fontSize: '15px', fontWeight: '600', color: '#334155', margin: '0 0 2px 0' }}>
                {eventName || 'Evento'}
              </h2>
              {eventStartDate && (
                <p style={{ fontSize: '11px', color: '#64748b', margin: 0 }}>
                  Data do Evento: {format(new Date(eventStartDate), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#047857', backgroundColor: '#ecfdf5', padding: '3px 8px', borderRadius: '4px', border: '1px solid #a7f3d0' }}>
                CongregaPay
              </span>
              <p style={{ fontSize: '10px', color: '#64748b', margin: '6px 0 0 0' }}>
                Gerado em: {format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
              </p>
              <p style={{ fontSize: '11px', fontWeight: 'bold', color: '#1e293b', margin: '2px 0 0 0' }}>
                Total de Participantes: {eligibleAttendanceList.length}
              </p>
            </div>
          </div>

          {/* Tabela de Participantes */}
          <table className="attendance-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f1f5f9', borderTop: '1px solid #cbd5e1', borderBottom: '2px solid #94a3b8' }}>
                <th style={{ padding: '6px 4px', textAlign: 'center', width: '35px', fontWeight: 'bold', border: '1px solid #cbd5e1' }}>Nº</th>
                <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 'bold', border: '1px solid #cbd5e1' }}>Nome do Participante</th>
                <th style={{ padding: '6px 8px', textAlign: 'left', width: '140px', fontWeight: 'bold', border: '1px solid #cbd5e1' }}>Categoria / Ingresso</th>
                <th style={{ padding: '6px 4px', textAlign: 'center', width: '55px', fontWeight: 'bold', border: '1px solid #cbd5e1' }}>Presença</th>
                <th style={{ padding: '6px 8px', textAlign: 'left', width: '180px', fontWeight: 'bold', border: '1px solid #cbd5e1' }}>Assinatura / Visto</th>
              </tr>
            </thead>
            <tbody>
              {eligibleAttendanceList.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: '#64748b', border: '1px solid #cbd5e1' }}>
                    Nenhuma inscrição confirmada ou paga encontrada para este evento.
                  </td>
                </tr>
              ) : (
                eligibleAttendanceList.map((reg, idx) => (
                  <tr key={reg.id} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                    <td style={{ padding: '6px 4px', textAlign: 'center', color: '#64748b', border: '1px solid #cbd5e1' }}>
                      {idx + 1}
                    </td>
                    <td style={{ padding: '6px 8px', fontWeight: '600', color: '#0f172a', border: '1px solid #cbd5e1' }}>
                      {reg.fullName}
                      {reg.cpf && (
                        <span style={{ display: 'block', fontSize: '9px', fontWeight: 'normal', color: '#64748b' }}>
                          CPF: {reg.cpf}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '6px 8px', color: '#334155', border: '1px solid #cbd5e1' }}>
                      {reg.inscriptionType?.name || 'Inscrição'}
                    </td>
                    <td style={{ padding: '6px 4px', textAlign: 'center', border: '1px solid #cbd5e1' }}>
                      <div style={{ width: '13px', height: '13px', border: '1.5px solid #64748b', borderRadius: '2px', margin: '0 auto' }} />
                    </td>
                    <td style={{ padding: '6px 8px', border: '1px solid #cbd5e1' }}>
                      <div style={{ borderBottom: '1px dotted #94a3b8', height: '14px', width: '100%' }} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Rodapé institucional para conferência */}
          <div style={{ marginTop: '16px', borderTop: '1px solid #e2e8f0', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#64748b' }}>
            <span>Documento emitido para controle de acesso físico e portaria · CongregaPay</span>
            <span>Total elegível: {eligibleAttendanceList.length} confirmados</span>
          </div>
        </div>
      </div>

      {/* ── ÁREA DE IMPRESSÃO: Crachás em Grade (A4) ── */}
      <div style={{ overflow: 'hidden', height: 0 }}>
        <div ref={badgesPrintRef} className="badges-print-container" style={{ padding: '8mm 6mm', fontFamily: 'Arial, Helvetica, sans-serif', color: '#111827', backgroundColor: '#fff' }}>
          <style>{`
            @media print {
              @page {
                size: A4 portrait;
                margin: 8mm 6mm;
              }
              body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .badges-grid {
                display: grid !important;
                grid-template-columns: repeat(2, 92mm) !important;
                grid-auto-rows: 62mm !important;
                gap: 5mm !important;
                justify-content: center !important;
              }
              .badge-card {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
            }
          `}</style>

          <div className="badges-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 92mm)', gap: '5mm', justifyContent: 'center' }}>
            {badgesList.map((badge) => (
              <div
                key={badge.id}
                className="badge-card"
                style={{
                  width: '92mm',
                  height: '62mm',
                  border: '1.5px dashed #94a3b8',
                  borderRadius: '6px',
                  padding: '5mm 6mm',
                  boxSizing: 'border-box',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  backgroundColor: '#ffffff',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Faixa decorativa superior */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', backgroundColor: '#059669' }} />

                {/* Topo do Crachá: Nome do Evento */}
                <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '3px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '60mm' }}>
                    {eventName || 'Evento'}
                  </span>
                  <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#059669', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    CongregaPay
                  </span>
                </div>

                {/* Centro: Nome do Participante e Categoria */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4mm', margin: '2mm 0' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 2px 0', lineHeight: 1.2, wordBreak: 'break-word' }}>
                      {badge.fullName}
                    </p>
                    {badge.cpf && (
                      <p style={{ fontSize: '9px', color: '#64748b', margin: '0 0 4px 0' }}>
                        CPF: {badge.cpf}
                      </p>
                    )}
                    <span style={{ display: 'inline-block', fontSize: '9px', fontWeight: 'bold', color: '#1d4ed8', backgroundColor: '#eff6ff', padding: '2px 6px', borderRadius: '4px', border: '1px solid #bfdbfe' }}>
                      {badge.inscriptionTypeName}
                    </span>
                  </div>

                  {/* QR Code seguro reutilizando congregapay:reg:<id> */}
                  <div style={{ flexShrink: 0, textAlign: 'center' }}>
                    <QRCodeSVG value={badge.qrPayload} size={82} level="M" />
                  </div>
                </div>

                {/* Rodapé do Crachá */}
                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '3px', display: 'flex', justifyContent: 'space-between', fontSize: '8px', color: '#94a3b8' }}>
                  <span>Credencial de Acesso</span>
                  <span>ID: {badge.id.slice(0, 8)}</span>
                </div>
              </div>
            ))}
          </div>
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
            variant="outline"
            onClick={() => router.push(`/eventos/${params.id}/checkin`)}
            className="border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 gap-1.5"
            title="Acessar leitor de QR Code e Check-in"
          >
            <CheckCircle className="h-4 w-4" />
            Check-in
          </Button>
          <Button
            variant="outline"
            onClick={handlePrintAttendanceList}
            disabled={eligibleAttendanceList.length === 0}
            title="Imprimir ou salvar em PDF a Lista de Chamada para portaria"
            className="border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-700 gap-1.5"
          >
            <ClipboardList className="h-4 w-4" />
            Lista de chamada
          </Button>
          <Button
            variant="outline"
            onClick={handleTriggerBadges}
            disabled={badgesLoading || eligibleAttendanceList.length === 0}
            title="Imprimir crachás em lote para credenciamento (Recurso Pro)"
            className="border-purple-300 bg-purple-50 hover:bg-purple-100 text-purple-700 gap-1.5"
          >
            {badgesLoading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Contact className="h-4 w-4" />
            )}
            Crachás
            {(tenantPlanId === 'free' || tenantPlanId === 'essencial') && (
              <Crown className="h-3 w-3 text-amber-500 ml-0.5" />
            )}
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push(`/eventos/${params.id}/relatorios`)}
            title="Relatórios Analíticos Avançados"
            className="border-indigo-300 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 gap-1.5"
          >
            <BarChart3 className="h-4 w-4" />
            Relatórios
            {(tenantPlanId === 'free' || tenantPlanId === 'essencial') && (
              <Crown className="h-3 w-3 text-amber-500 ml-0.5" />
            )}
          </Button>
          {hasPaidTypes && (
            <Button
              variant="outline"
              onClick={() => router.push(`/eventos/${params.id}/staff`)}
              className="gap-2"
            >
              <Users2 className="h-4 w-4" />
              Colaboradores
            </Button>
          )}
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
            onClick={handleExportExcel}
            disabled={filtered.length === 0}
            title="Exportar lista de inscritos para Excel"
            className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-400 gap-1.5"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Lista de inscritos
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
        {([
          { label: 'Total de inscritos', value: stats.total,   color: 'text-slate-800',   border: 'border-l-slate-400',   icon: <Users className="h-5 w-5 text-slate-400" /> },
          { label: 'Confirmados',        value: stats.paid,    color: 'text-emerald-700', border: 'border-l-emerald-500', icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" /> },
          { label: 'Pendentes',          value: stats.pending, color: 'text-amber-700',   border: 'border-l-amber-500',   icon: <Clock className="h-5 w-5 text-amber-500" /> },
          { label: 'Receita confirmada', value: totalRevenue,  color: 'text-blue-700',    border: 'border-l-blue-500',    icon: <TrendingUp className="h-5 w-5 text-blue-500" /> },
        ] as { label: string; value: string | number; color: string; border: string; icon: ReactNode }[]).map((s) => (
          <Card key={s.label} className={`border-l-4 ${s.border}`}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-slate-500">{s.label}</p>
                {s.icon}
              </div>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
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
                  <tr className="border-b bg-slate-100">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                      Participante
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                      Tipo
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide">
                      Valor
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                      Data
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide">
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
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                              STATUS_COLORS[reg.status] || 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {STATUS_ICONS[reg.status] ?? (
                              <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOTS[reg.status] || 'bg-slate-400'}`} />
                            )}
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

      {/* ── MODAL CTA UPGRADE PLANO PRO (Crachás em Lote) ── */}
      {showUpgradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md shadow-2xl border-purple-200 animate-in fade-in zoom-in-95 duration-200">
            <CardHeader className="pb-3 border-b border-purple-100 bg-gradient-to-r from-purple-50 to-indigo-50 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                  <Crown className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <CardTitle className="text-lg font-bold text-slate-900">CongregaPay Pro</CardTitle>
                  <p className="text-xs text-purple-700 font-medium">Recurso Exclusivo</p>
                </div>
              </div>
              <button
                onClick={() => setShowUpgradeModal(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </CardHeader>
            <CardContent className="pt-5 space-y-4">
              <div>
                <h3 className="font-semibold text-slate-800 text-base">Impressão de Crachás em Lote</h3>
                <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                  A geração e impressão de crachás padronizados em grade A4 com QR Code para credenciamento rápido está disponível no plano <strong>Pro</strong>.
                </p>
              </div>

              <div className="p-3 bg-purple-50/70 border border-purple-100 rounded-lg text-xs space-y-1.5 text-purple-950">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  <span>Crachás formatados em folhas A4 prontos para recorte</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  <span>QR Code individual para portaria e check-in instantâneo</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  <span>Taxa reduzida por inscrição (apenas 5% vs 10% no Essencial)</span>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  onClick={() => router.push('/admin/tenants')}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold gap-1.5"
                >
                  <Crown className="w-4 h-4 text-amber-300" />
                  Conhecer o Plano Pro
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowUpgradeModal(false)}
                  className="flex-1 border-slate-300"
                >
                  Continuar no Essencial
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
