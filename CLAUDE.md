# Josi Pilates — instruções para o Claude

**Toda sessão nova começa do `main` atualizado (`git pull origin main`) e lendo `docs/PENDENCIAS.md`** (estado atual, testes em aberto, o que está por fazer).
Modelos e agentes: a sessão roda em **Sonnet** e executa; **todo planejamento é do agente `planejador` (Opus)**, passos críticos vão para o `dev-critico` (Opus), e o `revisor` (Opus) revisa o diff uma vez antes do push, só nas tarefas de risco (banco, auth, créditos/pagamentos, emails, dados pessoais, textos legais). Regras completas: `.claude/rules/escolha-de-esforco.md` — seguir sempre.
**Primeira coisa de toda sessão, antes da tarefa: conferir o modelo da sessão principal** (ferramenta `get_session` do claude-code-remote, sem `session_id`: campo `session_context.model`; sem essa ferramenta, o modelo informado no prompt do sistema). Se não for Sonnet, avisar o dono em uma linha ("Esta sessão está em [modelo], não em Sonnet: reabra em Sonnet para economizar, ou diga para seguir assim") e esperar a resposta antes de começar. Os agentes `planejador`, `dev-critico` e `revisor` rodam sempre em Opus (fixado em `.claude/agents/`), seja qual for o modelo da sessão.

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
4. **Se quebrar:** como voltar atrás (Revert do PR no GitHub, ou Promote to Production do deploy anterior na Vercel; e o SQL de reversão, se houver).
5. Encerrar esta sessão (só depois do teste do passo 3).
6. Abrir uma sessão nova no Claude Code, no repositório `HenriquedaFonte/pilatesApp`, com o modelo **Sonnet** (esforço medium).
7. A primeira mensagem, pronta para colar (em bloco de código), sempre neste formato:
   ```
   Comece do main atualizado. Leia docs/PENDENCIAS.md. Quero fazer: [tarefa].
   ```
