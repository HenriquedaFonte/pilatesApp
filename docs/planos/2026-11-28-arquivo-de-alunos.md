# Plano: Arquivo de alunos (aluno que saiu, com registros guardados por lei)
Data: 2026-11-28 · Branch: feat/arquivo-alunos

## Respostas do dono (2026-11-28: as 4 recomendações aceitas)
1. **Lixeira vira "Arquivo"**, um lugar só. Mesmo estado de hoje (`profiles.deleted_at`), sem coluna nova. "Excluir para sempre" continua lá e só passa para quem não tem recibo, ficha nem termo aceito; o falso "90 dias restantes" sai (não existe purga automática).
2. **Login bloqueado ao arquivar, desbloqueado ao restaurar** (Supabase Auth). Tela de login: "conta arquivada".
3. **Créditos e plano online só avisados** no diálogo de arquivar; nada é zerado, encerrado ou lançado no histórico.
4. **Recibo permitido para arquivado:** na ficha só leitura a Josi vê, baixa, anula e emite recibo; o aviso automático por email não sai (já é assim para `deleted_at`).

Prazo de guarda: ≥5 anos ou o prazo da lei do Québec (a Josi confirma). O Arquivo só mostra o texto do prazo; **purga no fim do prazo fica fora do escopo**.

## Objetivo
A Josi arquiva o aluno que saiu. Ele some de listas, contagens, check-in, emails, aniversários e relatório de créditos baixos, não entra mais no site, e fica em Alunos → Arquivo, com a ficha em modo só leitura (histórico, recibos, termo e ficha de saúde guardados). Ela restaura com um clique.

## Fora do escopo
- Purga no fim do prazo (plano futuro).
- "Inativar" (`is_active = false`) continua igual (pausa; aluno fica na lista).
- **Histórico continua contando:** relatório financeiro, histórico de créditos e frequência de um período passado mostram o que aconteceu, inclusive de aluno hoje arquivado (tirar falsearia totais de dinheiro e aulas). Só onde o relatório mostra o **estado atual** (créditos baixos, painel, listas de escolha) o arquivado sai.
- Tela de erro do login com Google (`AuthCallback.jsx`): se não mostrar o erro da URL, fica como limite anotado no PENDENCIAS.

## Contexto lido
- `supabase/functions/manage-student/index.ts` — `delete` (audit `student.soft_delete`, apaga `student_class_link`, grava `deleted_at`), `restore` (limpa), `hard-delete` (recusas 409 `STUDENT_HAS_RECEIPTS` / `_HEALTH_PROFILE` / `_CONSENT_RECORDS`). **Não confere o papel do alvo.**
- `src/pages/TeacherStudents.jsx` — `fetchData` sem arquivados; `fetchDeletedStudents`, `getDaysUntilHardDelete` e seção "Lixeira" (~1331-1384); botão "Mover para Lixeira" (~1304); `AlertDialog` de `isDeleteConfirmOpen` (~1824); `handleRestoreStudent`/`handleHardDeleteStudent` com toasts fixos em pt.
- `src/pages/StudentSummary.jsx` — `select('*')` do perfil (já traz `deleted_at`); "Editar" (~348); `StudentConsentCard` (~503), `OnlinePlanCard` (~508), `ReceiptsList` + `IssueReceiptDialog` (~523-535).
- `src/components/StudentConsentCard.jsx` — botões: registrar em papel (termo ~232, saúde ~358), imprimir (~235), retirada (~284), editar ficha (~317), ver ficha guardada (~345), apagar ficha (~368). "Tem ficha" vem de `staff_consent_overview`, que exclui `deleted_at`.
- `src/components/OnlinePlanCard.jsx` — registrar pagamento (~227) e mudar/encerrar plano (~280-291).
- `supabase/migrations/20261128010000_consent_withdrawal_and_locks.sql` — `staff_consent_overview()` (~447-490, filtro `p.deleted_at IS NULL` em ~485; REVOKE/GRANT em ~628/637).
- Furos: `TeacherDashboard.jsx` `fetchDashboardStats` conta todos (bug atual); `AttendanceReport.jsx` `fetchAllStudents` inclui arquivados; `lowCreditsReport.jsx` usa RPCs cujo corpo não está no repo; `TeacherReceipts.jsx` lista todos sem marca.
- Já excluem `deleted_at` (não mexer): check-in, aniversários, Notificações por email, `queue_email_campaign`, aviso de recibo, RPCs do aluno, badge "Termo pendente". Sem cron de email ativo (`20261112050000`).
- `src/pages/Login.jsx` (~59-60) — mapeia só "Invalid login credentials".

