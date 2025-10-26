import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Calendar, AlertTriangle, Heart, Gift, CheckCircle } from 'lucide-react';
import { getTemplate } from '../lib/emailTemplates';

const EmailTemplates = ({ onSelectTemplate, selectedTemplateId, language = 'pt' }) => {
  // Template metadata for UI display
  const templateMetadata = {
    welcome: {
      title: { pt: 'Boas-vindas', en: 'Welcome', fr: 'Bienvenue' },
      description: {
        pt: 'Mensagem de boas-vindas para novos alunos',
        en: 'Welcome message for new students',
        fr: 'Message de bienvenue pour les nouveaux élèves'
      },
      preview: {
        pt: 'Olá, [Nome]! É com grande alegria que damos as boas-vindas ao Josi Pilates! 🎉',
        en: 'Hello, [Name]! We are delighted to welcome you to Josi Pilates! 🎉',
        fr: 'Bonjour, [Nom]! C\'est avec une grande joie que nous vous accueillons chez Josi Pilates! 🎉'
      },
      icon: Heart,
      color: 'text-pink-600',
      category: 'welcome'
    },
    classReminder: {
      title: { pt: 'Lembrete de Aula', en: 'Class Reminder', fr: 'Rappel de Cours' },
      description: {
        pt: 'Lembrete para aulas agendadas',
        en: 'Reminder for scheduled classes',
        fr: 'Rappel pour les cours programmés'
      },
      preview: {
        pt: 'Olá, [Nome]! Este é um lembrete sobre sua aula de Pilates agendada para amanhã.',
        en: 'Hello, [Name]! This is a reminder about your Pilates class scheduled for tomorrow.',
        fr: 'Bonjour, [Nom]! Ceci est un rappel concernant votre cours de Pilates prévu pour demain.'
      },
      icon: Calendar,
      color: 'text-blue-600',
      category: 'reminder'
    },
    lowCreditsGentle: {
      title: { pt: 'Saldo Baixo (Gentil)', en: 'Low Credits (Gentle)', fr: 'Crédits Faibles (Doux)' },
      description: {
        pt: 'Aviso gentil sobre saldo baixo de créditos',
        en: 'Gentle notice about low credit balance',
        fr: 'Avis doux sur le solde de crédits faible'
      },
      preview: {
        pt: 'Olá, [Nome]! Esperamos que esteja aproveitando suas aulas. Seus créditos estão acabando.',
        en: 'Hello, [Name]! We hope you\'re enjoying your classes. Your credits are running low.',
        fr: 'Bonjour, [Nom]! Nous espérons que vous profitez de vos cours. Vos crédits s\'épuisent.'
      },
      icon: AlertTriangle,
      color: 'text-orange-600',
      category: 'credits'
    },
    promotion: {
      title: { pt: 'Promoção Especial', en: 'Special Promotion', fr: 'Promotion Spéciale' },
      description: {
        pt: 'Anúncio de promoções e ofertas especiais',
        en: 'Announcement of promotions and special offers',
        fr: 'Annonce de promotions et offres spéciales'
      },
      preview: {
        pt: 'Olá, [Nome]! Temos uma oferta especial só para você! 🎁 Pacote com desconto.',
        en: 'Hello, [Name]! We have a special offer just for you! 🎁 Discounted package.',
        fr: 'Bonjour, [Nom]! Nous avons une offre spéciale rien que pour vous! 🎁 Forfait réduit.'
      },
      icon: Gift,
      color: 'text-purple-600',
      category: 'promotion'
    },
    scheduleChange: {
      title: { pt: 'Mudança de Horário', en: 'Schedule Change', fr: 'Changement d\'Horaire' },
      description: {
        pt: 'Comunicado sobre alterações de horários',
        en: 'Notice about schedule changes',
        fr: 'Avis concernant les changements d\'horaire'
      },
      preview: {
        pt: 'Olá, [Nome]! Precisamos informar sobre uma alteração no horário da sua aula.',
        en: 'Hello, [Name]! We need to inform you about a change in your class schedule.',
        fr: 'Bonjour, [Nom]! Nous devons vous informer d\'un changement dans l\'horaire de votre cours.'
      },
      icon: Calendar,
      color: 'text-red-600',
      category: 'schedule'
    },
    birthday: {
      title: { pt: 'Parabéns - Aniversário', en: 'Happy Birthday', fr: 'Joyeux Anniversaire' },
      description: {
        pt: 'Mensagem de parabéns para aniversariantes',
        en: 'Birthday congratulations message',
        fr: 'Message d\'anniversaire'
      },
      preview: {
        pt: 'Parabéns, [Nome]! 🎂 Hoje é um dia muito especial - seu aniversário!',
        en: 'Happy Birthday, [Name]! 🎂 Today is a very special day - your birthday!',
        fr: 'Joyeux Anniversaire, [Nom]! 🎂 Aujourd\'hui est un jour très spécial - votre anniversaire!'
      },
      icon: Gift,
      color: 'text-pink-600',
      category: 'special'
    },
    feedbackRequest: {
      title: { pt: 'Solicitação de Feedback', en: 'Feedback Request', fr: 'Demande de Retour' },
      description: {
        pt: 'Pedido de avaliação e sugestões',
        en: 'Request for evaluation and suggestions',
        fr: 'Demande d\'évaluation et de suggestions'
      },
      preview: {
        pt: 'Olá, [Nome]! Sua opinião é muito importante para nós. Como tem sido sua experiência?',
        en: 'Hello, [Name]! Your opinion is very important to us. How has your experience been?',
        fr: 'Bonjour, [Nom]! Votre avis est très important pour nous. Comment s\'est passée votre expérience?'
      },
      icon: FileText,
      color: 'text-green-600',
      category: 'feedback'
    },
    studentWelcomeSelfSignup: {
      title: { pt: 'Boas-vindas (Auto-cadastro)', en: 'Welcome (Self-Signup)', fr: 'Bienvenue (Auto-inscription)' },
      description: {
        pt: 'Mensagem de boas-vindas para alunos que se cadastram sozinhos',
        en: 'Welcome message for students who sign up themselves',
        fr: 'Message de bienvenue pour les élèves qui s\'inscrivent eux-mêmes'
      },
      preview: {
        pt: 'Olá, [Nome]! É com grande alegria que damos as boas-vindas ao Josi Pilates! 🎉',
        en: 'Hello, [Name]! We are delighted to welcome you to Josi Pilates! 🎉',
        fr: 'Bonjour, [Nom]! C\'est avec une grande joie que nous vous accueillons chez Josi Pilates! 🎉'
      },
      icon: Heart,
      color: 'text-pink-600',
      category: 'welcome'
    },
    consentForm: {
      title: { pt: 'Formulário de Consentimento', en: 'Consent Form', fr: 'Formulaire de Consentement' },
      description: {
        pt: 'Envio do formulário de consentimento com anexo PDF',
        en: 'Send consent form with PDF attachment',
        fr: 'Envoyer le formulaire de consentement avec pièce jointe PDF'
      },
      preview: {
        pt: 'Olá, [Nome]! Enviando o formulário de consentimento para preenchimento.',
        en: 'Hello, [Name]! Sending the consent form for completion.',
        fr: 'Bonjour, [Nom]! Envoi du formulaire de consentement à remplir.'
      },
      icon: FileText,
      color: 'text-blue-600',
      category: 'consent'
    }
  };

  // Generate templates array from metadata and emailTemplates data
  const templates = Object.keys(templateMetadata).map(templateKey => {
    const metadata = templateMetadata[templateKey];
    const templateData = getTemplate(templateKey, language);

    return {
      id: templateKey,
      title: metadata.title[language] || metadata.title.pt,
      description: metadata.description[language] || metadata.description.pt,
      icon: metadata.icon,
      color: metadata.color,
      subject: templateData.subject,
      message: metadata.preview[language] || metadata.preview.pt,
      category: metadata.category
    };
  });

  const getCategoryBadge = (category) => {
    const categoryMap = {
      welcome: {
        pt: { label: 'Boas-vindas', variant: 'default' },
        en: { label: 'Welcome', variant: 'default' },
        fr: { label: 'Bienvenue', variant: 'default' }
      },
      reminder: {
        pt: { label: 'Lembrete', variant: 'secondary' },
        en: { label: 'Reminder', variant: 'secondary' },
        fr: { label: 'Rappel', variant: 'secondary' }
      },
      credits: {
        pt: { label: 'Créditos', variant: 'destructive' },
        en: { label: 'Credits', variant: 'destructive' },
        fr: { label: 'Crédits', variant: 'destructive' }
      },
      promotion: {
        pt: { label: 'Promoção', variant: 'default' },
        en: { label: 'Promotion', variant: 'default' },
        fr: { label: 'Promotion', variant: 'default' }
      },
      schedule: {
        pt: { label: 'Horário', variant: 'outline' },
        en: { label: 'Schedule', variant: 'outline' },
        fr: { label: 'Horaire', variant: 'outline' }
      },
      special: {
        pt: { label: 'Especial', variant: 'default' },
        en: { label: 'Special', variant: 'default' },
        fr: { label: 'Spécial', variant: 'default' }
      },
      feedback: {
        pt: { label: 'Feedback', variant: 'secondary' },
        en: { label: 'Feedback', variant: 'secondary' },
        fr: { label: 'Retour', variant: 'secondary' }
      },
      consent: {
        pt: { label: 'Consentimento', variant: 'default' },
        en: { label: 'Consent', variant: 'default' },
        fr: { label: 'Consentement', variant: 'default' }
      }
    };

    const config = categoryMap[category]?.[language] || categoryMap[category]?.pt || { label: category, variant: 'outline' };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((template) => {
          const IconComponent = template.icon;
          const isSelected = selectedTemplateId === template.id;

          return (
            <Card
              key={template.id}
              className={`hover:shadow-md transition-all cursor-pointer ${
                isSelected
                  ? 'ring-2 ring-primary bg-primary/5 shadow-lg'
                  : 'hover:shadow-md'
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <IconComponent className={`h-5 w-5 ${template.color}`} />
                    <CardTitle className="text-sm flex items-center gap-2">
                      {template.title}
                      {isSelected && <CheckCircle className="h-4 w-4 text-primary" />}
                    </CardTitle>
                  </div>
                  {getCategoryBadge(template.category)}
                </div>
                <CardDescription className="text-xs">
                  {template.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  <div className="text-xs text-gray-600">
                    <strong>Assunto:</strong> {template.subject}
                  </div>
                  <div className="text-xs text-gray-500 line-clamp-3">
                    {template.message.substring(0, 100)}...
                  </div>
                  <Button
                    size="sm"
                    variant={isSelected ? "default" : "outline"}
                    className="w-full"
                    onClick={() => onSelectTemplate(template)}
                  >
                    {isSelected ? "Selecionado ✓" : "Usar Template"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      
      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-2">
          {language === 'en' ? '💡 Tips for using templates:' :
           language === 'fr' ? '💡 Conseils pour utiliser les modèles:' :
           '💡 Dicas para usar os templates:'}
        </h4>
        <ul className="text-sm text-blue-800 space-y-1">
          {language === 'en' ? (
            <>
              <li>• Personalize messages with specific student information</li>
              <li>• Replace fields in [BRACKETS] with real information</li>
              <li>• Adapt the message tone as needed</li>
              <li>• Always review before sending</li>
            </>
          ) : language === 'fr' ? (
            <>
              <li>• Personnalisez les messages avec des informations spécifiques sur les élèves</li>
              <li>• Remplacez les champs entre [CROCHETS] par les informations réelles</li>
              <li>• Adoptez le ton du message selon les besoins</li>
              <li>• Toujours vérifier avant d'envoyer</li>
            </>
          ) : (
            <>
              <li>• Personalize as mensagens com informações específicas dos alunos</li>
              <li>• Substitua os campos entre [COLCHETES] pelas informações reais</li>
              <li>• Adapte o tom da mensagem conforme necessário</li>
              <li>• Sempre revise antes de enviar</li>
            </>
          )}
        </ul>
      </div>
    </div>
  );
};

export default EmailTemplates;

