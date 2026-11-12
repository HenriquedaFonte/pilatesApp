// Email de boas-vindas do cadastro público, montado no servidor.
// Módulo puro (sem Deno, sem rede). Textos em pt/en/fr; o único dado que vem do
// aluno é o nome (lido do perfil no servidor), sempre escapado e encurtado.

export type SignupLanguage = 'pt' | 'en' | 'fr'

export const SIGNUP_LANGUAGES: SignupLanguage[] = ['pt', 'en', 'fr']
export const MAX_WELCOME_NAME = 80

const PORTAL_URL = 'https://josipilates.com/login'
const STUDIO_PHONE = '+1(438)274-8396'
const STUDIO_EMAIL = 'josi@josipilates.com'

const TEXTS = {
  pt: {
    subject: 'Bem-vindo ao Josi Pilates! 🎉',
    greeting: (name: string) => (name ? `Olá, ${name}!` : 'Olá!'),
    welcomeTitle: '🎉 Bem-vindo ao Josi Pilates!',
    accountCreated: 'Sua conta foi criada com sucesso!',
    nextStepsTitle: '🚀 Próximos passos:',
    nextSteps: [
      'Agende sua primeira aula experimental',
      'Conheça nossa equipe e instalações',
      'Tire todas suas dúvidas conosco',
    ],
    contactTitle: '📞 Precisa de ajuda?',
    contactInfo: 'Entre em contato conosco:',
    phone: `WhatsApp: ${STUDIO_PHONE}`,
    email: `E-mail: ${STUDIO_EMAIL}`,
    portal: 'Acessar Portal do Aluno',
    excitement: 'Estamos muito felizes em recebê-lo em nossa comunidade!',
    closing: 'Bem-vindo à família Josi Pilates!',
    signature: 'Com carinho,',
    teamName: 'Equipe Josi Pilates',
    rules: {
      title: '📋 Regras do Studio Josi Pilates',
      classDuration: '⏱️ Duração das Aulas',
      classDurationText: 'Cada aula tem duração de 55 minutos, incluindo aquecimento, exercícios principais e relaxamento final.',
      arrivalPolicy: '⏰ Política de Chegada',
      arrivalPolicyText: 'Pedimos gentilmente que chegue pelo menos 5 minutos antes do início da sua aula.',
      arrivalPolicyDetail: 'Este tempo extra permite uma transição tranquila entre as aulas e garante que você possa se preparar adequadamente.',
      cancellationPolicy: '📅 Política de Cancelamento',
      cancellationPolicyText: 'Cancelamentos devem ser feitos com pelo menos 24 horas de antecedência.',
      cancellationPolicyDetail: 'O não cumprimento desta política resultará na perda da aula.',
      cancellationWarning: '⚠️ IMPORTANTE: Aulas não canceladas dentro do prazo de 24 horas serão cobradas normalmente.',
      additionalGuidelines: '💡 Orientações Adicionais',
      wearComfortableClothing: 'Vista roupas confortáveis',
      wearComfortableClothingDesc: 'Use roupas leves e confortáveis que permitam movimento livre.',
      stayHydrated: 'Mantenha-se hidratado',
      stayHydratedDesc: 'Beba água antes e depois das aulas para manter o corpo hidratado.',
    },
  },
  en: {
    subject: 'Welcome to Josi Pilates! 🎉',
    greeting: (name: string) => (name ? `Hello, ${name}!` : 'Hello!'),
    welcomeTitle: '🎉 Welcome to Josi Pilates!',
    accountCreated: 'Your account has been created successfully!',
    nextStepsTitle: '🚀 Next steps:',
    nextSteps: [
      'Schedule your first trial class',
      'Meet our team and facilities',
      'Ask us any questions you have',
    ],
    contactTitle: '📞 Need help?',
    contactInfo: 'Contact us:',
    phone: `WhatsApp: ${STUDIO_PHONE}`,
    email: `Email: ${STUDIO_EMAIL}`,
    portal: 'Access Student Portal',
    excitement: 'We are very happy to welcome you to our community!',
    closing: 'Welcome to the Josi Pilates family!',
    signature: 'With care,',
    teamName: 'Josi Pilates Team',
    rules: {
      title: '📋 Josi Pilates Studio Rules',
      classDuration: '⏱️ Class Duration',
      classDurationText: 'Each class lasts 55 minutes, including warm-up, main exercises, and final relaxation.',
      arrivalPolicy: '⏰ Arrival Policy',
      arrivalPolicyText: 'We kindly ask that you arrive at least 5 minutes before your class begins.',
      arrivalPolicyDetail: 'This extra time allows for a smooth transition between classes and ensures you can prepare properly.',
      cancellationPolicy: '📅 Cancellation Policy',
      cancellationPolicyText: 'Cancellations must be made at least 24 hours in advance.',
      cancellationPolicyDetail: 'Failure to comply with this policy will result in the loss of the class.',
      cancellationWarning: '⚠️ IMPORTANT: Classes not cancelled within the 24-hour window will be charged normally.',
      additionalGuidelines: '💡 Additional Guidelines',
      wearComfortableClothing: 'Wear comfortable clothing',
      wearComfortableClothingDesc: 'Wear light, comfortable clothing that allows free movement.',
      stayHydrated: 'Stay hydrated',
      stayHydratedDesc: 'Drink water before and after classes to keep your body hydrated.',
    },
  },
  fr: {
    subject: 'Bienvenue chez Josi Pilates! 🎉',
    greeting: (name: string) => (name ? `Bonjour, ${name}!` : 'Bonjour!'),
    welcomeTitle: '🎉 Bienvenue chez Josi Pilates!',
    accountCreated: 'Votre compte a été créé avec succès!',
    nextStepsTitle: '🚀 Prochaines étapes:',
    nextSteps: [
      "Planifiez votre premier cours d'essai",
      'Rencontrez notre équipe et nos installations',
      'Posez-nous toutes vos questions',
    ],
    contactTitle: "📞 Besoin d'aide?",
    contactInfo: 'Contactez-nous:',
    phone: `WhatsApp: ${STUDIO_PHONE}`,
    email: `E-mail: ${STUDIO_EMAIL}`,
    portal: 'Accéder au Portail Étudiant',
    excitement: 'Nous sommes très heureux de vous accueillir dans notre communauté!',
    closing: 'Bienvenue dans la famille Josi Pilates!',
    signature: 'Avec soin,',
    teamName: 'Équipe Josi Pilates',
    rules: {
      title: '📋 Règles du Studio Josi Pilates',
      classDuration: '⏱️ Durée des Cours',
      classDurationText: "Chaque cours dure 55 minutes, incluant l'échauffement, les exercices principaux et la relaxation finale.",
      arrivalPolicy: "⏰ Politique d'Arrivée",
      arrivalPolicyText: "Nous vous demandons gentiment d'arriver au moins 5 minutes avant le début de votre cours.",
      arrivalPolicyDetail: 'Ce temps supplémentaire permet une transition fluide entre les cours et garantit que vous pouvez vous préparer correctement.',
      cancellationPolicy: "📅 Politique d'Annulation",
      cancellationPolicyText: "Les annulations doivent être faites au moins 24 heures à l'avance.",
      cancellationPolicyDetail: 'Le non-respect de cette politique entraînera la perte du cours.',
      cancellationWarning: '⚠️ IMPORTANT: Les cours non annulés dans la fenêtre de 24 heures seront facturés normalement.',
      additionalGuidelines: '💡 Directives Supplémentaires',
      wearComfortableClothing: 'Portez des vêtements confortables',
      wearComfortableClothingDesc: 'Portez des vêtements légers et confortables qui permettent un mouvement libre.',
      stayHydrated: 'Restez hydraté',
      stayHydratedDesc: "Buvez de l'eau avant et après les cours pour garder votre corps hydraté.",
    },
  },
} as const

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function normalizeLanguage(value: unknown): SignupLanguage {
  return typeof value === 'string' && (SIGNUP_LANGUAGES as string[]).includes(value)
    ? (value as SignupLanguage)
    : 'pt'
}

