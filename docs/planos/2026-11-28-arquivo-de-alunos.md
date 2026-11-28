# Plano: Arquivo de alunos (aluno que saiu, com registros guardados por lei)
Data: 2026-11-28 · Branch: feat/arquivo-alunos (a definir na sessão de execução)

> **Estado: parado nas perguntas ao dono (abaixo).** A investigação está feita; os passos só
> estão em esboço e serão detalhados depois das respostas (regra "perguntas antes de planejar").

## Perguntas ao dono (responder antes de detalhar)
1. **Lixeira e Arquivo: um lugar só ou dois?**
   - **(a) Recomendado: a "Lixeira" vira "Arquivo".** Mesmo estado de hoje (`profiles.deleted_at`), sem coluna nova. Todo aluno que sai vai para o Arquivo. "Excluir para sempre" continua lá e só passa para quem não tem recibo, ficha nem termo aceito (contas de teste, cadastro por engano); para os outros a mensagem diz que o aluno fica no Arquivo. Some o "90 dias restantes", que hoje é falso: não existe purga automática (nenhum cron ou função apaga nada).
   - (b) Dois lugares: Lixeira (vai ser apagado) e Arquivo (guardado por lei), com coluna nova e botão "Arquivar" na mensagem de recusa. Mais código e duas listas quase iguais, porque depois do lançamento do termo quase todo aluno tem aceite.
2. **O aluno arquivado consegue entrar no site?**
   - **Recomendado: não.** Ao arquivar, a conta é bloqueada no Supabase Auth; ao restaurar, desbloqueada. Na tela de login aparece "Sua conta está arquivada. Fale com o estúdio." Consequência: ele não vê mais recibos, histórico nem ficha pelo site; se precisar, pede à Josi (recibos já vão por email na emissão). Hoje o aluno na lixeira **ainda entra e usa o site** (nada confere `deleted_at` no login nem nas rotas); o bloqueio fecha isso também.
   - Alternativa: deixar entrar só para ver. Exige travar gravações (ficha de saúde, perfil, pedidos de plano online) por RLS em várias tabelas: plano bem maior.
3. **Aluno com créditos restantes ou plano online ativo, ao ser arquivado:**
   - **Recomendado: só avisar no diálogo** ("Este aluno ainda tem N créditos / plano online ativo; eles ficam guardados e voltam se você restaurar"). Nada é zerado nem encerrado; nenhum lançamento novo no histórico de créditos.
   - Alternativa: zerar créditos / encerrar o plano ao arquivar (mexe em dinheiro e histórico: mais risco).
4. **Recibo de seguro para aluno arquivado** (ex.: pede recibo para o imposto depois de sair):
   - **Recomendado:** na ficha só leitura a Josi ainda vê, baixa e pode **emitir** recibo; o aviso automático por email não sai (já é assim hoje para quem tem `deleted_at`), então ela envia o PDF por conta própria. Na tela "Recibos" o aluno continua na lista, marcado "(arquivado)".
   - Alternativa: emitir só depois de restaurar o aluno.

Prazo de guarda: ≥5 anos ou o prazo da lei do Québec, a Josi confirma com seguradora/advogado (já anotado no PENDENCIAS). O Arquivo só mostra o texto "registros guardados por pelo menos 5 anos"; **purga no fim do prazo fica fora do escopo** (plano futuro). Não é pergunta.

## Objetivo
A Josi tira do dia a dia o aluno que saiu e não pode ser excluído de vez (tem ficha de saúde, termo aceito ou recibo). Ele vai para um "Arquivo" em Alunos: não aparece em listas, contagens, check-in, emails nem relatórios de frequência/créditos; os registros ficam guardados e consultáveis só para leitura; ela restaura com um clique.

