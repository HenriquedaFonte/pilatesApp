import { FileText, Calendar, AlertTriangle, CircleSlash, PenLine, Paperclip } from 'lucide-react'
import { getTemplate } from './emailTemplates'
import { emptyContent, LANGUAGES } from './customEmail'

// Cards do passo 2 ("O quê"). Título e descrição de 1 linha nas 3 línguas.
// - blank: aviso geral, escrito do zero (em PT, EN e FR).
// - automatic: o email sai pronto na língua de cada aluno (sem assunto/mensagem na tela).
// - os demais preenchem assunto e mensagem completos em pt/en/fr, para revisar e editar.
export const TEMPLATE_CARDS = {
  blank: {
    title: { pt: 'Aviso geral', en: 'General notice', fr: 'Avis général' },
    description: {
      pt: 'Escrever o assunto e a mensagem do zero.',
      en: 'Write the subject and message from scratch.',
      fr: 'Écrire l\'objet et le message à partir de zéro.'
    },
    icon: PenLine,
    color: 'text-muted-foreground'
  },
  lowCredits: {
    title: { pt: 'Créditos baixos', en: 'Low credits', fr: 'Crédits faibles' },
    description: {
      pt: 'Pronto, com o saldo de cada aluno, na língua dele.',
      en: 'Ready-made, with each student\'s balance, in their language.',
      fr: 'Prêt à envoyer, avec le solde de chaque élève, dans sa langue.'
    },
    automatic: true,
    icon: AlertTriangle,
    color: 'text-amber-600'
  },
  zeroCreditsNotice: {
    title: { pt: 'Créditos zerados', en: 'No credits left', fr: 'Crédits épuisés' },
    description: {
      pt: 'Avisa que os créditos acabaram e como renovar.',
      en: 'Says the credits have run out and how to renew.',
      fr: 'Indique que les crédits sont épuisés et comment renouveler.'
    },
    icon: CircleSlash,
    color: 'text-red-600'
  },
  scheduleChangeNotice: {
    title: { pt: 'Mudança de horário', en: 'Schedule change', fr: 'Changement d\'horaire' },
    description: {
      pt: 'Avisar sobre alteração no horário das aulas.',
      en: 'Notice about a change in class times.',
      fr: 'Avis d\'un changement d\'horaire des cours.'
    },
    icon: Calendar,
    color: 'text-blue-600'
  },
  profileUpdate: {
    title: { pt: 'Atualizar cadastro', en: 'Update profile', fr: 'Mettre à jour le profil' },
    description: {
      pt: 'Pede telefone e seguro saúde.',
      en: 'Asks for phone and health insurance.',
      fr: 'Demande téléphone et assurance santé.'
    },
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
  }
}

export const pick = (map, language) => (map ? map[language] || map.pt : '')

export const templateTitle = (templateId, language = 'pt') =>
  pick(TEMPLATE_CARDS[templateId]?.title, language)

// Assunto e mensagem que o modelo coloca no passo 2, nas três línguas:
// { pt: { subject, message }, en: {...}, fr: {...} }.
export const templateContent = templateId => {
  const card = TEMPLATE_CARDS[templateId]
  const content = emptyContent()
  if (!card || templateId === 'blank' || card.automatic) return content
  for (const lang of LANGUAGES) {
    const data = getTemplate(templateId, lang)
    content[lang] = { subject: data.subject || '', message: data.message || '' }
  }
  return content
}