## Passos

### 1. [OPUS] Migration: overview inclui arquivados + bloqueio dos que já estão na lixeira
- Arquivo: `supabase/migrations/20261128020000_archive_students.sql` (BEGIN/COMMIT, idempotente), + `docs/testes/arquivo-alunos-teste.sql` e `docs/testes/arquivo-alunos-reversao.sql`.
- Fazer:
  - a) `CREATE OR REPLACE FUNCTION public.staff_consent_overview()` **idêntica** à de `20261128010000` (mesma assinatura, `SECURITY DEFINER`, `search_path`, checagem `is_staff()`), só trocando o `WHERE` para `p.role = 'student'`. Reaplicar o mesmo REVOKE/GRANT. Atualizar o COMMENT ("por aluno, inclusive arquivado").
  - b) Bloquear quem **já** está na lixeira (o código novo só bloqueia quem for arquivado depois):
    ```sql
    UPDATE auth.users u SET banned_until = now() + interval '876000 hours'
    FROM public.profiles p
    WHERE p.id = u.id AND p.role = 'student' AND p.deleted_at IS NOT NULL
      AND (u.banned_until IS NULL OR u.banned_until < now());
    ```
    Armadilha: não usar `'infinity'` (o GoTrue pode não ler); 876000 h = o mesmo valor da Edge Function.
  - Teste: overview devolve uma linha por aluno (com e sem `deleted_at`); todo aluno com `deleted_at` tem `banned_until > now()`; aluno ativo nenhum banido por esta migration.
  - Reversão: função com o filtro de volta (copiar a de `20261128010000`) e `UPDATE auth.users SET banned_until = NULL` para os alunos com `deleted_at IS NOT NULL`.
- Pronto quando: o teste passa no SQL Editor (feito pelo dono).

### 2. [OPUS] `manage-student`: arquivar bloqueia, restaurar desbloqueia
- Arquivo: `supabase/functions/manage-student/index.ts`.
- Fazer:
  - `delete` e `restore`: recusar se o snapshot não tiver `role === 'student'` (400, `code: 'NOT_A_STUDENT'`); sem isso, dava para bloquear uma professora.
  - `delete`, nesta ordem: audit (como hoje) → **ban** `auth.admin.updateUserById(studentId, { ban_duration: '876000h' })` → grava `deleted_at`/`deleted_by` → apaga `student_class_link`. Se gravar `deleted_at` falhar: tenta desbanir (`ban_duration: 'none'`) e lança o erro. Se apagar os links falhar: lança o erro (aluno já arquivado e bloqueado; repetir a ação é seguro, ela é idempotente).
  - `restore`: audit → **desbanir** (`ban_duration: 'none'`) → limpa `deleted_at`/`deleted_by`; se limpar falhar, banir de novo e lançar.
  - Usuário de auth inexistente (404/"not found") no ban/unban: só registra no log e segue (mesmo critério do `hard-delete`).
  - `hard-delete`: sem mudança de lógica. Mensagens de sucesso em inglês: "Student archived." / "Student restored.".
- Deploy: `supabase functions deploy manage-student --project-ref kezfpyhsejhjcvlbmejq`.
- Pronto quando: arquivar um aluno de teste deixa `banned_until` no futuro em `auth.users` e ele não consegue entrar; restaurar zera e ele entra.

### 3. [SONNET] Login: mensagem de conta arquivada
- Arquivo: `src/pages/Login.jsx` (~59-60).
- Fazer: se `error.code === 'user_banned'` ou `/banned/i.test(error.message)`, mostrar `t('login.archivedAccount')`. Manter o mapeamento atual de credenciais inválidas. Se `src/pages/AuthCallback.jsx` mostrar erro vindo da URL (`error_description`/`error_code`), aplicar o mesmo mapeamento; se não mostrar, só anotar o limite no PENDENCIAS.
- Pronto quando: aluno arquivado vê a mensagem nas 3 línguas.

### 4. [SONNET] Helper de arquivados + testes
- Arquivos: `src/lib/archivedStudents.js`, `src/tests/archivedStudents.test.js`.
- Fazer: `isArchived(profile)` (`!!profile?.deleted_at`); `fetchArchivedStudentIds()` (select `id` de `profiles` com `role = 'student'` e `deleted_at` não nulo → `Set`; em erro lança); `withoutArchived(rows, ids, key = 'student_id')` (função pura).
- Pronto quando: testes cobrem lista vazia, chave ausente, set vazio.

