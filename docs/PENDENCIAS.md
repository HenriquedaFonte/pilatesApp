# Pendências — Josi Pilates

> Memória entre sessões. Toda sessão nova começa lendo este arquivo.
> No fim de cada tarefa: "Atualize o PENDENCIAS".

_Última atualização: 2026-11-12_

## Estado atual
- Produção: josipilates.com (Vercel, branch `main`).
- Processo de trabalho com o Claude configurado: `CLAUDE.md`, agente `dev-critico`, regra de esforço e este arquivo.

## Testes em aberto (usuário)
- [ ] **Story 3.1 / AC-7:** depois de rodar a migration 3.1, abrir `docs/testes/3.1-rls-seguro-e-credenciais.sql`, trocar `<UUID_ALUNO_A>`, `<UUID_ALUNO_B>` e `<UUID_PROFESSORA>` por ids reais de `profiles` e rodar no SQL Editor. Sucesso = nenhum erro (termina em ROLLBACK, nada fica gravado). Erro "AC-7 FALHOU: ..." diz o que falhou. Esperado hoje: falha no pré-requisito do `role` até a correção abaixo ser aplicada.

## SQL / deploys pendentes
- [ ] **Story 3.1:** rodar no SQL Editor o conteúdo de `supabase/migrations/20261112000000_create_student_insurance_and_practitioner.sql` (cria `student_insurance`, `practitioner_credentials`, bucket privado `practitioner-signatures` e policies). Idempotente. Depois, conferir em Storage que o bucket aparece como privado.

## A fazer
- [ ] **URGENTE (segurança, dev-critico) — aluno consegue virar professora.** `public.prevent_privilege_escalation()` (migrations `20260620000001` e `20260620000003`) é `SECURITY DEFINER`; dentro dela `current_user` é sempre o dono (`postgres`), então o `IF current_user IS DISTINCT FROM 'authenticated' THEN RETURN NEW` libera tudo. Reproduzido em Postgres local: aluno autenticado fez `UPDATE profiles SET role = 'teacher', individual_credits = 99` na própria linha. Não verificado em produção. Diagnóstico (só leitura, dentro de transação com ROLLBACK) e correção proposta (`ALTER FUNCTION public.prevent_privilege_escalation() SECURITY INVOKER;`, testada localmente: bloqueia role/créditos via REST e mantém liberado para RPCs `SECURITY DEFINER`, service_role e SQL direto) ficam para uma sessão própria, antes da Story 3.2.
- [ ] **Epic 3 — Recibos para seguro saúde** (kinésithérapie e naturopathie). PRD: `docs/prd/PRD-002-recibos-seguro-saude.md`. Stories em `docs/stories/3.1` a `3.7`, uma por sessão, na ordem 3.1 → 3.7. Templates oficiais em `src/assets/receipt-templates/`.
  - [ ] Antes de começar a 3.4/3.5: responder as perguntas em aberto do PRD §7 com a Josi (assinatura em imagem, total com ou sem produtos, formato de data, valor padrão).
  - [x] 3.1 Banco: dados de seguro do aluno + dados profissionais (dev-critico) — migration pronta, **pendente rodar o SQL e o teste AC-7** (ver acima)
  - [ ] 3.2 UI: campos de seguro no cadastro + perfil profissional
  - [ ] 3.3 Banco + storage: recibos, numeração, anulação (dev-critico)
  - [ ] 3.4 Gerador de PDF (pdf-lib, formulários oficiais)
  - [ ] 3.5 Emissão e histórico (professora) (dev-critico)
  - [ ] 3.6 "Meus recibos" no portal do aluno
  - [ ] 3.7 Política de Privacidade (dev-critico)
- [ ] `npm run lint` falha no `main` com 75 problemas (56 erros, 19 avisos) pré-existentes, a maioria variáveis não usadas (ex.: `TeacherTestimonials.jsx`). Limpar numa sessão própria.
- [ ] Remover do repositório o arquivo vazio `credenciais google.txt` e adicionar `credenciais*` ao `.gitignore`.

## Regras fixas
- Uma tarefa, uma sessão, um PR.
- Textos sempre nas três línguas (pt, en, fr).
- Tarefas críticas vão para o agente `dev-critico` (ver `.claude/rules/escolha-de-esforco.md`).
- Todo push termina com o bloco "Próxima sessão" (ver `CLAUDE.md`).
