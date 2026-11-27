# Plano: texto novo do email "Créditos zerados" + envio rápido pelo card do aluno
Data: 2026-11-27 · Branch: `feat/email-creditos-zerados` (criar a partir do `main` atualizado)

## Objetivo
1. O modelo "Créditos zerados" (E-mails → Nova mensagem) passa a ter o texto novo da Josi, em pt, en e fr.
2. Na lista de Alunos, o menu ⋮ do card de um aluno sem créditos ganha "Email de créditos zerados": a professora confirma ("Enviar o email de créditos zerados para NOME?") e o email sai na língua do aluno, com o texto do modelo, sem editar nada, e fica no Histórico de E-mails.

## Decisões (com justificativa)
- **Um PR só.** Os dois pedidos são o mesmo assunto (o email de créditos zerados) e o botão manda exatamente o texto novo. Um PR = uma passada do `revisor` e um ciclo de testes. O PR #88 (layout dos cards) **já foi mergeado** no `main` (commit `44453a8`): não há mais conflito, basta criar a branch do `main` atualizado. Alternativa, se o dono preferir: PR A = passos 1–2 (texto), PR B = passos 3–6 (menu).
- **Sem Edge Function e sem SQL.** "Créditos zerados" é um modelo de texto (`email_type = 'custom'`): o assunto e a mensagem vão gravados na linha de `email_campaigns` e a `send-campaign` só monta o HTML com eles. `supabase/functions/send-campaign/texts.ts` não tem texto de créditos zerados (só créditos baixos, termo e saudação/assinatura). Logo, **não há deploy**.
- **Onde fica o botão: item no menu ⋮ (recomendado).** O rodapé do card (Ver / Saldo / Turmas / ⋮) já está no limite de largura no iPad em pé (motivo do PR #88). Item de menu não ocupa espaço e fica junto de "Resetar senha", que é outra ação que manda email. Alternativa: um botão-ícone de envelope no rodapé, só nos cards com 0 créditos (mais rápido de achar, mas volta a apertar a linha; não recomendado).
- **Quando o item aparece:** só se `totalBalance <= 0` **e** o aluno não for "só online" (`onlineOnly`, já calculado no card). Não aparece sempre: num aluno com créditos, um toque errado mandaria "seus créditos acabaram" para quem tem saldo. `<= 0` (e não `=== 0`) porque saldo negativo também significa créditos acabados. Aluno inativo com 0 créditos: o item aparece (a professora decide). O aluno "só online" fica de fora pela mesma regra dos grupos de E-mails (PR D).
- **Como envia: o mesmo fluxo da tela E-mails** (`email_campaigns` → RPC `queue_email_campaign` → `send-campaign`), e não a `send-email`. Motivos: grava no Histórico sozinho (uma linha, "1 enviado" ou "1 falha", com "Reenviar para quem falhou"); o servidor escolhe a língua pelo `preferred_language` do aluno; a RLS e a RPC já exigem professora (`is_staff()`) e a `send-campaign` já recusa aluno (403). A `send-email` não grava histórico e exigiria montar o HTML no navegador.
- **Contra clique duplo:** `useRef` de "enviando" + botão de confirmar desabilitado + item do menu desabilitado enquanto envia. Cada confirmação cria **uma** campanha; a RPC `queue_email_campaign` recusa pôr a mesma campanha na fila duas vezes.
- **Retorno para a professora: toast (`sonner`)**, não o `Alert` do topo da página (com a lista rolada, o alerta do topo fica fora da tela). O `Toaster` já está em `src/App.jsx`. O envio é em segundo plano no servidor: a tela espera até ~20 s pelo resultado (lendo a campanha) e mostra "enviado", "falhou" ou "ainda enviando, confira no Histórico".
- **Permissões:** nada novo. A rota `/teacher/students` já é `ProtectedRoute requireRole="teacher"`; insert em `email_campaigns` e a RPC exigem `is_staff()`; a `send-campaign` só aceita professora/admin.

## Fora do escopo
- Textos do painel do aluno (`dashboard.balanceZeroMsg` em `src/locales/*.json`: "Seus créditos acabaram. Converse com a professora…"): não é o email; não mudar.
- Email de "Créditos baixos" (`lowCredits` em `emailTemplates.js` e `send-campaign/texts.ts`): não mudar (cita WhatsApp e o mesmo Interac).
- Arquivos históricos com textos antigos: `docs/edge-functions-orfas/send-low-credits-notifications.ts.txt`, `notification_functions.sql`, migrations antigas. Não são usados; não mexer.
- Aviso "já mandou este email há X dias" no diálogo de confirmação (pode ser uma melhoria futura).
- Mudar a tela E-mails (`EmailNotifications.jsx`): continua igual.

## Contexto lido
- `src/lib/emailTemplates.js` — `zeroCreditsNotice` (linhas ~127–158): assunto + mensagem do modelo "Créditos zerados" em pt/en/fr (texto atual manda telefonar para +1 (438) 274-8396). Bloco `zeroCredits` (linhas ~324–379): modelo antigo, **não é usado em lugar nenhum** (código morto, com o texto antigo).
- `src/lib/templateCards.js` — card "Créditos zerados"; `templateContent(id)` copia assunto/mensagem do `emailTemplates` para as 3 línguas.
- `src/lib/customEmail.js` / `send-campaign/campaign.ts` (`buildCustomHtml`) — o email sai com "Olá, Nome completo!" (Hello/Bonjour) antes da mensagem, e "Atenciosamente, <quem assina> - Josi Pilates" + frase + botão "Acessar Portal do Aluno" depois. **A saudação e a assinatura entram sozinhas.**
- `src/lib/emailCampaigns.js` — `buildCampaignRow`, `buildCampaignFilter`, `campaignProgress`.
- `src/pages/EmailNotifications.jsx` (`createCampaign`, `runSend`) — fluxo: insert em `email_campaigns` (sem `created_by`: o banco preenche) → `rpc('queue_email_campaign', { p_campaign_id, p_student_ids })` → em erro, `rpc('finish_email_campaign')` → `emailService.startCampaign(id)` → acompanha lendo `email_campaigns`.
- `supabase/migrations/20261112080000_create_email_campaigns.sql` e `…090000_email_campaign_server_send.sql` — RLS staff; `queue_email_campaign` só professora, só a criadora, uma vez, só alunos fora da lixeira.
- `supabase/functions/send-campaign/index.ts` — responde 202 e envia em segundo plano (`EdgeRuntime.waitUntil`).
- `src/pages/TeacherStudents.jsx` — card (linhas ~960–1210): `totalBalance`, `onlineOnly`, menu ⋮ com Pagamento online / Observações / Resetar senha / Inativar / Lixeira; `fetchData` (select de `profiles` sem `preferred_language`); não usa `useAuth` nem `toast`.
- `src/tests/customEmail.test.js` — confere que `zeroCreditsNotice` tem assunto e mensagem (>80 caracteres) nas 3 línguas.
- Endereços no projeto: `pilatesmontreal@gmail.com` já é o endereço do **Interac** no email de créditos baixos (cliente e servidor); `josipilatesmontreal@gmail.com` é a caixa que recebe o formulário de contato; `josi@josipilates.com` é o remetente/contato.

## Perguntas ao dono (responder antes de executar o passo 1)
1. **Saudação:** o sistema já põe "Olá, Nome!" antes da mensagem. Com "Boa tarde, …" o aluno lê duas saudações seguidas (e "Boa tarde" também chega de manhã). **Recomendado: tirar "Boa tarde," e começar em "Este email é para informar…"** (versão A abaixo). Ou manter como está (versão B).
2. **"os seu créditos"** → "os seus créditos"? (parece erro de digitação)
3. **"enviar o interação"** → "enviar o Interac"? (o corretor deve ter trocado "interac"; o email de créditos baixos já diz "para o interac pilatesmontreal@gmail.com"). Em inglês fica "Interac e-Transfer" e em francês « virement Interac ».
4. **Email do Interac:** confirmar `pilatesmontreal@gmail.com` (sem "josi"). É o mesmo que o email de créditos baixos já usa para o Interac; a caixa do formulário de contato é `josipilatesmontreal@gmail.com`. Se o certo for outro, o de créditos baixos também está errado (avisar; corrigir lá exige deploy da `send-campaign`, fica para outro PR).
5. **Telefone/WhatsApp:** o texto atual manda "falar na próxima aula ou telefonar para +1 (438) 274-8396"; o texto novo não cita telefone nem WhatsApp. Confirmar que é para tirar (recomendado seguir o texto novo; se quiser manter, acrescentar a linha "Mande uma mensagem pelo WhatsApp: +1(438)274-8396", igual aos outros emails).
6. **Assunto:** continua "Seus créditos acabaram - Josi Pilates" (en/fr iguais aos de hoje)? Recomendado: sim.
7. **Pontuação miúda (versão A):** vírgula em "Para renovar o seu pacote, basta…" e ponto final em "…e a preferência." (opcional).

## Passos
### 1. [SONNET] Texto novo do modelo "Créditos zerados"
- Arquivo: `src/lib/emailTemplates.js`
- Fazer: em `zeroCreditsNotice`, trocar **só** o `message` de pt, en e fr pelo texto da versão escolhida pelo dono (tabela "Textos", versão A por padrão se o dono aprovar). Assuntos ficam iguais (salvo resposta diferente à pergunta 6). Manter as quebras de linha exatamente como na tabela (linha em branco entre parágrafos; "Agradecemos…" e "Até breve…" em linhas seguidas, sem linha em branco). Sem `{…}` no texto.
- Fazer também: apagar o bloco morto `zeroCredits` (o modelo antigo, `id: 'zero_credits'`). Antes, conferir com `grep -rn "zeroCredits\b\|'zeroCredits'\|getTemplate('zeroCredits" src` que nada usa `emailTemplates.zeroCredits` (o `normalizeTemplateParam('zeroCredits')` de `emailRecipients.js` é outra coisa e fica). Se aparecer uso, **não apagar** e avisar.
- Pronto quando: a pré-visualização do modelo em E-mails → Nova mensagem mostra o texto novo nas 3 abas; nenhum outro modelo mudou.

### 2. [SONNET] Testes do texto
- Arquivo: `src/tests/customEmail.test.js` (bloco "modelos do passo 2")
- Fazer: novo `it` para `zeroCreditsNotice`: as 3 mensagens contêm `pilatesmontreal@gmail.com` e `josipilates.com/login`; nenhuma contém `438` nem `{`; pt contém "12 ou 6 aulas", en contém "Interac e-Transfer", fr contém "virement Interac". Se versão A: nenhuma mensagem começa com "Boa tarde"/"Good afternoon"/"Bonjour".
- Pronto quando: `npm test` verde.

### 3. ✅ [OPUS] Envio rápido de um modelo para um aluno (lógica, sem React)
- Arquivo novo: `src/lib/studentQuickEmail.js`; testes novos: `src/tests/studentQuickEmail.test.js`
- Fazer:
  - `ZERO_CREDITS_TEMPLATE = 'zeroCreditsNotice'`.
  - `canSendZeroCreditsEmail({ totalBalance, onlineOnly })` → `totalBalance <= 0 && !onlineOnly`.
  - `buildQuickCampaignRow({ templateId, senderName, includeInactive })`: usa `buildCampaignRow({ kind: 'custom', content: templateContent(templateId), senderName, filter, total: 1 })` com `filter = { ...buildCampaignFilter({ filterType: 'selected', includeInactive, templateId }), source: 'student_card' }`. `includeInactive` = aluno inativo (só para o registro do histórico).
  - `sendTemplateToStudent({ db, startCampaign, student, templateId, senderName, sleep, waitMs = 20000, pollMs = 2000 })` (dependências injetadas, para testar sem mock de módulo; `db` = cliente supabase, `startCampaign` = `emailService.startCampaign.bind(emailService)`), na ordem:
    1. insert da linha em `email_campaigns` (`.insert(row).select('id').single()`); erro → `{ status: 'error', step: 'campaign' }` (nada foi enviado).
    2. `db.rpc('queue_email_campaign', { p_campaign_id, p_student_ids: [student.id] })`; erro → chamar `db.rpc('finish_email_campaign', { p_campaign_id })` (fecha o registro como falha, igual ao `runSend`) e devolver `{ status: 'error', step: 'queue' }`.
    3. `startCampaign(id)`; se lançar erro, esperar `pollMs` e tentar **uma** vez mais; se falhar de novo, seguir (a campanha está na fila; o Histórico tem "Continuar envio").
    4. Ler `email_campaigns` (`id, total, sent, failed, status`) a cada `pollMs` até `waitMs`; usar `campaignProgress`. Terminou → `{ status: sent > 0 ? 'sent' : 'failed', campaignId }`; não terminou → `{ status: 'pending', campaignId }`.
  - Nunca logar email/nome do aluno (só `error.code`), como o resto do projeto.
- Testes (com `db` falso e `sleep` que resolve na hora): linha gravada tem `email_type: 'custom'`, `subject_*`/`message_*` iguais a `templateContent('zeroCreditsNotice')`, `recipient_filter` com `group: 'selected'`, `template: 'zeroCreditsNotice'`, `source: 'student_card'`, `total: 1`, sem `created_by`; RPC chamada com `[student.id]`; caminho feliz → `sent`; campanha `failed` com `sent: 0` → `failed`; erro na fila → chama `finish_email_campaign` e devolve `error`/`queue`, sem chamar `startCampaign`; `startCampaign` falha 1× e depois funciona → 2 chamadas; tempo esgotado com `status: 'sending'` → `pending`; `canSendZeroCreditsEmail` com 0, −1, 3 e `onlineOnly`.
- Pronto quando: testes novos verdes; nenhum arquivo além destes dois.

### 4. ✅ [OPUS] Item no menu ⋮ e confirmação em `TeacherStudents.jsx`
- Arquivo: `src/pages/TeacherStudents.jsx`
- Fazer:
  - `fetchData`: acrescentar `preferred_language` ao select de `profiles` (só para mostrar a língua no diálogo; o servidor lê a língua sozinho).
  - `const { profile } = useAuth()` (import de `../hooks/useAuth`); quem assina = `profile?.full_name || 'Professora'` (mesmo padrão da tela E-mails).
  - Estado: `zeroEmailStudent` (aluno do diálogo, ou `null`), `zeroEmailSendingId` (id em envio, ou `null`) e `zeroEmailSendingRef = useRef(false)`.
  - No menu ⋮, **primeiro item** (antes de "Pagamento online"), só quando `canSendZeroCreditsEmail({ totalBalance, onlineOnly })`: ícone `Mail` (lucide), texto `teacher.students.card.zeroCreditsEmail`; `disabled` quando `zeroEmailSendingId === student.id`; `onClick` → `setZeroEmailStudent(student)`. Mesmas classes dos outros itens.
  - `AlertDialog` novo (junto dos outros, perto do de ativar/inativar), aberto com `!!zeroEmailStudent`: título `zeroCreditsEmail.title` com `{ name: full_name }`; descrição `zeroCreditsEmail.description` com `{ language: t('teacher.emails.languageNames.<pt|en|fr>') }` (língua = `preferred_language` se for pt/en/fr, senão pt); se inativo, uma linha a mais `zeroCreditsEmail.inactiveNote`. Botões: Cancelar (`zeroCreditsEmail.cancel`) e Enviar (`zeroCreditsEmail.send`), este `disabled` enquanto `zeroEmailSendingRef.current`/`zeroEmailSendingId`.
  - Confirmar: se `zeroEmailSendingRef.current` já é `true`, não faz nada. Senão marca ref + `zeroEmailSendingId`, fecha o diálogo, mostra `toast.loading(t('…sending', { name }))` (guardar o id do toast) e chama `sendTemplateToStudent({ db: supabase, startCampaign: id => emailService.startCampaign(id), student, templateId: ZERO_CREDITS_TEMPLATE, senderName, sleep: ms => new Promise(r => setTimeout(r, ms)) })`. No fim troca o toast (mesmo `id`): `sent` → `toast.success`; `failed` → `toast.error(…failed)`; `pending` → `toast.info(…pending)`; `error` → `toast.error(…error)`. Nos casos `failed`/`pending`, `action: { label: t('…openHistory'), onClick: () => navigate('/teacher/email-notifications?tab=history') }`. `finally`: solta ref e `zeroEmailSendingId`. Envolver em `try/catch` (exceção inesperada → toast de erro).
  - Não mexer no layout do rodapé do card nem em outros itens.
- Pronto quando: aluno com 0 créditos mostra o item; aluno com créditos e aluno só online não mostram; confirmar duas vezes rápido gera **uma** linha no Histórico; lint sem aviso novo.

### 5. [SONNET] Textos da tela (pt/en/fr)
- Arquivos: `src/locales/pt.json`, `en.json`, `fr.json`
- Fazer: `teacher.students.card.zeroCreditsEmail` e o bloco novo `teacher.students.zeroCreditsEmail` (chaves da tabela "Textos da tela"), nas 3 línguas, mesmas chaves nos 3 arquivos.
- Pronto quando: `npm test` (inclui o teste de chaves dos locales, se houver) e `npm run build` verdes.

### 6. [SONNET] `docs/PENDENCIAS.md`
- Fazer: em "Testes em aberto", item novo com a lista de "Manual depois do deploy" (abaixo). No item antigo da Story 4.3 (passo 1, "Pedir para a Josi ler e aprovar os textos de Créditos zerados"), anotar que o texto de "Créditos zerados" foi trocado pelo da Josi neste PR. Atualizar a linha "_Última atualização_".

## Textos do email (modelo `zeroCreditsNotice`, campo `message`)
Assuntos sem mudança: pt "Seus créditos acabaram - Josi Pilates" · en "Your credits have run out - Josi Pilates" · fr "Vos crédits sont épuisés - Josi Pilates".

**Versão A (recomendada; aplica as perguntas 1, 2, 3 e 7):**

pt:
```
Este email é para informar que os seus créditos de aulas de Pilates acabaram.

Para renovar o seu pacote, basta enviar o Interac com o valor correspondente ao seu pacote (12 ou 6 aulas) para o e-mail: pilatesmontreal@gmail.com

Seu saldo aparece sempre no Portal do Aluno, em josipilates.com/login.

Agradecemos a confiança e a preferência.
Até breve e muito obrigada!
```
en:
```
This email is to let you know that your Pilates class credits have run out.

To renew your package, just send an Interac e-Transfer for the amount of your package (12 or 6 classes) to: pilatesmontreal@gmail.com

You can always see your balance in the Student Portal at josipilates.com/login.

Thank you for your trust and for choosing us.
See you soon, and thank you so much!
```
fr:
```
Ce courriel vise à vous informer que vos crédits de cours de Pilates sont épuisés.

Pour renouveler votre forfait, il suffit d'envoyer un virement Interac du montant correspondant à votre forfait (12 ou 6 cours) à l'adresse : pilatesmontreal@gmail.com

Votre solde est toujours affiché dans le Portail de l'élève, sur josipilates.com/login.

Merci de votre confiance et de votre fidélité.
À bientôt et merci beaucoup !
```

**Versão B (ipsis litteris do dono):** pt exatamente como ele escreveu ("Boa tarde, este email é para informar que os seu créditos…", "enviar o interação…", sem a vírgula e sem o ponto). en/fr iguais à versão A, mas começando com "Good afternoon, this email is to let you know…" / « Bonjour, ce courriel vise à vous informer… ». O aluno lê "Olá, Nome!" logo antes.

Como o aluno recebe (os dois casos): "Olá, Nome Completo!" → mensagem acima → botão "Acessar Portal do Aluno" → "Atenciosamente, Josi … - Josi Pilates" + frase do estúdio.

## Textos da tela (pt / en / fr)
Prefixo `teacher.students.`
| chave | pt | en | fr |
|---|---|---|---|
| `card.zeroCreditsEmail` | Email de créditos zerados | No-credits email | Courriel crédits épuisés |
| `zeroCreditsEmail.title` | Enviar o email de créditos zerados para {{name}}? | Send the no-credits email to {{name}}? | Envoyer le courriel de crédits épuisés à {{name}} ? |
| `zeroCreditsEmail.description` | O email sai em {{language}} (a língua do aluno), com o texto do modelo "Créditos zerados", e fica no Histórico de E-mails. | The email goes out in {{language}} (the student's language), with the "No credits left" template text, and is saved in the Email history. | Le courriel part en {{language}} (la langue de l'élève), avec le texte du modèle « Crédits épuisés », et il est enregistré dans l'historique des courriels. |
| `zeroCreditsEmail.inactiveNote` | Atenção: este aluno está inativo. | Note: this student is inactive. | Attention : cet élève est inactif. |
| `zeroCreditsEmail.cancel` | Cancelar | Cancel | Annuler |
| `zeroCreditsEmail.send` | Enviar email | Send email | Envoyer le courriel |
| `zeroCreditsEmail.sending` | Enviando o email para {{name}}... | Sending the email to {{name}}... | Envoi du courriel à {{name}}... |
| `zeroCreditsEmail.sent` | Email de créditos zerados enviado para {{name}}. | No-credits email sent to {{name}}. | Courriel de crédits épuisés envoyé à {{name}}. |
| `zeroCreditsEmail.failed` | O email para {{name}} falhou. Veja o motivo no Histórico de E-mails. | The email to {{name}} failed. See why in the Email history. | Le courriel à {{name}} a échoué. Voyez pourquoi dans l'historique des courriels. |
| `zeroCreditsEmail.pending` | O email para {{name}} ainda está sendo enviado. Confira no Histórico de E-mails. | The email to {{name}} is still being sent. Check the Email history. | Le courriel à {{name}} est encore en cours d'envoi. Vérifiez l'historique des courriels. |
| `zeroCreditsEmail.error` | Não foi possível enviar o email. Nada foi enviado; tente de novo. | Could not send the email. Nothing was sent; please try again. | Impossible d'envoyer le courriel. Rien n'a été envoyé ; réessayez. |
| `zeroCreditsEmail.openHistory` | Ver histórico | View history | Voir l'historique |

Língua do aluno no diálogo: reaproveitar `teacher.emails.languageNames.{pt,en,fr}` (já existe).

## Banco de dados
- SQL: **não** (usa `email_campaigns`, `queue_email_campaign`, `finish_email_campaign` e RLS que já estão em produção desde 2026-11-12/13).
- Ordem: **só o merge** (não há SQL nem deploy).
- Edge Function a publicar: **nenhuma** (`send-campaign` e `send-email` não mudam; o texto do modelo viaja na linha da campanha).

## Testes
- Automáticos: `npm run lint`, `npm test`, `npm run build` + novos: `it` do texto em `src/tests/customEmail.test.js`; `src/tests/studentQuickEmail.test.js`.
- Revisão: **`revisor` obrigatório antes do push** (envio de emails). Passar o caminho deste plano e a branch.
- Manual depois do deploy (para "Testes em aberto"; usar só **aluno de teste** com email que você lê):
  1. **Modelo:** E-mails → Nova mensagem → "Créditos zerados": abas PT/EN/FR com o texto novo; pré-visualização mostra "Olá, Nome!" uma vez só, o texto, o botão do portal e a assinatura. **Josi lê e aprova as 3 línguas.**
  2. **Menu:** Alunos → aluno de teste com 0 créditos → ⋮ → "Email de créditos zerados" aparece; num aluno com créditos e num aluno só online, não aparece. Com saldo negativo, aparece.
  3. **Envio:** tocar no item → diálogo "Enviar o email de créditos zerados para NOME?" com a língua do aluno. Cancelar: nada acontece (Histórico igual). Enviar: toast "Enviando…" e depois "enviado"; chega o email na língua do aluno (trocar o idioma do aluno de teste para English e Français e repetir; voltar no fim).
  4. **Histórico:** E-mails → Histórico: uma linha por envio, assunto "Seus créditos acabaram - Josi Pilates" (ou o da língua), "1 enviado"; abrindo, o aluno com "Enviado".
  5. **Clique duplo:** tocar rápido duas vezes em "Enviar email": uma linha só no Histórico e um email só.
  6. **Falha:** trocar o email do aluno de teste para `teste@invalido`, enviar: toast de falha com "Ver histórico", que abre o Histórico com "1 falha"; voltar o email no fim.
  7. **iPad em pé e celular:** o rodapé do card não mudou; o menu abre e o diálogo cabe na tela.
  8. **Regressão:** "Resetar senha" e "Pagamento online" do menu continuam funcionando; tela E-mails envia normalmente.

## Riscos e como voltar atrás
- Email que já saiu não volta: testar só com aluno de teste até o item 3 passar.
- Toque errado num aluno real: mitigado pela confirmação com o nome e por o item só aparecer com saldo ≤ 0.
- `startCampaign` falhar: a campanha fica "Enviando" no Histórico; o botão "Continuar envio" de lá termina o envio (já existe).
- Se quebrar: GitHub → PR mergeado → **Revert** → mergear o PR de reversão; ou Vercel → Deployments → deploy anterior → **Promote to Production**. Sem SQL de reversão.

## Bloco "Próxima sessão" (modelo para o fim do PR)
1. Merge do PR (link).
2. Não tem SQL; nenhuma Edge Function para publicar. Ordem: só o merge.
3. Testar: itens 1–8 de "Manual depois do deploy".
4. Se quebrar: Revert do PR no GitHub, ou Promote to Production do deploy anterior na Vercel. Sem SQL de reversão.
5. Encerrar a sessão (depois do teste).
6. Sessão nova no Claude Code, `HenriquedaFonte/pilatesApp`, modelo Sonnet (esforço medium).
7. Primeira mensagem: `Comece do main atualizado. Leia docs/PENDENCIAS.md. Quero fazer: [tarefa].`