// Nome em uma linha, sem caracteres de controle, até MAX_WELCOME_NAME.
export function cleanWelcomeName(value: unknown): string {
  if (typeof value !== 'string') return ''
  // deno-lint-ignore no-control-regex
  const oneLine = value.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim()
  return Array.from(oneLine).slice(0, MAX_WELCOME_NAME).join('').trim()
}

export function buildSignupWelcomeContent(
  rawName: unknown,
  rawLanguage: unknown,
): { subject: string; html: string; text: string } {
  const t = TEXTS[normalizeLanguage(rawLanguage)]
  const r = t.rules
  const name = cleanWelcomeName(rawName)
  const safeName = escapeHtml(name)

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t.welcomeTitle}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #01b48d 0%, #017a6b 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">${t.welcomeTitle}</h1>
    <p style="color: #f0f0f0; margin: 5px 0 0 0; font-size: 16px;">Josi Pilates</p>
  </div>
  <div style="background: white; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 10px 10px;">
    <h2 style="color: #1e293b; margin-top: 0;">${t.greeting(safeName)}</h2>
    <p>${t.accountCreated}</p>
    <h4 style="color: #1e293b;">${t.nextStepsTitle}</h4>
    <ul style="margin: 10px 0; padding-left: 20px;">
      ${t.nextSteps.map((step) => `<li>${step}</li>`).join('')}
    </ul>
    <div style="background-color: #f8f9fa; padding: 25px; border-radius: 8px; margin: 30px 0; border-left: 4px solid #3b82f6;">
      <h3 style="color: #1e293b; margin-top: 0;">${r.title}</h3>
      <div style="margin: 20px 0;">
        <h4 style="color: #374151; margin: 15px 0 10px 0;">${r.classDuration}</h4>
        <div style="background-color: #e0f2fe; padding: 10px; border-radius: 6px;">
          <p style="margin: 0; color: #0277bd; font-weight: bold;">${r.classDurationText}</p>
        </div>
      </div>
      <div style="margin: 20px 0;">
        <h4 style="color: #374151; margin: 15px 0 10px 0;">${r.arrivalPolicy}</h4>
        <div style="background-color: #fff3e0; padding: 10px; border-radius: 6px;">
          <p style="margin: 0; color: #f57c00; font-weight: bold;">${r.arrivalPolicyText}</p>
          <p style="margin: 5px 0 0 0; color: #e65100;">${r.arrivalPolicyDetail}</p>
        </div>
      </div>
      <div style="margin: 20px 0;">
        <h4 style="color: #374151; margin: 15px 0 10px 0;">${r.cancellationPolicy}</h4>
        <div style="background-color: #ffebee; padding: 10px; border-radius: 6px;">
          <p style="margin: 0; color: #d32f2f; font-weight: bold;">${r.cancellationPolicyText}</p>
          <p style="margin: 5px 0 0 0; color: #b71c1c;">${r.cancellationPolicyDetail}</p>
          <div style="background-color: #ffcdd2; padding: 8px; border-radius: 4px; margin: 10px 0;">
            <p style="margin: 0; color: #b71c1c; font-weight: bold;">${r.cancellationWarning}</p>
          </div>
        </div>
      </div>
      <div style="margin: 20px 0;">
        <h4 style="color: #374151; margin: 15px 0 10px 0;">${r.additionalGuidelines}</h4>
        <ul style="margin: 10px 0; padding-left: 20px; color: #374151;">
          <li><strong>${r.wearComfortableClothing}:</strong> ${r.wearComfortableClothingDesc}</li>
          <li><strong>${r.stayHydrated}:</strong> ${r.stayHydratedDesc}</li>
        </ul>
      </div>
    </div>
    <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <h4 style="color: #1e293b; margin-top: 0;">${t.contactTitle}</h4>
      <p style="margin: 5px 0;">${t.contactInfo}</p>
      <p style="margin: 5px 0;"><strong>${t.phone}</strong></p>
      <p style="margin: 5px 0;"><strong>${t.email}</strong></p>
    </div>
    <p>${t.excitement}</p>
    <p>${t.closing}</p>
    <div style="text-align: center; margin: 25px 0; padding: 18px; background-color: #f0fdf4; border-radius: 8px; border: 1px solid #bbf7d0;">
      <a href="${PORTAL_URL}" style="background: linear-gradient(135deg, #01b48d 0%, #017a6b 100%); color: white; padding: 12px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 15px;">${t.portal}</a>
    </div>
    <hr style="margin: 30px 0; border: none; border-top: 1px solid #e2e8f0;">
    <p style="color: #64748b; font-size: 14px; text-align: center;">
      <strong>${t.signature}</strong><br>
      ${t.teamName}
    </p>
  </div>
</body>
</html>`

  const text = `${t.greeting(name)}

${t.accountCreated}

${t.nextStepsTitle}
${t.nextSteps.map((step) => `- ${step}`).join('\n')}

${r.title}

${r.classDuration}
${r.classDurationText}

${r.arrivalPolicy}
${r.arrivalPolicyText}
${r.arrivalPolicyDetail}

${r.cancellationPolicy}
${r.cancellationPolicyText}
${r.cancellationPolicyDetail}
${r.cancellationWarning}

${r.additionalGuidelines}
- ${r.wearComfortableClothing}: ${r.wearComfortableClothingDesc}
- ${r.stayHydrated}: ${r.stayHydratedDesc}

${t.contactTitle}
${t.contactInfo}
${t.phone}
${t.email}

${t.excitement}
${t.closing}

${t.portal}: ${PORTAL_URL}

${t.signature}
${t.teamName}`

  return { subject: t.subject, html, text }
}
