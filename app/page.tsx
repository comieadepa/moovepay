'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import Image from 'next/image'
import { ParallaxSection } from './components/ParallaxSection'
import { CookieBanner } from './components/CookieBanner'
import { OpenEventsSection } from './components/OpenEventsSection'

const heroSlides = [
  {
    badge: 'Feito para igrejas, ministérios e conferências cristãs',
    title: 'Organize eventos da sua igreja com uma experiência profissional',
    highlight: 'do início ao fim',
    description:
      'Crie páginas de inscrição, receba via Pix, cartão ou boleto, faça check-in com QR Code e acompanhe tudo em tempo real — sem planilhas, filas ou confusão.',
    primaryCta: 'Criar evento grátis',
    secondaryCta: 'Falar com especialista',
    eventName: 'Congresso de Jovens 2026',
    eventType: 'Evento pago',
    metricOne: '342 inscritos',
    metricTwo: 'R$ 18.420,00',
    status: 'Pix confirmado',
  },
  {
    badge: 'Ideal para retiros, congressos e cursos bíblicos',
    title: 'Venda inscrições online e reduza o trabalho manual da equipe',
    highlight: 'com pagamentos automáticos',
    description:
      'Os participantes se inscrevem pelo celular, recebem confirmação automática e sua liderança acompanha inscrições, pagamentos e presença pelo painel.',
    primaryCta: 'Começar agora',
    secondaryCta: 'Ver planos',
    eventName: 'Retiro Espiritual',
    eventType: 'Pix, cartão e boleto',
    metricOne: '128 vagas preenchidas',
    metricTwo: '96 pagamentos',
    status: 'Recebimento seguro',
  },
  {
    badge: 'Mais controle para pastores, líderes e voluntários',
    title: 'Check-in rápido com QR Code e certificados automáticos',
    highlight: 'sem complicação',
    description:
      'No dia do evento, sua equipe valida entradas pelo QR Code. Depois, você pode emitir certificados para cursos, seminários e conferências.',
    primaryCta: 'Criar minha conta',
    secondaryCta: 'Chamar no WhatsApp',
    eventName: 'Seminário de Liderança',
    eventType: 'Check-in ativo',
    metricOne: '287 presenças',
    metricTwo: 'Certificados prontos',
    status: 'QR Code validado',
  },
]

