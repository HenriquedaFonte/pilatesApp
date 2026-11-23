# Plano: Turma online por mensalidade (3 modalidades) + pagamentos online
Data: 2026-11-23 · Branch do PR A: `claude/online-class-modalities-0nyf1k` (os PRs B, C e D, cada um numa sessão nova, a partir do `main`)

## Objetivo
A Josi passa a ter, na ficha de cada aluno, uma **modalidade online** independente das aulas presenciais: **Grupo acompanhado** (mensal), **Aulas gravadas** (mensal) ou **Drop-in grupo online** (avulso). Ela registra **mensalidades** (com período: de/até) e **drop-ins** (com a data da aula), vê quem está em dia, vence logo ou está vencido, e o Relatório Financeiro soma presencial + online. O mesmo aluno pode ter créditos presenciais **e** modalidade online. O aluno vê a situação dele no painel e pode **pedir** uma modalidade (no cadastro ou no painel); a Josi aprova.

## Fora do escopo
- Vídeos/links das aulas gravadas dentro da plataforma (hoje é Instagram/Zoom, segundo a landing page): o sistema só controla **quem pagou**.
- Check-in/presença das aulas online e turmas online em "Aulas" (não criar turma online em `classes`/`class_schedules`: a regra "só online" abaixo depende disso).
- Cobrança automática, lembrete automático de vencimento por email, email para a Josi quando alguém pede.
- Grupo "Alunos online" na tela de Mensagens (fácil depois: o envio já recebe a lista de ids do site).
- Corrigir o símbolo de moeda do Relatório Financeiro (`formatCurrency` mostra R$/€/$ conforme a língua; deveria ser CAD) — anotar em PENDENCIAS como item à parte.
- Impostos (o valor registrado é o que o aluno pagou, já com imposto se houver).
- Campo de modalidade no "Cadastrar Aluno" da professora (ela cadastra e depois atribui na ficha).
- Política de Privacidade: já cobre "informações de pagamento para compras de aulas"; não muda.

## Contexto lido
- `src/pages/TeacherStudents.jsx` — lista de alunos (cards com créditos individual/duo/grupo, badge "Em dia"/"Saldo baixo"/"Sem créditos"), diálogo "Saldo" → RPC `update_class_balance` (grava `balance_history` com `payment_method` e `amount_paid`), "Turmas" → `student_class_link`.
- `src/pages/StudentSummary.jsx` — ficha do aluno ("Ver"): perfil, `InsuranceFields`, card de recibos (`ReceiptsList`), histórico de créditos (`balance_history` + ausências).
- `src/pages/FinancialReport.jsx` — lê `balance_history` com `amount_paid` não nulo; resumo por forma de pagamento, gráfico por tipo (`individual`/`duo`/`group`), 2 CSVs.
- `src/pages/StudentDashboard.jsx` — card de saldo de créditos + chips, acesso rápido, próxima aula, grade, atividade recente.
- `src/pages/Signup.jsx` + `useAuth.signUp` — cadastro público (texto fixo em pt; sessão volta direto porque a confirmação de email está desligada); perfil criado por `handle_new_user` (corpo de produção não está todo no repo: **não mexer**).
- `src/lib/emailRecipients.js` + `src/pages/EmailNotifications.jsx` — grupos "Créditos baixos"/"Créditos zerados" calculados no navegador; a tela já carrega `student_class_link`.
- `src/pages/lowCreditsReport.jsx` — RPCs `get_low_credits_report` / `get_zero_credits_students`.
- `supabase/migrations/20261112010000_...` — `is_staff()`, guarda `prevent_privilege_escalation()` em `profiles` (por isso **nada novo vai em `profiles`**).
- `supabase/migrations/20261112070000_create_insurance_receipts.sql` — padrão a copiar: checagens iniciais (`is_staff()` com comentário `josi-pilates:%`, colunas de `audit_log`), tabela só SELECT pela API, escrita só por RPC `SECURITY DEFINER` com `is_staff()`, `audit_log` só com ids, `REVOKE … FROM PUBLIC, anon, authenticated, service_role` + `GRANT EXECUTE … TO authenticated`.
- `supabase/functions/manage-student/index.ts` — `hard-delete` apaga tabelas e depois `profiles`; com FK `ON DELETE CASCADE` as tabelas novas saem junto (sem mexer na função).
- `scripts/backup.js` — lista `TABLES`; tabelas novas precisam entrar.
- `src/lib/receipts.js` — reaproveitar `todayMontreal`, `isValidDateString`, `parseAmountToCents`, `centsToNumber`, `moneyFormatter` (arquivo sem imports pesados).
- `src/locales/*.json` → `studioHome.online.*`: preços e nomes já publicados ($58/mês acompanhado, $26/mês gravadas, $14 + impostos drop-in; aulas quarta 20h30 e sexta 12h00 no Zoom).

