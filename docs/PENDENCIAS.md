# Pendências — Josi Pilates

> Memória entre sessões. Toda sessão nova começa lendo este arquivo.
> No fim de cada tarefa: "Atualize o PENDENCIAS".

_Última atualização: 2026-11-12_

## Estado atual
- Produção: josipilates.com (Vercel, branch `main`).
- Processo de trabalho com o Claude configurado: `CLAUDE.md`, agente `dev-critico`, regra de esforço e este arquivo.

## Testes em aberto (usuário)
As três migrations de segurança (`20261112010000`, `20261112020000`, `20261112030000`) **já rodaram em produção** (2026-11-12). Os testes SQL da `020000` e da `030000` passaram, e o diagnóstico mostrou que os 4 jobs do pg_cron rodam como `postgres`. Falta:
- [ ] **Teste SQL de `profiles` (migration `20261112010000`):** abrir `docs/testes/seguranca-privilegios-teste.sql`, trocar `<UUID_ALUNO>`, `<UUID_ALUNO_B>` e `<UUID_PROFESSORA>` por ids reais e rodar. Deu certo se não aparecer erro; o script termina em ROLLBACK. Erro "FALHOU: ..." diz o que falhou. Obs.: o SQL Editor mostra só o último resultado (um `set_config`); isso é normal.
- [ ] **Teste no site depois das 3 migrations de segurança** (se algo quebrar, anotar a tela e o erro do console do navegador e abrir sessão com o dev-critico):
  1. **Sem login:** a landing mostra depoimentos e a agenda.
  2. **Professora:**
     - lista de alunos carrega;
     - adicionar e remover créditos (saldo e histórico atualizam);
     - editar observações e ativar/desativar aluno;
     - mudar as turmas de um aluno;
     - Aulas: criar e apagar uma aula e um horário de teste;
     - Check-in: marcar presença (debita crédito), dispensar, adicionar aluno avulso;
     - Depoimentos e Agenda: editar e salvar;
     - Notificações por email: lista e histórico carregam;
     - os 4 relatórios abrem (frequência, créditos baixos, histórico de créditos, financeiro).
  3. **Aluno:**
     - painel, Histórico e "Meu perfil" carregam;
     - editar nome/telefone/email/idioma salva;
     - a landing, logado, mostra a agenda.
  4. **Cadastro:** criar uma conta nova de teste (o perfil é criado pelo trigger `handle_new_user`), conferir que aparece na lista de alunos e depois apagá-la.
  5. **Emails automáticos:** no dia seguinte, conferir que os emails de créditos baixos (`low-credits-daily`, 9h UTC) e de créditos zerados (`zero-credits-daily`, 10h UTC) continuaram saindo.
- [ ] **Teste no site depois da migration `20261112040000`** (relatórios só para professora):
  1. **Professora:** abrir Relatório de frequência (gerar com e sem filtro de aluno), Relatório de créditos baixos (listas de créditos baixos e zerados) e Notificações por email (enviar um aviso para um aluno de teste e conferir que aparece no histórico).
  2. **Aluno:** painel, Histórico e "Meu perfil" continuam carregando (nenhuma tela de aluno usa essas funções).
  3. **Emails automáticos:** no dia seguinte, conferir que `low-credits-daily` e `zero-credits-daily` continuaram enviando (rodam como `postgres`, sem JWT: liberados).
- [ ] **Story 3.1 / AC-7:** depois de rodar a migration 3.1 **e a correção de segurança acima**, abrir `docs/testes/3.1-rls-seguro-e-credenciais.sql`, trocar `<UUID_ALUNO_A>`, `<UUID_ALUNO_B>` e `<UUID_PROFESSORA>` por ids reais de `profiles` e rodar no SQL Editor. Sucesso = nenhum erro (termina em ROLLBACK, nada fica gravado). Erro "AC-7 FALHOU: ..." diz o que falhou.

