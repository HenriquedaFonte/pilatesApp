# PRD-001 — Proteção de Dados & Auditoria de Ações Destrutivas
**Josi Pilates Management System — Brownfield Enhancement**
**Autor:** Morgan (PM) | **Data:** 2026-06-17 | **Status:** Draft

---

## 1. Problema & Contexto

### Incidente Gatilho
Uma aluna (Talita Cavalcanti, tata_mc@hotmail.com) foi excluída do sistema com todo o seu histórico de aulas, créditos e check-ins. Não há como saber quem executou a ação nem recuperar os dados. O sistema opera desde sua criação sem:
- Log de auditoria de ações destrutivas
- Mecanismo de soft delete com janela de recuperação
- Backup automático de dados críticos
- Confirmação reforçada para operações irreversíveis

### Por que isso aconteceu?
O design inicial priorizou funcionalidade sobre governança. A função `manage-student` executa cascade delete completo (auth + profile + check_ins + balance_history) sem registrar quem invocou a operação. A UI apresenta um botão "Excluir Permanentemente" com apenas um modal de confirmação — insuficiente para uma operação tão destrutiva.

### Impacto Real
- Perda permanente de histórico de aulas de uma aluna ativa
- Impossibilidade de identificar responsável pela exclusão
- Risco legal/LGPD: aluna pode contestar registros inexistentes
- Erosão de confiança na plataforma

---

## 2. Objetivos

| # | Objetivo | Métrica de Sucesso |
|---|----------|--------------------|
| 1 | Toda ação destrutiva deve ser rastreável | 100% das exclusões registradas com autor, timestamp e dados |
| 2 | Dados de alunos devem ser recuperáveis por 90 dias | Restauração completa em < 5 min via painel admin |
| 3 | Exclusão permanente deve exigir fricção intencional | Taxa de exclusões acidentais = 0 após deploy |
| 4 | Dados históricos preservados mesmo após desativação | check_ins e balance_history disponíveis mesmo sem perfil ativo |

---

## 3. Usuários Afetados

- **Professora (Josiane):** precisa de controle total e rastreabilidade das ações
- **Alunos:** precisam de garantia de que seu histórico não desaparece
- **Sistema:** precisa de integridade referencial e conformidade com LGPD

---

## 4. Requisitos Funcionais

### FR-01 — Log de Auditoria
- Toda chamada à função `manage-student` com `action: delete` deve registrar:
  - `actor_id` (quem executou — UUID do usuário autenticado)
  - `actor_email` (email do executor)
  - `target_id` (UUID do aluno excluído)
  - `target_name` e `target_email` (snapshot no momento da exclusão)
  - `action` (tipo de operação)
  - `timestamp`
  - `snapshot_data` (JSON com dados completos do perfil antes da exclusão)
- Tabela `audit_log` deve ser append-only (sem DELETE, sem UPDATE via RLS)
- Visível para professora em painel dedicado

### FR-02 — Soft Delete com Janela de Recuperação
- Nova coluna `deleted_at TIMESTAMPTZ` e `deleted_by UUID` na tabela `profiles`
- Exclusão via UI move aluno para estado "excluído" em vez de deletar fisicamente
- Alunos excluídos ficam invisíveis nas listagens normais mas preservados no banco
- Janela de recuperação: **90 dias** (configurável)
- Após 90 dias: hard delete automático via cron job no Supabase (pg_cron)
- Histórico de aulas (check_ins, balance_history) **nunca é deletado** junto com o perfil — mantido por referência ao `student_id`

### FR-03 — Painel de Recuperação (Teacher Dashboard)
- Nova seção "Alunos Excluídos" no painel da professora
- Lista alunos em soft delete com: nome, email, data de exclusão, dias restantes para hard delete
- Botão "Restaurar Aluno" que reverte o soft delete
- Restauração recupera perfil + reativa histórico completo

### FR-04 — Exclusão Permanente com Fricção Intencional
- Hard delete manual (exclusão antes dos 90 dias) exige:
  1. Modal de confirmação com campo de texto: professora digita `EXCLUIR PERMANENTEMENTE` (uppercase)
  2. Aviso explícito: "Esta ação não pode ser desfeita. O histórico completo será perdido."
  3. Log no audit_log antes de executar a exclusão