## Decisões tomadas neste plano (o dono pode mudar antes de começar)
1. **Duas tabelas novas, nada em `profiles` nem em `balance_history`.** `balance_history` é crédito (tipo, quantidade, saldo) e alimenta histórico do aluno, relatório de créditos e ficha; misturar mensalidade ali quebraria esses números. `profiles` tem a guarda de privilégio (recriada 3 vezes); coluna nova lá exigiria recriá-la de novo.
2. **Modalidade = 1 linha por aluno** (`online_memberships`), com `plan` (`coached` | `recorded` | `dropin`) e `status` (`requested` | `active` | `ended`). Presencial continua igual (créditos + turmas); por isso "presencial + online" é automático.
3. **Pagamentos online** (`online_payments`), um por linha: `kind = 'monthly'` (plano `coached`/`recorded`, `period_start`/`period_end`) ou `kind = 'dropin'` (`class_date`, uma aula por linha). Valor, forma de pagamento (as mesmas 4 do presencial: `cash`, `interac`, `credit_card`, `other`), data do pagamento (`paid_on`). Erro se corrige **anulando** com motivo (como os recibos); nada é apagado nem editado.
4. **Drop-in pode ser registrado para qualquer aluno** (inclusive presencial sem modalidade). Na tela, se o aluno não tem modalidade ativa, uma caixa marcada por padrão "Atribuir também a modalidade Drop-in" chama a RPC de modalidade antes. Mensalidade: se a modalidade ativa não for a do pagamento, a caixa "Atribuir também a modalidade X" vem marcada.
5. **Situação da mensalidade (calculada no site, dia de Montréal):** consideram-se só mensalidades válidas com `period_start <= hoje`; `pagoAté` = maior `period_end` delas. `pagoAté >= hoje` → "Em dia até …" (ou "Vence em N dias" se faltam ≤ 5 dias); `pagoAté < hoje` → "Vencida desde …" (dia seguinte ao `pagoAté`); nenhuma → "Sem pagamento". Drop-in: mostra a última aula paga e quantos no mês.
6. **Período padrão da mensalidade:** início = dia seguinte ao fim da última mensalidade, se esse fim for de no máximo 31 dias atrás; senão, hoje. Fim = início + 1 mês − 1 dia, com o mês "travado" no último dia (31/01 → 27/02; 15/01 → 14/02). A Josi pode mudar as duas datas. Máximo 366 dias por pagamento (aceita pagar vários meses de uma vez).
7. **O servidor recusa** mensalidade que se sobrepõe a outra válida do mesmo aluno e drop-in repetido na mesma data (evita duplo clique e lançamento em dobro). Para trocar de plano no meio do mês: anular e lançar de novo, ou começar o período novo depois do antigo.
8. **Valores sugeridos** (editáveis, vêm da landing page): acompanhado 58, gravadas 26, drop-in 16.10 (com impostos, decidido pelo dono em 2026-11-23). Constante única em `src/lib/onlinePlans.js`.
9. **Aluno "só online"** = modalidade `active` **e** 0 créditos presenciais **e** nenhuma turma em `student_class_link`. Para ele: na lista de alunos, o badge "Online" substitui "Sem créditos"/"Saldo baixo"; no painel, o card de créditos some; nos grupos de email "Créditos baixos/zerados" e no relatório de créditos baixos, ele fica de fora. Aluno presencial + online continua com tudo do presencial.
10. **Pedido do aluno** só por RPC (`request_online_plan`): cria/reabre a linha como `requested`. Não pode pedir se já tem `requested` ou `active`. A Josi aprova (vira `active`) ou recusa (vira `ended`) na ficha. Sem email.
11. **Aluno lê** só a própria modalidade e os próprios pagamentos (o motivo de anulação não aparece na tela dele, igual aos recibos). Sem campo de observação livre nessas tabelas (o aluno conseguiria ler pela API).
12. **Fatiamento em 4 PRs, nesta ordem:** A (banco) → B (professora) → C (aluno) → D (relatórios e emails). Uma sessão por PR. B, C e D dependem do SQL do A rodado em produção.

---

## PR A — Banco (migration, testes SQL, backup)