- [ ] **Teste depois da migration `20261112050000` (limpeza dos emails automáticos):**
  1. No SQL Editor, `SELECT count(*) FROM get_students_for_notification('low_credits');` devolve um número, sem erro (antes dava `42804`).
  2. Se a `20261112040000` já rodou: `docs/testes/seguranca-rpcs-staff-teste.sql` roda sem erro (a versão do `main` não tolera mais o defeito antigo; agora não precisa).
  3. No dia seguinte, conferir que `low-credits-daily` e `zero-credits-daily` rodaram com `status=succeeded`: `SELECT j.jobname, d.status, d.start_time, left(d.return_message, 120) FROM cron.job_run_details d JOIN cron.job j USING (jobid) ORDER BY d.start_time DESC LIMIT 10;`
  4. Site (professora): Notificações por email e Relatório de créditos baixos continuam abrindo (nenhuma tela usa as funções mexidas; é só conferência).
- [ ] **Teste no celular em pé (painel do aluno):** o topo mostra só o primeiro nome ("Olá, Henrique") e os 3 botões de Acesso Rápido (Histórico, Perfil, Regras do Studio) mostram o texto inteiro, quebrando em 2 linhas se precisar.

## SQL / deploys pendentes
- [x] Migrations de segurança `20261112010000`, `20261112020000` e `20261112030000` rodadas em produção (2026-11-12). O CSV do diagnóstico de antes da `020000` está guardado com o usuário: as linhas `recriar` dele são a reversão exata das policies antigas. Reversões aproximadas (só emergência, reabrem as falhas): `docs/testes/seguranca-privilegios-reversao.sql`, `seguranca-rls-tabelas-reversao.sql` e `seguranca-rpcs-anon-reversao.sql`.
- [ ] **Migration `20261112040000_require_staff_in_report_rpcs.sql`** (relatórios só para professora). **Conferir se já rodou:** uma sessão anterior registrou (em commits que não chegaram ao `main`, branch `claude/awesome-pasteur-9o65bx`) que ela foi rodada e testada em produção em 2026-11-12. Se a verificação rápida do passo 4 mostrar as 7 funções como invólucro, marcar como feita e pular os passos 1–3. Ordem: **tanto faz** em relação ao merge (o PR não muda código do site; o site já chama essas funções só como professora). Passos no SQL Editor:
  1. Rodar `docs/testes/seguranca-rpcs-staff-diagnostico.sql` e guardar o resultado (CSV). Linhas `dependencia` ou `policy` → **parar** e mandar para o dev-critico. Linhas `chamador` com `trigger=true` → mandar também.
  2. Colar e rodar o conteúdo da migration (idempotente; se der erro, nada é aplicado).
  3. Rodar `docs/testes/seguranca-rpcs-staff-teste.sql` (termina em ROLLBACK). Sucesso = nenhum erro; "FALHOU: ..." diz o que falhou. Ele chama cada função como anônimo, aluno, professora, service_role e sem JWT.
  4. Rodar de novo o diagnóstico: esperado `involucro=true | authenticated=true | anon=false` nas 7 funções e `authenticated=false | anon=false | service_role=false` nas `_impl` e em `assert_staff_caller`. Verificação rápida:
     ```sql
     SELECT p.oid::regprocedure, p.prosecdef, p.proconfig,
            has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated,
            has_function_privilege('anon', p.oid, 'EXECUTE') AS anon
     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
     WHERE p.proname ~ '^(get_attendance_report|get_low_credits_report|get_zero_credits_students|get_students_for_notification|get_email_notification_stats|log_email_notification|is_profile_complete)(_impl)?$'
     ORDER BY 1;
     ```
  - Reversão (só emergência, reabre a falha): `docs/testes/seguranca-rpcs-staff-reversao.sql`.
- [ ] **Migration `20261112050000_cleanup_email_automation.sql`** (limpeza dos emails automáticos; ver "A fazer"). Ordem: **tanto faz** em relação ao merge (o site e as Edge Functions não usam nenhuma das funções/jobs mexidos) e **tanto faz** em relação à `20261112040000` (funciona antes ou depois dela). Passos no SQL Editor:
  1. Rodar `docs/testes/emails-limpeza-diagnostico.sql` e guardar o resultado (Export → CSV; chaves e tokens saem como `<oculto>`). **Parar e mandar o CSV para o dev-critico** se: aparecer alguma linha `alerta`; algum job com `plano=remover` tiver comando que não seja só `SELECT`; ou `low-credits-daily`/`zero-credits-daily` não aparecerem.
  2. Colar e rodar o conteúdo da migration (idempotente; se der erro, nada é aplicado e a mensagem diz o motivo).
  3. Rodar o diagnóstico de novo. Esperado: só os jobs com `plano=manter`; as funções com `plano=apagar` sumiram; linhas `backup` para cada job removido e função apagada/corrigida.
  4. Teste rápido: ver "Testes em aberto".
  - Reversão (só emergência): `docs/testes/emails-limpeza-reversao.sql` recria, da cópia exata guardada em `josi_backup.email_cleanup_20261112`, os jobs removidos e as funções apagadas (mesmo corpo e GRANTs).
