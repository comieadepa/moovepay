'use client'

import { useEffect, useState } from 'react'

interface ParallaxSectionProps {
  children: React.ReactNode
  bgImage: string
}

export function ParallaxSection({ children, bgImage }: ParallaxSectionProps) {
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    const handleScroll = () => {
      const element = document.getElementById('parallax-section')
      if (!element) return

      const rect = element.getBoundingClientRect()
      const elementTop = rect.top
      const elementHeight = rect.height
      const windowHeight = window.innerHeight

      // Calcula o offset apenas quando o elemento está visível
      if (elementTop < windowHeight && elementTop + elementHeight > 0) {
        const scrollPercentage = (windowHeight - elementTop) / (windowHeight + elementHeight)
        setOffset(scrollPercentage * 50) // 50px de movimento máximo
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div id="parallax-section" className="relative overflow-hidden py-20">
      {/* Background parallax */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url('${bgImage}')`,
          transform: `translateY(${offset}px)`,
          transition: 'transform 0.1s ease-out',
        }}
      >
        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-white/95 via-white/90 to-white/95"></div>
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-6xl mx-auto px-4">
        {children}
      </div>
    </div>
  )
}
