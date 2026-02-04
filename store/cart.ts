import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface CartItem {
  eventId: string
  eventName?: string
  inscriptionTypeId: string
  inscriptionTypeName: string
  value: number
  quantity: number
  participants: Array<{
    fullName: string
    cpf: string
    email: string
    whatsapp?: string
  }>
}

interface CartState {
  eventId: string | null
  items: CartItem[]
  couponCode: string | null
  couponPercentage: number
  
  addItem: (item: CartItem) => void
  removeItem: (inscriptionTypeId: string) => void
  updateQuantity: (inscriptionTypeId: string, quantity: number) => void
  applyCoupon: (code: string, percentage: number) => void
  removeCoupon: () => void
  addParticipant: (inscriptionTypeId: string, participant: CartItem['participants'][0]) => void
  removeParticipant: (inscriptionTypeId: string, index: number) => void
  updateParticipant: (inscriptionTypeId: string, index: number, participant: Partial<CartItem['participants'][0]>) => void
  clear: () => void
  
  getSubtotal: () => number
  getDiscount: () => number
  getPlatformFee: () => number
  getTotal: () => number
  getTotalParticipants: () => number
}

const PLATFORM_FEE = 0.10 // 10%

const emptyParticipant = () => ({
  fullName: '',
  cpf: '',
  email: '',
  whatsapp: '',
})

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      eventId: null,
      items: [],
      couponCode: null,
      couponPercentage: 0,

      addItem: (item) =>
        set((state) => {
          const existing = state.items.find((i) => i.inscriptionTypeId === item.inscriptionTypeId)
          if (existing) {
            const nextQuantity = Math.max(1, (existing.quantity || 1) + (item.quantity || 1))
            const nextParticipants = [...(existing.participants || [])]
            while (nextParticipants.length < nextQuantity) nextParticipants.push(emptyParticipant())
            return {
              items: state.items.map((i) =>
                i.inscriptionTypeId === item.inscriptionTypeId
                  ? { ...i, quantity: nextQuantity, participants: nextParticipants }
                  : i
              ),
              eventId: state.eventId || item.eventId,
            }
          }

          const normalizedQuantity = Math.max(1, item.quantity || 1)
          const normalizedParticipants = Array.isArray(item.participants) ? [...item.participants] : []
          while (normalizedParticipants.length < normalizedQuantity) normalizedParticipants.push(emptyParticipant())
          if (normalizedParticipants.length > normalizedQuantity) normalizedParticipants.length = normalizedQuantity

          return {
            items: [...state.items, { ...item, quantity: normalizedQuantity, participants: normalizedParticipants }],
            eventId: item.eventId,
          }
        }),

      removeItem: (inscriptionTypeId) =>
        set((state) => {
          const next = state.items.filter((i) => i.inscriptionTypeId !== inscriptionTypeId)
          return {
            items: next,
            eventId: next.length ? state.eventId : null,
          }
        }),

      updateQuantity: (inscriptionTypeId, quantity) =>
        set((state) => ({
          items: state.items.map((i) => {
            if (i.inscriptionTypeId !== inscriptionTypeId) return i
            const nextQuantity = Math.max(1, Math.min(50, Number(quantity || 1)))
            const nextParticipants = [...(i.participants || [])]
            while (nextParticipants.length < nextQuantity) nextParticipants.push(emptyParticipant())
            if (nextParticipants.length > nextQuantity) nextParticipants.length = nextQuantity
            return { ...i, quantity: nextQuantity, participants: nextParticipants }
          }),
        })),

      applyCoupon: (code, percentage) =>
        set({
          couponCode: code,
          couponPercentage: percentage,
        }),

      removeCoupon: () =>
        set({
          couponCode: null,
          couponPercentage: 0,
        }),

      addParticipant: (inscriptionTypeId, participant) =>
        set((state) => ({
          items: state.items.map((i) =>
            i.inscriptionTypeId === inscriptionTypeId
              ? {
                  ...i,
                  participants: [...i.participants, participant],
                  quantity: Math.max(i.quantity || 1, (i.participants?.length || 0) + 1),
                }
              : i
          ),
        })),

      removeParticipant: (inscriptionTypeId, index) =>
        set((state) => ({
          items: state.items.map((i) =>
            i.inscriptionTypeId === inscriptionTypeId
              ? {
                  ...i,
                  participants: i.participants.filter((_, idx) => idx !== index),
                  quantity: Math.max(1, i.participants.filter((_, idx) => idx !== index).length || 1),
                }
              : i
          ),
        })),

      updateParticipant: (inscriptionTypeId, index, participant) =>
        set((state) => ({
          items: state.items.map((i) => {
            if (i.inscriptionTypeId !== inscriptionTypeId) return i
            const next = [...(i.participants || [])]
            while (next.length <= index) next.push(emptyParticipant())
            next[index] = { ...next[index], ...participant }
            const nextQuantity = Math.max(1, Math.max(i.quantity || 1, next.length))
            while (next.length < nextQuantity) next.push(emptyParticipant())
            return { ...i, participants: next, quantity: nextQuantity }
          }),
        })),

      clear: () =>
        set({
          eventId: null,
          items: [],
          couponCode: null,
          couponPercentage: 0,
        }),

      getSubtotal: () => {
        const state = get()
        return state.items.reduce((total, item) => total + item.value * item.quantity, 0)
      },

      getDiscount: () => {
        const state = get()
        const subtotal = state.getSubtotal()
        return subtotal * (state.couponPercentage / 100)
      },

      getPlatformFee: () => {
        const state = get()
        const subtotal = state.getSubtotal()
        const discount = state.getDiscount()
        return (subtotal - discount) * PLATFORM_FEE
      },

      getTotal: () => {
        const state = get()
        const subtotal = state.getSubtotal()
        const discount = state.getDiscount()
        const fee = state.getPlatformFee()
        return subtotal - discount + fee
      },

      getTotalParticipants: () => {
        const state = get()
        return state.items.reduce((total, item) => total + item.participants.length, 0)
      },
    }),
    {
      name: 'moovepay-cart',
      version: 1,
    }
  )
)
