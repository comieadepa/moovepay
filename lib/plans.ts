// Definições centrais dos planos MoovePay.
// Usada tanto no front-end (badge/display) quanto no back-end (guards de feature).

export type PlanId = 'free' | 'essencial' | 'pro' | 'custom'

export interface PlanFeatures {
  paidEvents: boolean
  pix: boolean
  qrCheckin: boolean
  certificates: boolean
  multipleOrganizers: boolean
  advancedReports: boolean
  whiteLabel: boolean
  prioritySupport: boolean
}

export interface Plan {
  id: PlanId
  name: string
  monthlyPrice: number     // 0 = sem mensalidade
  feePercent: number       // % retida por inscrição paga
  features: PlanFeatures
  badge?: string           // texto do badge na landing
  priceLabel: string       // texto exibido no card
  priceNote: string        // legenda abaixo do preço
  ctaLabel: string
  ctaHref: string
  highlighted?: boolean
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: 'free',
    name: 'Gratuito',
    monthlyPrice: 0,
    feePercent: 0,
    priceLabel: 'R$ 0',
    priceNote: 'Para sempre',
    ctaLabel: 'Começar grátis',
    ctaHref: '/signup',
    features: {
      paidEvents: false,
      pix: false,
      qrCheckin: false,
      certificates: false,
      multipleOrganizers: false,
      advancedReports: false,
      whiteLabel: false,
      prioritySupport: false,
    },
  },
  essencial: {
    id: 'essencial',
    name: 'Essencial',
    monthlyPrice: 0,
    feePercent: 10,
    priceLabel: '10%',
    priceNote: 'Por inscrição paga confirmada',
    ctaLabel: 'Criar evento pago',
    ctaHref: '/signup',
    highlighted: true,
    badge: 'Mais indicado',
    features: {
      paidEvents: true,
      pix: true,
      qrCheckin: true,
      certificates: true,
      multipleOrganizers: false,
      advancedReports: false,
      whiteLabel: false,
      prioritySupport: false,
    },
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    monthlyPrice: 97,
    feePercent: 5,
    priceLabel: 'R$ 97',
    priceNote: 'por mês + 5% por inscrição paga',
    ctaLabel: 'Falar sobre Pro',
    ctaHref: 'https://wa.me/5591981755021',
    features: {
      paidEvents: true,
      pix: true,
      qrCheckin: true,
      certificates: true,
      multipleOrganizers: true,
      advancedReports: true,
      whiteLabel: false,
      prioritySupport: true,
    },
  },
  custom: {
    id: 'custom',
    name: 'Igrejas & Ministérios',
    monthlyPrice: 0,
    feePercent: 0,
    priceLabel: 'Custom',
    priceNote: 'Para grandes operações',
    ctaLabel: 'Solicitar proposta',
    ctaHref: 'https://wa.me/5591981755021',
    features: {
      paidEvents: true,
      pix: true,
      qrCheckin: true,
      certificates: true,
      multipleOrganizers: true,
      advancedReports: true,
      whiteLabel: true,
      prioritySupport: true,
    },
  },
}

export const PLAN_ORDER: PlanId[] = ['free', 'essencial', 'pro', 'custom']

/** Retorna as features do plano ou do plano 'free' como fallback seguro. */
export function getPlanFeatures(planId: string | null | undefined): PlanFeatures {
  return (PLANS[planId as PlanId] ?? PLANS.free).features
}

/** Labels coloridos para exibição em badge. */
export const PLAN_COLORS: Record<PlanId, string> = {
  free:      'bg-slate-100 text-slate-700',
  essencial: 'bg-blue-100 text-blue-700',
  pro:       'bg-purple-100 text-purple-700',
  custom:    'bg-emerald-100 text-emerald-700',
}