- [ ] **Story 3.1:** rodar no SQL Editor o conteúdo de `supabase/migrations/20261112000000_create_student_insurance_and_practitioner.sql` (cria `student_insurance`, `practitioner_credentials`, bucket privado `practitioner-signatures` e policies). Idempotente. Depois, conferir em Storage que o bucket aparece como privado.

## A fazer
- [x] **URGENTE (segurança) — `profiles` e RPCs de crédito abertos.** Corrigido no código (migration `20261112010000_fix_profiles_privilege_escalation_and_rls.sql`, testada em Postgres 16 local reproduzindo o estado de produção). **SQL rodado em produção; falta o teste no site** (ver "Testes em aberto"). O que estava aberto em produção (levantado em 2026-11-12):
  - `prevent_privilege_escalation()` era `SECURITY DEFINER` → o guarda nunca bloqueava: aluno virava professora e se dava créditos.
  - `profiles` tinha só a policy "Allow all authenticated operations" (ALL, `auth.role() = 'authenticated'`) → qualquer aluno lia, editava e apagava qualquer perfil, e podia se inserir como `teacher`.
  - `update_class_balance` (INVOKER) e `mark_attendance` (DEFINER) não conferiam quem chama; aluno e anônimo tinham EXECUTE (anônimo conseguia dar check-in e debitar crédito de qualquer aluno).
  - O que a migration faz: `is_staff()` (DEFINER); guarda `SECURITY INVOKER` que também impede o aluno de mudar `observations`, `is_active`, `deleted_at`, `deleted_by`; 4 policies em `profiles` (própria linha ou staff; INSERT só como `student` sem créditos; DELETE só staff); as RPCs originais viram `*_impl` sem EXECUTE e no lugar entram invólucros `SECURITY DEFINER` que exigem professora/admin (ou service_role) e chamam a original sem mudar nada da lógica.
- [x] **URGENTE (segurança, dev-critico) — RLS das outras tabelas em produção.** Corrigido no código (migration `20261112020000_fix_rls_operational_tables.sql`, testada em Postgres 16 local reproduzindo o estado de produção: falhas reproduzidas antes, bloqueadas depois, rodada 2x, reversão exata conferida). **SQL rodado em produção; falta o teste no site** (ver "Testes em aberto"). O que estava aberto (levantado em 2026-11-12):
  - `attendance`: INSERT e UPDATE para `{public}` com `true` (anônimo gravava e alterava).
  - `classes`: "Allow anon insert for classes" (anônimo criava aulas).
  - `balance_history`: "Students can insert their own balance history" (aluno forjava linhas no próprio histórico de créditos/pagamentos).
  - Policies duplicadas (PERMISSIVE se somam: valia sempre a mais aberta) e policies com `'admin'`.
  - O que a migration faz: em `balance_history`, `check_ins`, `student_class_link`, `classes`, `class_schedules`, `attendance`, `email_notifications`, `testimonials`, `schedule_slots` (e `email_logs`, `enrollments`, `*_backup`, se existirem) apaga **todas** as policies, seja qual for o nome, e cria só as necessárias: aluno lê só o que é dele; professora/admin via `is_staff()`; `balance_history` sem UPDATE/DELETE pela API (histórico só cresce); `check_ins` sem DELETE; anônimo só lê depoimentos ativos e horários publicados. `anon` perde os privilégios de tabela (menos SELECT nessas duas) e `authenticated` perde TRUNCATE. `get_attendance_report`, `get_students_for_notification` e `log_email_notification` deixam de aceitar anônimo.
  - Nenhuma mudança no código do site: levantei todo acesso em `src/` e `supabase/functions/`; o aluno só lê, as escritas são da professora ou das RPCs/Edge Functions (service_role).
  - Diagnóstico de produção (2026-11-12, antes da migration): todas as tabelas com RLS e dono `postgres`; `anon` com SELECT/INSERT/UPDATE/DELETE/TRUNCATE em todas e `authenticated` com TRUNCATE; policy extra "Students can insert their own class links" (aluno se matriculava sozinho; a migration apaga); não existem `enrollments` nem `*_backup`.
  - **Papel `admin`: não existe nenhum** (101 alunos, 1 professora). Decisão: `is_staff()` continua aceitando `admin`. Ninguém vira admin pela API (o guarda bloqueia mudança de `role` e o INSERT de perfil só aceita `student`); só dá para criar um admin por SQL ou service_role. Assim, um segundo acesso de professora/administração no futuro não precisa de migration. Se a Josi preferir fechar de vez, tirar `'admin'` de `is_staff()` numa migration.
