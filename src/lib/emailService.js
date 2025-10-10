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

      const { data, error } = await supabase.functions.invoke('send-email', {
        body: payload
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || 'Failed to send email');
      }

      return data.data;
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }

  async sendPasswordResetEmail(userEmail, resetLink) {
    // First verify the user exists
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('preferred_language')
      .eq('email', userEmail)
      .single();

    if (profileError) {
      throw new Error('User not found');
    }

    // Get user's language preference from their profile
    let userLanguage = 'pt'; // Default to Portuguese
    if (profile?.preferred_language) {
      userLanguage = profile.preferred_language;
    }

    const template = getTemplate('passwordReset', userLanguage);

    const variables = {
      resetLink: resetLink,
      email: userEmail
    };

    const processedTemplate = processTemplate(template, variables);

    const subject = processedTemplate.subject;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${processedTemplate.title}</title>
        <style>
          @media only screen and (max-width: 600px) {
            .email-container { padding: 10px !important; }
            .header { padding: 20px !important; }
            .header h1 { font-size: 24px !important; }
            .content { padding: 20px !important; }
            .reset-button { padding: 12px 20px !important; font-size: 14px !important; }
            .security-box { padding: 15px !important; margin: 15px 0 !important; }
            h2 { font-size: 20px !important; }
            p { font-size: 16px !important; line-height: 1.5 !important; }
          }
        </style>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;" class="email-container">
        <div style="background: linear-gradient(135deg, #01b48d 0%, #017a6b 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;" class="header">
          <h1 style="color: white; margin: 0; font-size: 28px;">Josi Pilates</h1>
          <p style="color: #f0f0f0; margin: 5px 0 0 0; font-size: 16px;">${processedTemplate.title}</p>
        </div>

        <div style="background: white; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 10px 10px;" class="content">
          <h2 style="color: #2c3e50; margin-top: 0;">${processedTemplate.greeting('')}</h2>

          <p>${processedTemplate.message}</p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}"
               style="background: linear-gradient(135deg, #01b48d 0%, #017a6b 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px; box-shadow: 0 4px 15px rgba(1, 180, 141, 0.4);" class="reset-button">
              ${processedTemplate.buttonText}
            </a>
          </div>

          <div style="background-color: #ecf0f1; padding: 20px; border-radius: 6px; margin: 20px 0;" class="security-box">
            <p style="margin: 0; font-size: 14px; line-height: 1.5;">
              <strong>${processedTemplate.validity}</strong> ${processedTemplate.security}
            </p>
          </div>

          <p>${processedTemplate.ignore}</p>

          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e2e8f0;">

          <p style="color: #64748b; font-size: 14px; text-align: center;">
            ${processedTemplate.contact}<br>
            <strong>${processedTemplate.signature}</strong><br>
            ${processedTemplate.teamName}<br>
            <em>${processedTemplate.footer}</em>
          </p>
        </div>
      </body>
      </html>
    `;

    const textContent = `
${processedTemplate.greeting('')}

${processedTemplate.message}

${processedTemplate.buttonText}: ${resetLink}

${processedTemplate.validity} ${processedTemplate.security}

${processedTemplate.ignore}

${processedTemplate.contact}

