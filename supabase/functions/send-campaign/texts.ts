// Textos fixos dos emails de campanha (Story 4.5), em pt/en/fr.
// Cópia de src/lib/emailTemplates.js (custom, lowCredits, consentForm) e do
// rótulo do botão do portal de src/lib/customEmail.js. O teste
// src/tests/sendCampaignPolicy.test.js confere que continuam iguais: se mudar
// o texto lá, mudar aqui também (e fazer o deploy da send-campaign).

export type CampaignLanguage = 'pt' | 'en' | 'fr'

// Mesmo número do email de boas-vindas (send-email/signupWelcome.ts).
export const STUDIO_PHONE = '+1(438)274-8396'

export const PORTAL_LABELS: Record<CampaignLanguage, string> = {
  pt: 'Acessar Portal do Aluno',
  en: 'Access Student Portal',
  fr: 'Accéder au Portail Étudiant',
}

export const CUSTOM_TEXTS = {
  pt: {
    greeting: (name: string) => `Olá, ${name}!`,
    signature: (senderName: string) => `Atenciosamente, ${senderName} - Josi Pilates`,
    tagline: 'Cuidando do seu bem-estar com carinho e profissionalismo',
  },
  en: {
    greeting: (name: string) => `Hello, ${name}!`,
    signature: (senderName: string) => `Best regards, ${senderName} - Josi Pilates`,
    tagline: 'Caring for your well-being with care and professionalism',
  },
  fr: {
    greeting: (name: string) => `Bonjour, ${name}!`,
    signature: (senderName: string) => `Cordialement, ${senderName} - Josi Pilates`,
    tagline: 'Prendre soin de votre bien-être avec soin et professionnalisme',
  },
}

export const LOW_CREDITS_TEXTS = {
  pt: {
    subject: 'Aviso: Saldo Baixo de Créditos - Josi Pilates',
    greeting: (name: string) => `Olá, ${name}!`,
    warning: '⚠️ Atenção: Saldo Baixo de Créditos',
    creditsText: (credits: number | string) => `Créditos Restantes: ${credits}`,
    message: 'Para continuar aproveitando nossas aulas de Pilates, recomendamos que você renove seus créditos em breve.',
    contactTitle: '💡 Como renovar seus créditos:',
    contactItems: [
      'Entre em contato conosco pelo WhatsApp: {phone}',
      'Envie o valor do seu pacote de aulas para o interac pilatesmontreal@gmail.com',
      'Visite nosso studio durante o horário de funcionamento',
    ],
    closing: 'Estamos aqui para ajudar você a manter sua rotina de exercícios e bem-estar!',
    signature: 'Atenciosamente,',
    teamName: 'Equipe Josi Pilates',
    tagline: 'Cuidando do seu bem-estar com carinho e profissionalismo',
  },
  en: {
    subject: 'Notice: Low Credits Balance - Josi Pilates',
    greeting: (name: string) => `Hello, ${name}!`,
    warning: '⚠️ Warning: Low Credits Balance',
    creditsText: (credits: number | string) => `Remaining Credits: ${credits}`,
    message: 'To continue enjoying your Pilates classes, we recommend renewing your credits soon.',
    contactTitle: '💡 How to renew your credits:',
    contactItems: [
      'Contact us by WhatsApp: {phone}',
      'Send the amount for your class package via Interac to pilatesmontreal@gmail.com.',
      'Visit our studio during business hours',
    ],
    closing: 'We are here to help you maintain your exercise routine and well-being!',
    signature: 'Best regards,',
    teamName: 'Josi Pilates Team',
    tagline: 'Caring for your well-being with care and professionalism',
  },
  fr: {
    subject: 'Avis: Solde de Crédits Faible - Josi Pilates',
    greeting: (name: string) => `Bonjour, ${name}!`,
    warning: '⚠️ Attention: Solde de Crédits Faible',
    creditsText: (credits: number | string) => `Crédits Restants: ${credits}`,
    message: 'Pour continuer à profiter de vos cours de Pilates sans interruption, nous vous recommandons de renouveler vos crédits bientôt.',
    contactTitle: '💡 Comment renouveler vos crédits:',
    contactItems: [
      'Contactez-nous par WhatsApp: {phone}',
      'Envoyez le montant de votre forfait de cours via Interac à pilatesmontreal@gmail.com.',
      "Visitez notre studio pendant les heures d'ouverture",
    ],
    closing: "Nous sommes là pour vous aider à maintenir votre routine d'exercice et votre bien-être!",
    signature: 'Cordialement,',
    teamName: 'Équipe Josi Pilates',
    tagline: 'Prendre soin de votre bien-être avec soin et professionnalisme',
  },
}