- [x] **URGENTE (segurança, dev-critico) — funções SECURITY DEFINER ainda chamáveis por aluno logado.** Corrigido no código (migration `20261112040000_require_staff_in_report_rpcs.sql`, testada em Postgres 16 local reproduzindo o estado de produção, também com dono não-superusuário; rodada 2x; reversão conferida). **Falta rodar o SQL em produção e testar** (ver "SQL / deploys pendentes" e "Testes em aberto"). O que estava aberto: qualquer aluno logado chamava pela API `get_attendance_report`, `get_low_credits_report`, `get_zero_credits_students`, `get_students_for_notification` (nome, email e créditos de todos os alunos), `get_email_notification_stats`, `log_email_notification` (gravava no log de emails) e `is_profile_complete`, todas `SECURITY DEFINER` sem `search_path`.
  - O que a migration faz (mesmo padrão de `update_class_balance`; nenhum corpo reescrito, porque os de produção não estão no repo): para cada versão/assinatura existente, a original vira `<nome>_impl` (sem EXECUTE para a API, `search_path = public`) e no lugar entra um invólucro `SECURITY DEFINER`, `SET search_path = public`, com o mesmo nome, argumentos, defaults e retorno (lidos do catálogo), que chama `assert_staff_caller()` e depois a `_impl`. Liberado: professora/admin (`is_staff()`), service_role e chamada sem JWT (pg_cron, SQL Editor). Aluno recebe `permission denied: only the teacher can call <função>` (42501). EXECUTE do invólucro: só authenticated e service_role.
  - `is_profile_complete`: nenhum código do site, Edge Function ou policy do repo usa (o site calcula "perfil completo" no `useAuth`). Regra: professora **ou o próprio usuário** (quando o 1º argumento é o uuid do perfil), para não quebrar um eventual trigger/função de produção que a chame para o perfil de quem está editando; o id de outro aluno é recusado.
  - `log_email_notification`: só o site chama (EmailNotifications.jsx, tela da professora); nenhuma Edge Function chama RPC. Professora, service_role e pg_cron/postgres continuam; aluno não.
  - Proteção: se alguma policy/view/default depender da função pelo OID, ou houver função de trigger/procedure com esses nomes, a migration para sem aplicar nada (rodar antes o diagnóstico).
