import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center">Política de Privacidade</CardTitle>
            <p className="text-center text-muted-foreground">Studio Josi Pilates</p>
          </CardHeader>
          <CardContent className="prose max-w-none">
            <p className="text-sm text-muted-foreground mb-6">
              Última atualização: {new Date().toLocaleDateString('pt-BR')}
            </p>

            <h2>1. Introdução</h2>
            <p>
              Bem-vindo ao Studio Josi Pilates. Esta Política de Privacidade explica como coletamos,
              usamos, divulgamos e protegemos suas informações quando você usa nosso aplicativo e serviços.
            </p>

            <h2>2. Informações que Coletamos</h2>
            <h3>2.1 Informações Fornecidas por Você</h3>
            <ul>
              <li>Nome completo</li>
              <li>Endereço de e-mail</li>
              <li>Número de telefone</li>
              <li>Informações de perfil (preferências de idioma, etc.)</li>
              <li>Informações de aulas e agendamentos</li>
            </ul>

            <h3>2.2 Informações Coletadas Automaticamente</h3>
            <ul>
              <li>Dados de uso do aplicativo</li>
              <li>Informações do dispositivo</li>
              <li>Cookies e tecnologias similares</li>
            </ul>

            <h3>2.3 Informações de Terceiros</h3>
            <ul>
              <li>Dados do Google quando você faz login com sua conta Google</li>
            </ul>

            <h2>3. Como Usamos Suas Informações</h2>
            <p>Usamos suas informações para:</p>
            <ul>
              <li>Fornecer e gerenciar seus serviços de pilates</li>
              <li>Processar inscrições e pagamentos</li>
              <li>Enviar notificações importantes sobre aulas</li>
              <li>Melhorar nossos serviços</li>
              <li>Cumprir obrigações legais</li>
            </ul>

            <h2>4. Compartilhamento de Informações</h2>
            <p>
              Não vendemos, alugamos ou compartilhamos suas informações pessoais com terceiros,
              exceto nas seguintes circunstâncias:
            </p>
            <ul>
              <li>Com seu consentimento explícito</li>
              <li>Para fornecer serviços (por exemplo, processamento de pagamentos)</li>
              <li>Quando exigido por lei</li>
              <li>Para proteger nossos direitos e segurança</li>
            </ul>

            <h2>5. Segurança dos Dados</h2>
            <p>
              Implementamos medidas de segurança técnicas e organizacionais apropriadas para proteger
              suas informações pessoais contra acesso não autorizado, alteração, divulgação ou destruição.
            </p>

            <h2>6. Seus Direitos</h2>
            <p>Você tem o direito de:</p>
            <ul>
              <li>Acessar suas informações pessoais</li>
              <li>Corrigir informações inexatas</li>
              <li>Solicitar exclusão de seus dados</li>
              <li>Optar por não receber comunicações de marketing</li>
            </ul>

            <h2>7. Cookies</h2>
            <p>
              Usamos cookies para melhorar sua experiência no aplicativo. Você pode controlar
              o uso de cookies através das configurações do seu navegador.
            </p>

            <h2>8. Alterações a Esta Política</h2>
            <p>
              Podemos atualizar esta Política de Privacidade periodicamente. Notificaremos você
              sobre mudanças significativas através do aplicativo ou por e-mail.
            </p>

            <h2>9. Contato</h2>
            <p>
              Se você tiver dúvidas sobre esta Política de Privacidade, entre em contato conosco:
            </p>
            <ul>
              <li>E-mail: josipilatesmontreal@gmail.com</li>
              <li>Telefone: +1(438)274-8396</li>
              <li>Endereço: Studio Josi Pilates, Montreal</li>
            </ul>

            <div className="mt-8 text-center">
              <Link to="/">
                <Button variant="outline">Voltar ao Início</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PrivacyPolicy;