### 1. [OPUS] Migration das tabelas, RLS e RPCs ✅
- Arquivo: `supabase/migrations/20261123000000_create_online_memberships.sql` (BEGIN/COMMIT, idempotente).
- Fazer:
  - Checagens iniciais copiadas da `20261112070000` (`is_staff()` com comentário `josi-pilates:%`; `audit_log` com as 5 colunas). Se faltar, `RAISE EXCEPTION` e nada é aplicado.
  - `online_memberships`: `student_id uuid PK REFERENCES profiles(id) ON DELETE CASCADE`, `plan text NOT NULL CHECK (plan IN ('coached','recorded','dropin'))`, `status text NOT NULL CHECK (status IN ('requested','active','ended'))`, `requested_at timestamptz`, `started_on date`, `ended_on date`, `created_at`/`updated_at timestamptz NOT NULL DEFAULT now()`, `updated_by uuid` (sem FK). Trigger de `updated_at` reusando `public.update_updated_at_column()`.
  - `online_payments`: `id uuid PK DEFAULT gen_random_uuid()`, `student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE`, `kind`, `plan`, `period_start`, `period_end`, `class_date`, `amount numeric(10,2) NOT NULL CHECK (amount >= 0 AND amount < 100000)`, `payment_method text NOT NULL CHECK (IN as 4)`, `paid_on date NOT NULL`, `status text NOT NULL DEFAULT 'valid' CHECK (IN ('valid','void'))`, `voided_at`, `voided_by`, `void_reason`, `created_at`, `created_by uuid`. CHECK de coerência (segunda barreira):
    ```sql
    CHECK (
      (kind = 'monthly' AND plan IN ('coached','recorded') AND period_start IS NOT NULL
        AND period_end >= period_start AND period_end <= period_start + 366 AND class_date IS NULL)
      OR (kind = 'dropin' AND plan IS NULL AND period_start IS NULL AND period_end IS NULL
        AND class_date IS NOT NULL)
    )
    ```
    e `CHECK ((status = 'void') = (voided_at IS NOT NULL))`. Índices: `(student_id, kind, status)` e `(paid_on)`.
  - Guarda `online_payments_guard()` (BEFORE UPDATE): só deixa a transição `valid → void` mexendo em `status`, `voided_at`, `voided_by`, `void_reason`; qualquer outra mudança → erro. **Não** criar trigger de DELETE (o `ON DELETE CASCADE` do "apagar de vez" do aluno precisa passar).
  - Privilégios/RLS nas duas tabelas: `REVOKE ALL … FROM PUBLIC, anon, authenticated, service_role`; `GRANT SELECT … TO authenticated, service_role`; `ENABLE ROW LEVEL SECURITY`; uma policy SELECT `TO authenticated USING (student_id = (SELECT auth.uid()) OR (SELECT public.is_staff()))`. Nenhuma policy de escrita.
  - RPCs `SECURITY DEFINER SET search_path = public`, `REVOKE ALL … FROM PUBLIC, anon, authenticated, service_role` + `GRANT EXECUTE … TO authenticated`. Hoje = `(now() AT TIME ZONE 'America/Montreal')::date`. Erros com `RAISE EXCEPTION '<código>'` (mensagem = código abaixo; o site traduz):
    - `request_online_plan(p_plan text) RETURNS void` — quem chama: `auth.uid()` não nulo, perfil `role = 'student'` e `deleted_at IS NULL` (senão `online_not_allowed`, 42501). Plano inválido → `online_invalid_plan`. Linha `requested`/`active` → `online_plan_exists`. Linha `ended` → vira `requested` com o plano novo, `requested_at = now()`, `started_on`/`ended_on` nulos. Sem linha → insere `requested`.
    - `set_online_membership(p_student_id uuid, p_plan text, p_status text) RETURNS void` — só `is_staff()` com `auth.uid()` (senão `online_not_allowed`). Aluno precisa existir com `role = 'student'` (`online_invalid_student`). `p_status IN ('active','ended')`. `active`: `started_on` = hoje se estava vazio ou se vinha de `ended`/`requested`; `ended_on` nulo. `ended`: `ended_on` = hoje. Upsert (`ON CONFLICT (student_id)`). `audit_log` `online_membership.set` com `{student_id, plan, status}`.
    - `register_online_payment(p_student_id uuid, p_kind text, p_plan text, p_period_start date, p_period_end date, p_class_date date, p_amount numeric, p_payment_method text, p_paid_on date) RETURNS uuid` — staff como acima. Primeiro `PERFORM 1 FROM profiles WHERE id = p_student_id AND role = 'student' FOR UPDATE` (trava por aluno: duas gravações ao mesmo tempo não passam pela checagem de sobreposição); sem linha → `online_invalid_student`. Validar: `online_invalid_kind`, `online_invalid_plan`, `online_invalid_period` (datas faltando, fim < início, > 366 dias), `online_invalid_date` (`p_class_date`/`p_paid_on` nulos, `p_paid_on` > hoje ou < 2020-01-01), `online_invalid_amount` (nulo, < 0, ≥ 100000, ou `round(p_amount, 2) <> p_amount`), `online_invalid_method`. Sobreposição:
      ```sql
      IF EXISTS (SELECT 1 FROM online_payments
                 WHERE student_id = p_student_id AND kind = 'monthly' AND status = 'valid'
                   AND period_start <= p_period_end AND period_end >= p_period_start) THEN
        RAISE EXCEPTION 'online_period_overlap';
      ```
      Drop-in repetido (mesmo aluno, `class_date`, `status = 'valid'`) → `online_dropin_duplicate`. Grava com `created_by = auth.uid()` e devolve o id. **Não** mexe em `online_memberships`. `audit_log` `online_payment.register` com `{payment_id, student_id, kind, plan, amount}`.
    - `void_online_payment(p_payment_id uuid, p_reason text) RETURNS void` — staff. Motivo com trim de 1 a 500 caracteres (`online_reason_required`). Não existe → `online_payment_not_found`; já anulado → `online_already_void`. `audit_log` `online_payment.void` com `{payment_id, student_id}` (sem o motivo).
  - `COMMENT ON TABLE/FUNCTION` começando com `josi-pilates:`.
  - Bloco de ROLLBACK comentado no fim, apontando para o arquivo de reversão.
- Pronto quando: roda 2x seguidas sem erro num Postgres 16 local com o estado de produção simulado (como nas migrations anteriores) e o teste do passo 2 passa.

### 2. [OPUS] Teste e reversão SQL ✅
- Arquivos: `docs/testes/online-modalidade-teste.sql`, `docs/testes/online-modalidade-reversao.sql`.
- Fazer: teste no padrão de `docs/testes/3.3-recibos-teste.sql` (BEGIN … ROLLBACK, `SET LOCAL ROLE authenticated`, `request.jwt.claims`, `RAISE EXCEPTION 'FALHOU: …'`), escolhendo uma professora e 2 alunos reais por SELECT (sem ids escritos). Cobrir: aluno A pede (ok), pede de novo (`online_plan_exists`), lê só a própria linha, não lê a do B, não faz INSERT/UPDATE/DELETE direto nas tabelas, não chama `set_online_membership`/`register_online_payment`/`void_online_payment`; anon não lê nada nem chama RPC; professora aprova, registra mensalidade, recusa sobreposição, aceita período seguinte, registra drop-in, recusa drop-in repetido, recusa valor com 3 casas e data futura, anula (motivo obrigatório; anular de novo dá erro); UPDATE direto como `postgres` em `amount` é barrado pela guarda; `DELETE FROM profiles` de um aluno com pagamentos (dentro da transação) apaga em cascata; `audit_log` ganhou as linhas esperadas.
  Reversão: `DROP FUNCTION` das 4 RPCs e da guarda, `DROP TABLE online_payments, online_memberships` — **recusa** (RAISE) se existir algum pagamento, a menos que a pessoa troque uma variável `v_forcar` para `true` no topo (dados financeiros).
