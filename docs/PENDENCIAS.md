# Pendências — Josi Pilates

> Memória entre sessões. Toda sessão nova começa lendo este arquivo.
> No fim de cada tarefa: "Atualize o PENDENCIAS".

_Última atualização: 2026-11-12_

## Estado atual
- Produção: josipilates.com (Vercel, branch `main`).
- Processo de trabalho com o Claude configurado: `CLAUDE.md`, agente `dev-critico`, regra de esforço e este arquivo.

## Testes em aberto (usuário)
- [ ] **Segurança de `profiles` (migration `20261112010000`):** depois de rodar o SQL (ver "SQL / deploys pendentes"):
  1. Rodar `docs/testes/seguranca-privilegios-diagnostico.sql` no SQL Editor (só leitura) e conferir com o "Esperado" do topo do arquivo: guarda `SECURITY INVOKER`, `is_staff` e os invólucros `update_class_balance`/`mark_attendance` `SECURITY DEFINER` com `search_path=public`, `*_impl` sem EXECUTE para ninguém, `anon=false` em tudo, trigger `ATIVO`, só as 4 policies `profiles_*`.
  2. Abrir `docs/testes/seguranca-privilegios-teste.sql`, trocar `<UUID_ALUNO>`, `<UUID_ALUNO_B>` e `<UUID_PROFESSORA>` por ids reais e rodar. Sucesso = nenhum erro (termina em ROLLBACK, nada fica gravado). Erro "FALHOU: ..." diz o que falhou.
  3. No site, como professora: lista de alunos carrega; adicionar e remover créditos de um aluno (saldo e histórico atualizam); fazer check-in (presença debita, histórico e check-in aparecem); editar observações e ativar/desativar aluno; relatórios abrem.
  4. No site, como aluno: painel, histórico e "Meu perfil" carregam; editar nome/telefone/email/idioma salva.
- [ ] **Story 3.1 / AC-7:** depois de rodar a migration 3.1 **e a correção de segurança acima**, abrir `docs/testes/3.1-rls-seguro-e-credenciais.sql`, trocar `<UUID_ALUNO_A>`, `<UUID_ALUNO_B>` e `<UUID_PROFESSORA>` por ids reais de `profiles` e rodar no SQL Editor. Sucesso = nenhum erro (termina em ROLLBACK, nada fica gravado). Erro "AC-7 FALHOU: ..." diz o que falhou.

## SQL / deploys pendentes
- [ ] **URGENTE — segurança de `profiles` e RPCs de crédito:** rodar no SQL Editor, de uma vez, o conteúdo de `supabase/migrations/20261112010000_fix_profiles_privilege_escalation_and_rls.sql`. Antes, rodar o diagnóstico e guardar o resultado. Idempotente, não mexe em dados; se algo falhar no meio, nada é aplicado. Depois, rodar o diagnóstico de novo e o teste (ver "Testes em aberto"). Reversão (reabre as falhas, só em emergência): `docs/testes/seguranca-privilegios-reversao.sql`.
- [ ] **Story 3.1:** rodar no SQL Editor o conteúdo de `supabase/migrations/20261112000000_create_student_insurance_and_practitioner.sql` (cria `student_insurance`, `practitioner_credentials`, bucket privado `practitioner-signatures` e policies). Idempotente. Depois, conferir em Storage que o bucket aparece como privado.

## A fazer
- [x] **URGENTE (segurança) — `profiles` e RPCs de crédito abertos.** Corrigido no código (migration `20261112010000_fix_profiles_privilege_escalation_and_rls.sql`, testada em Postgres 16 local reproduzindo o estado de produção). **Pendente: rodar o SQL em produção e os testes** (ver acima). O que estava aberto em produção (levantado em 2026-11-12):
  - `prevent_privilege_escalation()` era `SECURITY DEFINER` → o guarda nunca bloqueava: aluno virava professora e se dava créditos.
  - `profiles` tinha só a policy "Allow all authenticated operations" (ALL, `auth.role() = 'authenticated'`) → qualquer aluno lia, editava e apagava qualquer perfil, e podia se inserir como `teacher`.
  - `update_class_balance` (INVOKER) e `mark_attendance` (DEFINER) não conferiam quem chama; aluno e anônimo tinham EXECUTE (anônimo conseguia dar check-in e debitar crédito de qualquer aluno).
  - O que a migration faz: `is_staff()` (DEFINER); guarda `SECURITY INVOKER` que também impede o aluno de mudar `observations`, `is_active`, `deleted_at`, `deleted_by`; 4 policies em `profiles` (própria linha ou staff; INSERT só como `student` sem créditos; DELETE só staff); as RPCs originais viram `*_impl` sem EXECUTE e no lugar entram invólucros `SECURITY DEFINER` que exigem professora/admin (ou service_role) e chamam a original sem mudar nada da lógica.
- [ ] **URGENTE (segurança, dev-critico) — RLS das outras tabelas em produção.** Levantado em 2026-11-12, não corrigido no PR de `profiles`:
  - `attendance`: policies de INSERT e UPDATE para `{public}` com `true` (anônimo inclusive grava e altera).
  - `classes`: policy "Allow anon insert for classes" (anônimo cria aulas).
  - `balance_history`: policy "Students can insert their own balance history" (aluno forja linhas no próprio histórico de créditos/pagamentos).
  - Policies duplicadas em várias tabelas (difícil saber qual vale) e policies que usam o papel `'admin'` (conferir se existe alguém com `role = 'admin'` e se deve existir).
  - Fazer: levantar todas as policies de produção (`SELECT * FROM pg_policies WHERE schemaname = 'public'`), comparar com as migrations do repo e escrever uma migration que deixe só o necessário (aluno lê o que é dele, professora/admin via `is_staff()`, escrita de crédito/histórico só pelas RPCs).
- [ ] **Segurança (menor):** `src/hooks/useAuth.jsx` ainda manda `role: user_metadata.role` no INSERT do perfil quando ele não existe. A policy nova recusa qualquer role diferente de `student`, então não há escalada, mas o insert falharia para quem tiver `role` no metadata; tirar o `role` do insert. `StudentProfile.jsx` muda o `email` só em `profiles` (não no Auth), o que pode deixar os dois diferentes.
- [ ] **Epic 3 — Recibos para seguro saúde** (kinésithérapie e naturopathie). PRD: `docs/prd/PRD-002-recibos-seguro-saude.md`. Stories em `docs/stories/3.1` a `3.7`, uma por sessão, na ordem 3.1 → 3.7. Templates oficiais em `src/assets/receipt-templates/`.
  - [ ] Antes de começar a 3.4/3.5: responder as perguntas em aberto do PRD §7 com a Josi (assinatura em imagem, total com ou sem produtos, formato de data, valor padrão).
  - [x] 3.1 Banco: dados de seguro do aluno + dados profissionais (dev-critico) — migration pronta, **pendente rodar o SQL e o teste AC-7** (ver acima; rodar depois da correção de segurança de `profiles`)
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