export const CONSENT_TEXTS = {
  pt: {
    title: '📄 Formulário de Consentimento - Josi Pilates',
    subject: 'Formulário de Consentimento - Josi Pilates',
    greeting: (name: string) => `Olá, ${name}!`,
    introduction: 'Para garantir que você tenha todas as informações necessárias sobre nossas aulas de Pilates, estamos enviando o formulário de consentimento e políticas das aulas.',
    instructionsTitle: '📋 Instruções para preenchimento:',
    instructions: [
      '1. Baixe o arquivo PDF anexado a este e-mail',
      '2. Leia atentamente todas as informações',
      '3. Preencha os campos necessários',
      '4. Assine o documento digitalmente',
      '5. Envie o documento preenchido e assinado de volta para nós',
    ],
    returnInstructions: '📧 Como devolver o formulário:',
    returnMethods: ['Envie por e-mail para: josi@josipilates.com'],
    importance: 'Este formulário é obrigatório para participar das aulas e contém informações importantes sobre:',
    importantPoints: [
      'Políticas e regras do studio',
      'Termos de responsabilidade',
      'Informações sobre saúde e contraindicações',
      'Direitos e deveres dos alunos',
    ],
    questions: 'Se tiver alguma dúvida sobre o preenchimento do formulário, não hesite em nos contactar.',
    closing: 'Agradecemos sua atenção e estamos ansiosos para recebê-lo(a) em nossas aulas!',
    signature: 'Atenciosamente,',
    teamName: 'Equipe Josi Pilates',
  },
  en: {
    title: '📄 Consent Form - Josi Pilates',
    subject: 'Consent Form - Josi Pilates',
    greeting: (name: string) => `Hello, ${name}!`,
    introduction: 'To ensure you have all the necessary information about our Pilates classes, we are sending you the consent form and class policies.',
    instructionsTitle: '📋 Instructions for completion:',
    instructions: [
      '1. Download the PDF file attached to this email',
      '2. Read all information carefully',
      '3. Fill in the required fields',
      '4. Sign the document digitally',
      '5. Send the completed and signed document back to us',
    ],
    returnInstructions: '📧 How to return the form:',
    returnMethods: ['Send by email to: josi@josipilates.com'],
    importance: 'This form is mandatory to participate in classes and contains important information about:',
    importantPoints: [
      'Studio policies and rules',
      'Terms of liability',
      'Health information and contraindications',
      'Student rights and responsibilities',
    ],
    questions: 'If you have any questions about filling out the form, please do not hesitate to contact us.',
    closing: 'Thank you for your attention and we look forward to welcoming you to our classes!',
    signature: 'Best regards,',
    teamName: 'Josi Pilates Team',
  },
  fr: {
    title: '📄 Formulaire de Consentement - Josi Pilates',
    subject: 'Formulaire de Consentement - Josi Pilates',
    greeting: (name: string) => `Bonjour, ${name}!`,
    introduction: 'Pour vous assurer que vous disposez de toutes les informations nécessaires sur nos cours de Pilates, nous vous envoyons le formulaire de consentement et les politiques de cours.',
    instructionsTitle: '📋 Instructions de remplissage:',
    instructions: [
      '1. Téléchargez le fichier PDF joint à cet e-mail',
      '2. Lisez attentivement toutes les informations',
      '3. Remplissez les champs requis',
      '4. Signez le document numériquement',
      '5. Renvoyez-nous le document rempli et signé',
    ],
    returnInstructions: '📧 Comment retourner le formulaire:',
    returnMethods: ['Envoyez par e-mail à: josi@josipilates.com'],
    importance: 'Ce formulaire est obligatoire pour participer aux cours et contient des informations importantes sur:',
    importantPoints: [
      'Politiques et règles du studio',
      'Conditions de responsabilité',
      'Informations sur la santé et contre-indications',
      'Droits et devoirs des étudiants',
    ],
    questions: "Si vous avez des questions sur le remplissage du formulaire, n'hésitez pas à nous contacter.",
    closing: 'Nous vous remercions de votre attention et nous sommes impatients de vous accueillir dans nos cours!',
    signature: 'Cordialement,',
    teamName: 'Équipe Josi Pilates',
  },
}