- Pronto quando: o teste passa no Postgres local e a reversão volta o banco ao estado anterior (rodar migration → reversão → migration).

### 3. [SONNET] Backup e PENDENCIAS
- Arquivos: `scripts/backup.js`, `docs/PENDENCIAS.md`.
- Fazer: em `TABLES`, acrescentar `'online_memberships'` e `'online_payments'` (depois de `'receipt_counters'`). Em PENDENCIAS: item em "SQL / deploys pendentes" (migration + teste + reversão + ordem), item em "A fazer" com os 4 PRs, item "Relatório Financeiro mostra R$/€ em vez de CAD" (fora do escopo).
- Pronto quando: `npm run lint`, `npm test`, `npm run build` verdes.

Ordem do PR A: **SQL antes do merge** (o backup do `main` passaria a pedir tabelas que não existem e o workflow ficaria vermelho). O SQL sozinho não muda nada no site no ar (só cria tabelas e funções novas).

---

## PR B — Professora: modalidade e pagamentos na ficha + lista de alunos (sessão nova, depois do SQL)

### 4. [OPUS] Lógica pura e serviço ✅
- Arquivos: `src/lib/onlinePlans.js` (novo, sem supabase), `src/lib/onlineService.js` (novo), `src/tests/onlinePlans.test.js` (novo).
- Fazer em `onlinePlans.js`: constantes `ONLINE_PLANS`, `MONTHLY_PLANS`, `PAYMENT_METHODS` (as 4 do presencial), `SUGGESTED_PRICES = { coached: 58, recorded: 26, dropin: 14 }`, `EXPIRING_DAYS = 5`; `addDays(dateStr, n)` e `addMonthsClamped(dateStr, n)` **só com `Date.UTC`/strings `AAAA-MM-DD`** (nunca `new Date('AAAA-MM-DD')` local, que vira o dia anterior em Montréal); `defaultMonthlyPeriod(payments, today)` (decisão 6); `onlineStatus({ membership, payments, today })` → `{ state, plan, paidThrough, daysLeft, overdueSince, lastDropin, dropinsThisMonth }` com `state` em `'none' | 'requested' | 'ended' | 'dropin' | 'paid' | 'expiring' | 'overdue' | 'unpaid'` (decisão 5; ignora anulados); `isOnlineOnly({ membership, totalCredits, hasStudioClasses })` (decisão 9); `validatePaymentForm(form, today)` (mesmas regras do servidor; valor via `parseAmountToCents`; devolve erros por campo com chaves i18n); `onlineErrorKey(err)` (mapeia os códigos `online_*` do servidor para `online.errors.<código sem prefixo>`, senão `online.errors.generic`). Reusar `todayMontreal`, `isValidDateString`, `parseAmountToCents`, `centsToNumber` de `src/lib/receipts.js`.
- Fazer em `onlineService.js`: `fetchMembership(studentId)`, `fetchPayments(studentId)` (ordenado por `paid_on` desc, `created_at` desc), `fetchOnlineOverview()` (todas as modalidades + mensalidades válidas `student_id, plan, period_start, period_end` + drop-ins válidos `student_id, class_date`, para a lista), `requestOnlinePlan(plan)`, `setMembership(studentId, plan, status)`, `registerPayment(form)` (converte o valor com `centsToNumber(parseAmountToCents(...))`; campos não usados pelo tipo vão `null`), `voidPayment(id, reason)`. Erros sobem como estão (a tela usa `onlineErrorKey`).
- Testes: períodos (15/01→14/02; 31/01→27/02; 30/01/2028→28/02/2028; 01/12→31/12; sem pagamento → hoje; fim há 40 dias → hoje; fim ontem → hoje); status (paid, expiring no limite de 5 dias, overdue com `overdueSince`, unpaid, pagamento futuro ignorado, anulado ignorado, requested, ended, dropin com contagem do mês); `isOnlineOnly` (os 4 casos); validação (vírgula, 3 casas, data futura, fim < início, > 366 dias); `onlineErrorKey`.
- Pronto quando: testes novos e antigos verdes.

### 5. [SONNET] Textos pt/en/fr ✅
- Arquivos: `src/locales/pt.json`, `en.json`, `fr.json`.
- Fazer: novo bloco de topo `"online"` com as chaves da tabela "Textos" (todas as do PR B, C e D de uma vez, para os PRs seguintes só usarem). Teste de chaves iguais nas 3 línguas: acrescentar ao padrão de `src/tests/privacyPolicy.test.js` um teste novo `src/tests/onlineLocales.test.js` que confere que `online` tem as mesmas chaves em pt/en/fr.
- Pronto quando: teste verde.

