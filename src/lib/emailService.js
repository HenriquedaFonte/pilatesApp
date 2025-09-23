// Email service using Resend API
import { supabase } from './supabase';

class EmailService {
  constructor() {
    this.apiKey = import.meta.env.VITE_RESEND_API_KEY || import.meta.env.RESEND_API_KEY;
    this.fromEmail = import.meta.env.VITE_STUDIO_EMAIL || import.meta.env.STUDIO_EMAIL || 'josi@josipilates.com';
    this.fromName = import.meta.env.VITE_STUDIO_NAME || import.meta.env.STUDIO_NAME || 'Josi Pilates';
    this.baseUrl = 'https://api.resend.com';
  }

  async sendEmail({ to, subject, htmlContent, textContent }) {
    try {
      const payload = {
        from: `${this.fromName} <${this.fromEmail}>`,
        to: [to.email],
        subject: subject,
        html: htmlContent,
        text: textContent
      };

      // NOVO: Chama a Edge Function do Supabase
      const { data, error } = await supabase.functions.invoke('send-custom-email', {
        body: payload
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || 'Erro desconhecido ao enviar e-mail');
      }

      return data.result;
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }

  // Send bulk emails (one by one due to Resend limitations on free plan)
  async sendBulkEmails(emails) {
    const results = [];
    
    for (const email of emails) {
      try {
        const result = await this.sendEmail(email);
        results.push({ 
          success: true, 
          email: email.to.email, 
          result 
        });
        
        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Error sending email to ${email.to.email}:`, error);
        results.push({ 
          success: false, 
          email: email.to.email, 
          error: error.message 
        });
      }
    }
    
    return results;
  }

  // Send low credits notification
  async sendLowCreditsNotification(student, creditsRemaining) {
    const subject = 'Aviso: Saldo Baixo de Créditos - Josi Pilates';
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Saldo Baixo de Créditos</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #01b48d 0%, #017a6b 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <div style="display: inline-flex; align-items: center; justify-content: center; gap: 30px;">
            <img src="https://picsum.photos/60/60?random=1" alt="Josi Pilates Logo" style="width: 60px; height: 60px; border-radius: 50%; object-fit: cover;" />
            <div style="text-align: left;">
              <h1 style="color: white; margin: 0; font-size: 28px;">Josi Pilates</h1>
              <p style="color: #f0f0f0; margin: 5px 0 0 0; font-size: 16px;">Studio de Pilates</p>
            </div>
          </div>
        </div>
        
        <div style="background: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
          <h2 style="color: #2c3e50; margin-top: 0;">Olá, ${student.name || student.full_name}!</h2>
          
          <p>Esperamos que você esteja bem e aproveitando suas aulas de Pilates!</p>
          
          <div style="background-color: #fef3c7; border: 1px solid #f59e0b; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
            <h3 style="color: #92400e; margin: 0 0 10px 0;">⚠️ Atenção: Saldo Baixo de Créditos</h3>
            <p style="margin: 0; font-size: 18px; font-weight: bold; color: #92400e;">
              Créditos Restantes: ${creditsRemaining}
            </p>
          </div>
          
          <p>Para continuar aproveitando nossas aulas de Pilates sem interrupções, recomendamos que você renove seus créditos em breve.</p>
          
          <div style="background-color: #f1f5f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h4 style="color: #1e293b; margin-top: 0;">💡 Como renovar seus créditos:</h4>
            <ul style="margin: 10px 0; padding-left: 20px;">
              <li>Entre em contato conosco pelo telefone: <strong>${import.meta.env.VITE_STUDIO_PHONE || import.meta.env.STUDIO_PHONE || '(11) 99999-9999'}</strong></li>
              <li>Envie um WhatsApp para agilizar o processo</li>
              <li>Visite nosso studio durante o horário de funcionamento</li>
            </ul>
          </div>

          <p>Estamos aqui para ajudar você a manter sua rotina de exercícios e bem-estar!</p>

          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e2e8f0;">

          <p style="color: #64748b; font-size: 14px; text-align: center;">
            <strong>Atenciosamente,</strong><br>
            Equipe Josi Pilates<br>
            <em>Cuidando do seu bem-estar com carinho e profissionalismo</em>
          </p>
        </div>
      </body>
      </html>
    `;

    const textContent = `
      Olá, ${student.name || student.full_name}!
      
      Esperamos que você esteja bem e aproveitando suas aulas de Pilates!
      
      ATENÇÃO: SALDO BAIXO DE CRÉDITOS
      Créditos Restantes: ${creditsRemaining}
      
      Para continuar aproveitando nossas aulas de Pilates sem interrupções, recomendamos que você renove seus créditos em breve.
      
      Como renovar seus créditos:
      - Entre em contato conosco pelo telefone: ${import.meta.env.VITE_STUDIO_PHONE || import.meta.env.STUDIO_PHONE || '(11) 99999-9999'}
      - Envie um WhatsApp para agilizar o processo
      - Visite nosso studio durante o horário de funcionamento
      
      Estamos aqui para ajudar você a manter sua rotina de exercícios e bem-estar!
      
      Atenciosamente,
      Equipe Josi Pilates
      Cuidando do seu bem-estar com carinho e profissionalismo
    `;

    return this.sendEmail({
      to: { email: student.email, name: student.name || student.full_name },
      subject,
      htmlContent,
      textContent
    });
  }

  // Send custom notification to students
  async sendCustomNotification(students, subject, message, senderName = 'Professora') {
    const emails = students.map(student => ({
      to: { email: student.email, name: student.name || student.full_name },
      subject,
      htmlContent: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject}</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #01b48d 0%, #017a6b 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <div style="display: inline-flex; align-items: center; justify-content: center; gap: 30px;">
              <img src="https://picsum.photos/60/60?random=1" alt="Josi Pilates Logo" style="width: 60px; height: 60px; border-radius: 50%; object-fit: cover;" />
              <div style="text-align: left;">
                <h1 style="color: white; margin: 0; font-size: 28px;">Josi Pilates</h1>
                <p style="color: #f0f0f0; margin: 5px 0 0 0; font-size: 16px;">Studio de Pilates</p>
              </div>
            </div>
          </div>
          
          <div style="background: white; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 10px 10px;">
            <h2 style="color: #1e293b; margin-top: 0;">Olá, ${student.name || student.full_name}!</h2>

            <div style="background-color: #f1f5f9; padding: 25px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
              ${message.replace(/\n/g, '<br>')}
            </div>

            <hr style="margin: 30px 0; border: none; border-top: 1px solid #e2e8f0;">

            <p style="color: #64748b; font-size: 14px; text-align: center;">
              <strong>Atenciosamente,</strong><br>
              ${senderName} - Josi Pilates<br>
              <em>Cuidando do seu bem-estar com carinho e profissionalismo</em>
            </p>
          </div>
        </body>
        </html>
      `,
      textContent: `
        Olá, ${student.name || student.full_name}!
        
        ${message}
        
        Atenciosamente,
        ${senderName} - Josi Pilates
        Cuidando do seu bem-estar com carinho e profissionalismo
      `
    }));

    return this.sendBulkEmails(emails);
  }

  // Send welcome email for new students
  async sendWelcomeEmail(student) {
    const subject = 'Bem-vindo(a) ao Josi Pilates! 🧘‍♀️';
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Bem-vindo ao Josi Pilates</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #01b48d 0%, #017a6b 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <div style="display: inline-flex; align-items: center; justify-content: center; gap: 30px;">
            <img src="https://picsum.photos/60/60?random=1" alt="Josi Pilates Logo" style="width: 60px; height: 60px; border-radius: 50%; object-fit: cover;" />
            <div style="text-align: left;">
              <h1 style="color: white; margin: 0; font-size: 28px;">🧘‍♀️ Bem-vindo(a)!</h1>
              <p style="color: #f0f0f0; margin: 5px 0 0 0; font-size: 16px;">Josi Pilates</p>
            </div>
          </div>
        </div>
        
        <div style="background: white; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 10px 10px;">
          <h2 style="color: #1e293b; margin-top: 0;">Olá, ${student.name || student.full_name}!</h2>

          <p>É com grande alegria que damos as boas-vindas ao <strong>Josi Pilates</strong>! 🎉</p>

          <div style="background-color: #dcfce7; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #166534; margin-top: 0;">✨ Sua jornada de bem-estar começa agora!</h3>
            <p style="margin-bottom: 0;">Estamos aqui para apoiar você em cada movimento, respiração e conquista.</p>
          </div>

          <h4 style="color: #1e293b;">📋 Próximos passos:</h4>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li>Agende sua primeira aula experimental</li>
            <li>Conheça nossa equipe de instrutores qualificados</li>
            <li>Descubra nossos diferentes tipos de aula</li>
            <li>Tire todas suas dúvidas conosco</li>
          </ul>

          <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h4 style="color: #1e293b; margin-top: 0;">📞 Entre em contato:</h4>
            <p style="margin: 5px 0;"><strong>Telefone/WhatsApp:</strong> ${import.meta.env.VITE_STUDIO_PHONE || import.meta.env.STUDIO_PHONE || '(11) 99999-9999'}</p>
            <p style="margin: 5px 0;"><strong>E-mail:</strong> ${this.fromEmail}</p>
          </div>

          <p>Estamos ansiosos para conhecer você pessoalmente e ajudar você a alcançar seus objetivos de saúde e bem-estar!</p>

          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e2e8f0;">

          <p style="color: #64748b; font-size: 14px; text-align: center;">
            <strong>Com carinho,</strong><br>
            Equipe Josi Pilates<br>
            <em>Transformando vidas através do movimento</em>
          </p>
        </div>
      </body>
      </html>
    `;

    const textContent = `
      Olá, ${student.name || student.full_name}!
      
      É com grande alegria que damos as boas-vindas ao Josi Pilates!
      
      Sua jornada de bem-estar começa agora!
      Estamos aqui para apoiar você em cada movimento, respiração e conquista.
      
      Próximos passos:
      - Agende sua primeira aula experimental
      - Conheça nossa equipe de instrutores qualificados
      - Descubra nossos diferentes tipos de aula
      - Tire todas suas dúvidas conosco
      
      Entre em contato:
      Telefone/WhatsApp: ${import.meta.env.VITE_STUDIO_PHONE || import.meta.env.STUDIO_PHONE || '(11) 99999-9999'}
      E-mail: ${this.fromEmail}
      
      Estamos ansiosos para conhecer você pessoalmente e ajudar você a alcançar seus objetivos de saúde e bem-estar!
      
      Com carinho,
      Equipe Josi Pilates
      Transformando vidas através do movimento
    `;

    return this.sendEmail({
      to: { email: student.email, name: student.name || student.full_name },
      subject,
      htmlContent,
      textContent
    });
  }
}

export default new EmailService();