## Fora do escopo
- Purga automática no fim do prazo de guarda (plano futuro, depois do prazo confirmado pela Josi).
- Mudar "Inativar" (`is_active = false`): continua sendo pausa, aluno fica na lista.
- Reescrever os relatórios financeiro e de histórico de créditos: pagamentos e lançamentos passados de aluno arquivado **continuam contando** (é dinheiro que entrou de fato); só o nome continua aparecendo.

## Contexto lido (o que a investigação achou)
**Como a lixeira funciona hoje**
- `supabase/migrations/20260617100001_add_soft_delete_to_profiles.sql` — colunas `deleted_at`, `deleted_by` (travadas para o aluno pelo trigger de `profiles`, migrations `20261112010000`/`20261113000000`).
- `supabase/functions/manage-student/index.ts` — `delete`: grava `audit_log` (`student.soft_delete`), apaga `student_class_link`, grava `deleted_at`/`deleted_by`; `restore`: limpa as duas colunas; `hard-delete`: recusa com 409 `STUDENT_HAS_RECEIPTS`, `STUDENT_HAS_HEALTH_PROFILE`, `STUDENT_HAS_CONSENT_RECORDS` (PR D, 12b) antes de apagar qualquer coisa.
- `src/pages/TeacherStudents.jsx` — `fetchData` lista só `deleted_at IS NULL`; `fetchDeletedStudents` + seção "Lixeira" (linhas ~1331-1384) com "Restaurar" e "Excluir Para Sempre"; `getDaysUntilHardDelete` mostra "90 dias restantes", **sem nenhuma purga real por trás**; `handleHardDeleteStudent` traduz os 3 códigos 409.
- Não existe cron de email ativo: `20261112050000_cleanup_email_automation.sql` removeu os jobs (sem lembretes automáticos hoje).

**Já excluem o aluno na lixeira (nada a fazer)**
- Lista de Alunos, aniversários do painel (`TeacherDashboard.jsx` `fetchBirthdays`), check-in (`TeacherCheckIn.jsx`), Notificações por email (`EmailNotifications.jsx`), campanha (`queue_email_campaign`, `20261112090000`), aviso de recibo (`send-email/receiptNotice.ts` pula `deleted_at`), RPCs do aluno (`accept_consent`, `request_online_plan` exigem `deleted_at IS NULL`), badge "Termo pendente" (`staff_consent_overview`), índice único de email parcial (`20261022000000`).

**Furos encontrados (o aluno na lixeira ainda polui)**
- `TeacherDashboard.jsx` `fetchDashboardStats` — conta **todos** os alunos (sem filtro `deleted_at`): total, ativos e créditos do painel incluem a lixeira. **Bug atual.**
- `AttendanceReport.jsx` — lista de alunos do filtro inclui a lixeira.
- `lowCreditsReport.jsx` — RPCs `get_low_credits_report`/`get_zero_credits_students`: o corpo de produção **não está no repositório** (ver `20261112040000`), não dá para saber se filtram `deleted_at`. Filtro no front pelos ids arquivados resolve sem SQL.
- `TeacherReceipts.jsx` — lista todos os alunos (correto manter, mas sem marcar quem está arquivado).
- `staff_consent_overview` (`20261128010000`, linha ~485) — exclui `deleted_at`, então na ficha de um aluno arquivado o card "Termo e ficha de saúde" não sabe se há ficha guardada (limite já anotado no PENDENCIAS, PR D).
- Login/rotas (`useAuth.jsx`, `ProtectedRoute.jsx`) — não conferem `deleted_at`: aluno na lixeira entra normalmente.

**Ficha do aluno (para a leitura do Arquivo)**
- `src/pages/StudentSummary.jsx` (`/teacher/student-summary/:studentId`) — mostra perfil, histórico, recibos e `StudentConsentCard`; tem editar perfil, emitir recibo e o card com ações (registrar papel, retirada, apagar ficha, ler ficha guardada com motivo).