${processedTemplate.signature}
${processedTemplate.teamName}
${processedTemplate.footer}
    `;

    return this.sendEmail({
      to: { email: userEmail, name: '' },
      subject,
      htmlContent,
      textContent
    });
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
        <style>
          @media only screen and (max-width: 600px) {
            .email-container { padding: 10px !important; }
            .header { padding: 20px !important; }
            .header h1 { font-size: 24px !important; }
            .header p { font-size: 14px !important; }
            .content { padding: 20px !important; }
            .warning-box, .contact-box { padding: 15px !important; margin: 15px 0 !important; }
            .warning-box h3 { font-size: 16px !important; }
            .warning-box p { font-size: 16px !important; }
            .contact-box ul { padding-left: 15px !important; }
            h2 { font-size: 20px !important; }
            h4 { font-size: 16px !important; }
            p { font-size: 16px !important; line-height: 1.5 !important; }
          }
        </style>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;" class="email-container">
        <div style="background: linear-gradient(135deg, #01b48d 0%, #017a6b 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;" class="header">
          <h1 style="color: white; margin: 0; font-size: 28px;">Josi Pilates</h1>
          <p style="color: #f0f0f0; margin: 5px 0 0 0; font-size: 16px;">Low Credits Alert</p>
        </div>

        <div style="background: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;" class="content">
          <h2 style="color: #2c3e50; margin-top: 0;">${processedTemplate.greeting(student.name || student.full_name)}</h2>

          <p>${processedTemplate.message}</p>

          <div style="background-color: #fef3c7; border: 1px solid #f59e0b; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;" class="warning-box">
            <h3 style="color: #92400e; margin: 0 0 10px 0;">${processedTemplate.warning}</h3>
            <p style="margin: 0; font-size: 18px; font-weight: bold; color: #92400e;">
              ${processedTemplate.creditsText(creditsRemaining)}
            </p>
          </div>

          <div style="background-color: #f1f5f9; padding: 20px; border-radius: 8px; margin: 20px 0;" class="contact-box">
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
            <style>
              @media only screen and (max-width: 600px) {
                .email-container { padding: 10px !important; }
                .header { padding: 20px !important; }
                .header h1 { font-size: 24px !important; }
                .content { padding: 20px !important; }
                .message-box { padding: 20px !important; margin: 15px 0 !important; }
                h2 { font-size: 20px !important; }
                p { font-size: 16px !important; line-height: 1.5 !important; }
              }
            </style>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;" class="email-container">
            <div style="background: linear-gradient(135deg, #01b48d 0%, #017a6b 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;" class="header">
              <h1 style="color: white; margin: 0; font-size: 28px;">Josi Pilates</h1>
            </div>

            <div style="background: white; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 10px 10px;" class="content">
              <h2 style="color: #1e293b; margin-top: 0;">${processedTemplate.greeting(student.name || student.full_name)}</h2>

              <div style="background-color: #f1f5f9; padding: 25px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;" class="message-box">
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
        <style>
          @media only screen and (max-width: 600px) {
            .email-container { padding: 10px !important; }
            .header { padding: 20px !important; }
            .header h1 { font-size: 24px !important; }
            .header p { font-size: 14px !important; }
            .content { padding: 20px !important; }
            .journey-box, .contact-box { padding: 15px !important; margin: 15px 0 !important; }
            .journey-box h3 { font-size: 16px !important; }
            .contact-box h4 { font-size: 16px !important; }
            h2 { font-size: 20px !important; }
            h4 { font-size: 16px !important; }
            p { font-size: 16px !important; line-height: 1.5 !important; }
            ul { padding-left: 15px !important; }
          }
        </style>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;" class="email-container">
        <div style="background: linear-gradient(135deg, #01b48d 0%, #017a6b 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">${processedTemplate.welcomeTitle}</h1>
          <p style="color: #f0f0f0; margin: 5px 0 0 0; font-size: 16px;">Josi Pilates</p>
        </div>

        <div style="background: white; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 10px 10px;" class="content">
          <h2 style="color: #1e293b; margin-top: 0;">${processedTemplate.greeting(student.name || student.full_name)}</h2>

          <p>${processedTemplate.mainMessage}</p>

          <div style="background-color: #dcfce7; padding: 20px; border-radius: 8px; margin: 20px 0;" class="journey-box">
            <h3 style="color: #166534; margin-top: 0;">✨ ${processedTemplate.journeyMessage}</h3>
          </div>

          <h4 style="color: #1e293b;">${processedTemplate.nextStepsTitle}</h4>
          <ul style="margin: 10px 0; padding-left: 20px;">
            ${processedTemplate.nextSteps.map(step => `<li>${step}</li>`).join('')}
          </ul>

          <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;" class="contact-box">
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

  async sendCreditAdditionEmail(student, creditAmount, creditType, description, currentBalance) {
    const language = await this.getUserLanguage(student.id);
    const template = getTemplate('creditAddition', language);

    const variables = {
      amount: creditAmount,
      type: creditType,
      description: description,
      balance: currentBalance,
      name: student.name || student.full_name
    };

    const processedTemplate = processTemplate(template, variables);

    const subject = typeof processedTemplate.subject === 'function'
      ? processedTemplate.subject(creditAmount)
      : processedTemplate.subject;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${typeof processedTemplate.creditAdded === 'function' ? processedTemplate.creditAdded(creditAmount) : processedTemplate.creditAdded}</title>
        <style>
          @media only screen and (max-width: 600px) {
            .email-container { padding: 10px !important; }
            .header { padding: 20px !important; }
            .header h1 { font-size: 24px !important; }
            .header p { font-size: 14px !important; }
            .content { padding: 20px !important; }
            .credit-box, .rules-box { padding: 15px !important; margin: 15px 0 !important; }
            .credit-box h3 { font-size: 16px !important; }
            .credit-box p { font-size: 16px !important; }
            .rules-box h4 { font-size: 16px !important; }
            .rules-box h5 { font-size: 14px !important; }
            h2 { font-size: 20px !important; }
            p { font-size: 16px !important; line-height: 1.5 !important; }
          }
        </style>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;" class="email-container">
        <div style="background: linear-gradient(135deg, #01b48d 0%, #017a6b 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;" class="header">
          <h1 style="color: white; margin: 0; font-size: 28px;">Josi Pilates</h1>
          <p style="color: #f0f0f0; margin: 5px 0 0 0; font-size: 16px;">Credit Update</p>
        </div>

        <div style="background: white; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 10px 10px;">
          <h2 style="color: #1e293b; margin-top: 0;">${processedTemplate.greeting(student.name || student.full_name)}</h2>

          <div style="background-color: #dcfce7; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #166534; margin-top: 0;">💰 ${typeof processedTemplate.creditAdded === 'function' ? processedTemplate.creditAdded(creditAmount) : processedTemplate.creditAdded}</h3>
            <p style="margin: 10px 0; font-size: 16px;">${typeof processedTemplate.creditDetails === 'function' ? processedTemplate.creditDetails(creditAmount, creditType, description) : processedTemplate.creditDetails(creditAmount, creditType, description)}</p>
            <p style="margin: 10px 0; font-weight: bold;">${processedTemplate.currentBalance(currentBalance)}</p>
          </div>

          <div style="background-color: #f1f5f9; padding: 25px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;" class="rules-box">
            <h4 style="color: #1e293b; margin-top: 0;">${processedTemplate.studioRulesTitle}</h4>

            <div style="margin: 15px 0;">
              <h5 style="color: #374151; margin: 10px 0;">⏱️ ${processedTemplate.classDuration}</h5>
            </div>

            <div style="margin: 15px 0;">
              <h5 style="color: #374151; margin: 10px 0;">⏰ ${processedTemplate.arrivalRule}</h5>
            </div>

            <div style="margin: 15px 0;">
              <h5 style="color: #374151; margin: 10px 0;">📅 ${processedTemplate.cancellationRule}</h5>
            </div>
          </div>

          <p>${processedTemplate.excitement}</p>

          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e2e8f0;">

          <p style="color: #64748b; font-size: 14px; text-align: center;">
            <strong>${processedTemplate.signature}</strong><br>
            ${processedTemplate.teamName}
          </p>
        </div>
      </body>
      </html>
    `;

    const textContent = `
${processedTemplate.greeting(student.name || student.full_name)}

${typeof processedTemplate.creditAdded === 'function' ? processedTemplate.creditAdded(creditAmount) : processedTemplate.creditAdded}
${typeof processedTemplate.creditDetails === 'function' ? processedTemplate.creditDetails(creditAmount, creditType, description) : processedTemplate.creditDetails(creditAmount, creditType, description)}
${processedTemplate.currentBalance(currentBalance)}

${processedTemplate.studioRulesTitle}

⏱️ ${processedTemplate.classDuration}

⏰ ${processedTemplate.arrivalRule}

📅 ${processedTemplate.cancellationRule}

${processedTemplate.excitement}

${processedTemplate.signature}
${processedTemplate.teamName}
    `;

    return this.sendEmail({
      to: { email: student.email, name: student.name || student.full_name },
      subject,
      htmlContent,
      textContent
    });
  }

  async sendStudentWelcomeEmail(studentData) {
    const { email, fullName, preferredLanguage } = studentData;
    const template = getTemplate('studentWelcome', preferredLanguage);

    const variables = {
      phone: import.meta.env.VITE_STUDIO_PHONE || import.meta.env.STUDIO_PHONE || '+1(438)274-8396',
      email: this.fromEmail,
      name: fullName
    };

    const processedTemplate = processTemplate(template, variables);

    const subject = processedTemplate.subject;

    // Get studio rules in the user's language
    const rulesTemplate = getTemplate('studioRules', preferredLanguage);

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${processedTemplate.welcomeTitle}</title>
        <style>
          @media only screen and (max-width: 600px) {
            .email-container { padding: 10px !important; }
            .header { padding: 20px !important; }
            .header h1 { font-size: 24px !important; }
            .header p { font-size: 14px !important; }
            .content { padding: 20px !important; }
            .password-box, .instructions-box, .contact-box, .rules-box { padding: 15px !important; margin: 15px 0 !important; }
            .password-box h3 { font-size: 16px !important; }
            .instructions-box h4, .rules-box h4 { font-size: 16px !important; }
            .contact-box h4 { font-size: 16px !important; }
            h2, h3 { font-size: 20px !important; }
            h4 { font-size: 16px !important; }
            p { font-size: 16px !important; line-height: 1.5 !important; }
            ol, ul { padding-left: 15px !important; }
          }
        </style>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;" class="email-container">
        <div style="background: linear-gradient(135deg, #01b48d 0%, #017a6b 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">${processedTemplate.welcomeTitle}</h1>
          <p style="color: #f0f0f0; margin: 5px 0 0 0; font-size: 16px;">Josi Pilates</p>
        </div>

        <div style="background: white; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 10px 10px;">
          <h2 style="color: #1e293b; margin-top: 0;">${processedTemplate.greeting(fullName)}</h2>

          <p>${processedTemplate.accountCreated}</p>

          <div style="background-color: #fef3c7; border: 1px solid #f59e0b; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;" class="password-box">
            <h3 style="color: #92400e; margin: 0 0 10px 0;">🔐 ${processedTemplate.defaultPassword}</h3>
          </div>

          <div style="background-color: #f1f5f9; padding: 20px; border-radius: 8px; margin: 20px 0;" class="instructions-box">
            <h4 style="color: #1e293b; margin-top: 0;">${processedTemplate.importantInstructions}</h4>
            <ol style="margin: 10px 0; padding-left: 20px;">
              ${processedTemplate.instructions.map(instruction => `<li>${instruction}</li>`).join('')}
            </ol>
          </div>

          <h4 style="color: #1e293b;">${processedTemplate.nextStepsTitle}</h4>
          <ul style="margin: 10px 0; padding-left: 20px;">
            ${processedTemplate.nextSteps.map(step => `<li>${step}</li>`).join('')}
          </ul>

          <!-- Studio Rules Section -->
          <div style="background-color: #f8f9fa; padding: 25px; border-radius: 8px; margin: 30px 0; border-left: 4px solid #3b82f6;" class="rules-box">
            <h3 style="color: #1e293b; margin-top: 0;">📋 ${rulesTemplate.title}</h3>

            <div style="margin: 20px 0;">
              <h4 style="color: #374151; margin: 15px 0 10px 0;">⏱️ ${rulesTemplate.classDuration}</h4>
              <div style="background-color: #e0f2fe; padding: 10px; border-radius: 6px;">
                <p style="margin: 0; color: #0277bd; font-weight: bold;">${rulesTemplate.classDurationText}</p>
              </div>
            </div>

            <div style="margin: 20px 0;">
              <h4 style="color: #374151; margin: 15px 0 10px 0;">⏰ ${rulesTemplate.arrivalPolicy}</h4>
              <div style="background-color: #fff3e0; padding: 10px; border-radius: 6px;">
                <p style="margin: 0; color: #f57c00; font-weight: bold;">${rulesTemplate.arrivalPolicyText}</p>
                <p style="margin: 5px 0 0 0; color: #e65100;">${rulesTemplate.arrivalPolicyDetail}</p>
              </div>
            </div>

            <div style="margin: 20px 0;">
              <h4 style="color: #374151; margin: 15px 0 10px 0;">📅 ${rulesTemplate.cancellationPolicy}</h4>
              <div style="background-color: #ffebee; padding: 10px; border-radius: 6px;">
                <p style="margin: 0; color: #d32f2f; font-weight: bold;">${rulesTemplate.cancellationPolicyText}</p>
                <p style="margin: 5px 0 0 0; color: #b71c1c;">${rulesTemplate.cancellationPolicyDetail}</p>
                <div style="background-color: #ffcdd2; padding: 8px; border-radius: 4px; margin: 10px 0;">
                  <p style="margin: 0; color: #b71c1c; font-weight: bold;">⚠️ ${rulesTemplate.cancellationWarning}</p>
                </div>
              </div>
            </div>

            <div style="margin: 20px 0;">
              <h4 style="color: #374151; margin: 15px 0 10px 0;">💡 ${rulesTemplate.additionalGuidelines}</h4>
              <ul style="margin: 10px 0; padding-left: 20px; color: #374151;">
                <li><strong>${rulesTemplate.wearComfortableClothing}:</strong> ${rulesTemplate.wearComfortableClothingDesc}</li>
                <li><strong>${rulesTemplate.stayHydrated}:</strong> ${rulesTemplate.stayHydratedDesc}</li>
              </ul>
            </div>
          </div>

          <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;" class="contact-box">
            <h4 style="color: #1e293b; margin-top: 0;">${processedTemplate.contactTitle}</h4>
            <p style="margin: 5px 0;">${processedTemplate.contactInfo}</p>
            <p style="margin: 5px 0;"><strong>${processedTemplate.phone}</strong></p>
            <p style="margin: 5px 0;"><strong>${processedTemplate.email}</strong></p>
          </div>

          <p>${processedTemplate.excitement}</p>
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
${processedTemplate.greeting(fullName)}

${processedTemplate.accountCreated}

${processedTemplate.defaultPassword}

${processedTemplate.importantInstructions}
${processedTemplate.instructions.map((instruction, index) => `${index + 1}. ${instruction}`).join('\n')}

${processedTemplate.nextStepsTitle}
${processedTemplate.nextSteps.map(step => `- ${step}`).join('\n')}

--- STUDIO RULES ---
${rulesTemplate.title}

⏱️ ${rulesTemplate.classDuration}
${rulesTemplate.classDurationText}

⏰ ${rulesTemplate.arrivalPolicy}
${rulesTemplate.arrivalPolicyText}
${rulesTemplate.arrivalPolicyDetail}

📅 ${rulesTemplate.cancellationPolicy}
${rulesTemplate.cancellationPolicyText}
${rulesTemplate.cancellationPolicyDetail}
⚠️ ${rulesTemplate.cancellationWarning}

💡 ${rulesTemplate.additionalGuidelines}
- ${rulesTemplate.wearComfortableClothing}: ${rulesTemplate.wearComfortableClothingDesc}
- ${rulesTemplate.stayHydrated}: ${rulesTemplate.stayHydratedDesc}

${processedTemplate.contactTitle}
${processedTemplate.contactInfo}
${processedTemplate.phone}
${processedTemplate.email}

${processedTemplate.excitement}
${processedTemplate.closing}

${processedTemplate.signature}
${processedTemplate.teamName}
${processedTemplate.tagline}
    `;

    return this.sendEmail({
      to: { email: email, name: fullName },
      subject,
      htmlContent,
      textContent
    });
  }
}

export default new EmailService();