- [x] **Segurança — funções, view e `audit_log` abertos ao anônimo.** Corrigido no código (migration `20261112030000_revoke_anon_rpcs_and_views.sql`, testada em Postgres 16 local com o estado de produção + `20261112020000`, rodada 2x; cadastro de usuário novo e chamada como `postgres`/pg_cron continuam funcionando). **SQL e teste rodados em produção; falta o teste no site** (ver "Testes em aberto"). Com a chave anon (pública) dava para baixar nome, email e créditos de todos os alunos (`get_low_credits_report`, `get_zero_credits_students`) e disparar envio de emails (`trigger_email_notifications` e afins). A migration tira EXECUTE de anon/PUBLIC das 11 funções do diagnóstico (das de email e de `handle_new_user` também de `authenticated`), SELECT do anon na view `email_stats` (logado fica só com SELECT), todos os privilégios do anon em `audit_log` (logado só SELECT; service_role grava) e TRUNCATE de `profiles`.
- [x] **Segurança (menor):** `profiles` com TRUNCATE para anon/authenticated → tirado na migration `20261112030000`. SELECT/INSERT/UPDATE/DELETE do anon ficam (a RLS de `profiles` não tem nenhuma policy para anon, então não lê nem grava nada).
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
- [x] **Emails automáticos — limpeza (dev-critico, 2026-11-12).** Feito no código (migration `20261112050000_cleanup_email_automation.sql`, testada em Postgres 16 local com o estado de produção simulado; ver "SQL / deploys pendentes"). **Falta rodar o SQL em produção e testar.**
  - **Por que `get_students_for_notification` estava quebrada:** o corpo declara `preferred_language` como `text`, mas `profiles.preferred_language` é `varchar`. Em plpgsql, `RETURN QUERY` exige tipos idênticos, então toda chamada falhava com `42804 structure of query does not match function result type` (coluna 8), mesmo sem linhas. Reproduzido localmente com o corpo de `notification_functions.sql`. A migration lê o corpo de produção do banco, troca só `COALESCE(p.preferred_language, 'pt')` por `COALESCE(p.preferred_language, 'pt')::text`, chama a função para conferir e, se ainda falhar ou se o corpo for diferente do esperado, para sem aplicar nada. Corrige a `_impl` se a `20261112040000` já rodou, senão a própria função. O site não chama essa função (a tela de Notificações monta a lista sozinha), então nada muda no site.
  - **pg_cron:** `low-credits-report-daily` e `send-low-credits-notifications-daily` (só SELECT, resultado se perdia) são removidos, se existirem. `low-credits-daily` e `zero-credits-daily` ficam. A migration para se o comando de um job a remover fizer algo além de SELECT.
  - **Funções de disparo antigas** (`manual_trigger_notifications`, `trigger_email_notifications`, `schedule_email_notifications`): cada uma só é apagada se nada que fica a usa (job do pg_cron, outra função, trigger, policy, view, `pg_depend`); a que ainda for usada fica e aparece como `plano=manter (usada por: ...)` no diagnóstico. Site, Edge Functions do repositório, `scripts/` e `.github/` não chamam nenhuma delas. Provável: `trigger_email_notifications` fica (usada por `low-credits-daily`/`zero-credits-daily`).
  - **Proteção:** se algo automático que fica (job ativo, trigger) chegar a `get_students_for_notification`, a migration para: corrigida, ela poderia passar a enviar emails sem ninguém ter decidido.
  - **Cópia de segurança:** definição exata de cada função mexida/apagada e de cada job removido em `josi_backup.email_cleanup_20261112` (schema fora da API).
- [ ] **Decidir com o usuário: emails automáticos ligados ou não?** Uma sessão anterior registrou (branch não mergeada `claude/awesome-pasteur-9o65bx`) que "os emails automáticos de créditos baixos/zerados foram desligados a pedido do usuário" e que `low-credits-daily`/`zero-credits-daily` deveriam ser conferidos e apagados se ainda existissem. A migration `20261112050000` **mantém** esses dois jobs (instrução desta tarefa). Se o usuário quiser mesmo desligar: `SELECT cron.unschedule('low-credits-daily'); SELECT cron.unschedule('zero-credits-daily');` e depois apagar `trigger_email_notifications` (dev-critico).
- [ ] **Pendência das funções de disparo que ficarem:** se o diagnóstico de depois ainda mostrar `manual_trigger_notifications`, `trigger_email_notifications` ou `schedule_email_notifications`, é porque algo ainda as usa (ver `citada_por`). Decidir caso a caso (dev-critico). Linhas `outras` do diagnóstico (outras funções de email/notificação/cron) também não foram mexidas.
- [ ] **Edge Functions em produção:** conferir no painel do Supabase (Edge Functions) se existem só `create-user`, `manage-student`, `reset-password` e `send-email`. Uma Edge Function que não está no repositório poderia chamar uma função de disparo apagada (com service_role); se existir outra, avisar o dev-critico.
- [ ] Remover do repositório o arquivo vazio `credenciais google.txt` e adicionar `credenciais*` ao `.gitignore`.

## Regras fixas
- Uma tarefa, uma sessão, um PR.
- Textos sempre nas três línguas (pt, en, fr).
- Tarefas críticas vão para o agente `dev-critico` (ver `.claude/rules/escolha-de-esforco.md`).
- Todo push termina com o bloco "Próxima sessão" (ver `CLAUDE.md`).
