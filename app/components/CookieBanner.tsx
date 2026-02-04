'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export function CookieBanner() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Verificar se o usuário já aceitou cookies
    const cookieConsent = localStorage.getItem('moovepay_cookie_consent')
    if (!cookieConsent) {
      setIsVisible(true)
    }
  }, [])

  const handleAccept = () => {
    localStorage.setItem('moovepay_cookie_consent', JSON.stringify({
      accepted: true,
      timestamp: new Date().toISOString(),
    }))
    setIsVisible(false)
  }

  const handleReject = () => {
    localStorage.setItem('moovepay_cookie_consent', JSON.stringify({
      accepted: false,
      timestamp: new Date().toISOString(),
    }))
    setIsVisible(false)
  }

  if (!isVisible) {
    return null
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-900 text-white p-6 shadow-2xl z-40">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex-1">
            <h3 className="text-lg font-semibold mb-2">Conformidade com LGPD</h3>
            <p className="text-gray-300 text-sm">
              Utilizamos cookies para melhorar sua experiência. Ao continuar navegando, você concorda com nossa{' '}
              <Link href="/privacidade" className="text-blue-400 hover:text-blue-300 underline">
                Política de Privacidade
              </Link>
              {' '}e uso de cookies.
            </p>
          </div>
          <div className="flex gap-3 flex-shrink-0">
            <Button
              onClick={handleReject}
              variant="outline"
              className="border-gray-600 text-gray-300 hover:bg-gray-800"
            >
              Rejeitar
            </Button>
            <Button
              onClick={handleAccept}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Aceitar Tudo
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
