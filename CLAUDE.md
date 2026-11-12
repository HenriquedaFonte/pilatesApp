# Josi Pilates — instruções para o Claude

**Toda sessão nova começa do `main` atualizado (`git pull origin main`) e lendo `docs/PENDENCIAS.md`** (estado atual, testes em aberto, o que está por fazer).
Regras de esforço e quando usar o agente `dev-critico`: `.claude/rules/escolha-de-esforco.md`.

## O projeto
Aplicação web de um estúdio de Pilates em Montreal (josipilates.com).
- **Landing page pública:** `src/pages/StudioHome.jsx`, CSS em `src/index.css` (escopo `.studio-home-site`, usa CSS nesting). Trilíngue PT/FR/EN via i18next (`src/locales/pt.json`, `en.json`, `fr.json`). Fonte única: Hanken Grotesk (`--serif` e `--font` apontam para ela).
- **Sistema interno (rotas protegidas):** gestão de alunos, check-in, histórico de créditos, pagamentos, agendamento, relatórios. Página principal: `src/pages/TeacherStudents.jsx`.

## Stack
- Vite + React, Tailwind CSS + shadcn/ui (Radix), i18next
- Supabase (Postgres + Auth + Edge Functions), project ref `kezfpyhsejhjcvlbmejq`
- Email: Resend API via Edge Function `supabase/functions/send-email/` (cliente em `src/lib/emailService.js`)
- Deploy: Vercel, a partir da branch `main` → josipilates.com
- Repositório: `HenriquedaFonte/pilatesApp`

## Regras fixas
1. Uma tarefa, uma sessão, um PR.
2. Todo texto visível ao usuário existe nas três línguas (pt, en, fr).
3. Antes do push: rodar `npm run lint`, `npm test` e `npm run build` e informar o resultado real.
4. Nunca commitar segredos (`.env`, chaves, credenciais, dumps de banco).
5. Mudança de banco = migration nova em `supabase/migrations/` + o SQL entregue no bloco "Próxima sessão".
6. Mudança em Edge Function = o comando de deploy no bloco "Próxima sessão":
   `supabase functions deploy <nome> --project-ref kezfpyhsejhjcvlbmejq`
7. Push na branch da sessão e PR para `main`. Nunca push direto na `main`.
8. Teste (de site, SQL ou deploy) só é marcado como feito (`[x]`) em `docs/PENDENCIAS.md` quando o usuário disser que fez. Sem essa confirmação, continua aberto (`[ ]`) em "Testes em aberto" até ele poder fazer. Vale também para SQL e deploys pendentes.

## Bloco "Próxima sessão" (obrigatório no fim de todo push)
Antes, atualizar `docs/PENDENCIAS.md` no mesmo PR. Depois, terminar com passos numerados:
1. Merge do PR (com o link).
2. SQL para rodar no Supabase, ou "não tem SQL". Se mudou Edge Function, o comando de deploy.
   Sempre dizer a ordem: **SQL antes do merge** (o código novo depende do banco alterado), **merge antes do SQL** (o SQL quebraria o site no ar) ou **tanto faz** (independentes), com o motivo.
3. O que testar depois do deploy.
4. Encerrar esta sessão.
5. Abrir uma sessão nova no Claude Code, no repositório `HenriquedaFonte/pilatesApp`, com o esforço em medium.
6. A primeira mensagem, pronta para colar (em bloco de código), sempre neste formato:
   ```
   Comece do main atualizado. Leia docs/PENDENCIAS.md. Quero fazer: [tarefa].
   ```
