import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Calendar, AlertTriangle, Heart, Gift, CheckCircle } from 'lucide-react';

const EmailTemplates = ({ onSelectTemplate, selectedTemplateId }) => {
  const templates = [
    {
      id: 'welcome',
      title: 'Boas-vindas',
      description: 'Mensagem de boas-vindas para novos alunos',
      icon: Heart,
      color: 'text-pink-600',
      subject: 'Bem-vindo(a) ao Josi Pilates! 🧘‍♀️',
      message: `Olá!

É com grande alegria que damos as boas-vindas ao Josi Pilates! 🎉

Estamos muito felizes em tê-lo(a) conosco nesta jornada de bem-estar e saúde. Nossa equipe está preparada para oferecer o melhor atendimento e acompanhamento personalizado.

Próximos passos:
• Agende sua primeira aula experimental
• Conheça nossa equipe de instrutores qualificados
• Tire todas suas dúvidas conosco

Estamos ansiosos para conhecê-lo(a) pessoalmente!

Namastê! 🙏`,
      category: 'welcome'
    },
    {
      id: 'class_reminder',
      title: 'Lembrete de Aula',
      description: 'Lembrete para aulas agendadas',
      icon: Calendar,
      color: 'text-blue-600',
      subject: 'Lembrete: Sua aula de Pilates é amanhã! 📅',
      message: `Olá!

Este é um lembrete amigável sobre sua aula de Pilates agendada para amanhã.

Detalhes da aula:
• Data: [DATA]
• Horário: [HORÁRIO]
• Tipo: [TIPO_AULA]
• Instrutor(a): [INSTRUTOR]

Lembre-se de:
✓ Chegar 10 minutos antes
✓ Trazer uma toalha
✓ Usar roupas confortáveis
✓ Hidratar-se bem

Mal podemos esperar para vê-lo(a) na aula!`,
      category: 'reminder'
    },
    {
      id: 'low_credits_gentle',
      title: 'Saldo Baixo (Gentil)',
      description: 'Aviso gentil sobre saldo baixo de créditos',
      icon: AlertTriangle,
      color: 'text-orange-600',
      subject: 'Seus créditos estão acabando - Vamos renovar? 💪',
      message: `Olá!

Esperamos que você esteja aproveitando suas aulas de Pilates! 

Notamos que seus créditos estão chegando ao fim. Para continuar sua jornada de bem-estar sem interrupções, que tal renovar seu pacote?

Créditos restantes: [CREDITOS]

Benefícios de renovar agora:
• Continuidade no seu progresso
• Manutenção da sua rotina saudável
• Preços especiais para renovação

Entre em contato conosco para renovar ou tire suas dúvidas!

Estamos aqui para apoiar você! 💚`,
      category: 'credits'
    },
    {
      id: 'promotion',
      title: 'Promoção Especial',
      description: 'Anúncio de promoções e ofertas especiais',
      icon: Gift,
      color: 'text-purple-600',
      subject: 'Oferta Especial: Pacote de Créditos com Desconto! 🎁',
      message: `Olá!

Temos uma oferta especial só para você! 🎉

🎁 PROMOÇÃO LIMITADA:
• [DETALHES_PROMOCAO]
• Válida até: [DATA_LIMITE]
• Desconto de: [PERCENTUAL]%

Esta é uma oportunidade única para:
✓ Economizar em seus créditos
✓ Garantir mais aulas por um preço especial
✓ Manter sua rotina de exercícios

Não perca esta chance! Entre em contato conosco hoje mesmo.

Aproveite e cuide da sua saúde com economia! 💰`,
      category: 'promotion'
    },
    {
      id: 'schedule_change',
      title: 'Mudança de Horário',
      description: 'Comunicado sobre alterações de horários',
      icon: Calendar,
      color: 'text-red-600',
      subject: 'Importante: Alteração no horário da sua aula 📅',
      message: `Olá!

Precisamos informar sobre uma alteração no horário da sua aula.

ALTERAÇÃO:
• Aula original: [HORARIO_ORIGINAL]
• Novo horário: [NOVO_HORARIO]
• Data: [DATA]
• Motivo: [MOTIVO]

O que fazer:
✓ Confirme se o novo horário funciona para você
✓ Entre em contato se precisar reagendar
✓ Chegue 10 minutos antes no novo horário

Pedimos desculpas por qualquer inconveniente e agradecemos sua compreensão.

Nos vemos na aula! 🧘‍♀️`,
      category: 'schedule'
    },
    {
      id: 'birthday',
      title: 'Parabéns - Aniversário',
      description: 'Mensagem de parabéns para aniversariantes',
      icon: Gift,
      color: 'text-pink-600',
      subject: 'Parabéns pelo seu aniversário! 🎂🎉',
      message: `Parabéns! 🎉

Hoje é um dia muito especial - seu aniversário! 🎂

Toda a equipe do Josi Pilates deseja:
• Muita saúde e felicidade
• Conquistas e realizações
• Momentos de paz e bem-estar
• Muito amor e alegria

Como presente, preparamos uma surpresa especial para você! Entre em contato conosco para descobrir.

Que este novo ano de vida seja repleto de movimento, equilíbrio e muita energia positiva!

Feliz aniversário! 🎈✨`,
      category: 'special'
    },
    {
      id: 'feedback_request',
      title: 'Solicitação de Feedback',
      description: 'Pedido de avaliação e sugestões',
      icon: FileText,
      color: 'text-green-600',
      subject: 'Sua opinião é muito importante para nós! 💭',
      message: `Olá!

Esperamos que você esteja amando suas aulas de Pilates conosco! 

Sua opinião é fundamental para continuarmos melhorando nossos serviços. Gostaríamos muito de saber:

📝 Como tem sido sua experiência?
📝 O que você mais gosta nas aulas?
📝 Há algo que podemos melhorar?
📝 Recomendaria nosso studio para amigos?

Suas sugestões nos ajudam a:
• Aprimorar nossos serviços
• Criar novas modalidades
• Melhorar o atendimento
• Proporcionar a melhor experiência

Responda este e-mail ou fale conosco pessoalmente. Sua opinião faz toda a diferença!

Obrigado por fazer parte da família Josi Pilates! 💚`,
      category: 'feedback'
    }
  ];

  const getCategoryBadge = (category) => {
    const categoryMap = {
      welcome: { label: 'Boas-vindas', variant: 'default' },
      reminder: { label: 'Lembrete', variant: 'secondary' },
      credits: { label: 'Créditos', variant: 'destructive' },
      promotion: { label: 'Promoção', variant: 'default' },
      schedule: { label: 'Horário', variant: 'outline' },
      special: { label: 'Especial', variant: 'default' },
      feedback: { label: 'Feedback', variant: 'secondary' }
    };
    
    const config = categoryMap[category] || { label: category, variant: 'outline' };
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
        <h4 className="font-medium text-blue-900 mb-2">💡 Dicas para usar os templates:</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Personalize as mensagens com informações específicas dos alunos</li>
          <li>• Substitua os campos entre [COLCHETES] pelas informações reais</li>
          <li>• Adapte o tom da mensagem conforme necessário</li>
          <li>• Sempre revise antes de enviar</li>
        </ul>
      </div>
    </div>
  );
};

export default EmailTemplates;

