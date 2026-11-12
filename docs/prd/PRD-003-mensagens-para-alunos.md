# PRD-003 — Mensagens para os alunos (nova tela de emails)
**Josi Pilates Management System — Brownfield Enhancement**
**Data:** 2026-11-12 | **Status:** Aprovado pelo usuário (2026-11-12) | **Epic:** 4

---

## 1. Problema & Contexto

A tela **Notificações por email** (`src/pages/EmailNotifications.jsx`, rota `/teacher/email-notifications`) é a forma de a professora mandar avisos aos alunos. Ela foi montada aos poucos e ficou confusa e arriscada:

- **4 abas que se sobrepõem:** "Disparo Rápido" (aviso de saldo baixo) repete o filtro "Créditos baixos" da aba "E-mail Customizado"; os "Modelos" ficam numa aba separada de onde se escreve.
- **Bug:** o filtro "Turma específica" manda para **todos** os alunos (`getFilteredStudents`, caso `class`: `filtered = students`).
- **Sem confirmação e sem pré-visualização:** um clique manda para a lista inteira, sem ver como o email chega.
- **"Todos os alunos" inclui inativos** (a consulta não filtra `is_active`).
- **Filtro "Dia de matrícula"** usa o dia da semana em que a conta foi criada: não tem uso real.
- **Modelos fracos:** a maioria só preenche uma frase com "[Nome]" (e repete o "Olá" que o email já coloca); saem numa língua só. Só o `profileUpdate` (PR #47) tem texto completo em pt/en/fr e sai na língua de cada aluno.
- **Histórico:** agrupa por milissegundo (cada aluno vira uma linha) e carrega a tabela `email_notifications` inteira.
- **Envio no navegador:** um email por vez, em sequência; fechar a página interrompe.

## 2. Objetivos

| # | Objetivo | Métrica de sucesso |
|---|----------|--------------------|
| 1 | Mandar uma mensagem para um grupo sem erro de destinatário | Contagem e lista certas antes de enviar; zero envio para quem não estava no filtro |
| 2 | Cada aluno recebe na sua língua | Texto pt/en/fr escolhido por `preferred_language` |
| 3 | Ver antes de mandar | Pré-visualização por língua + "mandar teste para mim" + confirmação |
| 4 | Saber o que foi enviado | Histórico com uma linha por envio, destinatários e falhas; reenviar para quem falhou |
| 5 | Envio não depende da página aberta | Envio continua no servidor (fase final) |

## 3. Requisitos Funcionais

### FR-01 — Para quem
Ativos por padrão (opção "incluir inativos"). Grupos: todos; créditos baixos (limite ajustável); créditos zerados; uma turma; escolher na lista. Mostra a contagem, quantos em pt/en/fr e a lista (com busca para tirar alguém).

### FR-02 — O quê
Começar de um modelo ou em branco. Assunto e mensagem em abas **PT / EN / FR**; cada aluno recebe a da sua língua. Língua vazia → usa o texto pt (com aviso). Variáveis: `{nome}` (primeiro nome), `{creditos}` (total de créditos). Saudação e assinatura automáticas (como hoje).

### FR-03 — Revisar e enviar
Pré-visualização do email como o aluno vê, em cada língua, com um aluno de exemplo. "Mandar teste para mim" (email da professora). Confirmação: "Enviar para N alunos (x PT, y EN, z FR)?". Barra de progresso e resumo no fim.

### FR-04 — Histórico
Uma linha por envio: data, assunto, tipo, enviados/falhas. Abrir mostra destinatários e erros. "Reenviar para quem falhou". Paginado.

### FR-05 — Modelos
Poucos e completos em pt/en/fr: **Aviso geral** (em branco com saudação), **Créditos baixos**, **Créditos zerados**, **Mudança de horário**, **Atualizar cadastro** (`profileUpdate`), **Termo de consentimento** (com PDF, fluxo atual). Os demais saem da tela.

## 4. Não-Funcionais
- Textos de tela em pt/en/fr. Celular ok.
- Envio passa sempre pela `send-email` (regras de papel já em produção) ou por Edge Function nova revisada pelo dev-critico.
- Mensagem da professora vira HTML escapado (sem HTML livre), quebras de linha viram `<br>`.
- Sem dados pessoais nos logs das Edge Functions.

## 5. Fora de escopo
- Emails automáticos (cron) — continuam desligados (decisão anterior).
- SMS / WhatsApp.
- Editor rico (negrito, imagens).

## 6. Stories (uma por sessão, nesta ordem)

| Story | Título | Esforço | Banco/Edge |
|-------|--------|---------|------------|
| 4.1 | Correções urgentes da tela atual | medium | não |
| 4.2 | Tela "Nova mensagem" em 3 passos | medium | não |
| 4.3 | Modelos trilíngues, variáveis, pré-visualização e teste | medium | não |
| 4.4 | Registro de envios e histórico por envio | **dev-critico** | migration |
| 4.5 | Envio pelo servidor | **dev-critico** | Edge Function |

O email "Atualizar cadastro" pode ser enviado depois da 4.1 (já sai na língua de cada aluno desde o PR #47).
