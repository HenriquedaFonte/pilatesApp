import { supabase } from './supabase';
import { getTemplate, processTemplate } from './emailTemplates';

class EmailService {
  constructor() {
    this.apiKey = import.meta.env.VITE_RESEND_API_KEY || import.meta.env.RESEND_API_KEY;
    this.fromEmail = import.meta.env.VITE_STUDIO_EMAIL || import.meta.env.STUDIO_EMAIL || 'josi@josipilates.com';
    this.fromName = import.meta.env.VITE_STUDIO_NAME || import.meta.env.STUDIO_NAME || 'Josi Pilates';
    this.baseUrl = 'https://api.resend.com';
  }

  async getUserLanguage(userId) {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('preferred_language')
        .eq('id', userId)
        .single();

      if (error) {
        console.warn('Could not fetch user language preference:', error);
        return 'pt'; 
      }

      return profile?.preferred_language || 'pt';
    } catch (error) {
      console.warn('Error fetching user language:', error);
      return 'pt'; 
    }
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

  async sendLowCreditsNotification(student, creditsRemaining) {
    const language = await this.getUserLanguage(student.id);
    const template = getTemplate('lowCredits', language);

    const variables = {
      phone: import.meta.env.VITE_STUDIO_PHONE || import.meta.env.STUDIO_PHONE || '(11) 99999-9999',
      credits: creditsRemaining,
      name: student.name || student.full_name
    };

    const processedTemplate = processTemplate(template, variables);

    const subject = processedTemplate.subject;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${processedTemplate.warning}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #01b48d 0%, #017a6b 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <div style="display: inline-flex; align-items: center; justify-content: center; gap: 30px;">
            <img src="https://github.com/HenriquedaFonte/pilatesApp/blob/main/public/logo.jpg" alt="Josi Pilates Logo" style="width: 60px; height: 60px; border-radius: 50%; object-fit: cover;" />
            <div style="text-align: left;">
              <h1 style="color: white; margin: 0; font-size: 28px;">Josi Pilates</h1>
              <p style="color: #f0f0f0; margin: 5px 0 0 0; font-size: 16px;">Studio de Pilates</p>
            </div>
          </div>
        </div>

        <div style="background: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
          <h2 style="color: #2c3e50; margin-top: 0;">${processedTemplate.greeting(student.name || student.full_name)}</h2>

          <p>${processedTemplate.message}</p>

          <div style="background-color: #fef3c7; border: 1px solid #f59e0b; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
            <h3 style="color: #92400e; margin: 0 0 10px 0;">${processedTemplate.warning}</h3>
            <p style="margin: 0; font-size: 18px; font-weight: bold; color: #92400e;">
              ${processedTemplate.creditsText(creditsRemaining)}
            </p>
          </div>

          <div style="background-color: #f1f5f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h4 style="color: #1e293b; margin-top: 0;">${processedTemplate.contactTitle}</h4>
            <ul style="margin: 10px 0; padding-left: 20px;">
              ${processedTemplate.contactItems.map(item => `<li>${item}</li>`).join('')}
            </ul>
          </div>

          <p>${processedTemplate.closing}</p>

          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e2e8f0;">

          <p style="color: #64748b; font-size: 14px; text-align: center;">
            <strong>${processedTemplate.signature}</strong><br>
            ${processedTemplate.teamName}<br>
            <em>${processedTemplate.tagline}</em>
          </p>
        </div>
      </body>
      </html>
    `;

    const textContent = `
${processedTemplate.greeting(student.name || student.full_name)}

${processedTemplate.message}

${processedTemplate.warning}
${processedTemplate.creditsText(creditsRemaining)}

${processedTemplate.contactTitle}
${processedTemplate.contactItems.map(item => `- ${item}`).join('\n')}

${processedTemplate.closing}

${processedTemplate.signature}
${processedTemplate.teamName}
${processedTemplate.tagline}
    `;

    return this.sendEmail({
      to: { email: student.email, name: student.name || student.full_name },
      subject,
      htmlContent,
      textContent
    });
  }

  async sendCustomNotification(students, subject, message, senderName = 'Professora') {
    const emails = await Promise.all(students.map(async (student) => {
      const language = await this.getUserLanguage(student.id);
      const template = getTemplate('custom', language);

      const variables = {
        name: student.name || student.full_name,
        senderName: senderName
      };

      const processedTemplate = processTemplate(template, variables);

      return {
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
                <img src="https://github.com/HenriquedaFonte/pilatesApp/blob/main/public/logo.jpg" alt="Josi Pilates Logo" style="width: 60px; height: 60px; border-radius: 50%; object-fit: cover;" />
                <div style="text-align: left;">
                  <h1 style="color: white; margin: 0; font-size: 28px;">Josi Pilates</h1>
                  <p style="color: #f0f0f0; margin: 5px 0 0 0; font-size: 16px;">Studio de Pilates</p>
                </div>
              </div>
            </div>

            <div style="background: white; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 10px 10px;">
              <h2 style="color: #1e293b; margin-top: 0;">${processedTemplate.greeting(student.name || student.full_name)}</h2>

              <div style="background-color: #f1f5f9; padding: 25px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
                ${message.replace(/\n/g, '<br>')}
              </div>

              <hr style="margin: 30px 0; border: none; border-top: 1px solid #e2e8f0;">

              <p style="color: #64748b; font-size: 14px; text-align: center;">
                <strong>${processedTemplate.signature(senderName)}</strong><br>
                <em>${processedTemplate.tagline}</em>
              </p>
            </div>
          </body>
          </html>
        `,
        textContent: `
${processedTemplate.greeting(student.name || student.full_name)}

${message}

${processedTemplate.signature(senderName)}
${processedTemplate.tagline}
        `
      };
    }));

    return this.sendBulkEmails(emails);
  }

  async sendWelcomeEmail(student) {
    const language = await this.getUserLanguage(student.id);
    const template = getTemplate('welcome', language);

    const variables = {
      phone: import.meta.env.VITE_STUDIO_PHONE || import.meta.env.STUDIO_PHONE || '(11) 99999-9999',
      email: this.fromEmail,
      name: student.name || student.full_name
    };

    const processedTemplate = processTemplate(template, variables);

    const subject = processedTemplate.subject;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${processedTemplate.welcomeTitle}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #01b48d 0%, #017a6b 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <div style="display: inline-flex; align-items: center; justify-content: center; gap: 30px;">
            <img src="https://github.com/HenriquedaFonte/pilatesApp/blob/main/public/logo.jpg" alt="Josi Pilates Logo" style="width: 60px; height: 60px; border-radius: 50%; object-fit: cover;" />
            <div style="text-align: left;">
              <h1 style="color: white; margin: 0; font-size: 28px;">${processedTemplate.welcomeTitle}</h1>
              <p style="color: #f0f0f0; margin: 5px 0 0 0; font-size: 16px;">Josi Pilates</p>
            </div>
          </div>
        </div>

        <div style="background: white; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 10px 10px;">
          <h2 style="color: #1e293b; margin-top: 0;">${processedTemplate.greeting(student.name || student.full_name)}</h2>

          <p>${processedTemplate.mainMessage}</p>

          <div style="background-color: #dcfce7; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #166534; margin-top: 0;">✨ ${processedTemplate.journeyMessage}</h3>
          </div>

          <h4 style="color: #1e293b;">${processedTemplate.nextStepsTitle}</h4>
          <ul style="margin: 10px 0; padding-left: 20px;">
            ${processedTemplate.nextSteps.map(step => `<li>${step}</li>`).join('')}
          </ul>

          <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h4 style="color: #1e293b; margin-top: 0;">${processedTemplate.contactTitle}</h4>
            <p style="margin: 5px 0;"><strong>${processedTemplate.contactPhone}</strong></p>
            <p style="margin: 5px 0;"><strong>${processedTemplate.contactEmail}</strong></p>
          </div>

          <p>${processedTemplate.excitementMessage}</p>

          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e2e8f0;">

          <p style="color: #64748b; font-size: 14px; text-align: center;">
            <strong>${processedTemplate.signature}</strong><br>
            ${processedTemplate.teamName}<br>
            <em>${processedTemplate.tagline}</em>
          </p>
        </div>
      </body>
      </html>
    `;

    const textContent = `
${processedTemplate.greeting(student.name || student.full_name)}

${processedTemplate.mainMessage}

${processedTemplate.journeyMessage}

${processedTemplate.nextStepsTitle}
${processedTemplate.nextSteps.map(step => `- ${step}`).join('\n')}

${processedTemplate.contactTitle}
${processedTemplate.contactPhone}
${processedTemplate.contactEmail}

${processedTemplate.excitementMessage}

${processedTemplate.signature}
${processedTemplate.teamName}
${processedTemplate.tagline}
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