### 6. [OPUS] Card "Aulas online" na ficha do aluno ✅
- Arquivos: `src/components/OnlinePlanCard.jsx` (novo), `src/components/OnlinePaymentDialog.jsx` (novo), `src/pages/StudentSummary.jsx` (só inserir `<OnlinePlanCard studentId={studentId} className="mb-6" />` logo depois de `<InsuranceFields … />`).
- `OnlinePlanCard`: carrega modalidade e pagamentos; mostra plano + badge de situação (`onlineStatus`, cores: verde em dia, âmbar vence/pedido, vermelho vencida/sem pagamento, cinza encerrada). Botões conforme o estado: sem linha/encerrada → "Atribuir modalidade" (diálogo com o select dos 3 planos → `setMembership(…, 'active')`); `requested` → "Aprovar pedido" (mesmo diálogo, plano pré-escolhido) e "Recusar pedido" (`'ended'`, com confirmação); `active` → "Mudar modalidade" e "Encerrar" (confirmação). Sempre: "Registrar pagamento" (abre `OnlinePaymentDialog`). Tabela de pagamentos (data do pagamento, tipo, período ou data da aula, valor com `moneyFormatter`, forma, status) com "Anular" nos válidos (diálogo com motivo obrigatório; mostra o motivo embaixo dos anulados). Celular: tabela com rolagem horizontal dentro do card (não da página).
- `OnlinePaymentDialog` (props `student`, `membership`, `payments`, `open`, `onOpenChange`, `onSaved`): tipo (Mensalidade | Drop-in); mensalidade → plano (só os 2 mensais; padrão = plano ativo se for mensal, senão `coached`), início/fim (padrão `defaultMonthlyPeriod`), valor (padrão `SUGGESTED_PRICES[plan]`, muda junto com o plano enquanto a Josi não tiver digitado); drop-in → data da aula (padrão hoje), valor 14; os dois → forma de pagamento (padrão `interac`), data do pagamento (padrão hoje, `max` = hoje). Caixa "Atribuir também a modalidade …" conforme a decisão 4 (marcada por padrão; chama `setMembership` antes de `registerPayment`). Validar com `validatePaymentForm`; botão desabilitado enquanto grava (evita duplo clique); confirmação com o resumo antes de gravar; erros via `onlineErrorKey`. Nenhum email é enviado.
- Pronto quando: na ficha de um aluno de teste dá para atribuir, aprovar, mudar, encerrar, registrar mensalidade e drop-in, ver a situação mudar e anular; textos nas 3 línguas.

### 7. [SONNET] Lista de alunos: badge, filtro, pedidos e atalho de pagamento ✅
- Arquivo: `src/pages/TeacherStudents.jsx`.
- Fazer:
  - Em `fetchData`, carregar também `fetchOnlineOverview()` e `student_class_link` (`select('student_id')`) e guardar mapas por aluno (modalidade, pagamentos, `hasStudioClasses`). Falha nessa carga **não** derruba a lista (mostrar a lista sem os dados online).
  - No card: se o aluno tem modalidade `requested`/`active`, um badge "Online · <plano curto>" com a cor da situação, clicável para a ficha. Se `isOnlineOnly`, esse badge substitui o `statusBadge` de créditos ("Sem créditos"/"Saldo baixo"); se não, os dois aparecem.
  - No select de status (Ativos/Inativos/Todos), acrescentar "Online" (alunos com modalidade `requested` ou `active`).
  - Acima da busca (junto do `BirthdayBanner`), faixa "N pedidos de aulas online" com os nomes linkando para a ficha, só se houver `requested`.
  - No menu "⋮" do card, item "Pagamento online" que abre `OnlinePaymentDialog` para aquele aluno (recarrega a lista ao salvar).
- Pronto quando: aluno só online aparece com "Online" e sem "Sem créditos"; presencial + online mostra os dois; filtro e faixa funcionam; o atalho grava.

Ordem do PR B: **SQL do PR A antes do merge** (as telas leem as tabelas novas).

---

## PR C — Aluno: painel e pedido (sessão nova, depois do SQL)

### 8. [SONNET] Card "Aulas online" no painel do aluno
- Arquivos: `src/components/StudentOnlineCard.jsx` (novo), `src/pages/StudentDashboard.jsx`.
- Fazer: o card lê a própria modalidade e os próprios pagamentos (`fetchMembership(profile.id)`, `fetchPayments(profile.id)`) e mostra: plano, situação ("Em dia até …", "Vence em N dias", "Vencida desde …: fale com a Josi para renovar", "Pedido enviado: a Josi vai confirmar", drop-in: "Última aula paga: …"), e os últimos 5 pagamentos **válidos** (data, tipo, período/data da aula, valor). Sem modalidade (ou `ended`): link discreto "Quer fazer aulas online?" que abre diálogo com os 3 planos (nome, preço sugerido e uma linha de descrição, reusando os textos `studioHome.online.opt*`) → `requestOnlinePlan` → mensagem de sucesso; erro `online_plan_exists` mostra o texto próprio. No `StudentDashboard`: renderizar o card logo depois do bloco de saldo; se `isOnlineOnly` (modalidade ativa, total de créditos 0 e `myClasses` vazio), esconder o card de saldo + chips (o resto fica igual). Card nunca mostra motivo de anulação.
- Pronto quando: aluno de teste vê a situação certa nos estados (em dia, vence, vencida, pedido, drop-in), pede uma modalidade e a Josi vê o pedido.

