# Plano: Recibos — email ao aluno quando um recibo é emitido ou anulado
Data: 2026-11-21 · Branch: `feat/recibo-email-aluno` (criar a partir do `main` atualizado)

## Objetivo
Quando a professora **emite** um recibo de seguro, o aluno recebe automaticamente um email (na língua dele: pt, en ou fr) dizendo que o recibo nº X está em "Meus recibos", com um botão para `https://josipilates.com/student/receipts`. **Sem PDF anexado.** Quando a professora **anula** um recibo, o aluno recebe outro email dizendo que o recibo nº X foi anulado, **sem o motivo**. A professora vê um aviso pequeno ("Aviso enviado por e-mail ao(à) aluno(a)", ou que não saiu). Falha no email nunca desfaz nem trava a emissão/anulação.

Item de origem: `docs/PENDENCIAS.md` → "A fazer" → **"Recibos: email ao aluno quando um recibo é emitido ou anulado"** (decisões do dono de 2026-11-21: automático, só o link, anulado também avisa sem o motivo, pt/en/fr na língua do aluno, prévia do texto antes do merge).

## Fora do escopo
- Fazer o login voltar para "Meus recibos" depois de entrar (hoje, aluno **deslogado** que abre `/student/receipts` cai na página inicial; ver "Dúvidas para o dono", 1). O texto do email já explica como entrar.
- Email ao tocar em "Gerar PDF" ou ao anexar o PDF depois (**não sai email nenhum** nesse caminho; `ReceiptsList.handleGeneratePdf` e `ensureReceiptPdf` **não mudam**).
- Botão "Reenviar aviso", registro do aviso no banco, coluna "Aluno avisado em ..." na tela da professora, linha no Histórico de emails (`email_notifications`). Sem migration.
- Anexar o PDF ao email.
- Política de Privacidade / Termos (ver "Dúvidas para o dono", 5).
- Relatório fiscal (item seguinte do PENDENCIAS: **não mexer**).
- `src/lib/emailService.js` e `src/lib/emailTemplates.js`: **não mudam** (o email é montado no servidor, como o boas-vindas do cadastro).

## Contexto lido
- `supabase/functions/send-email/index.ts` — resolve quem chama (`service` / `staff` / `user` / `anonymous`), chama `buildEmail()` da `policy.ts` e manda pelo Resend; o boas-vindas (`signup_welcome`) é o modelo de email montado no servidor.
- `supabase/functions/send-email/policy.ts` — módulo puro: professora/admin manda assunto/HTML livres; contato e boas-vindas montados no servidor; exporta `STUDIO_FROM`, `normalizeEmail`, `escapeHtml`, tipos `Caller`, `OutgoingEmail`, `BuildResult`.
- `supabase/functions/send-email/signupWelcome.ts` — textos pt/en/fr do boas-vindas; exporta `normalizeLanguage` (desconhecida → pt) e `cleanWelcomeName` (uma linha, sem controle, até 80 caracteres). Padrão de HTML (cabeçalho verde, botão, assinatura "Com carinho, / Equipe Josi Pilates", WhatsApp "Mande uma mensagem pelo WhatsApp: +1(438)274-8396").
- `supabase/functions/send-campaign/{index,campaign}.ts` — usa o cabeçalho `Idempotency-Key` do Resend (`send-campaign/<campanha>/<aluno>`): mesmo pedido em 24 h não manda outro email. Reaproveitado aqui.
- `src/lib/emailService.js` — `sendEmail` (staff, HTML livre) e `sendStudentWelcomeSelfSignupEmail` (só pede `type`, o servidor monta): o aviso de recibo segue este segundo padrão.
- `src/lib/receiptService.js` — `issueReceipt` (RPC `issue_insurance_receipt` → lê o recibo → gera/sobe/anexa o PDF; devolve `{ receipt, pdfError }`), `ensureReceiptPdf` ("Gerar PDF"), `voidReceipt` (RPC `void_insurance_receipt`).
- `src/components/IssueReceiptDialog.jsx` — `handleIssue`: prévia em memória → `issueReceipt` → salva seguro (opcional) → `onIssued` → fecha → toasts (sucesso / PDF pendente). `issuingRef` impede clique duplo.
- `src/components/ReceiptsList.jsx` — tabela da professora (ficha do aluno e Relatórios → Recibos de seguro); `handleVoid` (anula com motivo) e `handleGeneratePdf`.
- `src/pages/StudentReceipts.jsx` — "Meus recibos" (`/student/receipts`): emitido com PDF → botões; sem PDF → "Em preparação"; anulado → "Este recibo foi anulado e não vale mais".
- `src/components/ProtectedRoute.jsx` / `src/pages/Login.jsx` — sem login, rota protegida manda para `/`; depois do login vai para `/student/dashboard` (que tem o botão "Meus recibos").
- `supabase/migrations/20261112070000_create_insurance_receipts.sql` / `20261121000000_receipt_first_opened_by_student.sql` — `insurance_receipts` (status `issued`/`void`, `issued_at`, `voided_at`, `void_reason`); `service_role` tem SELECT; RLS só SELECT para a API.
- Preferências/descadastro de email: **não existem** no projeto (procurado: nenhuma coluna, tela, link "unsubscribe" nem filtro no envio; a Política de Privacidade só fala em "optar por não receber comunicações de marketing"). Este email é **transacional** (sobre um documento do próprio aluno), não é marketing: sai sempre que houver email. Se um dia existir preferência, este aviso não deve ser desligado por ela (é aviso de serviço).
- Aluno sem email: o login exige email, mas `profiles.email` pode faltar/estar inválido ou o perfil estar na lixeira (`deleted_at`): nesses casos o servidor não manda nada e devolve "sem email".
- `src/tests/sendEmailPolicy.test.js`, `src/tests/receiptOpen.test.js`, `src/tests/studentReceipts.test.js` — padrão dos testes (`.ts` importado direto pelo Vitest; mock de `@/lib/supabase`; JSON de locales importado).
- `eslint.config.js` — só `.js/.jsx` (os `.ts` das Edge Functions não passam pelo lint); globals de navegador (por isso o teste importa `process` de `node:process`).

## Decisões já tomadas neste plano (o dono pode mudar antes de começar)
1. **Montado no servidor** (`send-email`, novo `type: 'receipt_notice'`): o site manda só `{ receipt_id, event }`. O servidor lê o recibo e o perfil do aluno com service_role, escolhe a língua, monta o texto e manda **para o email do perfil do aluno do recibo** (nunca um destinatário vindo do site). Só professora/admin logada pode pedir.
2. **Uma vez só:** o servidor só aceita `issued` se o recibo está emitido e foi emitido há no máximo **15 minutos**, e `voided` se está anulado e foi anulado há no máximo 15 minutos (aviso de recibo antigo é recusado com 409). Além disso, o pedido ao Resend leva `Idempotency-Key: receipt-notice/<id do recibo>/<evento>`: repetir em 24 h não manda outro email. No site, o aviso só é chamado em `handleIssue` (depois da RPC de emissão dar certo) e em `handleVoid` (depois da RPC de anulação dar certo) — **nunca** em "Gerar PDF".
3. **Não trava nada:** o site chama o aviso **sem `await`**, depois de fechar a tela/mostrar o sucesso. Qualquer erro vira só um toast amarelo para a professora.
4. **PDF que falhou na emissão (raro):** o email sai mesmo assim (a emissão deu certo); o aluno vê "Em preparação" até a professora tocar em "Gerar PDF", que não manda outro email (ver "Dúvidas para o dono", 2).
5. **O que o email leva:** nome do aluno (escapado), número do recibo e o link. **Não leva** valores, datas de tratamento, tipo (kinésithérapie/naturopathie por extenso), motivo da anulação nem PDF. Assunto genérico (sem número).
6. **Professora vê o resultado:** toast verde "Aviso enviado por e-mail ao(à) aluno(a).", azul "sem e-mail no cadastro" ou amarelo "não foi possível enviar". E as telas de confirmação (emitir e anular) passam a dizer que o aluno recebe um email.
7. **Sem SQL, sem migration.** Só deploy da `send-email`, **antes do merge**.

## Passos

