'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'

export default function PrivacidadePage() {
  return (
    <main className="w-full">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-white/95 backdrop-blur-sm border-b z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center h-16">
          <Link href="/" className="flex items-center gap-2">
            <Image 
              src="/logo.png" 
              alt="MoovePay Logo" 
              width={180} 
              height={60}
              className="h-14 w-auto"
            />
          </Link>
          <Link href="/">
            <Button variant="ghost" className="text-gray-700">
              ← Voltar
            </Button>
          </Link>
        </div>
      </nav>

      {/* Header */}
      <section className="pt-24 pb-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-blue-50 to-white">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl font-bold mb-4 text-gray-900">Política de Privacidade</h1>
          <p className="text-xl text-gray-600">
            Conheça como protegemos seus dados pessoais
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-4xl mx-auto prose prose-lg max-w-none">
          <h2>1. Introdução</h2>
          <p>
            A MoovePay ("nós", "nosso" ou "Companhia") está comprometida em proteger sua privacidade. Esta Política de Privacidade explica como coletamos, usamos, compartilhamos e protegemos suas informações pessoais de acordo com a Lei Geral de Proteção de Dados (LGPD).
          </p>

          <h2>2. Informações que Coletamos</h2>
          <p>Coletamos as seguintes informações:</p>
          <ul>
            <li><strong>Dados de Cadastro:</strong> Nome, email, telefone, CPF/CNPJ, endereço</li>
            <li><strong>Dados de Pagamento:</strong> Informações de conta bancária, dados de cartão (processados por terceiros)</li>
            <li><strong>Dados de Uso:</strong> Histórico de eventos, inscrições, interações com a plataforma</li>
            <li><strong>Dados Técnicos:</strong> Endereço IP, tipo de navegador, cookies, dados de localização</li>
          </ul>

          <h2>3. Como Usamos Suas Informações</h2>
          <p>Utilizamos suas informações para:</p>
          <ul>
            <li>Criar e gerenciar sua conta</li>
            <li>Processar pagamentos e transações</li>
            <li>Enviar confirmações e notificações</li>
            <li>Melhorar nossos serviços</li>
            <li>Cumprir obrigações legais</li>
            <li>Prevenir fraude e problemas de segurança</li>
          </ul>

          <h2>4. Compartilhamento de Dados</h2>
          <p>
            Não vendemos seus dados pessoais. Compartilhamos informações apenas quando necessário com:
          </p>
          <ul>
            <li>Provedores de pagamento (Asaas, etc)</li>
            <li>Provedores de email (Resend, etc)</li>
            <li>Autoridades legais, quando exigido por lei</li>
          </ul>

          <h2>5. Seus Direitos</h2>
          <p>De acordo com a LGPD, você tem direito a:</p>
          <ul>
            <li>Acessar seus dados pessoais</li>
            <li>Corrigir dados imprecisos</li>
            <li>Solicitar a exclusão de seus dados</li>
            <li>Obter cópia dos seus dados</li>
            <li>Revogar consentimento</li>
          </ul>
          <p>
            Para exercer esses direitos, entre em contato através de <Link href="/contato" className="text-blue-600 hover:underline">nosso formulário de contato</Link>.
          </p>

          <h2>6. Cookies e Rastreamento</h2>
          <p>
            Usamos cookies para melhorar sua experiência. Você pode controlar as configurações de cookies em seu navegador. Alguns cookies são essenciais para o funcionamento da plataforma.
          </p>

          <h2>7. Segurança</h2>
          <p>
            Implementamos medidas de segurança técnicas e administrativas para proteger suas informações contra acesso não autorizado, alteração ou destruição. Utilizamos criptografia SSL/TLS para transmissão de dados.
          </p>

          <h2>8. Retenção de Dados</h2>
          <p>
            Mantemos seus dados pelo tempo necessário para fornecer nossos serviços e cumprir obrigações legais. Você pode solicitar a exclusão de seus dados a qualquer momento.
          </p>

          <h2>9. Mudanças nesta Política</h2>
          <p>
            Podemos atualizar esta política ocasionalmente. Notificaremos você sobre mudanças significativas por email ou através de um aviso em nossa plataforma.
          </p>

          <h2>10. Contato</h2>
          <p>
            Se tiver dúvidas sobre esta Política de Privacidade, entre em contato conosco em <Link href="/contato" className="text-blue-600 hover:underline">suporte@moovepay.com</Link>.
          </p>

          <p className="text-sm text-gray-600 mt-8">
            <strong>Última atualização:</strong> 3 de fevereiro de 2026
          </p>
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
