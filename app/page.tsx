import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import Image from 'next/image'
import { EventsSlider } from './components/EventsSlider'
import { ParallaxSection } from './components/ParallaxSection'
import { CookieBanner } from './components/CookieBanner'
import { OpenEventsSection } from './components/OpenEventsSection'

export default function Home() {
  return (
    <main className="w-full">
      <CookieBanner />
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-white/95 backdrop-blur-sm border-b z-50 shadow-sm">
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
          <div className="flex items-center gap-6">
            <a href="#recursos" className="text-sm font-medium text-gray-700 hover:text-blue-600 transition">Recursos</a>
            <a href="#planos" className="text-sm font-medium text-gray-700 hover:text-blue-600 transition">Planos</a>
            <a href="#eventos" className="text-sm font-medium text-gray-700 hover:text-blue-600 transition">Eventos</a>
            <Link href="/login">
              <Button variant="ghost" size="sm" className="text-gray-700">Login</Button>
            </Link>
            <Link href="/signup">
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white shadow-md">Criar Conta Grátis</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Events Slider */}
      <EventsSlider />

      {/* Open Events */}
      <OpenEventsSection />

      {/* Hero Section */}
      <section className="pt-24 pb-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-blue-50 to-white">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-5xl sm:text-6xl font-bold mb-6 text-gray-900 leading-tight">
            A plataforma completa para <br />
            <span className="text-blue-600">gestão de eventos</span>
          </h1>
          
          <p className="text-xl text-gray-600 mb-10 max-w-3xl mx-auto leading-relaxed">
            A melhor escolha para seu retiro, conferência, congresso ou seminário presencial e online.
          </p>
          
          <Link href="/signup">
            <Button size="lg" className="bg-blue-600 hover:bg-blue-700 px-10 h-14 text-lg font-semibold shadow-lg hover:shadow-xl transition-all">
              Experimente Agora →
            </Button>
          </Link>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-16 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-600 mb-2">+12</div>
              <div className="text-sm text-gray-600">Anos de experiência</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-600 mb-2">+5.8M</div>
              <div className="text-sm text-gray-600">Inscrições realizadas</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-600 mb-2">+34k</div>
              <div className="text-sm text-gray-600">Clientes ativos</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-600 mb-2">+92k</div>
              <div className="text-sm text-gray-600">Eventos realizados</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Overview */}
      <section id="recursos" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">Gestão completa de eventos e cursos</h2>
          <p className="text-xl text-gray-600 mb-16 max-w-3xl mx-auto">
            Desde a divulgação até o certificado, passando pela inscrição, financeiro e check-in.
          </p>

          <div className="grid md:grid-cols-3 gap-10">
            <Card className="border-2 hover:border-blue-200 hover:shadow-xl transition-all">
              <CardHeader className="pb-4">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center text-2xl mb-4 shadow-md">
                  📝
                </div>
                <CardTitle className="text-xl">Criar Eventos</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base leading-relaxed">
                  Interface intuitiva para criar eventos com imagens, descrições detalhadas e tipos de inscrição personalizados.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-green-200 hover:shadow-xl transition-all">
              <CardHeader className="pb-4">
                <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center text-2xl mb-4 shadow-md">
                  💳
                </div>
                <CardTitle className="text-xl">Múltiplos Pagamentos</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base leading-relaxed">
                  Aceite PIX, cartão de crédito e boleto. Parcelamento em até 12x para seus clientes.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-purple-200 hover:shadow-xl transition-all">
              <CardHeader className="pb-4">
                <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center text-2xl mb-4 shadow-md">
                  👥
                </div>
                <CardTitle className="text-xl">Gerenciar Inscrições</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base leading-relaxed">
                  Acompanhe inscrições em tempo real, gere vouchers com QR code e envie confirmações automáticas.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-orange-200 hover:shadow-xl transition-all">
              <CardHeader className="pb-4">
                <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center text-2xl mb-4 shadow-md">
                  📊
                </div>
                <CardTitle className="text-xl">Análises Detalhadas</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base leading-relaxed">
                  Dashboard com estatísticas em tempo real: inscrições, receita, taxa de ocupação e muito mais.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-pink-200 hover:shadow-xl transition-all">
              <CardHeader className="pb-4">
                <div className="w-14 h-14 bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl flex items-center justify-center text-2xl mb-4 shadow-md">
                  📱
                </div>
                <CardTitle className="text-xl">100% Responsivo</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base leading-relaxed">
                  Funciona perfeitamente em qualquer dispositivo. Seus participantes sempre conectados.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-red-200 hover:shadow-xl transition-all">
              <CardHeader className="pb-4">
                <div className="w-14 h-14 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center text-2xl mb-4 shadow-md">
                  🔒
                </div>
                <CardTitle className="text-xl">Segurança Total</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base leading-relaxed">
                  Dados criptografados, autenticação segura e conformidade com LGPD.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Event Types with Parallax */}
      <div id="tipos-evento">
        <ParallaxSection bgImage="/img/Screenshot_7.jpg">
          <div className="text-center">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">MoovePay é ideal para o seu tipo de evento</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 mt-12">
            {['Retiros', 'Conferências', 'Congressos', 'Workshops', 'Seminários', 'Cursos'].map((tipo) => (
              <div key={tipo} className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition-all border border-gray-100 backdrop-blur-sm bg-white/80">
                <h3 className="font-bold text-lg text-gray-900">{tipo}</h3>
              </div>
            ))}
          </div>
        </div>
        </ParallaxSection>
      </div>

      {/* Pricing Section */}
      <section id="planos" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center text-gray-900 mb-4">Menor tarifa do mercado</h2>
          <p className="text-center text-xl text-gray-600 mb-16">Escolha o plano ideal para seu evento</p>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Gratuito */}
            <Card className="border-2">
              <CardHeader className="text-center pb-8">
                <CardTitle className="text-2xl mb-2">Eventos gratuitos</CardTitle>
                <div className="text-5xl font-bold text-gray-900 mb-2">R$ 0</div>
                <p className="text-sm text-gray-600">Ideal para pequenos eventos</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-center text-gray-700">
                  Vários recursos sem nenhum custo
                </p>
                <ul className="space-y-3 text-sm">
                  <li className="flex items-center gap-2">
                    <span className="text-green-600 text-lg">✓</span>
                    <span>Eventos gratuitos ilimitados</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-600 text-lg">✓</span>
                    <span>Inscrições ilimitadas</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-600 text-lg">✓</span>
                    <span>Relatórios Otimizados</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-600 text-lg">✓</span>
                    <span>Controle e Segurança</span>
                  </li>
                </ul>
                <Link href="/signup" className="block">
                  <Button className="w-full mt-6 bg-gray-900 hover:bg-gray-800">
                    Começar Grátis
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Pagos - Popular */}
            <Card className="border-2 border-blue-500 relative shadow-xl">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-4 py-1 rounded-full text-sm font-semibold">
                Mais Popular
              </div>
              <CardHeader className="text-center pb-8">
                <CardTitle className="text-2xl mb-2">Eventos pagos</CardTitle>
                <div className="text-5xl font-bold text-blue-600 mb-2">10%</div>
                <p className="text-sm text-gray-600">Taxa sobre o valor da inscrição</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-center text-gray-700 font-semibold">
                  Realize check-in por QR Code pelo app
                </p>
                <ul className="space-y-3 text-sm">
                  <li className="flex items-center gap-2">
                    <span className="text-green-600 text-lg">✓</span>
                    <span>Eventos pagos ilimitados</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-600 text-lg">✓</span>
                    <span>Recebimento automático</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-600 text-lg">✓</span>
                    <span>Suporte prioritário</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-600 text-lg">✓</span>
                    <span>Todas as formas de pagamento</span>
                  </li>
                </ul>
                <Link href="/signup" className="block">
                  <Button className="w-full mt-6 bg-blue-600 hover:bg-blue-700">
                    Começar Agora
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Premium */}
            <Card className="border-2">
              <CardHeader className="text-center pb-8">
                <CardTitle className="text-2xl mb-2">Premium</CardTitle>
                <div className="text-5xl font-bold text-gray-900 mb-2">Custom</div>
                <p className="text-sm text-gray-600">Grandes volumes</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-center text-gray-700">
                  Para grandes operações e empresas
                </p>
                <ul className="space-y-3 text-sm">
                  <li className="flex items-center gap-2">
                    <span className="text-green-600 text-lg">✓</span>
                    <span>Tarifa customizada</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-600 text-lg">✓</span>
                    <span>White label</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-600 text-lg">✓</span>
                    <span>Planejamento dedicado</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-600 text-lg">✓</span>
                    <span>Suporte 24/7</span>
                  </li>
                </ul>
                <a href="https://wa.me/5591981755021" target="_blank" rel="noopener noreferrer" className="block">
                  <Button className="w-full mt-6" variant="outline">
                    Fale Conosco
                  </Button>
                </a>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-blue-600 to-blue-700">
        <div className="max-w-4xl mx-auto text-center text-white">
          <h2 className="text-4xl sm:text-5xl font-bold mb-6">Comece a vender agora mesmo</h2>
          <p className="text-xl mb-10 opacity-95 leading-relaxed">
            Em poucos minutos você já pode divulgar o seu evento e começar a faturar.<br />
            Comece agora mesmo, sem taxas de associação ou contrato.
          </p>
          <Link href="/signup">
            <Button size="lg" className="bg-white text-blue-600 hover:bg-gray-100 px-12 h-14 text-lg font-semibold shadow-xl">
              Criar Meu Evento Agora →
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Image 
                  src="/logo_cont.png" 
                  alt="MoovePay Logo" 
                  width={200} 
                  height={65}
                  className="h-16 w-auto"
                />
              </div>
              <p className="text-sm leading-relaxed">
                A melhor escolha para seu evento, curso ou seminário presencial e online.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Páginas</h4>
              <ul className="space-y-3 text-sm">
                <li><a href="#recursos" className="hover:text-white transition">Recursos</a></li>
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
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Contato</h4>
              <ul className="space-y-3 text-sm">
                <li><Link href="/contato" className="hover:text-white transition">Fale conosco!</Link></li>
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
              <Link href="/privacidade" className="hover:text-white transition">
                Política de Privacidade
              </Link>
              <span>•</span>
              <Link href="/contato" className="hover:text-white transition">
                Contato
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </main>
  )
}
