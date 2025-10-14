export const emailTemplates = {
  lowCredits: {
    pt: {
      subject: 'Aviso: Saldo Baixo de Créditos - Josi Pilates',
      greeting: (name) => `Olá, ${name}!`,
      warning: '⚠️ Atenção: Saldo Baixo de Créditos',
      creditsText: (credits) => `Créditos Restantes: ${credits}`,
      message: 'Para continuar aproveitando nossas aulas de Pilates, recomendamos que você renove seus créditos em breve.',
      contactTitle: '💡 Como renovar seus créditos:',
      contactItems: [
        'Entre em contato conosco pelo WhatsApp: {phone}',
        'Envie o valor do seu pacote de aulas para o interac pilatesmontreal@gmail.com',
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
      message: 'To continue enjoying your Pilates classes, we recommend renewing your credits soon.',
      contactTitle: '💡 How to renew your credits:',
      contactItems: [
        'Contact us by WhatsApp: {phone}',
        'Send the amount for your class package via Interac to pilatesmontreal@gmail.com.',
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
        'Contactez-nous par WhatsApp: {phone}',
        'Envoyez le montant de votre forfait de cours via Interac à pilatesmontreal@gmail.com.',
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
      title: 'Redefinição de Senha Solicitada',
      message: 'Recebemos uma solicitação para redefinir sua senha da conta Josi Pilates.',
      instructions: 'Para criar uma nova senha, clique no botão abaixo:',
      buttonText: 'Redefinir Minha Senha',
      validity: 'Este link é válido por 1 hora.',
      security: 'Por segurança, este link expirará automaticamente após 1 hora.',
      ignore: 'Se você não solicitou esta redefinição, ignore este e-mail.',
      support: 'Se precisar de ajuda, entre em contato conosco.',
      contact: 'Contato: +1 (438) 274-8396 | josi@josipilates.com',
      signature: 'Atenciosamente,',
      teamName: 'Equipe Josi Pilates',
      footer: '© 2024 Josi Pilates. Todos os direitos reservados.'
    },
    en: {
      subject: 'Password Reset - Josi Pilates',
      greeting: (name) => `Hello, ${name}!`,
      title: 'Password Reset Requested',
      message: 'We received a request to reset your Josi Pilates account password.',
      instructions: 'To create a new password, click the button below:',
      buttonText: 'Reset My Password',
      validity: 'This link is valid for 1 hour.',
      security: 'For security, this link will automatically expire after 1 hour.',
      ignore: 'If you did not request this reset, please ignore this email.',
      support: 'If you need help, contact us.',
      contact: 'Contact: +1 (438) 274-8396 | josi@josipilates.com',
      signature: 'Best regards,',
      teamName: 'Josi Pilates Team',
      footer: '© 2024 Josi Pilates. All rights reserved.'
    },
    fr: {
      subject: 'Réinitialisation du Mot de Passe - Josi Pilates',
      greeting: (name) => `Bonjour, ${name}!`,
      title: 'Réinitialisation du Mot de Passe Demandée',
      message: 'Nous avons reçu une demande de réinitialisation de votre mot de passe du compte Josi Pilates.',
      instructions: 'Pour créer un nouveau mot de passe, cliquez sur le bouton ci-dessous:',
      buttonText: 'Réinitialiser Mon Mot de Passe',
      validity: 'Ce lien est valide pendant 1 heure.',
      security: 'Pour des raisons de sécurité, ce lien expirera automatiquement après 1 heure.',
      ignore: 'Si vous n\'avez pas demandé cette réinitialisation, ignorez cet e-mail.',
      support: 'Si vous avez besoin d\'aide, contactez-nous.',
      contact: 'Contact: +1 (438) 274-8396 | josi@josipilates.com',
      signature: 'Cordialement,',
      teamName: 'Équipe Josi Pilates',
      footer: '© 2024 Josi Pilates. Tous droits réservés.'
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
  },

  creditAddition: {
    pt: {
      subject: (amount) => amount > 0 ? 'Créditos Adicionados - Josi Pilates' : 'Créditos Removidos - Josi Pilates',
      greeting: (name) => `Olá, ${name}!`,
      creditAdded: (amount) => amount > 0 ? 'Créditos adicionados à sua conta!' : 'Créditos removidos da sua conta!',
      creditDetails: (amount, type, description) => {
        const action = amount > 0 ? 'adicionados' : 'removidos';
        const absAmount = Math.abs(amount);
        return `Foram ${action} ${absAmount} crédito(s) do tipo ${type} da sua conta. Descrição: ${description}`;
      },
      currentBalance: (balance) => `Seu saldo atual é de ${balance} crédito(s).`,
      studioRulesTitle: 'Regras do Studio Josi Pilates',
      classDuration: 'As aulas têm duração de 55 minutos.',
      arrivalRule: 'Pedimos gentilmente que chegue pelo menos 5 minutos antes do início da sua aula. Este tempo extra permite uma transição tranquila entre as aulas.',
      cancellationRule: 'Além disso, gostaríamos de lembrá-lo da nossa política de cancelamento de 24 horas para todas as aulas. Se precisar cancelar ou reagendar sua sessão, certifique-se de nos informar pelo menos 24 horas antes. O não cumprimento desta política resultará na perda da aula.',
      excitement: 'Mal podemos esperar para vê-lo no studio!',
      signature: 'Atenciosamente,',
      teamName: 'Equipe Josi Pilates'
    },
    en: {
      subject: (amount) => amount > 0 ? 'Credits Added - Josi Pilates' : 'Credits Removed - Josi Pilates',
      greeting: (name) => `Hello, ${name}!`,
      creditAdded: (amount) => amount > 0 ? 'Credits have been added to your account!' : 'Credits have been removed from your account!',
      creditDetails: (amount, type, description) => {
        const action = amount > 0 ? 'added to' : 'removed from';
        const absAmount = Math.abs(amount);
        return `${absAmount} ${type} credit(s) have been ${action} your account. Description: ${description}`;
      },
      currentBalance: (balance) => `Your current balance is ${balance} credit(s).`,
      studioRulesTitle: 'Josi Pilates Studio Rules',
      classDuration: 'Classes have a duration of 55 minutes.',
      arrivalRule: 'We kindly ask that you arrive at least 5 minutes before the start of your class. This extra time allows for a smooth setup in the studio.',
      cancellationRule: 'Additionally, we\'d like to remind you of our 24-hour cancellation policy for all classes. If you need to cancel or reschedule your session, please make sure to inform us at least 24 hours in advance. Failure to comply with this policy will result in the loss of the class.',
      excitement: 'We look forward to seeing you in the studio!',
      signature: 'Best regards,',
      teamName: 'Josi Pilates Team'
    },
    fr: {
      subject: (amount) => amount > 0 ? 'Crédits Ajoutés - Josi Pilates' : 'Crédits Retirés - Josi Pilates',
      greeting: (name) => `Bonjour, ${name}!`,
      creditAdded: (amount) => amount > 0 ? 'Des crédits ont été ajoutés à votre compte!' : 'Des crédits ont été retirés de votre compte!',
      creditDetails: (amount, type, description) => {
        const action = amount > 0 ? 'ajoutés à' : 'retirés de';
        const absAmount = Math.abs(amount);
        return `${absAmount} crédit(s) ${type} ont été ${action} votre compte. Description: ${description}`;
      },
      currentBalance: (balance) => `Votre solde actuel est de ${balance} crédit(s).`,
      studioRulesTitle: 'Règles du Studio Josi Pilates',
      classDuration: 'Les cours ont une durée de 55 minutes.',
      arrivalRule: 'Nous vous demandons gentiment d\'arriver au moins 5 minutes avant le début de votre cours. Ce temps supplémentaire permet une configuration fluide dans le studio.',
      cancellationRule: 'De plus, nous aimerions vous rappeler notre politique d\'annulation de 24 heures pour tous les cours. Si vous devez annuler ou reprogrammer votre séance, veuillez nous en informer au moins 24 heures à l\'avance. Le non-respect de cette politique entraînera la perte du cours.',
      excitement: 'Nous avons hâte de vous voir au studio!',
      signature: 'Cordialement,',
      teamName: 'Équipe Josi Pilates'
    }
  },

  studentWelcome: {
    pt: {
      subject: 'Bem-vindo ao Josi Pilates! Sua conta foi criada 🎉',
      greeting: (name) => `Olá, ${name}!`,
      welcomeTitle: '🎉 Bem-vindo ao Josi Pilates!',
      accountCreated: 'Sua conta foi criada com sucesso!',
      defaultPassword: 'Sua senha temporária é: <strong>000000</strong>',
      setPasswordButton: 'Definir Minha Senha',
      importantInstructions: '📋 Instruções importantes:',
      instructions: [
        '1. Visite nosso site: https://josipilates.com',
        '2. Clique em "Portal do Aluno" para fazer login',
        '3. Use seu e-mail e a senha temporária acima',
        '4. Complete suas informações pessoais',
        '5. Crie uma nova senha segura'
      ],
      nextStepsTitle: '🚀 Próximos passos:',
      nextSteps: [
        'Complete seu perfil com informações pessoais',
        'Agende sua primeira aula experimental',
        'Conheça nossa equipe e instalações',
        'Tire todas suas dúvidas conosco'
      ],
      contactTitle: '📞 Precisa de ajuda?',
      contactInfo: 'Entre em contato conosco:',
      phone: 'WhatsApp: +1(438)274-8396',
      email: 'E-mail: josi@josopilates.com',
      excitement: 'Estamos muito felizes em recebê-lo em nossa comunidade!',
      closing: 'Bem-vindo à família Josi Pilates!',
      signature: 'Com carinho,',
      teamName: 'Equipe Josi Pilates',
    },
    en: {
      subject: 'Welcome to Josi Pilates! Your account has been created 🎉',
      greeting: (name) => `Hello, ${name}!`,
      welcomeTitle: '🎉 Welcome to Josi Pilates!',
      accountCreated: 'Your account has been created successfully!',
      defaultPassword: 'Your temporary password is: <strong>000000</strong>',
      setPasswordButton: 'Set Your Password',
      importantInstructions: '📋 Important instructions:',
      instructions: [
        '1. Visit our website: https://josipilates.com',
        '2. Click "Student Portal" to log in',
        '3. Use your email and the temporary password above',
        '4. Complete your personal information',
        '5. Create a new secure password'
      ],
      nextStepsTitle: '🚀 Next steps:',
      nextSteps: [
        'Complete your profile with personal information',
        'Schedule your first trial class',
        'Meet our team and facilities',
        'Ask us any questions you have'
      ],
      contactTitle: '📞 Need help?',
      contactInfo: 'Contact us:',
      phone: 'WhatsApp: +1(438)274-8396',
      email: 'Email: josi@josopilates.com',
      excitement: 'We are very happy to welcome you to our community!',
      closing: 'Welcome to the Josi Pilates family!',
      signature: 'With care,',
      teamName: 'Josi Pilates Team',
    },
    fr: {
      subject: 'Bienvenue chez Josi Pilates! Votre compte a été créé 🎉',
      greeting: (name) => `Bonjour, ${name}!`,
      welcomeTitle: '🎉 Bienvenue chez Josi Pilates!',
      accountCreated: 'Votre compte a été créé avec succès!',
      defaultPassword: 'Votre mot de passe temporaire est: <strong>000000</strong>',
      setPasswordButton: 'Définir Votre Mot de Passe',
      importantInstructions: '📋 Instructions importantes:',
      instructions: [
        '1. Visitez notre site web: https://josipilates.com',
        '2. Cliquez sur "Student Portal" pour vous connecter',
        '3. Utilisez votre e-mail et le mot de passe temporaire ci-dessus',
        '4. Complétez vos informations personnelles',
        '5. Créez un nouveau mot de passe sécurisé'
      ],
      nextStepsTitle: '🚀 Prochaines étapes:',
      nextSteps: [
        'Complétez votre profil avec des informations personnelles',
        'Planifiez votre premier cours d\'essai',
        'Rencontrez notre équipe et nos installations',
        'Posez-nous toutes vos questions'
      ],
      contactTitle: '📞 Besoin d\'aide?',
      contactInfo: 'Contactez-nous:',
      phone: 'WhatsApp: +1(438)274-8396',
      email: 'E-mail: josi@josopilates.com',
      excitement: 'Nous sommes très heureux de vous accueillir dans notre communauté!',
      closing: 'Bienvenue dans la famille Josi Pilates!',
      signature: 'Avec soin,',
      teamName: 'Équipe Josi Pilates',
    }
  },

  studentWelcomeSelfSignup: {
    pt: {
      subject: 'Bem-vindo ao Josi Pilates! 🎉',
      greeting: (name) => `Olá, ${name}!`,
      welcomeTitle: '🎉 Bem-vindo ao Josi Pilates!',
      accountCreated: 'Sua conta foi criada com sucesso!',
      nextStepsTitle: '🚀 Próximos passos:',
      nextSteps: [
        'Agende sua primeira aula experimental',
        'Conheça nossa equipe e instalações',
        'Tire todas suas dúvidas conosco'
      ],
      contactTitle: '📞 Precisa de ajuda?',
      contactInfo: 'Entre em contato conosco:',
      phone: 'WhatsApp: +1(438)274-8396',
      email: 'E-mail: josi@josopilates.com',
      excitement: 'Estamos muito felizes em recebê-lo em nossa comunidade!',
      closing: 'Bem-vindo à família Josi Pilates!',
      signature: 'Com carinho,',
      teamName: 'Equipe Josi Pilates',
    },
    en: {
      subject: 'Welcome to Josi Pilates! 🎉',
      greeting: (name) => `Hello, ${name}!`,
      welcomeTitle: '🎉 Welcome to Josi Pilates!',
      accountCreated: 'Your account has been created successfully!',
      nextStepsTitle: '🚀 Next steps:',
      nextSteps: [
        'Schedule your first trial class',
        'Meet our team and facilities',
        'Ask us any questions you have'
      ],
      contactTitle: '📞 Need help?',
      contactInfo: 'Contact us:',
      phone: 'WhatsApp: +1(438)274-8396',
      email: 'Email: josi@josopilates.com',
      excitement: 'We are very happy to welcome you to our community!',
      closing: 'Welcome to the Josi Pilates family!',
      signature: 'With care,',
      teamName: 'Josi Pilates Team',
    },
    fr: {
      subject: 'Bienvenue chez Josi Pilates! 🎉',
      greeting: (name) => `Bonjour, ${name}!`,
      welcomeTitle: '🎉 Bienvenue chez Josi Pilates!',
      accountCreated: 'Votre compte a été créé avec succès!',
      nextStepsTitle: '🚀 Prochaines étapes:',
      nextSteps: [
        'Planifiez votre premier cours d\'essai',
        'Rencontrez notre équipe et nos installations',
        'Posez-nous toutes vos questions'
      ],
      contactTitle: '📞 Besoin d\'aide?',
      contactInfo: 'Contactez-nous:',
      phone: 'WhatsApp: +1(438)274-8396',
      email: 'E-mail: josi@josopilates.com',
      excitement: 'Nous sommes très heureux de vous accueillir dans notre communauté!',
      closing: 'Bienvenue dans la famille Josi Pilates!',
      signature: 'Avec soin,',
      teamName: 'Équipe Josi Pilates',
    }
  },

  rules: {
    pt: {
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
      stayHydratedDesc: 'Beba água antes e depois das aulas para manter o corpo hidratado.'
    },
    en: {
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
      stayHydratedDesc: 'Drink water before and after classes to keep your body hydrated.'
    },
    fr: {
      title: '📋 Règles du Studio Josi Pilates',
      classDuration: '⏱️ Durée des Cours',
      classDurationText: 'Chaque cours dure 55 minutes, incluant l\'échauffement, les exercices principaux et la relaxation finale.',
      arrivalPolicy: '⏰ Politique d\'Arrivée',
      arrivalPolicyText: 'Nous vous demandons gentiment d\'arriver au moins 5 minutes avant le début de votre cours.',
      arrivalPolicyDetail: 'Ce temps supplémentaire permet une transition fluide entre les cours et garantit que vous pouvez vous préparer correctement.',
      cancellationPolicy: '📅 Politique d\'Annulation',
      cancellationPolicyText: 'Les annulations doivent être faites au moins 24 heures à l\'avance.',
      cancellationPolicyDetail: 'Le non-respect de cette politique entraînera la perte du cours.',
      cancellationWarning: '⚠️ IMPORTANT: Les cours non annulés dans la fenêtre de 24 heures seront facturés normalement.',
      additionalGuidelines: '💡 Directives Supplémentaires',
      wearComfortableClothing: 'Portez des vêtements confortables',
      wearComfortableClothingDesc: 'Portez des vêtements légers et confortables qui permettent un mouvement libre.',
      stayHydrated: 'Restez hydraté',
      stayHydratedDesc: 'Buvez de l\'eau avant et après les cours pour garder votre corps hydraté.'
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