## Decisões já tomadas (técnicas, valem com as recomendações acima)
- Estado "arquivado" = `profiles.deleted_at IS NOT NULL` (sem coluna nova). Ações da Edge Function mantêm os nomes `delete`/`restore` (compatibilidade); só os textos mudam para "Arquivar"/"Restaurar".
- Bloqueio de login pelo Auth, no servidor: `auth.admin.updateUserById(id, { ban_duration: '876000h' })` ao arquivar e `{ ban_duration: 'none' }` ao restaurar. Armadilha: o token de acesso já emitido vale até expirar (~1 h); o refresh falha. Se o bloqueio falhar, a ação inteira tem de falhar sem deixar o aluno arquivado e desbloqueado (ordem e reversão detalhadas no passo).
- `staff_consent_overview` passa a incluir alunos arquivados (o badge da lista não muda, porque a lista já não tem arquivados).
- Ficha só leitura = a mesma `StudentSummary` com uma faixa "Arquivado em [data]" e sem as ações de edição; no card de consentimento ficam só "ver ficha guardada (com motivo)", "Imprimir" e "Apagar ficha de saúde" (é o apagamento manual do fim do prazo).
- "Excluir para sempre" continua só no Arquivo; as mensagens de recusa passam a dizer que o aluno fica no Arquivo.

## Passos (esboço; detalhar depois das respostas)
1. [OPUS] Migration: `staff_consent_overview` inclui arquivados (+ teste e reversão em `docs/testes/`).
2. [OPUS] `manage-student`: `delete` bloqueia o login (ban) e `restore` desbloqueia, com reversão se uma etapa falhar; `audit_log` inalterado.
3. [SONNET] `Login.jsx`: erro de usuário bloqueado vira a mensagem "conta arquivada".
4. [SONNET] `TeacherStudents.jsx`: "Mover para Lixeira" → "Arquivar" (diálogo com aviso de créditos/plano online, pergunta 3); seção "Lixeira" → "Arquivo" sem "dias restantes", com "Ver" (ficha só leitura); mensagens de recusa da exclusão permanente.
5. [SONNET] `StudentSummary.jsx`: modo arquivado (faixa, esconder editar e ações de créditos; recibo conforme pergunta 4).
6. [OPUS] `StudentConsentCard.jsx`: modo arquivado só leitura (dados de saúde).
7. [SONNET] Contagens e relatórios: `TeacherDashboard.jsx` stats sem arquivados, `AttendanceReport.jsx` sem arquivados, `lowCreditsReport.jsx` filtra ids arquivados, `TeacherReceipts.jsx` marca "(arquivado)".
8. [SONNET] Textos pt/en/fr, testes unitários (helper de "arquivado" e filtros) e `docs/PENDENCIAS.md`.

## Textos (pt / en / fr)
A definir no detalhamento (chaves em `teacher.students.archive.*`, mensagem de login, faixa da ficha).

## Banco de dados
- SQL: sim (passo 1, `CREATE OR REPLACE` de `staff_consent_overview` sem o filtro `deleted_at`) + reversão.
- Ordem: tanto faz (a função só passa a devolver linhas a mais, que a lista ignora).
- Edge Function a publicar: `manage-student`.

## Testes (esboço)
- Automáticos: `npm run lint`, `npm test`, `npm run build` + testes dos filtros.
- Manual: arquivar aluno de teste → some da lista, painel, check-in, frequência, créditos baixos, emails; aparece no Arquivo; "Ver" abre só leitura; login dele recusado com a mensagem; restaurar → volta à lista e entra de novo; "Excluir para sempre" de aluno com termo → recusa dizendo que fica no Arquivo.
- Revisor: sim (auth, dados pessoais, Edge Function).

## Riscos e como voltar atrás
- Aluno arquivado e não bloqueado (ou bloqueado e não arquivado) se uma etapa falhar: tratar no passo 2.
- Reversão: Revert do PR; SQL de reversão do passo 1; redeploy da `manage-student` anterior; desbloquear contas arquivadas pelo SQL/painel do Auth se precisar.