### 9. [SONNET] Pedido no cadastro público
- Arquivo: `src/pages/Signup.jsx`.
- Fazer: campo opcional "Aulas online" (select: "Não, só presencial" (padrão) + os 3 planos) antes do botão. Depois do `signUp`, **só se `data?.session`** e um plano foi escolhido: `requestOnlinePlan(plano)` dentro de `try/catch` (falha não impede o cadastro; o aluno pode pedir pelo painel). Textos novos com `t()` (o resto da tela continua como está).
- Pronto quando: cadastro de teste com "Grupo acompanhado" aparece como pedido na lista da professora; com "Não" nada é criado.

Ordem do PR C: **SQL do PR A antes do merge**. Tanto faz em relação ao PR B, mas fazer depois dele (a Josi precisa da tela para aprovar).

---

## PR D — Relatórios e emails (sessão nova, depois do PR B)

### 10. [OPUS] Relatório Financeiro com os pagamentos online
- Arquivo: `src/pages/FinancialReport.jsx`.
- Fazer: em `fetchHistory`, buscar também `online_payments` com `status = 'valid'`, filtrando `paid_on` direto pelas strings `dateStart`/`dateEnd` (`gte`/`lte`; é `date`, sem fuso), `limit(500)`. Converter cada uma numa linha `{ id: 'online-<id>', student_id, type: 'online_monthly' | 'online_dropin', change_amount: null, created_at: <paid_on ao meio-dia local, para ordenar>, description: <período "AAAA-MM-DD → AAAA-MM-DD" ou "Aula AAAA-MM-DD">, payment_method, amount_paid: amount, source: 'online' }` e juntar com as de `balance_history`, ordenando por data. Resumo por forma de pagamento: somar valores e transações das online; créditos somam `change_amount || 0`. `getTypeBadge` e `barData`: rótulos traduzidos para os 2 tipos novos. Tabela e CSVs: coluna de créditos vazia ("—" na tela) para online; tipo com o rótulo traduzido. Novo select "Origem: Tudo / Presencial / Online" que filtra `filteredHistory` **e** o resumo (recalcular o resumo a partir das linhas filtradas, não do fetch). Se a busca online falhar, mostrar o presencial com um aviso (não esconder tudo).
- Pronto quando: um período com pagamentos presenciais e online mostra os dois, os totais batem com a soma da tabela em cada origem, e os CSVs trazem as linhas online.

### 11. [OPUS] Alunos só online fora dos avisos de créditos
- Arquivos: `src/lib/emailRecipients.js`, `src/pages/EmailNotifications.jsx`, `src/pages/lowCreditsReport.jsx`, `src/tests/emailRecipients.test.js`.
- Fazer: `filterRecipients` ganha a opção `onlineOnlyIds = []` que tira esses ids **só** de `low_credits` e `zero_credits` (os outros grupos não mudam). `EmailNotifications`: carregar `fetchOnlineOverview()` (já carrega os links) e montar `onlineOnlyIds` com `isOnlineOnly`; falha na carga online → lista vazia (comportamento de hoje). Mesmo filtro em `getLowCreditsStudents` se a tela usar. `lowCreditsReport`: tirar das duas listas os alunos só online (carregar modalidades + links), com a linha "N alunos só online não aparecem aqui".
- Testes: só online sai de low/zero; presencial + online continua; grupos all/class/selected iguais.
- Pronto quando: aluno de teste só online não aparece em "Créditos zerados" nem no relatório de créditos baixos.

### 12. [SONNET] PENDENCIAS de cada PR
- Em cada PR (A, B, C, D): atualizar `docs/PENDENCIAS.md` (testes em aberto do PR, o que falta dos outros PRs) e o bloco "Próxima sessão".

---

## Textos (pt / en / fr)
Bloco `online` (chaves curtas; o executor cria exatamente estas):

