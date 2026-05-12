const nodemailer = require('nodemailer')

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

async function sendWelcomeEmail(to, nome) {
  await transporter.sendMail({
    from: `"SmartCorretorAI" <${process.env.SMTP_USER}>`,
    to,
    subject: '🏠 Bem-vindo ao SmartCorretorAI!',
    html: `
      <div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
        <h1 style="color: #4f52e8; margin-bottom: 8px;">Olá, ${nome}!</h1>
        <p style="color: #6b7280; font-size: 16px;">Bem-vindo ao SmartCorretorAI — sua plataforma de marketing imobiliário com IA.</p>
        <p style="color: #374151;">Agora você pode gerar pacotes completos de marketing para seus imóveis com banners, vídeos e textos para todas as redes sociais em segundos.</p>
        <a href="${process.env.FRONTEND_URL}/dashboard" style="display: inline-block; background: #4f52e8; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 16px;">
          Acessar minha conta
        </a>
        <p style="color: #9ca3af; font-size: 12px; margin-top: 32px;">SmartCorretorAI · Marketing imobiliário com IA</p>
      </div>
    `,
  })
}

async function sendPasswordResetEmail(to, resetUrl) {
  await transporter.sendMail({
    from: `"SmartCorretorAI" <${process.env.SMTP_USER}>`,
    to,
    subject: 'Redefinição de senha',
    html: `
      <div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
        <h1 style="color: #4f52e8;">Redefinição de senha</h1>
        <p style="color: #374151;">Clique no botão abaixo para redefinir sua senha. O link é válido por 1 hora.</p>
        <a href="${resetUrl}" style="display: inline-block; background: #4f52e8; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 16px;">
          Redefinir minha senha
        </a>
        <p style="color: #9ca3af; font-size: 12px; margin-top: 32px;">Se você não solicitou a redefinição, ignore este e-mail.</p>
      </div>
    `,
  })
}

module.exports = { sendWelcomeEmail, sendPasswordResetEmail }