### 5. [SONNET] Alunos: "Arquivar" e seção "Arquivo"
- Arquivo: `src/pages/TeacherStudents.jsx`.
- Fazer:
  - Botão do card "Mover para Lixeira" → `archive.archive` (ícone `Archive` do lucide no lugar de `Trash2`).
  - Diálogo (`isDeleteConfirmOpen`): textos `archiveDialog.*`; abaixo da descrição, `archiveDialog.creditsWarning` quando a soma de `individual_credits + duo_credits + group_credits` do aluno > 0 (`count` = soma) e `archiveDialog.onlineWarning` quando o aluno tem plano online com `status` ativo (usar o mapa de memberships que `fetchData` já carrega; conferir o valor de status ativo em `src/lib/onlinePlans.js`). Só aviso: o botão continua liberado.
  - Seção "Lixeira" → "Arquivo": título `archive.title` (ícone `Archive`), vazio `archive.empty`; por aluno: nome, email, `archive.archivedOn` + data (mesmo formato de hoje), e uma linha `archive.retention`. Remover `getDaysUntilHardDelete` e o texto de dias. Botões: **Ver** (`archive.view`, link para `/teacher/student-summary/${id}` no mesmo padrão do "Ver" dos cards, ~1196), **Restaurar**, **Excluir para sempre** (como hoje).
  - Toasts de arquivar/restaurar/excluir que hoje são fixos em pt: trocar por `archive.success`, `archive.restored`, `archive.deleted`, `archive.archiveError`, `archive.restoreError`, `archive.deleteError` (com `{{name}}`/`{{message}}`).
  - Recusa `NOT_A_STUDENT` (passo 2): `archive.notAStudent`.
- Pronto quando: nenhum texto "Lixeira"/"90 dias" sobra na tela; avisos aparecem só quando se aplicam.

### 6. [SONNET] Ficha do aluno em modo arquivado
- Arquivos: `src/pages/StudentSummary.jsx`, `src/components/OnlinePlanCard.jsx`.
- Fazer: `const archived = isArchived(student)`. Se arquivado: faixa no topo `teacher.studentSummary.archivedBanner` com a data; esconder "Editar" (~348); passar `archived` para `StudentConsentCard` (passo 7) e `readOnly` para `OnlinePlanCard` (esconde registrar pagamento e mudar/encerrar plano; o resumo continua). Recibos: tudo continua (lista, PDF, anular, **emitir**), conforme a resposta 4.
- Pronto quando: ficha de arquivado não tem nenhum botão que grave, fora recibos e as ações mantidas no passo 7.

### 7. [OPUS] Card "Termo e ficha de saúde" em modo arquivado
- Arquivo: `src/components/StudentConsentCard.jsx`.
- Fazer: prop `archived` (default `false`). Se `true`, esconder "Registrar em papel" (termo e saúde) e "Editar" da ficha. **Manter:** imprimir, histórico/detalhes, "Registrar retirada" (direito do aluno mesmo depois de sair), "ver ficha guardada" com motivo e "Apagar ficha de saúde" (o apagamento manual do fim do prazo). Com o passo 1, "tem ficha" passa a vir certo para arquivado; o "Limite conhecido" do PR D no PENDENCIAS sai.
- Pronto quando: nenhum dado de saúde é logado; sem o SQL do passo 1 o card continua funcionando como hoje (overview sem a linha → `hasProfile` nulo).

### 8. [SONNET] Contagens e relatórios sem arquivados
- Arquivos: `src/pages/TeacherDashboard.jsx`, `src/pages/AttendanceReport.jsx`, `src/pages/lowCreditsReport.jsx`, `src/pages/TeacherReceipts.jsx`.
- Fazer:
  - Painel: `fetchDashboardStats` ganha `.is('deleted_at', null)`.
  - Frequência: `fetchAllStudents` ganha `.is('deleted_at', null)` (só a lista de escolha; as linhas do relatório são histórico e ficam).
  - Créditos baixos: buscar `fetchArchivedStudentIds()` junto das RPCs e aplicar `withoutArchived` em `low` e `zero` **antes** do filtro de online; se a busca falhar, mostrar as listas como vêm (mesmo padrão do bloco online).
  - Recibos: selecionar também `deleted_at` e mostrar `teacher.students.archivedTag` depois do nome do arquivado na lista de escolha.
- Pronto quando: aluno arquivado com créditos não entra no total do painel nem no relatório de créditos baixos.

