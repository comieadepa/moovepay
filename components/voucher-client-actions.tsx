'use client'

import { Button } from '@/components/ui/button'
import { Printer, Share2 } from 'lucide-react'
import { useState } from 'react'

export function VoucherClientActions({ fullName, eventName }: { fullName: string; eventName: string }) {
  const [copied, setCopied] = useState(false)

  const handleShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `Voucher - ${eventName}`,
          text: `Voucher de inscrição de ${fullName} para o evento ${eventName}`,
          url: window.location.href,
        })
      } catch {}
    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 no-print max-w-xl mx-auto w-full px-4 mb-6">
      <Button
        onClick={() => window.print()}
        className="bg-slate-900 hover:bg-slate-800 text-white shadow-md text-xs sm:text-sm font-semibold h-10 px-5 flex items-center gap-2 rounded-xl transition-all"
      >
        <Printer className="w-4 h-4" />
        <span>Imprimir / Salvar PDF</span>
      </Button>

      <Button
        variant="outline"
        onClick={handleShare}
        className="bg-white/90 hover:bg-white text-slate-700 border-slate-200 shadow-sm text-xs sm:text-sm font-medium h-10 px-4 flex items-center gap-2 rounded-xl transition-all"
      >
        <Share2 className="w-4 h-4" />
        <span>{copied ? 'Link Copiado!' : 'Compartilhar'}</span>
      </Button>
    </div>
  )
}
