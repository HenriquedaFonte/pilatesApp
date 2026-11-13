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
        'Mande uma mensagem pelo WhatsApp: {phone}',
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
        'Send us a message on WhatsApp: {phone}',
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
        'Envoyez-nous un message sur WhatsApp : {phone}',
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
      contactPhone: 'Mande uma mensagem pelo WhatsApp: {phone}',
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
      contactPhone: 'Send us a message on WhatsApp: {phone}',
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
      contactPhone: 'Envoyez-nous un message sur WhatsApp : {phone}',
      contactEmail: 'E-mail: {email}',
      excitementMessage: 'Nous sommes impatients de vous rencontrer en personne et de vous aider à atteindre vos objectifs de santé et de bien-être!',
      signature: 'Avec soin,',
      teamName: 'Équipe Josi Pilates',
      tagline: 'Transformer les vies à travers le mouvement'
    }
  },

  // Mensagens escritas da tela Notificações por email (Story 4.3): assunto e
  // mensagem completos em pt/en/fr. A saudação ("Olá, Nome!") e a assinatura
  // entram sozinhas. Entre chaves: {nome} e {creditos} são preenchidos; os
  // outros (ex.: {horário novo}) a professora troca antes de enviar.
  zeroCreditsNotice: {
    pt: {
      subject: 'Seus créditos acabaram - Josi Pilates',
      message: `Seus créditos de aulas acabaram.

Para continuar vindo às aulas sem interrupção, é só renovar o seu pacote. Fale com a gente na próxima aula ou pelo telefone +1 (438) 274-8396.

Seu saldo aparece sempre no Portal do Aluno, em josipilates.com/login.

Até breve!`
    },
    en: {
      subject: 'Your credits have run out - Josi Pilates',
      message: `Your class credits have run out.

To keep coming to class without a break, just renew your package. Talk to us at your next class or call +1 (438) 274-8396.

You can always see your balance in the Student Portal at josipilates.com/login.

See you soon!`
    },
    fr: {
      subject: 'Vos crédits sont épuisés - Josi Pilates',
      message: `Vos crédits de cours sont épuisés.

Pour continuer à venir aux cours sans interruption, il suffit de renouveler votre forfait. Parlez-nous-en à votre prochain cours ou appelez le +1 (438) 274-8396.

Votre solde est toujours affiché dans le Portail de l'élève, sur josipilates.com/login.

À bientôt !`
    }
  },

  scheduleChangeNotice: {
    pt: {
      subject: 'Mudança no horário da sua aula - Josi Pilates',
      message: `Precisamos mudar o horário da sua aula.

Antes: {horário antigo}
Agora: {horário novo}

Se o novo horário não funcionar para você, fale com a gente que procuramos outra opção.

Obrigada pela compreensão!`
    },
    en: {
      subject: 'Change to your class time - Josi Pilates',
      message: `We need to change the time of your class.

Before: {old time}
Now: {new time}

If the new time does not work for you, let us know and we will find another option.

Thank you for your understanding!`
    },
    fr: {
      subject: 'Changement d\'horaire de votre cours - Josi Pilates',
      message: `Nous devons changer l'horaire de votre cours.

Avant : {ancien horaire}
Maintenant : {nouvel horaire}

Si le nouvel horaire ne vous convient pas, dites-le-nous et nous trouverons une autre option.

Merci de votre compréhension !`
    }
  },

  // Pedido de atualização do cadastro (seguro saúde etc.).
  // subject/message completos em cada língua (cada aluno recebe na sua).
  profileUpdate: {
    pt: {
      subject: 'Atualize seu cadastro no Josi Pilates',
      message: `Estamos atualizando o cadastro dos alunos e contamos com a sua ajuda.

O studio sempre emitiu recibos para o seu seguro saúde, mas até agora era tudo feito à mão. Agora o processo fica automático: os recibos saem direto pelo sistema, com os dados do seu cadastro. Para isso, entre no Portal do Aluno em josipilates.com/login?lng=pt e clique em "Perfil". Lá, confira ou complete:

• Telefone (depois clique em "Salvar Alterações")
• Data de Nascimento, se ainda estiver vazia (depois clique em "Salvar Alterações" e confirme). Confira bem a data: depois de salva, só a Josi pode corrigir.
• Seguro saúde: nº da apólice e cidade/província (depois clique em "Salvar dados do seguro")
• Se você não for o titular da apólice: desligue "Eu sou o titular da apólice" e preencha os dados do titular

Os dados do seguro são opcionais: preencha só se quiser receber recibos para o seu seguro.

Não lembra a senha? Na tela de entrada, clique em "Esqueceu a senha?" e você recebe um link por email para criar uma nova.

Obrigada!`
    },
    en: {
      subject: 'Please update your Josi Pilates profile',
      message: `We are updating our students' records and would appreciate your help.

The studio has always issued receipts for your health insurance, but until now it was all done by hand. From now on the process is automatic: receipts are generated directly by the system, using the details in your profile. To make this work, sign in to the Student Portal at josipilates.com/login?lng=en and click "Profile". There, check or complete:

• Phone number (then click "Save Changes")
• Date of Birth, if it is still empty (then click "Save Changes" and confirm). Check the date carefully: once saved, only Josi can correct it.
• Health insurance: policy number and city/province (then click "Save insurance details")
• If you are not the policyholder: turn off "I am the policyholder" and fill in the policyholder's details

The insurance details are optional: fill them in only if you want receipts for your insurance.

Forgot your password? On the sign-in page, click "Forgot your password?" and you will receive a link by email to create a new one.

Thank you!`
    },
    fr: {
      subject: 'Mettez à jour votre profil Josi Pilates',
      message: `Nous mettons à jour les dossiers de nos élèves et comptons sur votre aide.

Le studio a toujours émis des reçus pour votre assurance santé, mais jusqu'à présent tout se faisait à la main. Désormais, le processus est automatique : les reçus sortent directement du système, avec les informations de votre profil. Pour cela, connectez-vous au Portail de l'élève sur josipilates.com/login?lng=fr et cliquez sur « Profil ». Vérifiez ou complétez :

• Numéro de téléphone (puis cliquez sur « Sauvegarder les Modifications »)
• Date de Naissance, si elle est encore vide (puis cliquez sur « Sauvegarder les Modifications » et confirmez). Vérifiez bien la date : une fois enregistrée, seule Josi pourra la corriger.
• Assurance santé : numéro de police et ville/province (puis cliquez sur « Enregistrer l'assurance »)
• Si vous n'êtes pas le titulaire de la police : désactivez « Je suis le titulaire de la police » et remplissez les informations du titulaire

Les informations d'assurance sont facultatives : remplissez-les seulement si vous voulez des reçus pour votre assurance.

Mot de passe oublié ? Sur la page de connexion, cliquez sur « Mot de passe oublié ? » et vous recevrez un lien par courriel pour en créer un nouveau.

Merci !`
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
      greeting: (name) => `Olá, ${name}!`,
      message: 'Notamos que você não possui créditos disponíveis para aulas.',
      warning: 'Para continuar aproveitando nossas aulas de Pilates, é necessário adquirir novos créditos.',
      contactTitle: '💡 Como renovar seus créditos:',
      contactItems: [
        'Mande uma mensagem pelo WhatsApp: {phone}',
        'Envie o valor do seu pacote de aulas para o interac pilatesmontreal@gmail.com',
        'Visite nosso studio durante o horário de funcionamento'
      ],
      closing: 'Estamos aqui para ajudar você a manter sua rotina de exercícios e bem-estar!',
      signature: 'Atenciosamente,',
      teamName: 'Equipe Josi Pilates',
      tagline: 'Cuidando do seu bem-estar com carinho e profissionalismo'
    },
    en: {
      id: 'zero_credits',
      title: 'Zero Credits - Purchase Required',
      subject: 'Notice: You have no credits remaining - Josi Pilates',
      greeting: (name) => `Hello, ${name}!`,
      message: 'We notice that you have no credits available for classes.',
      warning: 'To continue enjoying our Pilates classes, you need to purchase new credits.',
      contactTitle: '💡 How to renew your credits:',
      contactItems: [
        'Send us a message on WhatsApp: {phone}',
        'Send the amount for your class package via Interac to pilatesmontreal@gmail.com.',
        'Visit our studio during business hours'
      ],
      closing: 'We are here to help you maintain your exercise routine and well-being!',
      signature: 'Best regards,',
      teamName: 'Josi Pilates Team',
      tagline: 'Caring for your well-being with care and professionalism'
    },
    fr: {
      id: 'zero_credits',
      title: 'Sans Crédits - Achat Requis',
      subject: 'Avis: Vous n\'avez plus de crédits - Josi Pilates',
      greeting: (name) => `Bonjour, ${name}!`,
      message: 'Nous remarquons que vous n\'avez plus de crédits disponibles pour les cours.',
      warning: 'Pour continuer à profiter de nos cours de Pilates, vous devez acheter de nouveaux crédits.',
      contactTitle: '💡 Comment renouveler vos crédits:',
      contactItems: [
        'Envoyez-nous un message sur WhatsApp : {phone}',
        'Envoyez le montant de votre forfait de cours via Interac à pilatesmontreal@gmail.com.',
        'Visitez notre studio pendant les heures d\'ouverture'
      ],
      closing: 'Nous sommes là pour vous aider à maintenir votre routine d\'exercice et votre bien-être!',
      signature: 'Cordialement,',
      teamName: 'Équipe Josi Pilates',
      tagline: 'Prendre soin de votre bien-être avec soin et professionnalisme'
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
      excitement: 'Até a próxima aula!',
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
      excitement: 'See you at the next class!',
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
      excitement: 'À la prochaine cours!',
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
      phone: 'Mande uma mensagem pelo WhatsApp: +1(438)274-8396',
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
      phone: 'Send us a message on WhatsApp: +1(438)274-8396',
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
      phone: 'Envoyez-nous un message sur WhatsApp : +1(438)274-8396',
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
      phone: 'Mande uma mensagem pelo WhatsApp: +1(438)274-8396',
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
      phone: 'Send us a message on WhatsApp: +1(438)274-8396',
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
      phone: 'Envoyez-nous un message sur WhatsApp : +1(438)274-8396',
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
  },

  consentForm: {
    pt: {
      id: 'consent_form',
      title: '📄 Formulário de Consentimento - Josi Pilates',
      subject: 'Formulário de Consentimento - Josi Pilates',
      greeting: (name) => `Olá, ${name}!`,
      introduction: 'Para garantir que você tenha todas as informações necessárias sobre nossas aulas de Pilates, estamos enviando o formulário de consentimento e políticas das aulas.',
      instructionsTitle: '📋 Instruções para preenchimento:',
      instructions: [
        '1. Baixe o arquivo PDF anexado a este e-mail',
        '2. Leia atentamente todas as informações',
        '3. Preencha os campos necessários',
        '4. Assine o documento digitalmente',
        '5. Envie o documento preenchido e assinado de volta para nós'
      ],
      returnInstructions: '📧 Como devolver o formulário:',
      returnMethods: [
        'Envie por e-mail para: josi@josipilates.com'
      ],
      importance: 'Este formulário é obrigatório para participar das aulas e contém informações importantes sobre:',
      importantPoints: [
        'Políticas e regras do studio',
        'Termos de responsabilidade',
        'Informações sobre saúde e contraindicações',
        'Direitos e deveres dos alunos'
      ],
      questions: 'Se tiver alguma dúvida sobre o preenchimento do formulário, não hesite em nos contactar.',
      closing: 'Agradecemos sua atenção e estamos ansiosos para recebê-lo(a) em nossas aulas!',
      signature: 'Atenciosamente,',
      teamName: 'Equipe Josi Pilates',
      attachmentNote: '📎 Anexo: PilatesLessonsPolicies.pdf'
    },
    en: {
      id: 'consent_form',
      title: '📄 Consent Form - Josi Pilates',
      subject: 'Consent Form - Josi Pilates',
      greeting: (name) => `Hello, ${name}!`,
      introduction: 'To ensure you have all the necessary information about our Pilates classes, we are sending you the consent form and class policies.',
      instructionsTitle: '📋 Instructions for completion:',
      instructions: [
        '1. Download the PDF file attached to this email',
        '2. Read all information carefully',
        '3. Fill in the required fields',
        '4. Sign the document digitally',
        '5. Send the completed and signed document back to us'
      ],
      returnInstructions: '📧 How to return the form:',
      returnMethods: [
        'Send by email to: josi@josipilates.com'
      ],
      importance: 'This form is mandatory to participate in classes and contains important information about:',
      importantPoints: [
        'Studio policies and rules',
        'Terms of liability',
        'Health information and contraindications',
        'Student rights and responsibilities'
      ],
      questions: 'If you have any questions about filling out the form, please do not hesitate to contact us.',
      closing: 'Thank you for your attention and we look forward to welcoming you to our classes!',
      signature: 'Best regards,',
      teamName: 'Josi Pilates Team',
      attachmentNote: '📎 Attachment: PilatesLessonsPolicies.pdf'
    },
    fr: {
      id: 'consent_form',
      title: '📄 Formulaire de Consentement - Josi Pilates',
      subject: 'Formulaire de Consentement - Josi Pilates',
      greeting: (name) => `Bonjour, ${name}!`,
      introduction: 'Pour vous assurer que vous disposez de toutes les informations nécessaires sur nos cours de Pilates, nous vous envoyons le formulaire de consentement et les politiques de cours.',
      instructionsTitle: '📋 Instructions de remplissage:',
      instructions: [
        '1. Téléchargez le fichier PDF joint à cet e-mail',
        '2. Lisez attentivement toutes les informations',
        '3. Remplissez les champs requis',
        '4. Signez le document numériquement',
        '5. Renvoyez-nous le document rempli et signé'
      ],
      returnInstructions: '📧 Comment retourner le formulaire:',
      returnMethods: [
        'Envoyez par e-mail à: josi@josipilates.com'
      ],
      importance: 'Ce formulaire est obligatoire pour participer aux cours et contient des informations importantes sur:',
      importantPoints: [
        'Politiques et règles du studio',
        'Conditions de responsabilité',
        'Informations sur la santé et contre-indications',
        'Droits et devoirs des étudiants'
      ],
      questions: 'Si vous avez des questions sur le remplissage du formulaire, n\'hésitez pas à nous contacter.',
      closing: 'Nous vous remercions de votre attention et nous sommes impatients de vous accueillir dans nos cours!',
      signature: 'Cordialement,',
      teamName: 'Équipe Josi Pilates',
      attachmentNote: '📎 Pièce jointe: PilatesLessonsPolicies.pdf'
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