### 9. [SONNET] Textos e PENDENCIAS
- Arquivos: `src/locales/pt.json`, `en.json`, `fr.json`; `docs/PENDENCIAS.md`.
- Fazer: trocar o bloco `teacher.students.trash` por `teacher.students.archive` e `deleteDialog` por `archiveDialog` (apagar as chaves antigas e o `reversible` de 90 dias; conferir com grep que nenhum `t('...trash...')`/`deleteDialog` sobra); atualizar `restoreDialog.warning`, `hardDeleteDialog.hasReceipts` e `hasConsentRecords`; chaves novas da tabela abaixo. PENDENCIAS: item de teste deste PR, SQL e deploy pendentes, limite do Google se houver.

## Textos (pt / en / fr)
| chave | pt | en | fr |
|---|---|---|---|
| `teacher.students.archive.title` | Arquivo | Archive | Archives |
| `…archive.empty` | Nenhum aluno arquivado. | No archived students. | Aucun élève archivé. |
| `…archive.archive` | Arquivar | Archive | Archiver |
| `…archive.archivedOn` | Arquivado em | Archived on | Archivé le |
| `…archive.retention` | Registros guardados por pelo menos 5 anos. | Records kept for at least 5 years. | Dossiers conservés au moins 5 ans. |
| `…archive.view` | Ver | View | Voir |
| `…archive.restore` | Restaurar | Restore | Restaurer |
| `…archive.deleteForever` | Excluir para sempre | Delete forever | Supprimer définitivement |
| `…archive.success` | {{name}} foi arquivado(a). | {{name}} was archived. | {{name}} a été archivé(e). |
| `…archive.restored` | {{name}} foi restaurado(a). | {{name}} was restored. | {{name}} a été restauré(e). |
| `…archive.deleted` | {{name}} foi excluído(a) para sempre. | {{name}} was permanently deleted. | {{name}} a été supprimé(e) définitivement. |
| `…archive.archiveError` | Erro ao arquivar: {{message}} | Could not archive: {{message}} | Erreur lors de l'archivage : {{message}} |
| `…archive.restoreError` | Erro ao restaurar: {{message}} | Could not restore: {{message}} | Erreur lors de la restauration : {{message}} |
| `…archive.deleteError` | Erro ao excluir: {{message}} | Could not delete: {{message}} | Erreur lors de la suppression : {{message}} |
| `…archive.notAStudent` | Só alunos podem ser arquivados. | Only students can be archived. | Seuls les élèves peuvent être archivés. |
| `…archiveDialog.title` | Arquivar aluno? | Archive this student? | Archiver cet élève ? |
| `…archiveDialog.description` | {{name}} sai da lista de alunos, das contagens, do check-in e dos emails, e não consegue mais entrar no site. Histórico, recibos, termo e ficha de saúde ficam guardados. | {{name}} will leave the student list, counts, check-in and emails, and will no longer be able to sign in. History, receipts, consent and health form are kept. | {{name}} quittera la liste des élèves, les décomptes, l'enregistrement et les courriels, et ne pourra plus se connecter. L'historique, les reçus, le consentement et la fiche santé sont conservés. |
| `…archiveDialog.reversible` | Você pode restaurar quando quiser, em Alunos → Arquivo. | You can restore at any time in Students → Archive. | Vous pouvez restaurer à tout moment dans Élèves → Archives. |
| `…archiveDialog.creditsWarning` | Ainda tem {{count}} crédito(s): ficam guardados e voltam se você restaurar. | Still has {{count}} credit(s): they are kept and come back if you restore. | Il reste {{count}} crédit(s) : ils sont conservés et reviennent si vous restaurez. |
| `…archiveDialog.onlineWarning` | Tem plano online ativo: ele não é encerrado e volta como está se você restaurar. | Has an active online plan: it is not ended and comes back as is if you restore. | A un forfait en ligne actif : il n'est pas résilié et revient tel quel si vous restaurez. |
| `…archiveDialog.confirm` | Arquivar | Archive | Archiver |
| `…archiveDialog.moving` | Arquivando... | Archiving... | Archivage... |
| `…restoreDialog.warning` | O aluno volta à lista e consegue entrar no site de novo. As turmas precisam ser rematriculadas manualmente. | The student returns to the list and can sign in again. Classes must be re-enrolled manually. | L'élève revient dans la liste et peut se reconnecter. Les cours doivent être réinscrits manuellement. |
| `…hardDeleteDialog.hasReceipts` | Este(a) aluno(a) tem recibo de seguro emitido e não pode ser excluído(a) permanentemente. Ele(a) fica no Arquivo. | This student has an issued insurance receipt and cannot be permanently deleted. They stay in the Archive. | Cet(te) élève a un reçu d'assurance émis et ne peut pas être supprimé(e) définitivement. Il/Elle reste dans les Archives. |
| `…hardDeleteDialog.hasConsentRecords` | Este aluno tem registro de termo aceito, que o estúdio guarda por pelo menos 5 anos (ou o prazo da lei do Québec). Não é possível excluir permanentemente; ele fica no Arquivo. | This student has an accepted consent record, which the studio keeps for at least 5 years (or the period required by Québec law). They cannot be permanently deleted and stay in the Archive. | Cet élève a un consentement accepté, que le studio conserve au moins 5 ans (ou le délai prévu par la loi du Québec). Il ne peut pas être supprimé définitivement et reste dans les Archives. |
| `teacher.students.archivedTag` | (arquivado) | (archived) | (archivé) |
| `teacher.studentSummary.archivedBanner` | Aluno arquivado em {{date}}. Somente leitura: para editar, restaure em Alunos → Arquivo. | Student archived on {{date}}. Read only: to edit, restore in Students → Archive. | Élève archivé le {{date}}. Lecture seule : pour modifier, restaurez dans Élèves → Archives. |
| `login.archivedAccount` | Sua conta está arquivada. Fale com o estúdio para reativá-la. | Your account is archived. Contact the studio to reactivate it. | Votre compte est archivé. Contactez le studio pour le réactiver. |