### 1. [OPUS] Módulo do aviso no servidor: `receiptNotice.ts` (novo)
- Arquivo: `supabase/functions/send-email/receiptNotice.ts` (novo)
- Fazer: criar o arquivo exatamente com o conteúdo abaixo (módulo puro, sem Deno nem rede).
- Código:
  ```ts
  // Aviso ao aluno por email quando um recibo de seguro é emitido ou anulado
  // (pedido de 2026-11-21; plano docs/planos/2026-11-21-recibo-email-aluno.md).
  // Módulo puro (sem Deno, sem rede): o index.ts lê o recibo e o perfil do aluno
  // com service_role e chama as funções daqui. Testes: src/tests/receiptNotice.test.js.
  //
  //   - Só professora/admin logada (caller 'staff'). service_role, aluno e sem
  //     login: recusado (403 / 401).
  //   - Corpo: { type: 'receipt_notice', receipt_id: uuid, event: 'issued' | 'voided' }.
  //     Destinatário, assunto, HTML, anexos e Reply-To do corpo são ignorados.
  //   - 'issued': o recibo tem de estar emitido (status 'issued') e ter sido
  //     emitido há no máximo NOTICE_WINDOW_MS; 'voided': anulado (status 'void')
  //     há no máximo NOTICE_WINDOW_MS. Fora disso: 409 (não avisa de novo de
  //     recibo antigo). O index.ts ainda manda ao Resend uma Idempotency-Key por
  //     recibo e evento: repetir em 24 h não manda outro email.
  //   - Destinatário: profiles.email do aluno do recibo (lido no servidor). Sem
  //     email válido ou perfil na lixeira (deleted_at): nada sai (kind 'skip').
  //   - Texto fixo em pt/en/fr pela preferred_language do aluno (outra → pt).
  //     Leva só o nome (escapado), o número do recibo e o link de "Meus recibos".
  //     Nada de valores, datas, tipo de tratamento, motivo da anulação nem PDF
  //     (o recibo tem dados de saúde; o aluno baixa pelo portal).
  //   - Não existe preferência/descadastro de email no projeto; este aviso é
  //     transacional (documento do próprio aluno) e sai sempre que houver email.

  import { escapeHtml, normalizeEmail, STUDIO_FROM, type Caller, type OutgoingEmail } from './policy.ts'
  import { cleanWelcomeName, normalizeLanguage, type SignupLanguage } from './signupWelcome.ts'

  export type ReceiptEvent = 'issued' | 'voided'
  export const RECEIPT_EVENTS: ReceiptEvent[] = ['issued', 'voided']
  export const NOTICE_WINDOW_MS = 15 * 60 * 1000
  export const RECEIPTS_URL = 'https://josipilates.com/student/receipts'
  const STUDIO_PHONE = '+1(438)274-8396'
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

  export interface ReceiptNoticeRequest {
    receiptId: string
    event: ReceiptEvent
  }

  // Colunas lidas pelo index.ts (insurance_receipts e profiles).
  export interface NoticeReceipt {
    id: string
    receipt_number: string
    student_id: string
    status: string
    issued_at: string | null
    voided_at: string | null
  }
  export interface NoticeStudent {
    email: string | null
    full_name: string | null
    preferred_language: string | null
    deleted_at: string | null
  }

  export type ReceiptNoticeResult =
    | { kind: 'send'; email: OutgoingEmail; idempotencyKey: string }
    | { kind: 'skip'; reason: 'no_email' }
    | { kind: 'fail'; status: number; error: string }

  const fail = (status: number, error: string): ReceiptNoticeResult => ({ kind: 'fail', status, error })

  // deno-lint-ignore no-explicit-any
  export function isReceiptNoticeBody(body: any): boolean {
    return Boolean(body) && typeof body === 'object' && !Array.isArray(body) && body.type === 'receipt_notice'
  }

  export function authorizeReceiptNotice(caller: Caller): ReceiptNoticeResult | null {
    if (caller.kind === 'anonymous') return fail(401, 'Unauthorized')
    if (caller.kind !== 'staff') return fail(403, 'Forbidden')
    return null
  }

  // deno-lint-ignore no-explicit-any
  export function readReceiptNoticeRequest(body: any): ReceiptNoticeRequest | null {
    const id = typeof body?.receipt_id === 'string' ? body.receipt_id.trim() : ''
    const event = body?.event
    if (!UUID_RE.test(id)) return null
    if (!(RECEIPT_EVENTS as unknown[]).includes(event)) return null
    return { receiptId: id.toLowerCase(), event: event as ReceiptEvent }
  }

  export const receiptNoticeIdempotencyKey = (receiptId: string, event: ReceiptEvent) =>
    `receipt-notice/${receiptId}/${event}`

  // Dentro da janela: no máximo NOTICE_WINDOW_MS atrás (e até 1 min "no futuro",
  // diferença de relógio entre banco e função).
  function withinWindow(iso: string | null, now: number): boolean {
    const at = iso ? Date.parse(iso) : NaN
    return Number.isFinite(at) && now - at <= NOTICE_WINDOW_MS && now - at >= -60_000
  }

  interface EventTexts {
    subject: string
    title: string
    intro: (receiptNumber: string) => string
    body: string
    privacy: string
  }
  interface NoticeTexts {
    greeting: (name: string) => string
    issued: EventTexts
    voided: EventTexts
    button: string
    loginHint: string
    contact: string
    signature: string
    teamName: string
  }

  export const NOTICE_TEXTS: Record<SignupLanguage, NoticeTexts> = {
    pt: {
      greeting: (name) => (name ? `Olá, ${name}!` : 'Olá!'),
      issued: {
        subject: 'Seu recibo de seguro está disponível',
        title: 'Recibo de seguro disponível',
        intro: (n) => `Emitimos um recibo de seguro para você: nº ${n}.`,
        body: 'Para baixar o PDF e enviar ao seu seguro, entre no Portal do Aluno e abra "Meus recibos".',
        privacy: 'Por segurança, o recibo não vai anexado a este e-mail.',
      },
      voided: {
        subject: 'Um recibo de seguro foi anulado',
        title: 'Recibo de seguro anulado',
        intro: (n) => `O recibo de seguro nº ${n} foi anulado e não vale mais.`,
        body: 'Se você já enviou este recibo ao seu seguro, fale com a gente. Se um recibo novo foi emitido no lugar dele, ele está em "Meus recibos", no Portal do Aluno.',
        privacy: '',
      },
      button: 'Ver meus recibos',
      loginHint: 'Se você não estiver conectado(a), entre no Portal do Aluno com o seu e-mail e a sua senha e toque em "Meus recibos".',
      contact: `Dúvidas? Mande uma mensagem pelo WhatsApp: ${STUDIO_PHONE}`,
      signature: 'Com carinho,',
      teamName: 'Equipe Josi Pilates',
    },
    en: {
      greeting: (name) => (name ? `Hello, ${name}!` : 'Hello!'),
      issued: {
        subject: 'Your insurance receipt is available',
        title: 'Insurance receipt available',
        intro: (n) => `We have issued an insurance receipt for you: no. ${n}.`,
        body: 'To download the PDF and send it to your insurer, log in to the Student Portal and open "My receipts".',
        privacy: 'For your privacy, the receipt is not attached to this email.',
      },
      voided: {
        subject: 'An insurance receipt was voided',
        title: 'Insurance receipt voided',
        intro: (n) => `Insurance receipt no. ${n} was voided and is no longer valid.`,
        body: 'If you have already sent this receipt to your insurer, please contact us. If a new receipt was issued to replace it, you will find it in "My receipts" on the Student Portal.',
        privacy: '',
      },
      button: 'See my receipts',
      loginHint: 'If you are not logged in, log in to the Student Portal with your email and password, then tap "My receipts".',
      contact: `Questions? Send us a message on WhatsApp: ${STUDIO_PHONE}`,
      signature: 'With care,',
      teamName: 'Josi Pilates Team',
    },
    fr: {
      greeting: (name) => (name ? `Bonjour, ${name}!` : 'Bonjour!'),
      issued: {
        subject: "Votre reçu d'assurance est disponible",
        title: "Reçu d'assurance disponible",
        intro: (n) => `Nous avons émis un reçu d'assurance à votre nom : nº ${n}.`,
        body: "Pour télécharger le PDF et l'envoyer à votre assureur, connectez-vous au Portail Étudiant et ouvrez « Mes reçus ».",
        privacy: "Pour protéger vos renseignements, le reçu n'est pas joint à ce courriel.",
      },
      voided: {
        subject: "Un reçu d'assurance a été annulé",
        title: "Reçu d'assurance annulé",
        intro: (n) => `Le reçu d'assurance nº ${n} a été annulé et n'est plus valide.`,
        body: 'Si vous avez déjà envoyé ce reçu à votre assureur, contactez-nous. Si un nouveau reçu a été émis pour le remplacer, vous le trouverez dans « Mes reçus », sur le Portail Étudiant.',
        privacy: '',
      },
      button: 'Voir mes reçus',
      loginHint: "Si vous n'êtes pas connecté(e), connectez-vous au Portail Étudiant avec votre courriel et votre mot de passe, puis touchez « Mes reçus ».",
      contact: `Des questions ? Envoyez-nous un message sur WhatsApp : ${STUDIO_PHONE}`,
      signature: 'Avec soin,',
      teamName: 'Équipe Josi Pilates',
    },
  }

  export function buildReceiptNoticeContent(
    event: ReceiptEvent,
    receiptNumber: unknown,
    rawName: unknown,
    rawLanguage: unknown,
  ): { subject: string; html: string; text: string } {
    const t = NOTICE_TEXTS[normalizeLanguage(rawLanguage)]
    const e = t[event]
    const name = cleanWelcomeName(rawName)
    const number = cleanWelcomeName(receiptNumber)
    const safeName = escapeHtml(name)
    const safeNumber = escapeHtml(number)

    const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${e.title}</title>
  </head>
  <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #01b48d 0%, #017a6b 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
      <h1 style="color: white; margin: 0; font-size: 28px;">Josi Pilates</h1>
      <p style="color: #f0f0f0; margin: 5px 0 0 0; font-size: 16px;">${e.title}</p>
    </div>
    <div style="background: white; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 10px 10px;">
      <h2 style="color: #1e293b; margin-top: 0;">${t.greeting(safeName)}</h2>
      <p>${e.intro(safeNumber)}</p>
      <p>${e.body}</p>
      <div style="text-align: center; margin: 25px 0; padding: 18px; background-color: #f0fdf4; border-radius: 8px; border: 1px solid #bbf7d0;">
        <a href="${RECEIPTS_URL}" style="background: linear-gradient(135deg, #01b48d 0%, #017a6b 100%); color: white; padding: 12px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 15px;">${t.button}</a>
      </div>
      <p style="color: #64748b; font-size: 14px;">${t.loginHint}</p>
      ${e.privacy ? `<p style="color: #64748b; font-size: 14px;">${e.privacy}</p>` : ''}
      <p>${t.contact}</p>
      <hr style="margin: 30px 0; border: none; border-top: 1px solid #e2e8f0;">
      <p style="color: #64748b; font-size: 14px; text-align: center;">
        <strong>${t.signature}</strong><br>
        ${t.teamName}
      </p>
    </div>
  </body>
  </html>`

    const text = `${t.greeting(name)}

  ${e.intro(number)}

  ${e.body}

  ${t.button}: ${RECEIPTS_URL}

  ${t.loginHint}${e.privacy ? `\n${e.privacy}` : ''}

  ${t.contact}

  ${t.signature}
  ${t.teamName}`

    return { subject: e.subject, html, text }
  }

  export function buildReceiptNotice(args: {
    request: ReceiptNoticeRequest
    receipt: NoticeReceipt | null
    student: NoticeStudent | null
    now?: number
  }): ReceiptNoticeResult {
    const { request, receipt, student } = args
    const now = args.now ?? Date.now()
    if (!receipt || String(receipt.id).toLowerCase() !== request.receiptId) return fail(404, 'Receipt not found')

    const expectedStatus = request.event === 'issued' ? 'issued' : 'void'
    const eventAt = request.event === 'issued' ? receipt.issued_at : receipt.voided_at
    if (receipt.status !== expectedStatus || !withinWindow(eventAt, now)) return fail(409, 'Notice not allowed')

    const to = student && !student.deleted_at ? normalizeEmail(student.email) : null
    if (!to) return { kind: 'skip', reason: 'no_email' }

    const content = buildReceiptNoticeContent(
      request.event,
      receipt.receipt_number,
      student?.full_name,
      student?.preferred_language,
    )
    return {
      kind: 'send',
      email: { from: STUDIO_FROM, to: [to], ...content, attachments: [] },
      idempotencyKey: receiptNoticeIdempotencyKey(request.receiptId, request.event),
    }
  }
  ```
  Observação para quem executa: no bloco acima, as linhas do `html` e do `text` estão indentadas com 2 espaços só por causa do Markdown. No arquivo, o conteúdo dos template strings fica **colado à margem esquerda** (como em `signupWelcome.ts`), para o texto do email não sair com espaços no começo de cada linha.
- Conferir antes: `signupWelcome.ts` exporta `cleanWelcomeName`, `normalizeLanguage` e o tipo `SignupLanguage` (exporta hoje; se não, exportar sem mudar mais nada). `policy.ts` exporta `escapeHtml`, `normalizeEmail`, `STUDIO_FROM`, `Caller`, `OutgoingEmail` (exporta hoje). `receiptNotice.ts` importa de `policy.ts`, e `policy.ts` **não** importa `receiptNotice.ts` (sem import circular).
- Pronto quando: o arquivo existe, os testes do passo 3 passam.

### 2. [OPUS] Ligar o aviso na `send-email` (`policy.ts` e `index.ts`)
- Arquivos: `supabase/functions/send-email/policy.ts`, `supabase/functions/send-email/index.ts`
- Fazer em `policy.ts`:
  1. No comentário do topo, depois do item do "aluno logado (cadastro público)", acrescentar:
     ```ts
     //   - aviso de recibo ao aluno (type: 'receipt_notice'): só professora/admin;
     //     tratado no index.ts com receiptNotice.ts (lê o recibo e o perfil no
     //     servidor). buildEmail() recusa esse type (400) para ele nunca cair no
     //     envio livre da professora.
     ```
  2. Em `BuildResult`, trocar `mode: 'staff' | 'contact' | 'signup_welcome'` por `mode: 'staff' | 'contact' | 'signup_welcome' | 'receipt_notice'`.
  3. Em `buildEmail`, logo depois da linha `if (body.type === 'signup_welcome') return buildSignupWelcomeEmail(caller, now)`, acrescentar:
     ```ts
     // Aviso de recibo: só pelo caminho do index.ts (receiptNotice.ts), nunca como envio livre.
     if (body.type === 'receipt_notice') return fail(400, 'Invalid request')
     ```
- Fazer em `index.ts`:
  1. Imports (trocar a linha 2 e acrescentar a de baixo):
     ```ts
     import { ALLOWED_ATTACHMENTS, buildEmail, type BuildResult, type Caller } from './policy.ts'
     import {
       authorizeReceiptNotice,
       buildReceiptNotice,
       isReceiptNoticeBody,
       readReceiptNoticeRequest,
       type NoticeStudent,
       type ReceiptNoticeResult,
     } from './receiptNotice.ts'
     ```
  2. Nova função, depois de `loadAttachment`:
     ```ts
     // Aviso de recibo ao aluno: lê o recibo e o perfil com service_role (o
     // destinatário vem do banco, nunca do pedido). Ver receiptNotice.ts.
     // deno-lint-ignore no-explicit-any
     async function handleReceiptNotice(body: any, caller: Caller): Promise<ReceiptNoticeResult> {
       const denied = authorizeReceiptNotice(caller)
       if (denied) return denied
       const request = readReceiptNoticeRequest(body)
       if (!request) return { kind: 'fail', status: 400, error: 'Invalid request' }

       const adminClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
       const { data: receipt, error: receiptError } = await adminClient
         .from('insurance_receipts')
         .select('id, receipt_number, student_id, status, issued_at, voided_at')
         .eq('id', request.receiptId)
         .maybeSingle()
       if (receiptError) {
         console.error('send-email: receipt_notice could not read the receipt')
         return { kind: 'fail', status: 500, error: 'Internal server error' }
       }

       let student: NoticeStudent | null = null
       if (receipt) {
         const { data, error } = await adminClient
           .from('profiles')
           .select('email, full_name, preferred_language, deleted_at')
           .eq('id', receipt.student_id)
           .maybeSingle()
         if (error) {
           console.error('send-email: receipt_notice could not read the student profile')
           return { kind: 'fail', status: 500, error: 'Internal server error' }
         }
         student = data
       }

       return buildReceiptNotice({ request, receipt, student, now: Date.now() })
     }
     ```
  3. Dentro do `Deno.serve`, trocar:
     ```ts
         const caller = await resolveCaller(req.headers.get('Authorization') ?? '')
         // deno-lint-ignore no-explicit-any
         const result = buildEmail(body as any, caller)
         if (!result.ok) {
     ```
     por:
     ```ts
         const caller = await resolveCaller(req.headers.get('Authorization') ?? '')
         let result: BuildResult
         let idempotencyKey: string | null = null
         if (isReceiptNoticeBody(body)) {
           const notice = await handleReceiptNotice(body, caller)
           if (notice.kind === 'fail') {
             console.warn(`send-email refused: caller=${caller.kind} mode=receipt_notice status=${notice.status} reason=${notice.error}`)
             return json({ error: notice.error }, notice.status)
           }
           if (notice.kind === 'skip') {
             // Sem email no cadastro (ou perfil na lixeira): nada sai. Sem email/nome no log.
             console.log(`send-email: receipt_notice skipped reason=${notice.reason}`)
             return json({ success: false, skipped: notice.reason }, 200)
           }
           result = { ok: true, mode: 'receipt_notice', email: notice.email }
           idempotencyKey = notice.idempotencyKey
         } else {
           // deno-lint-ignore no-explicit-any
           result = buildEmail(body as any, caller)
         }
         if (!result.ok) {
     ```
  4. No `fetch('https://api.resend.com/emails', ...)`, trocar o objeto `headers` por:
     ```ts
           headers: {
             'Authorization': `Bearer ${resendApiKey}`,
             'Content-Type': 'application/json',
             // Aviso de recibo: o mesmo recibo/evento em 24 h não manda outro email.
             ...(idempotencyKey && { 'Idempotency-Key': idempotencyKey }),
           },
     ```
  - Nada mais muda no `index.ts` (o log `Email sent: id=... mode=receipt_notice caller=staff recipients=1` sai sozinho, sem email nem nome).
- Pronto quando: `npm test` passa (inclusive os testes antigos de `sendEmailPolicy.test.js`); se o Deno estiver instalado, `deno check supabase/functions/send-email/index.ts` sem erro (se não estiver, dizer isso no resultado; não instalar).

### 3. [OPUS] Testes do servidor
- Arquivos: `src/tests/receiptNotice.test.js` (novo); `src/tests/sendEmailPolicy.test.js` (acrescentar 1 teste)
- Fazer em `sendEmailPolicy.test.js`, no `describe('send-email: professora e service_role', ...)`:
  ```js
  it('type receipt_notice nunca vira envio livre (vai pelo receiptNotice.ts)', () => {
    const r = buildEmail({ ...generic, type: 'receipt_notice' }, staff, NOW)
    expect(r).toEqual({ ok: false, status: 400, error: 'Invalid request' })
  })
  ```
- Fazer: criar `src/tests/receiptNotice.test.js` com este conteúdo:
  ```js
  // @vitest-environment node
  import { describe, it, expect } from 'vitest'
  import process from 'node:process'
  import { mkdirSync, writeFileSync } from 'node:fs'
  import { join } from 'node:path'
  import {
    authorizeReceiptNotice,
    buildReceiptNotice,
    buildReceiptNoticeContent,
    isReceiptNoticeBody,
    readReceiptNoticeRequest,
    receiptNoticeIdempotencyKey,
    NOTICE_WINDOW_MS,
    RECEIPTS_URL
  } from '../../supabase/functions/send-email/receiptNotice.ts'
  import { STUDIO_FROM } from '../../supabase/functions/send-email/policy.ts'

  // Aviso ao aluno quando um recibo é emitido ou anulado (send-email, type 'receipt_notice').

  const NOW = Date.parse('2026-11-21T15:00:00Z')
  const ID = '0b7c6a4e-1f2d-4c3b-9a8e-7d6c5b4a3f21'
  const minutesAgo = m => new Date(NOW - m * 60 * 1000).toISOString()

  const issuedReceipt = {
    id: ID,
    receipt_number: 'K-2026-0007',
    student_id: 's1',
    status: 'issued',
    issued_at: minutesAgo(1),
    voided_at: null,
    // Campos que NUNCA podem ir para o email (o index.ts nem lê; aqui para provar):
    total_fees: 123.45,
    void_reason: 'MOTIVO-SECRETO',
    treatments: [{ date: '2026-11-20', amount: 123.45 }]
  }
  const voidedReceipt = { ...issuedReceipt, status: 'void', voided_at: minutesAgo(1), void_reason: 'MOTIVO-SECRETO' }
  const student = { email: 'aluna@example.com', full_name: 'Maria Exemplo', preferred_language: 'pt', deleted_at: null }

  const issued = { receiptId: ID, event: 'issued' }
  const voided = { receiptId: ID, event: 'voided' }

  describe('receipt_notice: pedido e permissão', () => {
    it('reconhece o type', () => {
      expect(isReceiptNoticeBody({ type: 'receipt_notice' })).toBe(true)
      expect(isReceiptNoticeBody({ type: 'contact' })).toBe(false)
      expect(isReceiptNoticeBody(null)).toBe(false)
      expect(isReceiptNoticeBody([])).toBe(false)
    })

    it('lê só receipt_id (uuid) e event; o resto do corpo é ignorado', () => {
      expect(readReceiptNoticeRequest({
        type: 'receipt_notice', receipt_id: ID.toUpperCase(), event: 'issued',
        to: ['outro@example.com'], subject: 'x', html: '<b>x</b>'
      })).toEqual({ receiptId: ID, event: 'issued' })
      expect(readReceiptNoticeRequest({ receipt_id: ID, event: 'voided' })).toEqual({ receiptId: ID, event: 'voided' })
      expect(readReceiptNoticeRequest({ receipt_id: 'abc', event: 'issued' })).toBeNull()
      expect(readReceiptNoticeRequest({ receipt_id: ID, event: 'paid' })).toBeNull()
      expect(readReceiptNoticeRequest({ receipt_id: ID })).toBeNull()
    })

    it('só professora/admin', () => {
      expect(authorizeReceiptNotice({ kind: 'staff', userId: 't1' })).toBeNull()
      expect(authorizeReceiptNotice({ kind: 'anonymous' })).toEqual({ kind: 'fail', status: 401, error: 'Unauthorized' })
      expect(authorizeReceiptNotice({ kind: 'service' })).toEqual({ kind: 'fail', status: 403, error: 'Forbidden' })
      expect(authorizeReceiptNotice({ kind: 'user', userId: 's1', email: 'a@b.com', createdAt: null }))
        .toEqual({ kind: 'fail', status: 403, error: 'Forbidden' })
    })
  })

  describe('receipt_notice: recibo emitido', () => {
    it('vai para o email do perfil, do remetente fixo, sem anexo nem Reply-To, com chave de idempotência', () => {
      const r = buildReceiptNotice({ request: issued, receipt: issuedReceipt, student, now: NOW })
      expect(r.kind).toBe('send')
      expect(r.email.from).toBe(STUDIO_FROM)
      expect(r.email.to).toEqual(['aluna@example.com'])
      expect(r.email.attachments).toEqual([])
      expect(r.email.reply_to).toBeUndefined()
      expect(r.idempotencyKey).toBe(receiptNoticeIdempotencyKey(ID, 'issued'))
      expect(r.idempotencyKey).toBe(`receipt-notice/${ID}/issued`)
    })

    it('leva nome, número e o link de "Meus recibos"; nada de valores, datas, tipo ou motivo', () => {
      const r = buildReceiptNotice({ request: issued, receipt: issuedReceipt, student, now: NOW })
      for (const body of [r.email.html, r.email.text]) {
        expect(body).toContain('Maria Exemplo')
        expect(body).toContain('K-2026-0007')
        expect(body).toContain(RECEIPTS_URL)
        expect(body).not.toContain('123')
        expect(body).not.toContain('2026-11-20')
        expect(body).not.toContain('MOTIVO-SECRETO')
        expect(body).not.toMatch(/kin[ée]sith|naturopath/i)
      }
      expect(r.email.subject).not.toContain('K-2026-0007')
    })

    it('emitido há mais de 15 minutos ou anulado: recusado (409)', () => {
      const old = { ...issuedReceipt, issued_at: new Date(NOW - NOTICE_WINDOW_MS - 1000).toISOString() }
      expect(buildReceiptNotice({ request: issued, receipt: old, student, now: NOW }))
        .toEqual({ kind: 'fail', status: 409, error: 'Notice not allowed' })
      expect(buildReceiptNotice({ request: issued, receipt: voidedReceipt, student, now: NOW }).kind).toBe('fail')
      const future = { ...issuedReceipt, issued_at: new Date(NOW + 5 * 60 * 1000).toISOString() }
      expect(buildReceiptNotice({ request: issued, receipt: future, student, now: NOW }).kind).toBe('fail')
      const fresh = { ...issuedReceipt, issued_at: minutesAgo(14) }
      expect(buildReceiptNotice({ request: issued, receipt: fresh, student, now: NOW }).kind).toBe('send')
    })
  })

  describe('receipt_notice: recibo anulado', () => {
    it('avisa sem o motivo; exige recibo anulado há pouco', () => {
      const r = buildReceiptNotice({ request: voided, receipt: voidedReceipt, student, now: NOW })
      expect(r.kind).toBe('send')
      expect(r.email.subject).toBe('Um recibo de seguro foi anulado')
      expect(r.email.html).not.toContain('MOTIVO-SECRETO')
      expect(r.email.text).not.toContain('MOTIVO-SECRETO')
      expect(r.idempotencyKey).toBe(`receipt-notice/${ID}/voided`)
      expect(buildReceiptNotice({ request: voided, receipt: issuedReceipt, student, now: NOW }).kind).toBe('fail')
      const old = { ...voidedReceipt, voided_at: minutesAgo(16) }
      expect(buildReceiptNotice({ request: voided, receipt: old, student, now: NOW }).kind).toBe('fail')
    })
  })

  describe('receipt_notice: aluno e recibo', () => {
    it('sem email, email inválido, perfil na lixeira ou sem perfil: nada sai', () => {
      for (const s of [
        { ...student, email: null },
        { ...student, email: 'sem-arroba' },
        { ...student, deleted_at: '2026-11-01T00:00:00Z' },
        null
      ]) {
        expect(buildReceiptNotice({ request: issued, receipt: issuedReceipt, student: s, now: NOW }))
          .toEqual({ kind: 'skip', reason: 'no_email' })
      }
    })

    it('recibo inexistente ou de outro id: 404', () => {
      expect(buildReceiptNotice({ request: issued, receipt: null, student, now: NOW }))
        .toEqual({ kind: 'fail', status: 404, error: 'Receipt not found' })
      expect(buildReceiptNotice({ request: issued, receipt: { ...issuedReceipt, id: 'outro' }, student, now: NOW }).kind)
        .toBe('fail')
    })
  })

  describe('receipt_notice: texto', () => {
    it('três línguas pela preferência do aluno; outra ou vazia → pt', () => {
      expect(buildReceiptNoticeContent('issued', 'K-2026-0007', 'Ana', 'pt').subject).toBe('Seu recibo de seguro está disponível')
      expect(buildReceiptNoticeContent('issued', 'K-2026-0007', 'Ana', 'en').subject).toBe('Your insurance receipt is available')
      expect(buildReceiptNoticeContent('issued', 'K-2026-0007', 'Ana', 'fr').subject).toBe("Votre reçu d'assurance est disponible")
      expect(buildReceiptNoticeContent('voided', 'K-2026-0007', 'Ana', 'en').subject).toBe('An insurance receipt was voided')
      expect(buildReceiptNoticeContent('voided', 'K-2026-0007', 'Ana', 'fr').subject).toBe("Un reçu d'assurance a été annulé")
      expect(buildReceiptNoticeContent('issued', 'K-2026-0007', 'Ana', 'es').subject).toBe('Seu recibo de seguro está disponível')
      expect(buildReceiptNoticeContent('issued', 'K-2026-0007', 'Ana', null).subject).toBe('Seu recibo de seguro está disponível')
    })

    it('nome escapado e em uma linha; sem nome, saudação sem nome', () => {
      const c = buildReceiptNoticeContent('issued', 'K-2026-0007', 'Ana <b>X</b>\nY', 'pt')
      expect(c.html).toContain('Olá, Ana &lt;b&gt;X&lt;/b&gt; Y!')
      expect(c.html).not.toContain('<b>X</b>')
      expect(c.text).toContain('Olá, Ana <b>X</b> Y!')
      expect(buildReceiptNoticeContent('issued', 'K-2026-0007', '', 'pt').text.startsWith('Olá!')).toBe(true)
    })

    it('emitido diz que o PDF não vai anexado; anulado não fala de anexo', () => {
      expect(buildReceiptNoticeContent('issued', 'K-2026-0007', 'Ana', 'pt').text).toContain('não vai anexado')
      expect(buildReceiptNoticeContent('voided', 'K-2026-0007', 'Ana', 'pt').text).not.toContain('anexado')
    })
  })

  // Prévia para o dono: só roda com RECEIPT_NOTICE_PREVIEW_DIR=<pasta> (grava 6 .html e 6 .txt).
  const previewDir = process.env.RECEIPT_NOTICE_PREVIEW_DIR
  describe.runIf(Boolean(previewDir))('prévia dos emails', () => {
    it('grava os 6 emails', () => {
      mkdirSync(previewDir, { recursive: true })
      for (const event of ['issued', 'voided']) {
        for (const lang of ['pt', 'en', 'fr']) {
          const c = buildReceiptNoticeContent(event, 'K-2026-0007', 'Maria Exemplo', lang)
          writeFileSync(join(previewDir, `${event}-${lang}.html`), c.html)
          writeFileSync(join(previewDir, `${event}-${lang}.txt`), `Assunto: ${c.subject}\n\n${c.text}\n`)
        }
      }
    })
  })
  ```
- Pronto quando: `npx vitest run src/tests/receiptNotice.test.js src/tests/sendEmailPolicy.test.js` passa; `npm run lint` sem erro nesses arquivos.

### 4. [OPUS] Função do site que pede o aviso
- Arquivo: `src/lib/receiptService.js`
- Fazer: acrescentar no fim do arquivo:
  ```js
  // Aviso ao aluno por email (recibo emitido ou anulado). O servidor (send-email,
  // type 'receipt_notice') lê o recibo e o perfil e monta o email na língua do
  // aluno; daqui só vão o id e o evento. Devolve 'sent' ou 'no_email' (aluno sem
  // email no cadastro); erro → exceção.
  export async function notifyStudentAboutReceipt(receiptId, event) {
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: { type: 'receipt_notice', receipt_id: receiptId, event },
    })
    if (error) throw new Error(data?.error || error.message || 'Failed to send email')
    if (data?.skipped === 'no_email') return 'no_email'
    if (!data?.success) throw new Error(data?.error || 'Failed to send email')
    return 'sent'
  }

  // Para a tela: chama sem travar quem chamou (quem chama NÃO usa await) e nunca
  // rejeita. onResult recebe 'sent' | 'no_email' | 'failed'. Falha no email não
  // desfaz nem trava a emissão/anulação.
  export function notifyStudentInBackground(receiptId, event, onResult) {
    return notifyStudentAboutReceipt(receiptId, event)
      .catch(() => 'failed')
      .then(result => {
        try {
          onResult?.(result)
        } catch {
          // o aviso na tela nunca quebra nada
        }
        return result
      })
  }

  // Toast da professora para cada resultado do aviso.
  export const NOTIFY_TOASTS = {
    sent: { type: 'success', key: 'receipts.notify.sent' },
    no_email: { type: 'info', key: 'receipts.notify.noEmail' },
    failed: { type: 'warning', key: 'receipts.notify.failed' },
  }
  ```
- **Não** chamar `notifyStudentAboutReceipt` dentro de `issueReceipt`, `ensureReceiptPdf` nem `voidReceipt` (essas funções continuam iguais).
- Pronto quando: testes do passo 8 passam.

### 5. [OPUS] Emitir: avisar o aluno depois da emissão dar certo
- Arquivo: `src/components/IssueReceiptDialog.jsx`
- Fazer:
  1. Import (linha 18): `import { downloadReceipt, issueReceipt, loadSignatureBytes, NOTIFY_TOASTS, notifyStudentInBackground } from '../lib/receiptService'`
  2. Em `handleIssue`, logo depois da linha `if (profileSaveFailed) toast.error(t('receipts.issue.saveProfileError'))` (ainda dentro do `try`), acrescentar:
     ```js
      // Aviso ao aluno por email, sem await: a emissão já deu certo e não
      // depende do email. Sai também com o PDF pendente ("Gerar PDF" depois não
      // manda outro).
      notifyStudentInBackground(receipt.id, 'issued', result => {
        const { type, key } = NOTIFY_TOASTS[result]
        toast[type](t(key))
      })
     ```
  - Nada mais muda: o aviso fica **depois** de `issueReceipt` (só roda se a RPC deu certo; se ela der erro, o `catch` mostra o erro e nenhum aviso sai).
- Pronto quando: emitir um recibo fecha a tela na mesma hora (sem esperar o email) e aparece o toast do aviso em seguida.

### 6. [OPUS] Anular: avisar o aluno depois da anulação dar certo
- Arquivo: `src/components/ReceiptsList.jsx`
- Fazer:
  1. Import (linha 15): `import { ensureReceiptPdf, fetchReceipt, NOTIFY_TOASTS, notifyStudentInBackground, voidReceipt } from '../lib/receiptService'`
  2. Em `handleVoid`, trocar:
     ```js
      await voidReceipt(voidTarget.id, reason)
      toast.success(t('receipts.void.success', { number: voidTarget.receipt_number }))
     ```
     por:
     ```js
      await voidReceipt(voidTarget.id, reason)
      toast.success(t('receipts.void.success', { number: voidTarget.receipt_number }))
      // Aviso ao aluno por email (sem o motivo), sem await: a anulação já deu certo.
      notifyStudentInBackground(voidTarget.id, 'voided', result => {
        const { type, key } = NOTIFY_TOASTS[result]
        toast[type](t(key))
      })
     ```
  - `handleGeneratePdf` **não muda** (não manda email).
- Pronto quando: anular fecha a janela na mesma hora e aparece o toast do aviso em seguida; "Gerar PDF" não mostra toast de aviso.

### 7. [SONNET] Textos pt / en / fr
- Arquivos: `src/locales/pt.json`, `src/locales/en.json`, `src/locales/fr.json`
- Fazer, em cada arquivo, dentro de `"receipts"`:
  1. Trocar o valor de `receipts.dialog.confirmText` e de `receipts.void.description` pelos da tabela "Textos" abaixo (o texto antigo continua igual, só ganha a frase do email no fim).
  2. Acrescentar o bloco `"notify"` logo depois do bloco `"void": { ... }` (antes de `"page"`), com as chaves `sent`, `noEmail`, `failed` da tabela.
- Não mexer em nenhuma outra chave. Conferir que os 3 arquivos continuam JSON válido (`node -e "for (const l of ['pt','en','fr']) JSON.parse(require('fs').readFileSync('src/locales/'+l+'.json','utf8'))"`).
- Pronto quando: os testes do passo 8 (chaves nas 3 línguas) passam.

### 8. [SONNET] Testes do site
- Arquivo: `src/tests/receiptNotify.test.js` (novo)
- Fazer: criar com este conteúdo:
  ```js
  // @vitest-environment node
  import { describe, it, expect, vi, beforeEach } from 'vitest'
  import pt from '@/locales/pt.json'
  import en from '@/locales/en.json'
  import fr from '@/locales/fr.json'

  const invoke = vi.fn()
  vi.mock('@/lib/supabase', () => ({
    supabase: { functions: { invoke: (...args) => invoke(...args) }, rpc: vi.fn(), storage: { from: () => ({}) } },
  }))
  vi.mock('@/lib/receiptPdf', () => ({ generateReceiptPdf: vi.fn() }))

  const { notifyStudentAboutReceipt, notifyStudentInBackground, NOTIFY_TOASTS } = await import('@/lib/receiptService')

  const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj)

  describe('notifyStudentAboutReceipt', () => {
    beforeEach(() => invoke.mockReset())

    it('manda só o type, o id e o evento para a send-email', async () => {
      invoke.mockResolvedValue({ data: { success: true, data: { id: 'x' } }, error: null })
      expect(await notifyStudentAboutReceipt('r1', 'issued')).toBe('sent')
      expect(invoke).toHaveBeenCalledWith('send-email', {
        body: { type: 'receipt_notice', receipt_id: 'r1', event: 'issued' },
      })
    })

    it('aluno sem email: "no_email"', async () => {
      invoke.mockResolvedValue({ data: { success: false, skipped: 'no_email' }, error: null })
      expect(await notifyStudentAboutReceipt('r1', 'voided')).toBe('no_email')
    })

    it('erro da função ou resposta sem sucesso: exceção', async () => {
      invoke.mockResolvedValueOnce({ data: null, error: new Error('403') })
      await expect(notifyStudentAboutReceipt('r1', 'issued')).rejects.toThrow()
      invoke.mockResolvedValueOnce({ data: { success: false }, error: null })
      await expect(notifyStudentAboutReceipt('r1', 'issued')).rejects.toThrow()
    })
  })

  describe('notifyStudentInBackground', () => {
    beforeEach(() => invoke.mockReset())

    it('nunca rejeita: erro vira "failed"', async () => {
      invoke.mockRejectedValue(new Error('rede'))
      const onResult = vi.fn()
      await expect(notifyStudentInBackground('r1', 'issued', onResult)).resolves.toBe('failed')
      expect(onResult).toHaveBeenCalledWith('failed')
    })

    it('passa "sent" e "no_email" para a tela', async () => {
      const onResult = vi.fn()
      invoke.mockResolvedValueOnce({ data: { success: true }, error: null })
      await notifyStudentInBackground('r1', 'issued', onResult)
      invoke.mockResolvedValueOnce({ data: { success: false, skipped: 'no_email' }, error: null })
      await notifyStudentInBackground('r1', 'voided', onResult)
      expect(onResult.mock.calls).toEqual([['sent'], ['no_email']])
    })

    it('erro no aviso da tela não sobe', async () => {
      invoke.mockResolvedValue({ data: { success: true }, error: null })
      await expect(notifyStudentInBackground('r1', 'issued', () => { throw new Error('toast') })).resolves.toBe('sent')
    })
  })

  describe('textos do aviso', () => {
    it('os 3 toasts existem em pt, en e fr', () => {
      for (const { key } of Object.values(NOTIFY_TOASTS)) {
        for (const locale of [pt, en, fr]) expect(typeof get(locale, key)).toBe('string')
      }
    })

    it('as confirmações de emitir e anular falam do email nas 3 línguas', () => {
      expect(pt.receipts.dialog.confirmText).toMatch(/e-mail/)
      expect(en.receipts.dialog.confirmText).toMatch(/email/)
      expect(fr.receipts.dialog.confirmText).toMatch(/courriel/)
      expect(pt.receipts.void.description).toMatch(/e-mail/)
      expect(en.receipts.void.description).toMatch(/email/)
      expect(fr.receipts.void.description).toMatch(/courriel/)
    })
  })
  ```
- Pronto quando: `npx vitest run src/tests/receiptNotify.test.js` passa.

### 9. [SONNET] Prévia do texto para o dono (antes do revisor e do merge)
- Fazer:
  1. Gerar os arquivos: `RECEIPT_NOTICE_PREVIEW_DIR=<pasta de rascunho da sessão>/previa-recibo npx vitest run src/tests/receiptNotice.test.js` (a pasta de rascunho da sessão, **fora do repositório**; nada disso é commitado).
  2. Mostrar ao dono: publicar uma página privada (Artifact) com os 6 emails (emitido e anulado × pt, en, fr), cada um com o assunto em cima e o HTML do `.html` correspondente embaixo (por exemplo em `<iframe srcdoc>`); nome de exemplo "Maria Exemplo", recibo "K-2026-0007". Se não der para publicar, colar na conversa os 6 `.txt`.
  3. **Esperar o "ok" do dono no texto.** Se ele pedir mudança, mudar **só** `NOTICE_TEXTS` em `receiptNotice.ts` (e o assunto esperado nos testes do passo 3, se mudar o assunto), rodar o passo 9.1 de novo e mostrar outra vez.
- Pronto quando: o dono aprovou o texto (anotar a data da aprovação no PENDENCIAS, passo 10).

### 10. [SONNET] Atualizar `docs/PENDENCIAS.md`
- Arquivo: `docs/PENDENCIAS.md`
- Fazer:
  1. Linha `_Última atualização: ..._` → `_Última atualização: 2026-11-21 (email ao aluno quando o recibo é emitido/anulado: feito no código; falta o deploy da send-email, o merge e o teste)_`.
  2. "A fazer": marcar o item "Recibos: email ao aluno quando um recibo é emitido ou anulado" como `[x]` e acrescentar no começo do texto: `**Feito no código (2026-11-21), plano docs/planos/2026-11-21-recibo-email-aluno.md; texto aprovado pelo dono em <data>. Falta o deploy da send-email (antes do merge), o merge e o teste no site.**` (manter o resto do texto).
  3. "A fazer": item novo (aberto): `- [ ] **Recibos: login que volta para "Meus recibos" (vem do email do recibo, 2026-11-21).** Hoje, aluno deslogado que toca em "Ver meus recibos" no email cai na página inicial (rota protegida manda para "/"), e depois do login vai para o painel. Mexe em login/rotas protegidas → planejador + dev-critico.` — **só se** o dono não decidir outra coisa na dúvida 1.
  4. "SQL / deploys pendentes": item novo (aberto): `- [ ] **Deploy da Edge Function send-email (aviso de recibo ao aluno) — ANTES do merge do PR.** Comando: supabase functions deploy send-email --project-ref kezfpyhsejhjcvlbmejq (sem --no-verify-jwt: o verify_jwt continua ligado). Sem SQL. A função nova é compatível com o site no ar (só acrescenta o type receipt_notice). Reversão: fazer o deploy de novo a partir do main antes deste PR.`
  5. "Testes em aberto": item novo (aberto) com os passos de "Manual depois do deploy" (seção "Testes" abaixo).
- Pronto quando: o PENDENCIAS reflete o estado e nada foi marcado `[x]` sem o dono confirmar (só o item de "A fazer" do código).

### 11. [SONNET] Verificação e revisão
- Fazer: `npm run lint`, `npm test`, `npm run build` (informar o resultado real). Conferir `git diff --stat main`: só os arquivos deste plano (`supabase/functions/send-email/{receiptNotice.ts,policy.ts,index.ts}`, `src/lib/receiptService.js`, `src/components/IssueReceiptDialog.jsx`, `src/components/ReceiptsList.jsx`, `src/locales/{pt,en,fr}.json`, `src/tests/{receiptNotice,receiptNotify,sendEmailPolicy}.test.js`, `docs/PENDENCIAS.md`, este plano). Chamar o `revisor` com o caminho deste plano e a branch. Só então push e PR.
- Pronto quando: lint/testes/build ok, revisor aprovou, PR aberto com o bloco "Próxima sessão".

## Textos (pt / en / fr)

### Telas da professora (`src/locales/*.json`)
| chave | pt | en | fr |
|---|---|---|---|
| `receipts.dialog.confirmText` (troca) | Depois de emitido o recibo não pode ser alterado, só anulado. O(a) aluno(a) recebe um e-mail avisando que o recibo está em "Meus recibos". | Once issued, the receipt cannot be changed, only voided. The student gets an email saying the receipt is in "My receipts". | Une fois émis, le reçu ne peut pas être modifié, seulement annulé. L'élève reçoit un courriel l'avisant que le reçu est dans « Mes reçus ». |
| `receipts.void.description` (troca) | Recibo {{number}}. Ele continua no histórico, marcado como anulado. Para corrigir, anule e emita um novo. O(a) aluno(a) recebe um e-mail avisando da anulação (sem o motivo). | Receipt {{number}}. It stays in the history, marked as voided. To correct it, void it and issue a new one. The student gets an email about the voiding (without the reason). | Reçu {{number}}. Il reste dans l'historique, marqué comme annulé. Pour le corriger, annulez-le et émettez-en un nouveau. L'élève reçoit un courriel l'avisant de l'annulation (sans le motif). |
| `receipts.notify.sent` (nova) | Aviso enviado por e-mail ao(à) aluno(a). | Email notice sent to the student. | Avis envoyé par courriel à l'élève. |
| `receipts.notify.noEmail` (nova) | O(a) aluno(a) não tem e-mail no cadastro: o aviso por e-mail não foi enviado. | The student has no email on file: the email notice was not sent. | L'élève n'a pas de courriel au dossier : l'avis par courriel n'a pas été envoyé. |
| `receipts.notify.failed` (nova) | Não foi possível enviar o e-mail de aviso ao(à) aluno(a). O recibo não muda; avise o(a) aluno(a) por outro meio, se precisar. | Could not send the email notice to the student. The receipt is not affected; let the student know another way if needed. | Impossible d'envoyer l'avis par courriel à l'élève. Le reçu n'est pas touché ; prévenez l'élève autrement au besoin. |

Nos JSON, as aspas dentro do texto em pt/en vão escapadas (`\"Meus recibos\"`, `\"My receipts\"`).

### Email ao aluno (`supabase/functions/send-email/receiptNotice.ts`, `NOTICE_TEXTS`) — **o dono aprova antes do merge (passo 9)**
| parte | pt | en | fr |
|---|---|---|---|
| assunto (emitido) | Seu recibo de seguro está disponível | Your insurance receipt is available | Votre reçu d'assurance est disponible |
| assunto (anulado) | Um recibo de seguro foi anulado | An insurance receipt was voided | Un reçu d'assurance a été annulé |
| saudação | Olá, {nome}! (sem nome: Olá!) | Hello, {name}! (Hello!) | Bonjour, {nom}! (Bonjour!) |
| emitido, 1ª frase | Emitimos um recibo de seguro para você: nº K-2026-0007. | We have issued an insurance receipt for you: no. K-2026-0007. | Nous avons émis un reçu d'assurance à votre nom : nº K-2026-0007. |
| emitido, 2ª frase | Para baixar o PDF e enviar ao seu seguro, entre no Portal do Aluno e abra "Meus recibos". | To download the PDF and send it to your insurer, log in to the Student Portal and open "My receipts". | Pour télécharger le PDF et l'envoyer à votre assureur, connectez-vous au Portail Étudiant et ouvrez « Mes reçus ». |
| anulado, 1ª frase | O recibo de seguro nº K-2026-0007 foi anulado e não vale mais. | Insurance receipt no. K-2026-0007 was voided and is no longer valid. | Le reçu d'assurance nº K-2026-0007 a été annulé et n'est plus valide. |
| anulado, 2ª frase | Se você já enviou este recibo ao seu seguro, fale com a gente. Se um recibo novo foi emitido no lugar dele, ele está em "Meus recibos", no Portal do Aluno. | If you have already sent this receipt to your insurer, please contact us. If a new receipt was issued to replace it, you will find it in "My receipts" on the Student Portal. | Si vous avez déjà envoyé ce reçu à votre assureur, contactez-nous. Si un nouveau reçu a été émis pour le remplacer, vous le trouverez dans « Mes reçus », sur le Portail Étudiant. |
| botão (link `https://josipilates.com/student/receipts`) | Ver meus recibos | See my receipts | Voir mes reçus |
| como entrar | Se você não estiver conectado(a), entre no Portal do Aluno com o seu e-mail e a sua senha e toque em "Meus recibos". | If you are not logged in, log in to the Student Portal with your email and password, then tap "My receipts". | Si vous n'êtes pas connecté(e), connectez-vous au Portail Étudiant avec votre courriel et votre mot de passe, puis touchez « Mes reçus ». |
| só no emitido | Por segurança, o recibo não vai anexado a este e-mail. | For your privacy, the receipt is not attached to this email. | Pour protéger vos renseignements, le reçu n'est pas joint à ce courriel. |
| contato | Dúvidas? Mande uma mensagem pelo WhatsApp: +1(438)274-8396 | Questions? Send us a message on WhatsApp: +1(438)274-8396 | Des questions ? Envoyez-nous un message sur WhatsApp : +1(438)274-8396 |
| assinatura | Com carinho, / Equipe Josi Pilates | With care, / Josi Pilates Team | Avec soin, / Équipe Josi Pilates |
| título no cabeçalho verde | Recibo de seguro disponível / Recibo de seguro anulado | Insurance receipt available / Insurance receipt voided | Reçu d'assurance disponible / Reçu d'assurance annulé |

Remetente: `Josi Pilates <josi@josipilates.com>` (fixo no servidor). Sem anexo, sem Reply-To.

## Banco de dados
- SQL: **não** (sem migration, sem teste SQL, sem reversão SQL). O servidor só **lê** `insurance_receipts` e `profiles` com service_role (que já tem SELECT).
- Ordem: **deploy da `send-email` antes do merge** — motivo: o site novo pede `type: 'receipt_notice'`; com a função antiga no ar, ela recusa (400) e cada emissão/anulação mostra "Não foi possível enviar o e-mail de aviso" (nada quebra, mas nenhum aviso sai até o deploy). A função nova com o site antigo no ar não muda nada (ninguém pede o type novo; contato, boas-vindas e envios da professora iguais).
- Edge Function a publicar: **`send-email`** — `supabase functions deploy send-email --project-ref kezfpyhsejhjcvlbmejq` (sem `--no-verify-jwt`; o `verify_jwt` continua ligado, como na versão no ar). Os arquivos novos/alterados da função: `index.ts`, `policy.ts`, `receiptNotice.ts` (o `signupWelcome.ts` é importado e vai junto).

## Testes
- Automáticos: `npm run lint`, `npm test`, `npm run build` + testes novos: `src/tests/receiptNotice.test.js` (servidor: permissão, pedido, janela de 15 min, idempotência, sem email, conteúdo sem valores/datas/tipo/motivo, 3 línguas, escape), `src/tests/receiptNotify.test.js` (site: corpo enviado, resultados, nunca rejeita, textos nas 3 línguas), 1 teste novo em `src/tests/sendEmailPolicy.test.js`.
- Manual depois do deploy da `send-email` e do merge (usar um **aluno de teste** com um email que o dono lê):
  1. **Emitir:** ficha do aluno de teste → "Emitir recibo" → a confirmação diz que o aluno recebe um e-mail → emitir. A tela fecha na hora; aparecem "Recibo ... emitido." e "Aviso enviado por e-mail ao(à) aluno(a).". Chega o email "Seu recibo de seguro está disponível", de `josi@josipilates.com`, **sem anexo**, com o número certo e sem valores/datas.
  2. **Link:** no celular/navegador onde o aluno de teste está logado, "Ver meus recibos" abre "Meus recibos" com o recibo. Numa janela anônima (deslogado), o link cai na página inicial: entrar como o aluno → painel → "Meus recibos" (limitação conhecida, dúvida 1).
  3. **Línguas:** mudar o idioma do aluno de teste para English e emitir (ou anular) outro → email em inglês; depois Français → em francês. Voltar o idioma original no fim.
  4. **Anular:** anular um recibo de teste com um motivo → a janela diz que o aluno recebe um e-mail; toasts "Recibo ... anulado." e "Aviso enviado ...". Chega "Um recibo de seguro foi anulado" **sem o motivo**.
  5. **Sem reenvio:** "Gerar PDF" (se algum recibo de teste estiver com PDF pendente) não mostra toast de aviso e não manda email. Emitir/anular uma vez = um email só.
  6. **Logs** (Supabase → Edge Functions → `send-email` → Logs): `Email sent: id=... mode=receipt_notice caller=staff recipients=1`, sem email, nome nem número.
  7. **Regressão:** formulário de contato do site, email de créditos (ficha do aluno → créditos) e "Esqueci a senha" continuam chegando.
  8. Opcional (console, logado como **aluno** de teste): `supabase.functions.invoke('send-email', { body: { type: 'receipt_notice', receipt_id: '<id de um recibo dele>', event: 'issued' } })` → erro (403), nenhum email.

## Riscos e como voltar atrás
- **Email não sai** (função antiga no ar, Resend fora, chave errada): a emissão/anulação continua funcionando; a professora vê o toast amarelo. Conferir se o deploy foi feito e os logs da `send-email`.
- **Aviso duplicado:** bloqueado pela janela de 15 min, pelo `Idempotency-Key` (24 h) e por o site só chamar em `handleIssue`/`handleVoid` (com `issuingRef`/`voiding` impedindo clique duplo).
- **Aluno deslogado cai na página inicial** ao tocar no link (comportamento atual das rotas protegidas): o texto do email ensina a entrar; correção à parte (dúvida 1).
- **PDF pendente na emissão:** email sai e o aluno vê "Em preparação" até "Gerar PDF" (dúvida 2).
- **Se quebrar:** GitHub → PR mergeado → **Revert** → mergear o PR de reversão; ou Vercel → Deployments → deploy anterior → **Promote to Production**. A `send-email` nova pode ficar no ar (é compatível com o site antigo); se for preciso voltar a função também: no `main` depois do revert, `supabase functions deploy send-email --project-ref kezfpyhsejhjcvlbmejq`. Sem SQL de reversão.

## Bloco "Próxima sessão" (o que a sessão principal escreve no fim)
1. Merge do PR (link) — **só depois** do passo 2.
2. Não tem SQL. **Antes do merge**, deploy da Edge Function: `supabase functions deploy send-email --project-ref kezfpyhsejhjcvlbmejq`. Ordem: **deploy antes do merge** (com a função antiga, o site novo não consegue mandar o aviso; a função nova não muda nada para o site antigo).
3. O que testar: os passos 1 a 8 de "Manual depois do deploy" acima.
4. **Se quebrar:** a linha "Se quebrar" de "Riscos e como voltar atrás".
5. Resultado do `revisor` em uma linha.
6. Encerrar a sessão só depois do teste; sessão nova em Sonnet com: `Comece do main atualizado. Leia docs/PENDENCIAS.md. Quero fazer: [tarefa].`

## Dúvidas para o dono (nenhuma bloqueia; o plano segue as respostas padrão)
1. **Link para aluno deslogado:** hoje, quem não está logado e toca em "Ver meus recibos" cai na **página inicial** do site (não no login), e depois de entrar vai para o painel (onde tem "Meus recibos"). O email já explica como entrar. Quer que o login passe a voltar direto para "Meus recibos"? Padrão: **sim, mas num PR separado** (mexe em login/rotas protegidas, que é área crítica) — fica como item novo em "A fazer". Alternativa no mesmo PR: o botão do email apontar para `josipilates.com/login` (sempre funciona, com um toque a mais em "Meus recibos").
2. **PDF que falha na emissão (raro):** o email sai mesmo assim e o aluno vê "Em preparação" até a Josi tocar em "Gerar PDF" (que não manda outro email). Padrão: **assim**. Alternativa: segurar o email e mandar só quando o PDF ficar pronto (aí "Gerar PDF" mandaria o primeiro e único aviso desse recibo; precisa de mais código).
3. **Número do recibo no email:** o número (ex.: K-2026-0007) vai no corpo, não no assunto. A letra K/N indica o tipo para quem conhece a regra. Padrão: **mostrar o número** (o aluno precisa saber qual recibo foi anulado); sem tipo por extenso, valores nem datas.
4. **Toast verde "Aviso enviado"** para a Josi a cada recibo: padrão **sim** (confirma que o automático funcionou). Se incomodar, fica só o aviso de falha/sem e-mail.
5. **Política de Privacidade:** o email é aviso de serviço sobre um documento do próprio aluno, sem dados de saúde; a política já cobre email para "fornecer e gerenciar seus serviços". Padrão: **não mexer** no texto legal.
