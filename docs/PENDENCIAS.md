# Pendências — Josi Pilates

> Memória entre sessões. Toda sessão nova começa lendo este arquivo.
> No fim de cada tarefa: "Atualize o PENDENCIAS".

_Última atualização: 2026-11-12_

## Estado atual
- Produção: josipilates.com (Vercel, branch `main`).
- Processo de trabalho com o Claude configurado: `CLAUDE.md`, agente `dev-critico`, regra de esforço e este arquivo.

## Testes em aberto (usuário)
- [ ] _(nenhum registrado)_

## SQL / deploys pendentes
- [ ] _(nenhum registrado)_

## A fazer
- [ ] **Epic 3 — Recibos para seguro saúde** (kinésithérapie e naturopathie). PRD: `docs/prd/PRD-002-recibos-seguro-saude.md`. Stories em `docs/stories/3.1` a `3.7`, uma por sessão, na ordem 3.1 → 3.7. Templates oficiais em `src/assets/receipt-templates/`.
  - [ ] Antes de começar a 3.4/3.5: responder as perguntas em aberto do PRD §7 com a Josi (assinatura em imagem, total com ou sem produtos, formato de data, valor padrão).
  - [ ] 3.1 Banco: dados de seguro do aluno + dados profissionais (dev-critico)
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