(Conferir no `en.json`/`fr.json` como a tela Alunos se chama hoje e usar o mesmo nome em "Alunos → Arquivo".)

## Banco de dados
- SQL: sim — `supabase/migrations/20261128020000_archive_students.sql`; teste `docs/testes/arquivo-alunos-teste.sql`; reversão `docs/testes/arquivo-alunos-reversao.sql`.
- Ordem: **deploy da `manage-student` antes do SQL** — o SQL bloqueia quem já está na lixeira, e só a função nova desbloqueia ao restaurar. **Merge: tanto faz** em relação aos dois (front novo com função antiga só não bloqueia; front antigo com função nova bloqueia e mostra os textos antigos).
- Edge Function a publicar: `manage-student` — `supabase functions deploy manage-student --project-ref kezfpyhsejhjcvlbmejq`.

## Testes
- Automáticos: `npm run lint`, `npm test`, `npm run build` + `src/tests/archivedStudents.test.js`.
- Revisor (Opus): **sim** (auth, banco, dados pessoais, Edge Function).
- Manual depois do deploy (aluno de teste com créditos, 3 línguas, celular):
  1. Arquivar: o diálogo mostra o aviso de créditos (e de plano online, se tiver); confirmar → some da lista, do painel (total/créditos), do check-in, dos aniversários, de Notificações por email e do relatório de créditos baixos; aparece em Alunos → Arquivo com a data e o texto dos 5 anos, sem "dias restantes".
  2. Login do aluno arquivado → "Sua conta está arquivada..."; em `auth.users`, `banned_until` no futuro; no `audit_log`, `student.soft_delete`.
  3. Arquivo → Ver: faixa "arquivado em", sem "Editar", sem ações do plano online, sem "Registrar em papel"; recibos: baixar e emitir funcionam (nenhum email automático sai); card mostra se há ficha guardada.
  4. Recibos: o aluno aparece com "(arquivado)". Frequência: não está na lista de escolha; período passado em que ele teve aulas ainda mostra a linha dele.
  5. "Excluir para sempre" de aluno com termo/recibo → recusa dizendo que fica no Arquivo; aluno sem nada disso → excluído.
  6. Restaurar → volta à lista com os mesmos créditos, entra no site de novo; `banned_until` vazio.
  7. Tentar arquivar a professora pela API (console) → `NOT_A_STUDENT`.
  8. SQL: rodar o teste do passo 1 (alunos que já estavam na lixeira ficaram bloqueados).

## Riscos e como voltar atrás
- **Aluno bloqueado e não arquivado (ou o contrário)** se uma etapa falhar: tratado no passo 2 (desfaz o ban; ação idempotente).
- **Sessão aberta do aluno** continua até o token expirar (~1 h); o refresh falha. Aceito.
- **Bloquear professora por engano:** checagem de papel no passo 2.
- **Se quebrar:** GitHub → PR → Revert → mergear; ou Vercel → deploy anterior → Promote to Production. Função: redeploy da versão anterior (`git checkout <commit anterior> -- supabase/functions/manage-student` e o mesmo comando de deploy). SQL: `docs/testes/arquivo-alunos-reversao.sql` (refiltra o overview e desbloqueia os alunos arquivados).