| chave | pt | en | fr |
|---|---|---|---|
| online.title | Aulas online | Online classes | Cours en ligne |
| online.plans.coached | Grupo acompanhado | Accompanied group | Groupe accompagné |
| online.plans.recorded | Aulas gravadas | Recorded classes | Cours enregistrés |
| online.plans.dropin | Drop-in grupo online | Online group drop-in | Drop-in groupe en ligne |
| online.badge | Online | Online | En ligne |
| online.status.paid | Em dia até {{date}} | Paid through {{date}} | Payé jusqu'au {{date}} |
| online.status.expiring | Vence em {{count}} dia(s) ({{date}}) | Due in {{count}} day(s) ({{date}}) | Échéance dans {{count}} jour(s) ({{date}}) |
| online.status.overdue | Vencida desde {{date}} | Overdue since {{date}} | En retard depuis le {{date}} |
| online.status.unpaid | Sem pagamento | No payment yet | Aucun paiement |
| online.status.requested | Pedido pendente | Request pending | Demande en attente |
| online.status.ended | Encerrada | Ended | Terminée |
| online.status.dropin | Última aula paga: {{date}} · {{count}} no mês | Last paid class: {{date}} · {{count}} this month | Dernier cours payé : {{date}} · {{count}} ce mois-ci |
| online.status.noDropin | Nenhuma aula paga ainda | No paid class yet | Aucun cours payé pour l'instant |
| online.none | Sem modalidade online | No online plan | Aucune formule en ligne |
| online.actions.assign | Atribuir modalidade | Assign plan | Attribuer une formule |
| online.actions.change | Mudar modalidade | Change plan | Changer de formule |
| online.actions.end | Encerrar | End | Terminer |
| online.actions.approve | Aprovar pedido | Approve request | Approuver la demande |
| online.actions.reject | Recusar pedido | Decline request | Refuser la demande |
| online.actions.registerPayment | Registrar pagamento | Record payment | Enregistrer un paiement |
| online.actions.paymentShortcut | Pagamento online | Online payment | Paiement en ligne |
| online.confirm.end | Encerrar a modalidade online de {{name}}? Os pagamentos continuam no histórico. | End {{name}}'s online plan? Payments stay in the history. | Terminer la formule en ligne de {{name}} ? Les paiements restent dans l'historique. |
| online.confirm.reject | Recusar o pedido de {{name}}? | Decline {{name}}'s request? | Refuser la demande de {{name}} ? |
| online.payment.kind | Tipo | Type | Type |
| online.payment.monthly | Mensalidade | Monthly fee | Mensualité |
| online.payment.dropin | Drop-in | Drop-in | Drop-in |
| online.payment.plan | Modalidade | Plan | Formule |
| online.payment.periodStart | Início do período | Period start | Début de la période |
| online.payment.periodEnd | Fim do período | Period end | Fin de la période |
| online.payment.classDate | Data da aula | Class date | Date du cours |
| online.payment.amount | Valor pago | Amount paid | Montant payé |
| online.payment.method | Forma de pagamento | Payment method | Mode de paiement |
| online.payment.paidOn | Data do pagamento | Payment date | Date du paiement |
| online.payment.alsoAssign | Atribuir também a modalidade {{plan}} | Also assign the {{plan}} plan | Attribuer aussi la formule {{plan}} |
| online.payment.confirmTitle | Confirmar pagamento | Confirm payment | Confirmer le paiement |
| online.payment.saved | Pagamento registrado. | Payment recorded. | Paiement enregistré. |
| online.payment.period | {{start}} a {{end}} | {{start}} to {{end}} | du {{start}} au {{end}} |
| online.payment.history | Pagamentos online | Online payments | Paiements en ligne |
| online.payment.empty | Nenhum pagamento online. | No online payments. | Aucun paiement en ligne. |
| online.payment.valid | Válido | Valid | Valide |
| online.payment.void | Anulado | Voided | Annulé |
| online.payment.voidAction | Anular | Void | Annuler |
| online.payment.voidReason | Motivo da anulação | Reason for voiding | Motif de l'annulation |
| online.payment.voided | Pagamento anulado. | Payment voided. | Paiement annulé. |
| online.methods.cash | Dinheiro | Cash | Comptant |
| online.methods.interac | Interac | Interac | Interac |
| online.methods.credit_card | Cartão de crédito | Credit card | Carte de crédit |
| online.methods.other | Outro | Other | Autre |
| online.list.filter | Online | Online | En ligne |
| online.list.requestsBanner | {{count}} pedido(s) de aulas online: | {{count}} online class request(s): | {{count}} demande(s) de cours en ligne : |
| online.student.overdueHint | Fale com a Josi para renovar. | Talk to Josi to renew. | Parlez à Josi pour renouveler. |
| online.student.requestedHint | Pedido enviado: a Josi vai confirmar. | Request sent: Josi will confirm. | Demande envoyée : Josi va confirmer. |
| online.student.cta | Quer fazer aulas online? | Want to take online classes? | Envie de cours en ligne ? |
| online.student.requestTitle | Escolha a modalidade online | Choose your online plan | Choisissez votre formule en ligne |
| online.student.requestSend | Enviar pedido | Send request | Envoyer la demande |
| online.student.requestSent | Pedido enviado! A Josi vai confirmar com você. | Request sent! Josi will confirm with you. | Demande envoyée ! Josi va confirmer avec vous. |
| online.student.lastPayments | Últimos pagamentos | Latest payments | Derniers paiements |
| online.signup.label | Aulas online (opcional) | Online classes (optional) | Cours en ligne (facultatif) |
| online.signup.none | Não, só presencial | No, in-studio only | Non, en studio seulement |
| online.report.origin | Origem | Source | Origine |
| online.report.all | Tudo | All | Tout |
| online.report.studio | Presencial | In-studio | En studio |
| online.report.online | Online | Online | En ligne |
| online.report.typeMonthly | Mensalidade online | Online monthly fee | Mensualité en ligne |
| online.report.typeDropin | Drop-in online | Online drop-in | Drop-in en ligne |
| online.report.loadWarning | Não foi possível carregar os pagamentos online. | Could not load online payments. | Impossible de charger les paiements en ligne. |
| online.report.hiddenOnlineOnly | {{count}} aluno(s) só online não aparece(m) aqui. | {{count}} online-only student(s) not shown here. | {{count}} élève(s) uniquement en ligne non affiché(s) ici. |
| online.errors.not_allowed | Você não tem permissão para isso. | You don't have permission to do this. | Vous n'avez pas la permission. |
| online.errors.invalid_student | Aluno não encontrado. | Student not found. | Élève introuvable. |
| online.errors.invalid_plan | Modalidade inválida. | Invalid plan. | Formule invalide. |
| online.errors.invalid_kind | Tipo de pagamento inválido. | Invalid payment type. | Type de paiement invalide. |
| online.errors.plan_exists | Já existe um pedido ou modalidade ativa. | There is already a request or active plan. | Il y a déjà une demande ou une formule active. |
| online.errors.invalid_period | Período inválido (fim antes do início ou mais de 1 ano). | Invalid period (end before start or longer than 1 year). | Période invalide (fin avant le début ou plus d'un an). |
| online.errors.period_overlap | Este período se sobrepõe a uma mensalidade já registrada. | This period overlaps a monthly fee already recorded. | Cette période chevauche une mensualité déjà enregistrée. |
| online.errors.dropin_duplicate | Já existe um drop-in nesta data. | There is already a drop-in on this date. | Il y a déjà un drop-in à cette date. |
| online.errors.invalid_date | Data inválida ou no futuro. | Invalid or future date. | Date invalide ou dans le futur. |
| online.errors.invalid_amount | Valor inválido. | Invalid amount. | Montant invalide. |
| online.errors.invalid_method | Escolha a forma de pagamento. | Choose the payment method. | Choisissez le mode de paiement. |
| online.errors.reason_required | Escreva o motivo. | Enter the reason. | Indiquez le motif. |
| online.errors.payment_not_found | Pagamento não encontrado. | Payment not found. | Paiement introuvable. |
| online.errors.already_void | Este pagamento já foi anulado. | This payment is already voided. | Ce paiement est déjà annulé. |
| online.errors.generic | Algo deu errado. Tente de novo. | Something went wrong. Try again. | Une erreur est survenue. Réessayez. |
| online.errors.load | Não foi possível carregar as aulas online. | Could not load online classes. | Impossible de charger les cours en ligne. |

Os textos da **Josi** (nomes dos planos) são os mesmos da landing page; se ela mudar lá, mudar aqui também.

## Banco de dados
- SQL: **sim** — `supabase/migrations/20261123000000_create_online_memberships.sql`; teste `docs/testes/online-modalidade-teste.sql`; reversão `docs/testes/online-modalidade-reversao.sql` (recusa se houver pagamento, salvo `v_forcar`).
- Ordem: **SQL antes do merge** em todos os PRs (A: backup lê as tabelas novas; B, C, D: as telas leem as tabelas/RPCs novas). O SQL sozinho não quebra o site no ar (só cria tabelas e funções).
- Edge Function a publicar: **nenhuma** (o "apagar de vez" da `manage-student` funciona pelo `ON DELETE CASCADE`).

## Testes
- Automáticos (todo PR): `npm run lint`, `npm test`, `npm run build`. Novos: `onlinePlans.test.js` (PR B), `onlineLocales.test.js` (PR B), `emailRecipients.test.js` ampliado (PR D). SQL: `online-modalidade-teste.sql` no Postgres local (PR A) e em produção depois da migration.
- Manual depois do deploy (aluno de teste, nas 3 línguas e no celular):
  - **PR A:** rodar a migration e o teste SQL (sem "FALHOU"); rodar o workflow de backup manualmente: verde, com `online_memberships`/`online_payments` (0 registros).
  - **PR B:** ficha → atribuir "Grupo acompanhado"; registrar mensalidade (período sugerido = hoje a hoje+1 mês−1, valor 58); registrar de novo (período sugerido começa no dia seguinte); tentar um período sobreposto (erro); drop-in para um aluno **presencial** sem modalidade (caixa "Atribuir também" marcada) → card mostra drop-in e o aluno mantém créditos/turmas; anular com motivo; encerrar. Lista: badge "Online", filtro "Online", aluno só online sem "Sem créditos", atalho "Pagamento online". Regressão: "Saldo" presencial e check-in iguais.
  - **PR C:** painel do aluno nos estados em dia / vence em ≤ 5 dias (lançar um período que termina daqui a 3 dias) / vencida (período que terminou ontem) / pedido / drop-in; aluno só online não vê o card de créditos; presencial + online vê os dois. Pedir pelo painel e pelo cadastro público (conta de teste, apagar depois).
  - **PR D:** Relatório Financeiro num período com pagamentos dos dois tipos: origem Tudo/Presencial/Online, totais e CSVs; Mensagens → "Créditos zerados" sem o aluno só online; relatório de créditos baixos idem, com a linha "N alunos só online".

## Riscos e como voltar atrás
- **Dinheiro:** valores em `numeric(10,2)`, conversão pelo `parseAmountToCents` já testado; o servidor recusa mais de 2 casas. Erro de lançamento se corrige anulando (fica no `audit_log`).
- **Datas:** tudo em `AAAA-MM-DD` de Montréal; o risco é usar `new Date('AAAA-MM-DD')` (vira o dia anterior) — proibido no plano e coberto por testes.
- **Sobreposição em dois cliques:** trava por aluno (`FOR UPDATE` no perfil) + botão desabilitado.
- **"Apagar de vez" do aluno:** depende do `ON DELETE CASCADE` e de não existir trigger de DELETE nas tabelas novas (testado no SQL).
- **Regra "só online"** depende de não haver turma online em `student_class_link`; se a Josi quiser turmas online no check-in no futuro, a regra muda (plano novo).
- Voltar atrás: PRs B/C/D → Revert do PR no GitHub (ou Promote to Production do deploy anterior na Vercel); os dados ficam no banco. PR A → primeiro o Revert dos PRs de tela, depois `docs/testes/online-modalidade-reversao.sql` (só se ainda não houver pagamentos reais).
- Revisão do `revisor` (Opus): **sim nos 4 PRs** (banco; pagamentos; dados do aluno/cadastro; relatório financeiro e emails).

## Perguntas ao dono — respondidas (2026-11-23)
1. Aulas gravadas: **sim**, o sistema só controla quem pagou.
2. Presença nas aulas online: **não**.
3. Drop-in: **16,10** (com impostos).