### FR-05 — Desativação como Alternativa à Exclusão
- Novo status `is_active: boolean` no perfil (já existe como `active`)
- UI deve priorizar "Desativar Aluno" como ação principal
- Aluno desativado: não aparece em listagens ativas, não pode fazer check-in, mas histórico preservado
- "Excluir" torna-se ação secundária, visualmente menos prominente

---

## 5. Requisitos Não-Funcionais

| # | Requisito | Critério |
|---|-----------|----------|
| NFR-01 | Performance | Log de auditoria não deve adicionar > 50ms ao tempo de resposta da exclusão |
| NFR-02 | Segurança | Tabela audit_log inacessível para escrita por usuários não-admin via RLS |
| NFR-03 | Retenção | Logs de auditoria retidos por mínimo 2 anos |
| NFR-04 | LGPD | Hard delete automático após 90 dias respeita direito ao esquecimento |

---

## 6. Fora de Escopo

- Backup externo (S3, dump) — considerado para próxima fase
- Auditoria de outras entidades (aulas, check-ins individuais)
- Sistema de permissões multi-professor (app tem uma professora)

---

## 7. Priorização MoSCoW

| Prioridade | Feature |
|------------|---------|
| **MUST** | FR-01 Log de Auditoria |
| **MUST** | FR-02 Soft Delete (sem hard delete automático inicialmente) |
| **MUST** | FR-05 Desativação como alternativa visível |
| **SHOULD** | FR-03 Painel de Recuperação |
| **SHOULD** | FR-04 Fricção intencional no hard delete |
| **COULD** | Hard delete automático via cron (90 dias) |

---

## 8. Arquitetura de Alto Nível

```
[Teacher UI]
    │
    ├─ "Desativar" → PATCH profiles SET is_active=false (sem apagar nada)
    │
    ├─ "Excluir" → soft delete: SET deleted_at=NOW(), deleted_by=actor_id
    │               + INSERT INTO audit_log (snapshot completo)
    │
    └─ "Restaurar" → SET deleted_at=NULL, deleted_by=NULL
    
[Supabase Edge Function: manage-student]
    ├─ action: 'deactivate' → novo endpoint
    ├─ action: 'soft-delete' → novo endpoint  
    ├─ action: 'restore' → novo endpoint
    └─ action: 'hard-delete' → mantido, com log obrigatório antes

[Banco de Dados]
    ├─ audit_log (nova tabela) — append-only
    ├─ profiles: + deleted_at, + deleted_by
    └─ check_ins, balance_history: sem cascade delete
```

---

## 9. Entrega em Fases

### Fase 1 — Proteção Imediata (1-2 dias)
- FR-01: Audit log na função `manage-student`
- FR-02: Soft delete em `profiles` (sem UI de recuperação ainda)
- FR-05: Botão "Desativar" como ação principal na UI

### Fase 2 — Recuperação (2-3 dias)
- FR-03: Painel de alunos excluídos + restauração
- FR-04: Fricção no hard delete (campo de confirmação textual)

### Fase 3 — Automação (futuro)
- Hard delete automático via pg_cron após 90 dias
- Notificação para professora antes do hard delete automático

---

## 10. Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Aluno deletado via auth.admin antes do soft delete ser implementado | Alta (histórico) | Alto | Fase 1 cobre isso rapidamente |
| Tabela audit_log com dados sensíveis (emails) | Média | Médio | RLS restritiva + acesso apenas service role |
| Migração de schema quebrar app em produção | Baixa | Alto | Migrations não-destrutivas (só ADD COLUMN) |

---

## 11. Caso Específico — Restauração da Talita

A conta de auth da aluna Talita (ID: `8ca46dc3-0a03-4f05-8e94-08b1586551be`) ainda existe. Após aprovação deste PRD e implementação:
- Recriar `profiles` com os dados disponíveis no auth.users
- Créditos e check-ins foram apagados — precisam ser inseridos manualmente pela professora
- Esta situação não se repetirá após Fase 1

---

*— Morgan, planejando o futuro 📊*