export default function Home() {
  const [activeSlide, setActiveSlide] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)

  const goToSlide = (index: number) => {
    if (index === activeSlide || isTransitioning) return

    setIsTransitioning(true)

    setTimeout(() => {
      setActiveSlide(index)
      setTimeout(() => setIsTransitioning(false), 80)
    }, 280)
  }

  useEffect(() => {
    const interval = setInterval(() => {
      goToSlide((activeSlide + 1) % heroSlides.length)
    }, 6500)

    return () => clearInterval(interval)
  }, [activeSlide, isTransitioning])

  const slide = heroSlides[activeSlide]

  const dores = [
    'Inscrições espalhadas no WhatsApp',
    'Listas no papel ou planilhas confusas',
    'Pessoas inscritas que ainda não pagaram',
    'Fila e desorganização no check-in',
    'Dificuldade para emitir certificados',
    'Falta de controle financeiro do evento',
  ]

  const recursos = [
    {
      icon: '📝',
      title: 'Crie eventos em minutos',
      description:
        'Cadastre congressos, retiros, conferências, cursos e encontros da igreja com página própria, imagem, descrição e tipos de inscrição.',
      color: 'from-blue-500 to-blue-600',
      border: 'hover:border-blue-200',
    },
    {
      icon: '💳',
      title: 'Receba via Pix, cartão e boleto',
      description:
        'Pagamentos online processados com segurança via Asaas, com confirmação automática para facilitar a vida da tesouraria.',
      color: 'from-green-500 to-green-600',
      border: 'hover:border-green-200',
    },
    {
      icon: '🎟️',
      title: 'Check-in com QR Code',
      description:
        'Cada participante recebe um comprovante com QR Code para entrada rápida no dia do evento, mesmo com equipe voluntária.',
      color: 'from-purple-500 to-purple-600',
      border: 'hover:border-purple-200',
    },
    {
      icon: '👥',
      title: 'Controle total dos inscritos',
      description:
        'Acompanhe inscrições, pagamentos, presença e dados dos participantes em tempo real, sem depender de planilhas manuais.',
      color: 'from-orange-500 to-orange-600',
      border: 'hover:border-orange-200',
    },
    {
      icon: '🏅',
      title: 'Certificados automáticos',
      description:
        'Emita certificados para cursos, seminários, escolas bíblicas, congressos e treinamentos com muito mais praticidade.',
      color: 'from-pink-500 to-pink-600',
      border: 'hover:border-pink-200',
    },
    {
      icon: '🔒',
      title: 'Segurança e LGPD',
      description:
        'Dados protegidos, autenticação segura e pagamentos em ambiente confiável para sua igreja e seus participantes.',
      color: 'from-red-500 to-red-600',
      border: 'hover:border-red-200',
    },
  ]

  const tiposEvento = [
    'Congresso de Jovens',
    'Retiro Espiritual',
    'Conferência Gospel',
    'Encontro de Casais',
    'Curso Bíblico',
    'Seminário de Liderança',
  ]

  return (
    <main className="w-full">
      <CookieBanner />

      <a
        href="https://wa.me/5591981755021"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 bg-green-500 hover:bg-green-600 text-white px-5 py-4 rounded-full shadow-xl font-semibold transition-all"
        aria-label="Falar com a MoovePay no WhatsApp"
      >
        WhatsApp
      </a>

      <nav className="fixed top-0 w-full bg-white/95 backdrop-blur-sm border-b z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center h-16">
          <div className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="MoovePay Logo"
              width={180}
              height={60}
              className="h-14 w-auto"
              priority
            />
          </div>

          <div className="hidden md:flex items-center gap-6">
            <a href="#recursos" className="text-sm font-medium text-gray-700 hover:text-blue-600 transition">
              Recursos
            </a>
            <a href="#como-funciona" className="text-sm font-medium text-gray-700 hover:text-blue-600 transition">
              Como funciona
            </a>
            <a href="#planos" className="text-sm font-medium text-gray-700 hover:text-blue-600 transition">
              Planos
            </a>
            <a href="#eventos" className="text-sm font-medium text-gray-700 hover:text-blue-600 transition">
              Eventos
            </a>
            <Link href="/login">
              <Button variant="ghost" size="sm" className="text-gray-700">
                Login
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white shadow-md">
                Criar evento grátis
              </Button>
            </Link>
          </div>

          <div className="md:hidden">
            <Link href="/signup">
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                Começar
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <section className="pt-24 pb-20 px-4 sm:px-6 lg:px-8 bg-[radial-gradient(circle_at_top_left,#dbeafe,transparent_35%),linear-gradient(to_bottom,#eff6ff,#ffffff)] overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="relative rounded-[2rem] border bg-white/80 backdrop-blur-sm shadow-2xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-indigo-50" />
            <div className="absolute -top-24 -right-24 w-72 h-72 bg-blue-200 rounded-full blur-3xl opacity-50" />
            <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-indigo-200 rounded-full blur-3xl opacity-40" />

            <div className={`relative grid lg:grid-cols-2 gap-10 items-center p-6 sm:p-10 lg:p-14 min-h-[620px] transition-all duration-700 ease-out ${isTransitioning ? 'opacity-0 translate-y-2 blur-sm' : 'opacity-100 translate-y-0 blur-0'}`}>
              <div>
                <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-sm font-semibold mb-6">
                  {slide.badge}
                </div>

                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6 text-gray-900 leading-tight">
                  {slide.title} <br />
                  <span className="text-blue-600">{slide.highlight}</span>
                </h1>

                <p className="text-lg sm:text-xl text-gray-600 mb-9 max-w-2xl leading-relaxed">
                  {slide.description}
                </p>

                <div className="flex flex-col sm:flex-row gap-4 mb-10">
                  <Link href="/signup">
                    <Button size="lg" className="bg-blue-600 hover:bg-blue-700 px-10 h-14 text-lg font-semibold shadow-lg hover:shadow-xl transition-all">
                      {slide.primaryCta} →
                    </Button>
                  </Link>

                  {slide.secondaryCta === 'Ver planos' ? (
                    <a href="#planos">
                      <Button size="lg" variant="outline" className="px-10 h-14 text-lg font-semibold bg-white/80">
                        {slide.secondaryCta}
                      </Button>
                    </a>
                  ) : (
                    <a href="https://wa.me/5591981755021" target="_blank" rel="noopener noreferrer">
                      <Button size="lg" variant="outline" className="px-10 h-14 text-lg font-semibold bg-white/80">
                        {slide.secondaryCta}
                      </Button>
                    </a>
                  )}
                </div>

                <div className="flex flex-wrap gap-3 text-sm text-gray-600">
                  <span className="bg-white border rounded-full px-4 py-2 shadow-sm">Pix automático</span>
                  <span className="bg-white border rounded-full px-4 py-2 shadow-sm">Sem contrato</span>
                  <span className="bg-white border rounded-full px-4 py-2 shadow-sm">Suporte por WhatsApp</span>
                </div>
              </div>

              <div className={`relative transition-all duration-700 ease-out ${isTransitioning ? 'opacity-0 translate-x-6 scale-95 blur-sm' : 'opacity-100 translate-x-0 scale-100 blur-0'}`}>
                <div className="absolute -top-8 -left-8 bg-white rounded-2xl shadow-xl border p-4 hidden sm:block">
                  <p className="text-xs text-gray-500 mb-1">Status</p>
                  <p className="font-bold text-green-600">● {slide.status}</p>
                </div>

                <div className="absolute -bottom-8 -right-6 bg-white rounded-2xl shadow-xl border p-4 hidden sm:block z-10">
                  <p className="text-xs text-gray-500 mb-1">Check-in</p>
                  <p className="font-bold text-gray-900">QR Code ativo</p>
                </div>

                <div className="bg-gray-950 rounded-[2rem] p-3 shadow-2xl border border-gray-800">
                  <div className="bg-white rounded-[1.5rem] overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
                      <div className="flex justify-between items-start gap-4">
                        <div>
                          <p className="text-sm opacity-90">MoovePay Dashboard</p>
                          <h3 className="text-2xl font-bold mt-1">{slide.eventName}</h3>
                        </div>
                        <span className="bg-white/20 text-xs px-3 py-1 rounded-full">{slide.eventType}</span>
                      </div>
                    </div>

                    <div className="p-6 space-y-5">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-blue-50 rounded-2xl p-4">
                          <p className="text-xs text-gray-500 mb-1">Inscrições</p>
                          <p className="text-xl font-bold text-gray-900">{slide.metricOne}</p>
                        </div>
                        <div className="bg-green-50 rounded-2xl p-4">
                          <p className="text-xs text-gray-500 mb-1">Resultado</p>
                          <p className="text-xl font-bold text-gray-900">{slide.metricTwo}</p>
                        </div>
                      </div>

                      <div className="border rounded-2xl p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="font-semibold text-gray-900">Participante confirmado</p>
                            <p className="text-sm text-gray-500">Pagamento recebido e inscrição liberada</p>
                          </div>
                          <div className="w-12 h-12 rounded-xl bg-gray-900 text-white flex items-center justify-center text-xl">
                            ▦
                          </div>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full w-3/4 bg-blue-600 rounded-full" />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="border rounded-xl p-3">
                          <p className="text-lg font-bold text-gray-900">Pix</p>
                          <p className="text-xs text-gray-500">ativo</p>
                        </div>
                        <div className="border rounded-xl p-3">
                          <p className="text-lg font-bold text-gray-900">QR</p>
                          <p className="text-xs text-gray-500">check-in</p>
                        </div>
                        <div className="border rounded-xl p-3">
                          <p className="text-lg font-bold text-gray-900">PDF</p>
                          <p className="text-xs text-gray-500">certificado</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative border-t bg-white/70 px-6 sm:px-10 lg:px-14 py-5 flex items-center justify-between gap-4">
              <div className="flex gap-2">
                {heroSlides.map((item, index) => (
                  <button
                    key={item.title}
                    type="button"
                    onClick={() => goToSlide(index)}
                    aria-label={`Ir para o slide ${index + 1}`}
                    className={`h-3 rounded-full transition-all ${activeSlide === index ? 'w-10 bg-blue-600' : 'w-3 bg-gray-300 hover:bg-gray-400'}`}
                  />
                ))}
              </div>

              <div className="hidden md:flex items-center gap-6 text-sm text-gray-600">
                <span>100% online</span>
                <span>•</span>
                <span>Pagamentos seguros</span>
                <span>•</span>
                <span>Feito para equipes de igreja</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <OpenEventsSection />

      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Sua igreja ainda organiza eventos assim?
          </h2>
          <p className="text-xl text-gray-600 mb-12 max-w-3xl mx-auto">
            Eventos da igreja exigem cuidado, organização e transparência. A MoovePay ajuda sua equipe a sair do improviso.
          </p>

          <div className="grid md:grid-cols-3 gap-6">
            {dores.map((dor) => (
              <div key={dor} className="bg-white p-6 rounded-2xl shadow-sm border text-left">
                <div className="text-red-500 text-2xl mb-3">✕</div>
                <p className="font-semibold text-gray-800">{dor}</p>
              </div>
            ))}
          </div>

          <p className="mt-10 text-lg font-semibold text-blue-600">
            A MoovePay centraliza inscrições, pagamentos, check-in e certificados em uma única plataforma.
          </p>
        </div>
      </section>

      <section id="recursos" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Tudo que sua igreja precisa para organizar eventos com excelência
          </h2>
          <p className="text-xl text-gray-600 mb-16 max-w-3xl mx-auto">
            Do cadastro do evento ao controle financeiro, a MoovePay simplifica a operação para pastores, líderes e equipes voluntárias.
          </p>

          <div className="grid md:grid-cols-3 gap-10">
            {recursos.map((recurso) => (
              <Card key={recurso.title} className={`border-2 ${recurso.border} hover:shadow-xl transition-all text-left`}>
                <CardHeader className="pb-4">
                  <div className={`w-14 h-14 bg-gradient-to-br ${recurso.color} rounded-xl flex items-center justify-center text-2xl mb-4 shadow-md`}>
                    {recurso.icon}
                  </div>
                  <CardTitle className="text-xl">{recurso.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base leading-relaxed">
                    {recurso.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="como-funciona" className="py-20 px-4 sm:px-6 lg:px-8 bg-blue-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Como funciona</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Em poucos passos, sua igreja já pode divulgar o evento e receber inscrições online.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-2xl shadow-sm border">
              <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center text-xl font-bold mb-6">1</div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Crie a página do evento</h3>
              <p className="text-gray-600 leading-relaxed">
                Informe nome, data, local, descrição, imagem e tipos de inscrição do seu retiro, congresso ou curso.
              </p>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-sm border">
              <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center text-xl font-bold mb-6">2</div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Receba inscrições e pagamentos</h3>
              <p className="text-gray-600 leading-relaxed">
                Os participantes se inscrevem online e pagam por Pix, cartão ou boleto com segurança via Asaas.
              </p>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-sm border">
              <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center text-xl font-bold mb-6">3</div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Faça check-in e acompanhe tudo</h3>
              <p className="text-gray-600 leading-relaxed">
                Use QR Code na entrada, acompanhe relatórios e emita certificados quando o evento terminar.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div id="tipos-evento">
        <ParallaxSection bgImage="/img/Screenshot_7.jpg">
          <div className="text-center">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Ideal para eventos cristãos de todos os tamanhos
            </h2>
            <p className="text-xl text-gray-700 max-w-3xl mx-auto">
              Seja para uma igreja local, ministério, associação, escola bíblica ou conferência regional.
            </p>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 mt-12">
              {tiposEvento.map((tipo) => (
                <div key={tipo} className="bg-white/90 p-6 rounded-xl shadow-md hover:shadow-lg transition-all border border-gray-100 backdrop-blur-sm">
                  <h3 className="font-bold text-lg text-gray-900">{tipo}</h3>
                </div>
              ))}
            </div>
          </div>
        </ParallaxSection>
      </div>

      <section id="planos" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Planos simples para sua igreja começar hoje
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Comece sem mensalidade obrigatória. Pague apenas quando vender inscrições pagas ou escolha um plano para operações recorrentes.
            </p>
          </div>

          <div className="grid lg:grid-cols-4 md:grid-cols-2 gap-8">
            <Card className="border-2 hover:shadow-xl transition-all">
              <CardHeader className="text-center pb-8">
                <CardTitle className="text-2xl mb-2">Gratuito</CardTitle>
                <div className="text-5xl font-bold text-gray-900 mb-2">R$ 0</div>
                <p className="text-sm text-gray-600">Ideal para eventos gratuitos da igreja</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-3 text-sm">
                  <li className="flex items-start gap-2"><span className="text-green-600 text-lg">✓</span><span>Eventos gratuitos ilimitados</span></li>
                  <li className="flex items-start gap-2"><span className="text-green-600 text-lg">✓</span><span>Inscrições online</span></li>
                  <li className="flex items-start gap-2"><span className="text-green-600 text-lg">✓</span><span>Lista de participantes</span></li>
                  <li className="flex items-start gap-2"><span className="text-green-600 text-lg">✓</span><span>Relatórios básicos</span></li>
                  <li className="flex items-start gap-2"><span className="text-green-600 text-lg">✓</span><span>Página pública do evento</span></li>
                </ul>
                <Link href="/signup" className="block">
                  <Button className="w-full mt-6 bg-gray-900 hover:bg-gray-800">Começar grátis</Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="border-2 border-blue-500 relative shadow-xl scale-105">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-4 py-1 rounded-full text-sm font-semibold">
                Mais indicado
              </div>
              <CardHeader className="text-center pb-8">
                <CardTitle className="text-2xl mb-2">Essencial</CardTitle>
                <div className="text-5xl font-bold text-blue-600 mb-2">10%</div>
                <p className="text-sm text-gray-600">Por inscrição paga confirmada</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-center text-gray-700 font-semibold">
                  Receba inscrições com Pix automático via Asaas
                </p>
                <ul className="space-y-3 text-sm">
                  <li className="flex items-start gap-2"><span className="text-green-600 text-lg">✓</span><span>Tudo do plano Gratuito</span></li>
                  <li className="flex items-start gap-2"><span className="text-green-600 text-lg">✓</span><span>Pix, cartão e boleto</span></li>
                  <li className="flex items-start gap-2"><span className="text-green-600 text-lg">✓</span><span>Confirmação automática de pagamento</span></li>
                  <li className="flex items-start gap-2"><span className="text-green-600 text-lg">✓</span><span>Certificados automáticos</span></li>
                  <li className="flex items-start gap-2"><span className="text-green-600 text-lg">✓</span><span>Check-in com QR Code</span></li>
                </ul>
                <Link href="/signup" className="block">
                  <Button className="w-full mt-6 bg-blue-600 hover:bg-blue-700">Criar evento pago</Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="border-2 hover:shadow-xl transition-all">
              <CardHeader className="text-center pb-8">
                <CardTitle className="text-2xl mb-2">Pro</CardTitle>
                <div className="text-5xl font-bold text-gray-900 mb-2">R$ 97</div>
                <p className="text-sm text-gray-600">por mês para igrejas recorrentes</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-center text-gray-700">Para igrejas que fazem eventos todos os meses</p>
                <ul className="space-y-3 text-sm">
                  <li className="flex items-start gap-2"><span className="text-green-600 text-lg">✓</span><span>Tudo do Essencial</span></li>
                  <li className="flex items-start gap-2"><span className="text-green-600 text-lg">✓</span><span>Taxa reduzida nas inscrições pagas</span></li>
                  <li className="flex items-start gap-2"><span className="text-green-600 text-lg">✓</span><span>Múltiplos organizadores</span></li>
                  <li className="flex items-start gap-2"><span className="text-green-600 text-lg">✓</span><span>Relatórios avançados</span></li>
                  <li className="flex items-start gap-2"><span className="text-green-600 text-lg">✓</span><span>Suporte prioritário</span></li>
                </ul>
                <a href="https://wa.me/5591981755021" target="_blank" rel="noopener noreferrer" className="block">
                  <Button className="w-full mt-6" variant="outline">Falar sobre Pro</Button>
                </a>
              </CardContent>
            </Card>

            <Card className="border-2 hover:shadow-xl transition-all">
              <CardHeader className="text-center pb-8">
                <CardTitle className="text-2xl mb-2">Igrejas & Ministérios</CardTitle>
                <div className="text-5xl font-bold text-gray-900 mb-2">Custom</div>
                <p className="text-sm text-gray-600">Para grandes operações</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-center text-gray-700">
                  Para conferências, denominações e ministérios com alto volume
                </p>
                <ul className="space-y-3 text-sm">
                  <li className="flex items-start gap-2"><span className="text-green-600 text-lg">✓</span><span>Tarifa personalizada</span></li>
                  <li className="flex items-start gap-2"><span className="text-green-600 text-lg">✓</span><span>Multi-eventos</span></li>
                  <li className="flex items-start gap-2"><span className="text-green-600 text-lg">✓</span><span>White label</span></li>
                  <li className="flex items-start gap-2"><span className="text-green-600 text-lg">✓</span><span>Suporte dedicado</span></li>
                  <li className="flex items-start gap-2"><span className="text-green-600 text-lg">✓</span><span>Onboarding personalizado</span></li>
                </ul>
                <a href="https://wa.me/5591981755021" target="_blank" rel="noopener noreferrer" className="block">
                  <Button className="w-full mt-6" variant="outline">Solicitar proposta</Button>
                </a>
              </CardContent>
            </Card>
          </div>

          <p className="text-center text-sm text-gray-500 mt-8">
            Pagamentos processados com segurança. Taxas do gateway e condições de repasse podem variar conforme configuração da conta.
          </p>
        </div>
      </section>

      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div className="bg-white p-8 rounded-2xl border shadow-sm">
              <div className="text-3xl mb-4">💳</div>
              <h3 className="font-bold text-gray-900 mb-2">Pagamentos Digitais</h3>
              <p className="text-gray-600 text-sm">Pix, cartão e boleto em um fluxo simples e seguro para os participantes.</p>
            </div>
            <div className="bg-white p-8 rounded-2xl border shadow-sm">
              <div className="text-3xl mb-4">🤝</div>
              <h3 className="font-bold text-gray-900 mb-2">Sem contrato para começar</h3>
              <p className="text-gray-600 text-sm">Sua igreja pode criar eventos gratuitos e testar a plataforma sem compromisso.</p>
            </div>
            <div className="bg-white p-8 rounded-2xl border shadow-sm">
              <div className="text-3xl mb-4">📲</div>
              <h3 className="font-bold text-gray-900 mb-2">Suporte humano</h3>
              <p className="text-gray-600 text-sm">Fale com a equipe pelo WhatsApp para tirar dúvidas e configurar seu primeiro evento.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-blue-600 to-blue-700">
        <div className="max-w-4xl mx-auto text-center text-white">
          <h2 className="text-4xl sm:text-5xl font-bold mb-6">
            Comece a organizar o próximo evento da sua igreja hoje
          </h2>
          <p className="text-xl mb-10 opacity-95 leading-relaxed">
            Crie uma página de inscrição, receba pagamentos online e acompanhe tudo em um só lugar. Sem planilhas, sem confusão e sem mensalidade obrigatória para começar.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup">
              <Button size="lg" className="bg-white text-blue-600 hover:bg-gray-100 px-12 h-14 text-lg font-semibold shadow-xl">
                Criar meu evento agora →
              </Button>
            </Link>
            <a href="https://wa.me/5591981755021" target="_blank" rel="noopener noreferrer">
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white hover:text-blue-600 px-12 h-14 text-lg font-semibold">
                Falar no WhatsApp
              </Button>
            </a>
          </div>
        </div>
      </section>

      <footer className="bg-gray-900 text-gray-400 py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Image src="/logo_cont.png" alt="MoovePay Logo" width={200} height={65} className="h-16 w-auto" />
              </div>
              <p className="text-sm leading-relaxed">
                Sistema completo para gestão de eventos de igrejas, ministérios, cursos, retiros e conferências cristãs.
              </p>
              <p className="text-xs mt-4 text-gray-500">Pagamentos processados com segurança.</p>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-4">Plataforma</h4>
              <ul className="space-y-3 text-sm">
                <li><a href="#recursos" className="hover:text-white transition">Recursos</a></li>
                <li><a href="#como-funciona" className="hover:text-white transition">Como funciona</a></li>
                <li><a href="#planos" className="hover:text-white transition">Planos</a></li>
                <li><a href="#eventos" className="hover:text-white transition">Eventos</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-4">Conta</h4>
              <ul className="space-y-3 text-sm">
                <li><Link href="/login" className="hover:text-white transition">Login</Link></li>
                <li><Link href="/signup" className="hover:text-white transition">Criar conta grátis</Link></li>
                <li><Link href="/ajuda" className="hover:text-white transition">Ajuda</Link></li>
                <li><Link href="/privacidade" className="hover:text-white transition">Privacidade</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-4">Contato</h4>
              <ul className="space-y-3 text-sm">
                <li>
                  <a href="https://wa.me/5591981755021" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">
                    WhatsApp: (91) 98175-5021
                  </a>
                </li>
                <li><Link href="/contato" className="hover:text-white transition">Fale conosco</Link></li>
                <li className="flex gap-3 pt-2">
                  <a href="#" className="hover:text-white transition">Facebook</a>
                  <a href="#" className="hover:text-white transition">Instagram</a>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-8 text-center text-sm">
            <p>&copy; 2026 MoovePay. Todos os direitos reservados.</p>
            <div className="mt-4 space-x-4">
              <Link href="/privacidade" className="hover:text-white transition">Política de Privacidade</Link>
              <span>•</span>
              <Link href="/contato" className="hover:text-white transition">Contato</Link>
            </div>
          </div>
        </div>
      </footer>
    </main>
  )
}
