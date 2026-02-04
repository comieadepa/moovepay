'use client'

import useEmblaCarousel from 'embla-carousel-react'
import Autoplay from 'embla-carousel-autoplay'
import { useCallback } from 'react'

export function EventsSlider() {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true }, [Autoplay({ delay: 4000 })])

  const scrollPrev = useCallback(() => {
    if (emblaApi) emblaApi.scrollPrev()
  }, [emblaApi])

  const scrollNext = useCallback(() => {
    if (emblaApi) emblaApi.scrollNext()
  }, [emblaApi])

  const slides = [
    {
      title: 'Eventos Incríveis Acontecem Aqui',
      subtitle: 'Mais de 92 mil eventos já foram realizados na nossa plataforma',
      bgImage: '/img/Screenshot_6.jpg'
    },
    {
      title: 'Gerencie com Facilidade',
      subtitle: 'Dashboard completo para controlar todas as suas inscrições em tempo real',
      bgImage: '/img/Screenshot_7.jpg'
    },
    {
      title: 'Pagamentos Seguros',
      subtitle: 'Aceite PIX, cartão e boleto com a melhor tarifa do mercado',
      bgImage: '/img/Screenshot_8.jpg'
    }
  ]

  return (
    <div className="pt-16 overflow-hidden">
      <div className="embla" ref={emblaRef}>
        <div className="embla__container flex">
          {slides.map((slide, index) => (
            <div key={index} className="embla__slide flex-[0_0_100%] min-w-0">
              <div 
                className="relative h-[400px] bg-cover bg-center flex items-center justify-center"
                style={{
                  backgroundImage: `url('${slide.bgImage}')`,
                }}
              >
                <div className="absolute inset-0 bg-black/40"></div>
                <div className="relative z-10 text-center text-white px-4">
                  <h2 className="text-4xl sm:text-5xl font-bold mb-4">{slide.title}</h2>
                  <p className="text-xl sm:text-2xl opacity-90 max-w-3xl mx-auto">{slide.subtitle}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Navigation Buttons */}
      <div className="absolute left-4 top-[calc(50%+2rem)] transform -translate-y-1/2 z-20">
        <button
          onClick={scrollPrev}
          className="w-12 h-12 rounded-full bg-white/90 hover:bg-white shadow-lg flex items-center justify-center text-gray-800 hover:scale-110 transition-all"
          aria-label="Slide anterior"
        >
          ←
        </button>
      </div>
      <div className="absolute right-4 top-[calc(50%+2rem)] transform -translate-y-1/2 z-20">
        <button
          onClick={scrollNext}
          className="w-12 h-12 rounded-full bg-white/90 hover:bg-white shadow-lg flex items-center justify-center text-gray-800 hover:scale-110 transition-all"
          aria-label="Próximo slide"
        >
          →
        </button>
      </div>
    </div>
  )
}
