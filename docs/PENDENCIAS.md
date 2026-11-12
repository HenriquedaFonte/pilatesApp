# Pendências — Josi Pilates

> Memória entre sessões. Toda sessão nova começa lendo este arquivo.
> No fim de cada tarefa: "Atualize o PENDENCIAS".

_Última atualização: 2026-11-12_

## Estado atual
- Produção: josipilates.com (Vercel, branch `main`).
- Processo de trabalho com o Claude configurado: `CLAUDE.md`, agente `dev-critico`, regra de esforço e este arquivo.

## Testes em aberto (usuário)
- [ ] **Segurança (aluno virar professora):** depois de rodar a migration `20261112010000` (ver "SQL / deploys pendentes"):
  1. Rodar `docs/testes/seguranca-privilegios-diagnostico.sql` no SQL Editor (só leitura). Esperado: `prevent_privilege_escalation` = `SECURITY INVOKER`; trigger `enforce_privilege_escalation_guard` = `ATIVO`; `update_class_balance` e `mark_attendance` = `SECURITY DEFINER` com dono `postgres`. Se alguma das duas RPCs vier `SECURITY INVOKER`, avisar: a professora perde a troca de créditos.
  2. Abrir `docs/testes/seguranca-privilegios-teste.sql`, trocar `<UUID_ALUNO>` e `<UUID_PROFESSORA>` por ids reais e rodar. Sucesso = nenhum erro (termina em ROLLBACK, nada fica gravado). Erro "FALHOU: ..." diz o que falhou.
  3. No site: como professora, adicionar/remover créditos de um aluno e fazer um check-in (saldo e histórico atualizam). Como aluno, editar nome/telefone em "Meu perfil" (continua salvando).
- [ ] **Story 3.1 / AC-7:** depois de rodar a migration 3.1 **e a correção de segurança acima**, abrir `docs/testes/3.1-rls-seguro-e-credenciais.sql`, trocar `<UUID_ALUNO_A>`, `<UUID_ALUNO_B>` e `<UUID_PROFESSORA>` por ids reais de `profiles` e rodar no SQL Editor. Sucesso = nenhum erro (termina em ROLLBACK, nada fica gravado). Erro "AC-7 FALHOU: ..." diz o que falhou.

## SQL / deploys pendentes
- [ ] **URGENTE — correção de segurança (aluno virar professora):** rodar no SQL Editor o conteúdo de `supabase/migrations/20261112010000_fix_privilege_escalation_security_invoker.sql`. Idempotente, não mexe em dados. Antes e depois, rodar o diagnóstico e o teste (ver "Testes em aberto"). Reversão (reabre a falha, só em emergência): rodar de novo `supabase/migrations/20260620000003_fix_security_trigger_scope.sql`.
- [ ] **Story 3.1:** rodar no SQL Editor o conteúdo de `supabase/migrations/20261112000000_create_student_insurance_and_practitioner.sql` (cria `student_insurance`, `practitioner_credentials`, bucket privado `practitioner-signatures` e policies). Idempotente. Depois, conferir em Storage que o bucket aparece como privado.

## A fazer
- [x] **URGENTE (segurança) — aluno conseguia virar professora.** `public.prevent_privilege_escalation()` era `SECURITY DEFINER`, então `current_user` lá dentro era sempre `postgres` e o guarda liberava tudo (aluno fazia `UPDATE profiles SET role = 'teacher', individual_credits = 99` na própria linha). **Corrigido no código** pela migration `20261112010000_fix_privilege_escalation_security_invoker.sql` (função passa a `SECURITY INVOKER`, `search_path` fixo, bloqueia `authenticated` e `anon`, trigger recriado). Testado em Postgres 16 local. **Pendente: rodar o SQL em produção e os testes** (ver acima).
- [ ] **Segurança (follow-up, dev-critico):** (a) `useAuth.jsx` cria o perfil pelo cliente com `role: user_metadata.role` quando o perfil não existe, e a policy de INSERT só confere o `id` — se um usuário ficar sem linha em `profiles`, ele pode se inserir como `teacher` ou com créditos. Falta um guarda de INSERT (role `student`, créditos 0 para `authenticated`) e tirar o `role` do insert do cliente. (b) Pelas migrations do repositório, a policy "Users can update their own profile" deixa o aluno mudar na própria linha campos que não são role/créditos, como `observations` (anotações da professora), `is_active`, `deleted_at`/`deleted_by` e `email`. (c) As RPCs `update_class_balance` e `mark_attendance` não estão nas migrations: confirmar em produção que verificam se quem chama é professora (o diagnóstico mostra que `authenticated` tem EXECUTE).
- [ ] **Epic 3 — Recibos para seguro saúde** (kinésithérapie e naturopathie). PRD: `docs/prd/PRD-002-recibos-seguro-saude.md`. Stories em `docs/stories/3.1` a `3.7`, uma por sessão, na ordem 3.1 → 3.7. Templates oficiais em `src/assets/receipt-templates/`.
  - [ ] Antes de começar a 3.4/3.5: responder as perguntas em aberto do PRD §7 com a Josi (assinatura em imagem, total com ou sem produtos, formato de data, valor padrão).
  - [x] 3.1 Banco: dados de seguro do aluno + dados profissionais (dev-critico) — migration pronta, **pendente rodar o SQL e o teste AC-7** (ver acima; rodar depois da correção de segurança)
  - [ ] 3.2 UI: campos de seguro no cadastro + perfil profissional
  - [ ] 3.3 Banco + storage: recibos, numeração, anulação (dev-critico)
  - [ ] 3.4 Gerador de PDF (pdf-lib, formulários oficiais)
  - [ ] 3.5 Emissão e histórico (professora) (dev-critico)
  - [ ] 3.6 "Meus recibos" no portal do aluno
  - [ ] 3.7 Política de Privacidade (dev-critico)
- [x] Lint zerado (eram 75 problemas): variáveis e imports sem uso removidos, `scratch/` ignorado, `scripts/` com globais de Node, `react-refresh` desligado para `components/ui` e `useAuth`, e `exhaustive-deps` silenciado linha a linha nos `useEffect` de carga (intencionais).
- [x] Gerenciador de pacotes: o projeto usa **pnpm** (`packageManager` no `package.json`, `pnpm-lock.yaml` atualizado). O `package-lock.json` estava desatualizado e quebrava `npm ci`; foi removido. Instalar com `pnpm install`; os scripts continuam `npm run lint/test/build`.
- [ ] Remover do repositório o arquivo vazio `credenciais google.txt` e adicionar `credenciais*` ao `.gitignore`.

## Regras fixas
- Uma tarefa, uma sessão, um PR.
- Textos sempre nas três línguas (pt, en, fr).
- Tarefas críticas vão para o agente `dev-critico` (ver `.claude/rules/escolha-de-esforco.md`).
- Todo push termina com o bloco "Próxima sessão" (ver `CLAUDE.md`).
