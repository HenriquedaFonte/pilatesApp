export const emailTemplates = {
  lowCredits: {
    pt: {
      subject: 'Aviso: Saldo Baixo de Créditos - Josi Pilates',
      greeting: (name) => `Olá, ${name}!`,
      warning: '⚠️ Atenção: Saldo Baixo de Créditos',
      creditsText: (credits) => `Créditos Restantes: ${credits}`,
      message: 'Para continuar aproveitando nossas aulas de Pilates sem interrupções, recomendamos que você renove seus créditos em breve.',
      contactTitle: '💡 Como renovar seus créditos:',
      contactItems: [
        'Entre em contato conosco pelo telefone: {phone}',
        'Envie um WhatsApp para agilizar o processo',
        'Visite nosso studio durante o horário de funcionamento'
      ],
      closing: 'Estamos aqui para ajudar você a manter sua rotina de exercícios e bem-estar!',
      signature: 'Atenciosamente,',
      teamName: 'Equipe Josi Pilates',
      tagline: 'Cuidando do seu bem-estar com carinho e profissionalismo'
    },
    en: {
      subject: 'Notice: Low Credits Balance - Josi Pilates',
      greeting: (name) => `Hello, ${name}!`,
      warning: '⚠️ Warning: Low Credits Balance',
      creditsText: (credits) => `Remaining Credits: ${credits}`,
      message: 'To continue enjoying your Pilates classes without interruptions, we recommend renewing your credits soon.',
      contactTitle: '💡 How to renew your credits:',
      contactItems: [
        'Contact us by phone: {phone}',
        'Send a WhatsApp message to speed up the process',
        'Visit our studio during business hours'
      ],
      closing: 'We are here to help you maintain your exercise routine and well-being!',
      signature: 'Best regards,',
      teamName: 'Josi Pilates Team',
      tagline: 'Caring for your well-being with care and professionalism'
    },
    fr: {
      subject: 'Avis: Solde de Crédits Faible - Josi Pilates',
      greeting: (name) => `Bonjour, ${name}!`,
      warning: '⚠️ Attention: Solde de Crédits Faible',
      creditsText: (credits) => `Crédits Restants: ${credits}`,
      message: 'Pour continuer à profiter de vos cours de Pilates sans interruption, nous vous recommandons de renouveler vos crédits bientôt.',
      contactTitle: '💡 Comment renouveler vos crédits:',
      contactItems: [
        'Contactez-nous par téléphone: {phone}',
        'Envoyez un WhatsApp pour accélérer le processus',
        'Visitez notre studio pendant les heures d\'ouverture'
      ],
      closing: 'Nous sommes là pour vous aider à maintenir votre routine d\'exercice et votre bien-être!',
      signature: 'Cordialement,',
      teamName: 'Équipe Josi Pilates',
      tagline: 'Prendre soin de votre bien-être avec soin et professionnalisme'
    }
  },

  welcome: {
    pt: {
      subject: 'Bem-vindo(a) ao Josi Pilates! 🧘‍♀️',
      greeting: (name) => `Olá, ${name}!`,
      welcomeTitle: '🧘‍♀️ Bem-vindo(a)!',
      mainMessage: 'É com grande alegria que damos as boas-vindas ao <strong>Josi Pilates</strong>! 🎉',
      journeyMessage: 'Sua jornada de bem-estar começa agora! Estamos aqui para apoiar você em cada movimento, respiração e conquista.',
      nextStepsTitle: '📋 Próximos passos:',
      nextSteps: [
        'Agende sua primeira aula experimental',
        'Conheça nossa equipe de instrutores qualificados',
        'Descubra nossos diferentes tipos de aula',
        'Tire todas suas dúvidas conosco'
      ],
      contactTitle: '📞 Entre em contato:',
      contactPhone: 'Telefone/WhatsApp: {phone}',
      contactEmail: 'E-mail: {email}',
      excitementMessage: 'Estamos ansiosos para conhecer você pessoalmente e ajudar você a alcançar seus objetivos de saúde e bem-estar!',
      signature: 'Com carinho,',
      teamName: 'Equipe Josi Pilates',
      tagline: 'Transformando vidas através do movimento'
    },
    en: {
      subject: 'Welcome to Josi Pilates! 🧘‍♀️',
      greeting: (name) => `Hello, ${name}!`,
      welcomeTitle: '🧘‍♀️ Welcome!',
      mainMessage: 'We are delighted to welcome you to <strong>Josi Pilates</strong>! 🎉',
      journeyMessage: 'Your wellness journey begins now! We are here to support you in every movement, breath, and achievement.',
      nextStepsTitle: '📋 Next steps:',
      nextSteps: [
        'Schedule your first trial class',
        'Meet our qualified instructors',
        'Discover our different class types',
        'Ask us any questions you have'
      ],
      contactTitle: '📞 Contact us:',
      contactPhone: 'Phone/WhatsApp: {phone}',
      contactEmail: 'Email: {email}',
      excitementMessage: 'We are excited to meet you in person and help you achieve your health and wellness goals!',
      signature: 'With care,',
      teamName: 'Josi Pilates Team',
      tagline: 'Transforming lives through movement'
    },
    fr: {
      subject: 'Bienvenue chez Josi Pilates! 🧘‍♀️',
      greeting: (name) => `Bonjour, ${name}!`,
      welcomeTitle: '🧘‍♀️ Bienvenue!',
      mainMessage: 'C\'est avec une grande joie que nous vous accueillons chez <strong>Josi Pilates</strong>! 🎉',
      journeyMessage: 'Votre parcours de bien-être commence maintenant! Nous sommes là pour vous soutenir dans chaque mouvement, respiration et réussite.',
      nextStepsTitle: '📋 Prochaines étapes:',
      nextSteps: [
        'Planifiez votre premier cours d\'essai',
        'Rencontrez nos instructeurs qualifiés',
        'Découvrez nos différents types de cours',
        'Posez-nous toutes vos questions'
      ],
      contactTitle: '📞 Contactez-nous:',
      contactPhone: 'Téléphone/WhatsApp: {phone}',
      contactEmail: 'E-mail: {email}',
      excitementMessage: 'Nous sommes impatients de vous rencontrer en personne et de vous aider à atteindre vos objectifs de santé et de bien-être!',
      signature: 'Avec soin,',
      teamName: 'Équipe Josi Pilates',
      tagline: 'Transformer les vies à travers le mouvement'
    }
  },

  classReminder: {
    pt: {
      subject: 'Lembrete: Sua aula de Pilates é amanhã! 📅',
      greeting: (name) => `Olá, ${name}!`,
      reminder: 'Este é um lembrete amigável sobre sua aula de Pilates agendada para amanhã.',
      details: 'Detalhes da aula:',
      date: (date) => `Data: ${date}`,
      time: (time) => `Horário: ${time}`,
      type: (type) => `Tipo: ${type}`,
      instructor: (instructor) => `Instrutor(a): ${instructor}`,
      preparation: 'Lembre-se de:',
      tips: [
        'Chegar 10 minutos antes',
        'Trazer uma toalha',
        'Usar roupas confortáveis',
        'Hidratar-se bem'
      ],
      excitement: 'Mal podemos esperar para vê-lo(a) na aula!',
      signature: 'Atenciosamente,',
      teamName: 'Equipe Josi Pilates'
    },
    en: {
      subject: 'Reminder: Your Pilates class is tomorrow! 📅',
      greeting: (name) => `Hello, ${name}!`,
      reminder: 'This is a friendly reminder about your Pilates class scheduled for tomorrow.',
      details: 'Class details:',
      date: (date) => `Date: ${date}`,
      time: (time) => `Time: ${time}`,
      type: (type) => `Type: ${type}`,
      instructor: (instructor) => `Instructor: ${instructor}`,
      preparation: 'Remember to:',
      tips: [
        'Arrive 10 minutes early',
        'Bring a towel',
        'Wear comfortable clothing',
        'Stay hydrated'
      ],
      excitement: 'We can\'t wait to see you in class!',
      signature: 'Best regards,',
      teamName: 'Josi Pilates Team'
    },
    fr: {
      subject: 'Rappel: Votre cours de Pilates est demain! 📅',
      greeting: (name) => `Bonjour, ${name}!`,
      reminder: 'Ceci est un rappel amical concernant votre cours de Pilates prévu pour demain.',
      details: 'Détails du cours:',
      date: (date) => `Date: ${date}`,
      time: (time) => `Heure: ${time}`,
      type: (type) => `Type: ${type}`,
      instructor: (instructor) => `Instructeur: ${instructor}`,
      preparation: 'Rappelez-vous de:',
      tips: [
        'Arriver 10 minutes à l\'avance',
        'Apporter une serviette',
        'Porter des vêtements confortables',
        'Bien s\'hydrater'
      ],
      excitement: 'Nous avons hâte de vous voir en cours!',
      signature: 'Cordialement,',
      teamName: 'Équipe Josi Pilates'
    }
  },

  lowCreditsGentle: {
    pt: {
      subject: 'Seus créditos estão acabando - Vamos renovar? 💪',
      greeting: (name) => `Olá, ${name}!`,
      message: 'Esperamos que você esteja aproveitando suas aulas de Pilates!',
      warning: 'Notamos que seus créditos estão chegando ao fim.',
      creditsText: (credits) => `Créditos restantes: ${credits}`,
      benefits: 'Benefícios de renovar agora:',
      benefitsList: [
        'Continuidade no seu progresso',
        'Manutenção da sua rotina saudável',
        'Preços especiais para renovação'
      ],
      contact: 'Entre em contato conosco para renovar ou tire suas dúvidas!',
      closing: 'Estamos aqui para apoiar você!',
      signature: 'Atenciosamente,',
      teamName: 'Equipe Josi Pilates'
    },
    en: {
      subject: 'Your credits are running low - Shall we renew? 💪',
      greeting: (name) => `Hello, ${name}!`,
      message: 'We hope you\'re enjoying your Pilates classes!',
      warning: 'We notice your credits are running low.',
      creditsText: (credits) => `Remaining credits: ${credits}`,
      benefits: 'Benefits of renewing now:',
      benefitsList: [
        'Continuity in your progress',
        'Maintenance of your healthy routine',
        'Special renewal prices'
      ],
      contact: 'Contact us to renew or ask your questions!',
      closing: 'We are here to support you!',
      signature: 'Best regards,',
      teamName: 'Josi Pilates Team'
    },
    fr: {
      subject: 'Vos crédits s\'épuisent - Renouvelons? 💪',
      greeting: (name) => `Bonjour, ${name}!`,
      message: 'Nous espérons que vous profitez de vos cours de Pilates!',
      warning: 'Nous remarquons que vos crédits s\'épuisent.',
      creditsText: (credits) => `Crédits restants: ${credits}`,
      benefits: 'Avantages du renouvellement maintenant:',
      benefitsList: [
        'Continuité dans vos progrès',
        'Maintien de votre routine saine',
        'Prix spéciaux de renouvellement'
      ],
      contact: 'Contactez-nous pour renouveler ou posez vos questions!',
      closing: 'Nous sommes là pour vous soutenir!',
      signature: 'Cordialement,',
      teamName: 'Équipe Josi Pilates'
    }
  },

  promotion: {
    pt: {
      subject: 'Oferta Especial: Pacote de Créditos com Desconto! 🎁',
      greeting: (name) => `Olá, ${name}!`,
      announcement: 'Temos uma oferta especial só para você! 🎉',
      promotion: 'PROMOÇÃO LIMITADA:',
      details: (details) => details,
      validity: (date) => `Válida até: ${date}`,
      discount: (percent) => `Desconto de: ${percent}%`,
      benefits: 'Esta é uma oportunidade única para:',
      benefitsList: [
        'Economizar em seus créditos',
        'Garantir mais aulas por um preço especial',
        'Manter sua rotina de exercícios'
      ],
      callToAction: 'Não perca esta chance! Entre em contato conosco hoje mesmo.',
      closing: 'Aproveite e cuide da sua saúde com economia!',
      signature: 'Atenciosamente,',
      teamName: 'Equipe Josi Pilates'
    },
    en: {
      subject: 'Special Offer: Discounted Credit Package! 🎁',
      greeting: (name) => `Hello, ${name}!`,
      announcement: 'We have a special offer just for you! 🎉',
      promotion: 'LIMITED TIME PROMOTION:',
      details: (details) => details,
      validity: (date) => `Valid until: ${date}`,
      discount: (percent) => `Discount: ${percent}%`,
      benefits: 'This is a unique opportunity to:',
      benefitsList: [
        'Save on your credits',
        'Get more classes at a special price',
        'Maintain your exercise routine'
      ],
      callToAction: 'Don\'t miss this chance! Contact us today.',
      closing: 'Take advantage and take care of your health economically!',
      signature: 'Best regards,',
      teamName: 'Josi Pilates Team'
    },
    fr: {
      subject: 'Offre Spéciale: Forfait de Crédits Remisé! 🎁',
      greeting: (name) => `Bonjour, ${name}!`,
      announcement: 'Nous avons une offre spéciale rien que pour vous! 🎉',
      promotion: 'PROMOTION LIMITÉE:',
      details: (details) => details,
      validity: (date) => `Valable jusqu'au: ${date}`,
      discount: (percent) => `Remise: ${percent}%`,
      benefits: 'C\'est une opportunité unique de:',
      benefitsList: [
        'Économiser sur vos crédits',
        'Obtenir plus de cours à prix spécial',
        'Maintenir votre routine d\'exercice'
      ],
      callToAction: 'Ne manquez pas cette chance! Contactez-nous dès aujourd\'hui.',
      closing: 'Profitez-en et prenez soin de votre santé économiquement!',
      signature: 'Cordialement,',
      teamName: 'Équipe Josi Pilates'
    }
  },

  scheduleChange: {
    pt: {
      subject: 'Importante: Alteração no horário da sua aula 📅',
      greeting: (name) => `Olá, ${name}!`,
      message: 'Precisamos informar sobre uma alteração no horário da sua aula.',
      change: 'ALTERAÇÃO:',
      originalTime: (time) => `Aula original: ${time}`,
      newTime: (time) => `Novo horário: ${time}`,
      date: (date) => `Data: ${date}`,
      reason: (reason) => `Motivo: ${reason}`,
      action: 'O que fazer:',
      actionItems: [
        'Confirme se o novo horário funciona para você',
        'Entre em contato se precisar reagendar',
        'Chegue 10 minutos antes no novo horário'
      ],
      apology: 'Pedimos desculpas por qualquer inconveniente e agradecemos sua compreensão.',
      closing: 'Nos vemos na aula!',
      signature: 'Atenciosamente,',
      teamName: 'Equipe Josi Pilates'
    },
    en: {
      subject: 'Important: Change in your class schedule 📅',
      greeting: (name) => `Hello, ${name}!`,
      message: 'We need to inform you about a change in your class schedule.',
      change: 'CHANGE:',
      originalTime: (time) => `Original class: ${time}`,
      newTime: (time) => `New time: ${time}`,
      date: (date) => `Date: ${date}`,
      reason: (reason) => `Reason: ${reason}`,
      action: 'What to do:',
      actionItems: [
        'Confirm if the new time works for you',
        'Contact us if you need to reschedule',
        'Arrive 10 minutes early at the new time'
      ],
      apology: 'We apologize for any inconvenience and thank you for your understanding.',
      closing: 'See you in class!',
      signature: 'Best regards,',
      teamName: 'Josi Pilates Team'
    },
    fr: {
      subject: 'Important: Changement dans l\'horaire de votre cours 📅',
      greeting: (name) => `Bonjour, ${name}!`,
      message: 'Nous devons vous informer d\'un changement dans l\'horaire de votre cours.',
      change: 'CHANGEMENT:',
      originalTime: (time) => `Cours original: ${time}`,
      newTime: (time) => `Nouvel horaire: ${time}`,
      date: (date) => `Date: ${date}`,
      reason: (reason) => `Raison: ${reason}`,
      action: 'Que faire:',
      actionItems: [
        'Confirmez si le nouvel horaire vous convient',
        'Contactez-nous si vous devez reprogrammer',
        'Arrivez 10 minutes à l\'avance au nouvel horaire'
      ],
      apology: 'Nous nous excusons pour tout inconvénient et vous remercions de votre compréhension.',
      closing: 'À bientôt en cours!',
      signature: 'Cordialement,',
      teamName: 'Équipe Josi Pilates'
    }
  },

  birthday: {
    pt: {
      subject: 'Parabéns pelo seu aniversário! 🎂🎉',
      greeting: (name) => `Parabéns, ${name}!`,
      celebration: '🎂 Hoje é um dia muito especial - seu aniversário! 🎉',
      wishes: 'Toda a equipe do Josi Pilates deseja:',
      wishesList: [
        'Muita saúde e felicidade',
        'Conquistas e realizações',
        'Momentos de paz e bem-estar',
        'Muito amor e alegria'
      ],
      surprise: 'Como presente, preparamos uma surpresa especial para você!',
      contact: 'Entre em contato conosco para descobrir.',
      year: 'Que este novo ano de vida seja repleto de movimento, equilíbrio e muita energia positiva!',
      closing: 'Feliz aniversário!',
      signature: 'Com carinho,',
      teamName: 'Equipe Josi Pilates'
    },
    en: {
      subject: 'Happy Birthday! 🎂🎉',
      greeting: (name) => `Happy Birthday, ${name}!`,
      celebration: '🎂 Today is a very special day - your birthday! 🎉',
      wishes: 'The entire Josi Pilates team wishes you:',
      wishesList: [
        'Lots of health and happiness',
        'Achievements and accomplishments',
        'Moments of peace and well-being',
        'Lots of love and joy'
      ],
      surprise: 'As a gift, we have prepared a special surprise for you!',
      contact: 'Contact us to find out.',
      year: 'May this new year of life be full of movement, balance, and lots of positive energy!',
      closing: 'Happy Birthday!',
      signature: 'With care,',
      teamName: 'Josi Pilates Team'
    },
    fr: {
      subject: 'Joyeux Anniversaire! 🎂🎉',
      greeting: (name) => `Joyeux Anniversaire, ${name}!`,
      celebration: '🎂 Aujourd\'hui est un jour très spécial - votre anniversaire! 🎉',
      wishes: 'Toute l\'équipe Josi Pilates vous souhaite:',
      wishesList: [
        'Beaucoup de santé et de bonheur',
        'Des réalisations et des accomplissements',
        'Des moments de paix et de bien-être',
        'Beaucoup d\'amour et de joie'
      ],
      surprise: 'En cadeau, nous vous avons préparé une surprise spéciale!',
      contact: 'Contactez-nous pour découvrir.',
      year: 'Puisse cette nouvelle année de vie être remplie de mouvement, d\'équilibre et de beaucoup d\'énergie positive!',
      closing: 'Joyeux Anniversaire!',
      signature: 'Avec soin,',
      teamName: 'Équipe Josi Pilates'
    }
  },

  feedbackRequest: {
    pt: {
      subject: 'Sua opinião é muito importante para nós! 💭',
      greeting: (name) => `Olá, ${name}!`,
      message: 'Esperamos que você esteja amando suas aulas de Pilates conosco!',
      importance: 'Sua opinião é fundamental para continuarmos melhorando nossos serviços.',
      questions: 'Gostaríamos muito de saber:',
      questionsList: [
        '📝 Como tem sido sua experiência?',
        '📝 O que você mais gosta nas aulas?',
        '📝 Há algo que podemos melhorar?',
        '📝 Recomendaria nosso studio para amigos?'
      ],
      help: 'Suas sugestões nos ajudam a:',
      helpList: [
        'Aprender nossos serviços',
        'Criar novas modalidades',
        'Melhorar o atendimento',
        'Proporcionar a melhor experiência'
      ],
      contact: 'Responda este e-mail ou fale conosco pessoalmente.',
      closing: 'Sua opinião faz toda a diferença!',
      thanks: 'Obrigado por fazer parte da família Josi Pilates!',
      signature: 'Atenciosamente,',
      teamName: 'Equipe Josi Pilates'
    },
    en: {
      subject: 'Your opinion is very important to us! 💭',
      greeting: (name) => `Hello, ${name}!`,
      message: 'We hope you\'re loving your Pilates classes with us!',
      importance: 'Your opinion is fundamental for us to continue improving our services.',
      questions: 'We would love to know:',
      questionsList: [
        '📝 How has your experience been?',
        '📝 What do you like most about the classes?',
        '📝 Is there anything we can improve?',
        '📝 Would you recommend our studio to friends?'
      ],
      help: 'Your suggestions help us to:',
      helpList: [
        'Improve our services',
        'Create new modalities',
        'Enhance customer service',
        'Provide the best experience'
      ],
      contact: 'Reply to this email or speak to us in person.',
      closing: 'Your opinion makes all the difference!',
      thanks: 'Thank you for being part of the Josi Pilates family!',
      signature: 'Best regards,',
      teamName: 'Josi Pilates Team'
    },
    fr: {
      subject: 'Votre avis est très important pour nous! 💭',
      greeting: (name) => `Bonjour, ${name}!`,
      message: 'Nous espérons que vous adorez vos cours de Pilates avec nous!',
      importance: 'Votre avis est fondamental pour que nous continuions à améliorer nos services.',
      questions: 'Nous aimerions beaucoup savoir:',
      questionsList: [
        '📝 Comment s\'est passée votre expérience?',
        '📝 Qu\'est-ce que vous aimez le plus dans les cours?',
        '📝 Y a-t-il quelque chose que nous pouvons améliorer?',
        '📝 Recommanderiez-vous notre studio à des amis?'
      ],
      help: 'Vos suggestions nous aident à:',
      helpList: [
        'Améliorer nos services',
        'Créer de nouvelles modalités',
        'Améliorer le service client',
        'Fournir la meilleure expérience'
      ],
      contact: 'Répondez à cet e-mail ou parlez-nous en personne.',
      closing: 'Votre avis fait toute la différence!',
      thanks: 'Merci de faire partie de la famille Josi Pilates!',
      signature: 'Cordialement,',
      teamName: 'Équipe Josi Pilates'
    }
  },

  custom: {
    pt: {
      greeting: (name) => `Olá, ${name}!`,
      signature: (senderName) => `Atenciosamente, ${senderName} - Josi Pilates`,
      tagline: 'Cuidando do seu bem-estar com carinho e profissionalismo'
    },
    en: {
      greeting: (name) => `Hello, ${name}!`,
      signature: (senderName) => `Best regards, ${senderName} - Josi Pilates`,
      tagline: 'Caring for your well-being with care and professionalism'
    },
    fr: {
      greeting: (name) => `Bonjour, ${name}!`,
      signature: (senderName) => `Cordialement, ${senderName} - Josi Pilates`,
      tagline: 'Prendre soin de votre bien-être avec soin et professionnalisme'
    }
  },

  passwordReset: {
    pt: {
      subject: 'Redefinição de Senha - Josi Pilates',
      greeting: (name) => `Olá, ${name}!`,
      message: 'Recebemos uma solicitação para redefinir sua senha.',
      instructions: 'Para redefinir sua senha, clique no link abaixo:',
      resetLink: 'Redefinir Senha',
      validity: 'Este link é válido por 1 hora.',
      ignore: 'Se você não solicitou esta redefinição, ignore este e-mail.',
      support: 'Se precisar de ajuda, entre em contato conosco.',
      signature: 'Atenciosamente,',
      teamName: 'Equipe Josi Pilates'
    },
    en: {
      subject: 'Password Reset - Josi Pilates',
      greeting: (name) => `Hello, ${name}!`,
      message: 'We received a request to reset your password.',
      instructions: 'To reset your password, click the link below:',
      resetLink: 'Reset Password',
      validity: 'This link is valid for 1 hour.',
      ignore: 'If you did not request this reset, please ignore this email.',
      support: 'If you need help, contact us.',
      signature: 'Best regards,',
      teamName: 'Josi Pilates Team'
    },
    fr: {
      subject: 'Réinitialisation du Mot de Passe - Josi Pilates',
      greeting: (name) => `Bonjour, ${name}!`,
      message: 'Nous avons reçu une demande de réinitialisation de votre mot de passe.',
      instructions: 'Pour réinitialiser votre mot de passe, cliquez sur le lien ci-dessous:',
      resetLink: 'Réinitialiser le Mot de Passe',
      validity: 'Ce lien est valide pendant 1 heure.',
      ignore: 'Si vous n\'avez pas demandé cette réinitialisation, ignorez cet e-mail.',
      support: 'Si vous avez besoin d\'aide, contactez-nous.',
      signature: 'Cordialement,',
      teamName: 'Équipe Josi Pilates'
    }
  },

  zeroCredits: {
    pt: {
      id: 'zero_credits',
      title: 'Sem Créditos - Compra Necessária',
      subject: 'Aviso: Você não possui créditos - Josi Pilates',
      message: 'Notamos que você não possui créditos disponíveis para aulas.\n\nPara continuar aproveitando nossas aulas de Pilates, é necessário adquirir novos créditos.\n\nEntre em contato conosco para renovar seus créditos e manter sua rotina de exercícios!'
    },
    en: {
      id: 'zero_credits',
      title: 'Zero Credits - Purchase Required',
      subject: 'Notice: You have no credits remaining - Josi Pilates',
      message: 'We notice that you have no credits available for classes.\n\nTo continue enjoying our Pilates classes, you need to purchase new credits.\n\nContact us to renew your credits and maintain your exercise routine!'
    },
    es: {
      id: 'zero_credits',
      title: 'Sin Créditos - Compra Requerida',
      subject: 'Aviso: No tienes créditos restantes - Josi Pilates',
      message: 'Notamos que no tienes créditos disponibles para clases.\n\nPara continuar disfrutando de nuestras clases de Pilates, necesitas adquirir nuevos créditos.\n\n¡Contáctanos para renovar tus créditos y mantener tu rutina de ejercicios!'
    }
  }
};

export const getTemplate = (templateType, language = 'pt') => {
  const template = emailTemplates[templateType];
  if (!template) {
    console.warn(`Template type "${templateType}" not found`);
    return emailTemplates.lowCredits.pt; 
  }

  return template[language] || template.pt;
};

export const processTemplate = (template, variables = {}) => {
  const processed = { ...template };

  Object.keys(processed).forEach(key => {
    if (typeof processed[key] === 'string') {
      processed[key] = processed[key].replace(/{(\w+)}/g, (match, varName) => {
        return variables[varName] || match;
      });
    } else if (Array.isArray(processed[key])) {
      processed[key] = processed[key].map(item =>
        item.replace(/{(\w+)}/g, (match, varName) => {
          return variables[varName] || match;
        })
      );
    }
  });

  return processed;
};