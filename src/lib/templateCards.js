import {
  FileText,
  Calendar,
  AlertTriangle,
  Heart,
  Gift,
  PenLine,
  Paperclip
} from 'lucide-react'
import { getTemplate } from './emailTemplates'

// Cards do passo 2 ("O quê"). Título e descrição de 1 linha nas 3 línguas.
// - blank: mensagem em branco.
// - automatic: o email sai pronto na língua de cada aluno (sem assunto/mensagem na tela).
// - fullMessage: o modelo tem a mensagem completa em pt/en/fr.
// - os demais preenchem o assunto e o começo da mensagem (preview) para editar.
export const TEMPLATE_CARDS = {
  blank: {
    title: { pt: 'Mensagem em branco', en: 'Blank message', fr: 'Message vide' },
    description: {
      pt: 'Escrever o assunto e a mensagem do zero.',
      en: 'Write the subject and message from scratch.',
      fr: 'Écrire l\'objet et le message à partir de zéro.'
    },
    icon: PenLine,
    color: 'text-muted-foreground'
  },
  lowCredits: {
    title: { pt: 'Aviso de créditos baixos', en: 'Low credits notice', fr: 'Avis de crédits faibles' },
    description: {
      pt: 'Pronto, com o saldo de cada aluno, na língua dele.',
      en: 'Ready-made, with each student\'s balance, in their language.',
      fr: 'Prêt à envoyer, avec le solde de chaque élève, dans sa langue.'
    },
    automatic: true,
    icon: AlertTriangle,
    color: 'text-amber-600'
  },
  profileUpdate: {
    title: { pt: 'Atualizar cadastro', en: 'Update profile', fr: 'Mettre à jour le profil' },
    description: {
      pt: 'Pede telefone e seguro saúde. Sai na língua de cada aluno.',
      en: 'Asks for phone and health insurance. Sent in each student\'s language.',
      fr: 'Demande téléphone et assurance santé. Envoyé dans la langue de chaque élève.'
    },
    fullMessage: true,
    icon: FileText,
    color: 'text-teal-600'
  },
  consentForm: {
    title: { pt: 'Termo de consentimento', en: 'Consent form', fr: 'Formulaire de consentement' },
    description: {
      pt: 'Pronto, com o PDF das regras do estúdio anexado.',
      en: 'Ready-made, with the studio rules PDF attached.',
      fr: 'Prêt à envoyer, avec le PDF des règles du studio en pièce jointe.'
    },
    automatic: true,
    icon: Paperclip,
    color: 'text-blue-600'
  },
  scheduleChange: {
    title: { pt: 'Mudança de horário', en: 'Schedule change', fr: 'Changement d\'horaire' },
    description: {
      pt: 'Avisar sobre alteração no horário das aulas.',
      en: 'Notice about a change in class times.',
      fr: 'Avis d\'un changement d\'horaire des cours.'
    },
    preview: {
      pt: 'Olá, [Nome]! Precisamos informar sobre uma alteração no horário da sua aula.',
      en: 'Hello, [Name]! We need to inform you about a change in your class schedule.',
      fr: 'Bonjour, [Nom]! Nous devons vous informer d\'un changement dans l\'horaire de votre cours.'
    },
    icon: Calendar,
    color: 'text-red-600'
  },
  classReminder: {
    title: { pt: 'Lembrete de aula', en: 'Class reminder', fr: 'Rappel de cours' },
    description: {
      pt: 'Lembrete de uma aula agendada.',
      en: 'Reminder of a scheduled class.',
      fr: 'Rappel d\'un cours programmé.'
    },
    preview: {
      pt: 'Olá, [Nome]! Este é um lembrete sobre sua aula de Pilates agendada para amanhã.',
      en: 'Hello, [Name]! This is a reminder about your Pilates class scheduled for tomorrow.',
      fr: 'Bonjour, [Nom]! Ceci est un rappel concernant votre cours de Pilates prévu pour demain.'
    },
    icon: Calendar,
    color: 'text-blue-600'
  },
  lowCreditsGentle: {
    title: { pt: 'Créditos acabando (texto livre)', en: 'Credits running low (free text)', fr: 'Crédits bientôt épuisés (texte libre)' },
    description: {
      pt: 'Aviso gentil para editar antes de enviar.',
      en: 'Gentle notice to edit before sending.',
      fr: 'Avis doux à modifier avant l\'envoi.'
    },
    preview: {
      pt: 'Olá, [Nome]! Esperamos que esteja aproveitando suas aulas. Seus créditos estão acabando.',
      en: 'Hello, [Name]! We hope you\'re enjoying your classes. Your credits are running low.',
      fr: 'Bonjour, [Nom]! Nous espérons que vous profitez de vos cours. Vos crédits s\'épuisent.'
    },
    icon: AlertTriangle,
    color: 'text-orange-600'
  },
  promotion: {
    title: { pt: 'Promoção', en: 'Promotion', fr: 'Promotion' },
    description: {
      pt: 'Anunciar uma oferta ou pacote especial.',
      en: 'Announce a special offer or package.',
      fr: 'Annoncer une offre ou un forfait spécial.'
    },
    preview: {
      pt: 'Olá, [Nome]! Temos uma oferta especial só para você! 🎁 Pacote com desconto.',
      en: 'Hello, [Name]! We have a special offer just for you! 🎁 Discounted package.',
      fr: 'Bonjour, [Nom]! Nous avons une offre spéciale rien que pour vous! 🎁 Forfait réduit.'
    },
    icon: Gift,
    color: 'text-purple-600'
  },
  welcome: {
    title: { pt: 'Boas-vindas', en: 'Welcome', fr: 'Bienvenue' },
    description: {
      pt: 'Mensagem para alunos novos.',
      en: 'Message for new students.',
      fr: 'Message pour les nouveaux élèves.'
    },
    preview: {
      pt: 'Olá, [Nome]! É com grande alegria que damos as boas-vindas ao Josi Pilates! 🎉',
      en: 'Hello, [Name]! We are delighted to welcome you to Josi Pilates! 🎉',
      fr: 'Bonjour, [Nom]! C\'est avec une grande joie que nous vous accueillons chez Josi Pilates! 🎉'
    },
    icon: Heart,
    color: 'text-pink-600'
  },
  birthday: {
    title: { pt: 'Aniversário', en: 'Birthday', fr: 'Anniversaire' },
    description: {
      pt: 'Parabéns para quem faz aniversário.',
      en: 'Birthday wishes.',
      fr: 'Vœux d\'anniversaire.'
    },
    preview: {
      pt: 'Parabéns, [Nome]! 🎂 Hoje é um dia muito especial - seu aniversário!',
      en: 'Happy Birthday, [Name]! 🎂 Today is a very special day - your birthday!',
      fr: 'Joyeux Anniversaire, [Nom]! 🎂 Aujourd\'hui est un jour très spécial - votre anniversaire!'
    },
    icon: Gift,
    color: 'text-pink-600'
  },
  feedbackRequest: {
    title: { pt: 'Pedir opinião', en: 'Ask for feedback', fr: 'Demander un avis' },
    description: {
      pt: 'Perguntar como está a experiência no estúdio.',
      en: 'Ask how their experience at the studio is going.',
      fr: 'Demander comment se passe l\'expérience au studio.'
    },
    preview: {
      pt: 'Olá, [Nome]! Sua opinião é muito importante para nós. Como tem sido sua experiência?',
      en: 'Hello, [Name]! Your opinion is very important to us. How has your experience been?',
      fr: 'Bonjour, [Nom]! Votre avis est très important pour nous. Comment s\'est passée votre expérience?'
    },
    icon: FileText,
    color: 'text-green-600'
  }
}

export const pick = (map, language) => (map ? map[language] || map.pt : '')

export const templateTitle = (templateId, language = 'pt') =>
  pick(TEMPLATE_CARDS[templateId]?.title, language)

// Assunto e mensagem que o modelo coloca no passo 2 (na língua escolhida).
export const templateContent = (templateId, language = 'pt') => {
  const card = TEMPLATE_CARDS[templateId]
  if (!card || templateId === 'blank' || card.automatic) {
    return { subject: '', message: '' }
  }
  const data = getTemplate(templateId, language)
  return {
    subject: data.subject || '',
    message: card.fullMessage && data.message ? data.message : pick(card.preview, language)
  }
}
