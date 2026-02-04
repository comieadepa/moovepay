import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export interface EmailPayload {
  to: string
  subject: string
  html: string
  from?: string
}

export async function sendEmail({
  to,
  subject,
  html,
  from = process.env.NEXT_PUBLIC_EMAIL_FROM || 'noreply@moovepay.com.br',
}: EmailPayload) {
  try {
    const data = await resend.emails.send({
      from,
      to,
      subject,
      html,
    })
    return data
  } catch (error) {
    console.error('Erro ao enviar email:', error)
    throw error
  }
}

// Email templates
export const emailTemplates = {
  // Voucher após pagamento confirmado
  voucherEmail: (participantName: string, eventName: string, voucherUrl: string) => ({
    subject: `Seu voucher para ${eventName} está pronto!`,
    html: `
      <h2>Olá, ${participantName}!</h2>
      <p>Seu pagamento foi confirmado com sucesso!</p>
      <p>Seu voucher para o evento <strong>${eventName}</strong> está pronto.</p>
      <p><a href="${voucherUrl}" style="background: #10b981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Baixar Voucher</a></p>
      <p>Você também pode imprimir este email que contém o código QR para o check-in.</p>
      <p>Qualquer dúvida, entre em contato conosco!</p>
    `,
  }),

  // Confirmação de inscrição
  registrationConfirmation: (participantName: string, eventName: string) => ({
    subject: `Inscrição confirmada em ${eventName}`,
    html: `
      <h2>Olá, ${participantName}!</h2>
      <p>Sua inscrição para <strong>${eventName}</strong> foi recebida com sucesso!</p>
      <p>Aguarde o processamento do pagamento e em breve você receberá seu voucher.</p>
    `,
  }),

  // Pagamento em aberto
  pendingPaymentEmail: (participantName: string, eventName: string, paymentLink: string) => ({
    subject: `Complete seu pagamento para ${eventName}`,
    html: `
      <h2>Olá, ${participantName}!</h2>
      <p>Você tem um pagamento pendente para <strong>${eventName}</strong>.</p>
      <p><a href="${paymentLink}" style="background: #f59e0b; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Pagar Agora</a></p>
    `,
  }),

  // Voucher reenviado
  voucherResent: (participantName: string, eventName: string) => ({
    subject: `Seu voucher para ${eventName} foi reenviado`,
    html: `
      <h2>Olá, ${participantName}!</h2>
      <p>Seu voucher para <strong>${eventName}</strong> foi reenviado com sucesso!</p>
      <p>Se não conseguir localizá-lo, verifique sua pasta de spam.</p>
    `,
  }),
}
