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
  from = process.env.NEXT_PUBLIC_EMAIL_FROM || 'noreply@congregapay.com.br',
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
    subject: `✅ Seu voucher para ${eventName} está pronto!`,
    html: `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#2563eb,#4f46e5);padding:32px 32px 24px;text-align:center">
            <div style="color:#bfdbfe;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;margin-bottom:8px">CongregaPay</div>
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;line-height:1.3">${eventName}</h1>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px">
            <p style="margin:0 0 8px;color:#374151;font-size:15px">Olá, <strong>${participantName}</strong>!</p>
            <p style="margin:0 0 24px;color:#6b7280;font-size:14px;line-height:1.6">
              Seu pagamento foi confirmado. Apresente o QR Code abaixo na entrada do evento.
            </p>
            <!-- CTA -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding-bottom:24px">
                  <a href="${voucherUrl}"
                     style="display:inline-block;background:linear-gradient(135deg,#2563eb,#4f46e5);color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 32px;border-radius:10px;letter-spacing:0.3px">
                    Ver meu voucher
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;line-height:1.6">
              Ou copie e cole no navegador:<br>
              <span style="color:#2563eb;word-break:break-all">${voucherUrl}</span>
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0;text-align:center">
            <p style="margin:0;color:#94a3b8;font-size:12px">
              Dúvidas? Entre em contato pelo nosso suporte.
            </p>
            <p style="margin:6px 0 0;color:#cbd5e1;font-size:11px">© 2026 CongregaPay</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
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
