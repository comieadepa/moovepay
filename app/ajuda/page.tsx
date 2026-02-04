'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface FAQItem {
  id: number
  question: string
  answer: string
  category: 'inscricao' | 'evento' | 'pagamento' | 'tecnico'
}

const faqItems: FAQItem[] = [
  {
    id: 1,
    category: 'inscricao',
    question: 'Como faço minha inscrição em um evento?',
    answer: 'Para se inscrever em um evento, acesse a página do evento desejado, preencha o formulário com seus dados e escolha a forma de pagamento (PIX, cartão ou boleto). Após a confirmação do pagamento, você receberá um voucher por e-mail com QR Code para o check-in.',
  },
  {
    id: 2,
    category: 'inscricao',
    question: 'Posso me inscrever em vários eventos ao mesmo tempo?',
    answer: 'Sim! Você pode se inscrever em quantos eventos quiser. Basta acessar cada página de evento e fazer sua inscrição normalmente. Todas as suas inscrições ficarão salvas no seu perfil.',
  },
  {
    id: 3,
    category: 'inscricao',
    question: 'Como cancelar minha inscrição?',
    answer: 'Você pode cancelar sua inscrição acessando sua conta, indo em "Minhas Inscrições" e clicando em cancelar. O reembolso será processado conforme a política do evento.',
  },
  {
    id: 4,
    category: 'evento',
    question: 'Como criar um evento na plataforma?',
    answer: 'Primeiramente, crie sua conta no MoovePay (é grátis!). Depois faça login, vá em "Criar Novo Evento" e preencha os dados básicos como nome, descrição, datas, imagem e tipos de ingressos. Você pode salvar como rascunho e publicar depois.',
  },
  {
    id: 5,
    category: 'evento',
    question: 'Qual é o limite de inscrições por evento?',
    answer: 'Não há limite! Você pode receber quantas inscrições quiser. A plataforma é escalável e suporta eventos de qualquer tamanho.',
  },
  {
    id: 6,
    category: 'evento',
    question: 'Como gerar o voucher com QR Code?',
    answer: 'O voucher com QR Code é gerado automaticamente quando uma inscrição é confirmada. Você pode visualizar e baixar os vouchers na área "Inscrições" do seu evento. O QR Code permite fazer o check-in rápido durante o evento.',
  },
  {
    id: 7,
    category: 'evento',
    question: 'Como fazer check-in dos participantes?',
    answer: 'Use nosso app móvel para fazer o check-in lendo o QR Code dos vouchers. Você também pode fazer check-in manual na área administrativa do evento.',
  },
  {
    id: 8,
    category: 'pagamento',
    question: 'Quais são as formas de pagamento aceitas?',
    answer: 'Aceitamos PIX (instantâneo), Cartão de Crédito e Boleto. Cada participante pode escolher a forma que preferir.',
  },
  {
    id: 9,
    category: 'pagamento',
    question: 'Quanto custa usar a plataforma?',
    answer: 'Temos dois planos: Eventos Gratuitos (R$ 0 - ideal para eventos sem cobrança) e Eventos Pagos (10% sobre o valor da inscrição). Para grandes volumes, oferecemos plano Premium com tarifa customizada.',
  },
  {
    id: 10,
    category: 'pagamento',
    question: 'Quando recebo o dinheiro das inscrições?',
    answer: 'Você pode solicitar o saque do seu saldo a qualquer momento na sua área administrativa. Acesse "Minha Conta" > "Extrato Financeiro" > "Solicitar Saque" e o dinheiro será transferido para sua conta bancária em até 24 horas. Não há limite mínimo para saque.',
  },
  {
    id: 11,
    category: 'tecnico',
    question: 'Meus dados estão seguros na plataforma?',
    answer: 'Sim! Usamos criptografia de ponta a ponta, autenticação segura e conformidade com LGPD. Todos os dados dos participantes são protegidos e nunca compartilhados sem consentimento.',
  },
  {
    id: 12,
    category: 'tecnico',
    question: 'A plataforma funciona em mobile?',
    answer: 'Sim, 100% responsiva! Você pode acessar pelo navegador do seu smartphone/tablet em qualquer lugar. Em breve lançaremos nosso app nativo com funcionalidades adicionais.',
  },
]

export default function AjudaPage() {
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string>('todos')

  const backHref = '/'

  const categories = [
    { id: 'todos', label: 'Todos' },
    { id: 'inscricao', label: 'Inscrição' },
    { id: 'evento', label: 'Eventos' },
    { id: 'pagamento', label: 'Pagamento' },
    { id: 'tecnico', label: 'Técnico' },
  ]

  const filteredItems = selectedCategory === 'todos'
    ? faqItems
    : faqItems.filter(item => item.category === selectedCategory)

  return (
    <main className="w-full">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-white/95 backdrop-blur-sm border-b z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center h-16">
          <Link href={backHref} className="flex items-center gap-2">
            <Image 
              src="/logo.png" 
              alt="MoovePay Logo" 
              width={180} 
              height={60}
              className="h-14 w-auto"
            />
          </Link>
          <Link href={backHref}>
            <Button variant="ghost" className="text-gray-700">
              ← Voltar
            </Button>
          </Link>
        </div>
      </nav>

      {/* Header */}
      <section className="pt-24 pb-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-blue-50 to-white">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl font-bold mb-4 text-gray-900">Central de Ajuda</h1>
          <p className="text-xl text-gray-600 mb-8">
            Encontre respostas para as perguntas mais frequentes
          </p>
        </div>
      </section>

      {/* Categories */}
      <section className="py-8 px-4 sm:px-6 lg:px-8 bg-white border-b">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-wrap gap-3 justify-center">
            {categories.map(cat => (
              <Button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                variant={selectedCategory === cat.id ? 'default' : 'outline'}
                className={selectedCategory === cat.id ? 'bg-blue-600' : ''}
              >
                {cat.label}
              </Button>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Items */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="space-y-4">
            {filteredItems.map(item => (
              <Card key={item.id} className="cursor-pointer border-2 hover:border-blue-300 transition">
                <button
                  onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                  className="w-full text-left p-6 flex justify-between items-start gap-4"
                >
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {item.question}
                    </h3>
                  </div>
                  <div className="text-2xl text-blue-600 flex-shrink-0">
                    {expandedId === item.id ? '−' : '+'}
                  </div>
                </button>

                {expandedId === item.id && (
                  <CardContent className="pt-0 pb-6 px-6 border-t">
                    <p className="text-gray-700 leading-relaxed">
                      {item.answer}
                    </p>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-blue-600 to-blue-700">
        <div className="max-w-4xl mx-auto text-center text-white">
          <h2 className="text-3xl font-bold mb-4">Não encontrou sua resposta?</h2>
          <p className="text-lg mb-8 opacity-95">
            Entre em contato conosco via WhatsApp e fale com nosso time de suporte e vendas!
          </p>
          <a href="https://wa.me/5591981755021" target="_blank" rel="noopener noreferrer">
            <Button size="lg" className="bg-white text-blue-600 hover:bg-gray-100 px-12 h-14 text-lg font-semibold shadow-xl">
              Conversar no WhatsApp →
            </Button>
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <p>&copy; 2026 MoovePay. Todos os direitos reservados.</p>
        </div>
      </footer>
    </main>
  )
}
