-- Teste — modalidade online e pagamentos online
-- (migration 20261123000000_create_online_memberships.sql; plano
--  docs/planos/2026-11-23-online-modalidades.md, PR A passo 2)
--
-- Rodar no Supabase SQL Editor DEPOIS da migration.
--
-- Não precisa editar nada: o script escolhe sozinho a professora (role =
-- 'teacher') e os dois primeiros alunos (role = 'student', ordem do id) que
-- não estão apagados, ainda não têm modalidade nem pagamento online e não têm
-- recibo de seguro (recibo impede o "apagar de vez", testado no fim).
--
-- Tudo roda dentro de uma transação que termina em ROLLBACK: nada fica gravado
-- (nem modalidade, nem pagamento, nem audit_log, nem a exclusão de teste do
-- aluno B no fim).
-- Resultado:
--   • Sucesso → nenhum erro (o editor mostra só o último resultado; é normal).
--   • Falha   → erro começando com "FALHOU: ..." dizendo o que falhou.
--
-- Não testável aqui (uma sessão só): duas gravações AO MESMO TEMPO para o
-- mesmo aluno. A trava (SELECT ... FOR UPDATE no perfil) foi conferida em
-- Postgres local com duas sessões.

BEGIN;

SELECT set_config('josi.aluno',
         (SELECT p.id::text FROM public.profiles p
          WHERE p.role = 'student' AND p.deleted_at IS NULL
            AND NOT EXISTS (SELECT 1 FROM public.online_memberships m WHERE m.student_id = p.id)
            AND NOT EXISTS (SELECT 1 FROM public.online_payments o WHERE o.student_id = p.id)
            AND NOT EXISTS (SELECT 1 FROM public.insurance_receipts r WHERE r.student_id = p.id)
          ORDER BY p.id LIMIT 1), true),
       set_config('josi.aluno_b',
         (SELECT p.id::text FROM public.profiles p
          WHERE p.role = 'student' AND p.deleted_at IS NULL
            AND NOT EXISTS (SELECT 1 FROM public.online_memberships m WHERE m.student_id = p.id)
            AND NOT EXISTS (SELECT 1 FROM public.online_payments o WHERE o.student_id = p.id)
            AND NOT EXISTS (SELECT 1 FROM public.insurance_receipts r WHERE r.student_id = p.id)
          ORDER BY p.id OFFSET 1 LIMIT 1), true),
       set_config('josi.professora',
         (SELECT id::text FROM public.profiles WHERE role = 'teacher' ORDER BY id LIMIT 1), true);

-- ════════════════════════════════════════════════════════════════════════════
-- 0. Estrutura (como postgres)
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  a uuid := nullif(current_setting('josi.aluno'), '')::uuid;
  b uuid := nullif(current_setting('josi.aluno_b'), '')::uuid;
  t uuid := nullif(current_setting('josi.professora'), '')::uuid;
  v_fn text;
  n int;
BEGIN
  IF a IS NULL OR b IS NULL OR a = b THEN
    RAISE EXCEPTION 'FALHOU: não há dois alunos disponíveis para o teste (role = student, não apagados, sem modalidade/pagamento online e sem recibo)';
  END IF;
  IF t IS NULL THEN
    RAISE EXCEPTION 'FALHOU: professora de teste não encontrada (role = teacher)';
  END IF;

  IF to_regclass('public.online_memberships') IS NULL OR to_regclass('public.online_payments') IS NULL THEN
    RAISE EXCEPTION 'FALHOU: migration 20261123000000 não rodou (tabelas não existem)';
  END IF;

  -- RLS ligada.
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.online_memberships'::regclass)
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.online_payments'::regclass) THEN
    RAISE EXCEPTION 'FALHOU: RLS desligada em online_memberships/online_payments';
  END IF;

  -- Privilégios: a API só lê; anon nada.
  IF has_table_privilege('authenticated', 'public.online_memberships', 'INSERT')
     OR has_table_privilege('authenticated', 'public.online_memberships', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.online_memberships', 'DELETE')
     OR has_table_privilege('authenticated', 'public.online_memberships', 'TRUNCATE')
     OR has_table_privilege('authenticated', 'public.online_payments', 'INSERT')
     OR has_table_privilege('authenticated', 'public.online_payments', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.online_payments', 'DELETE')
     OR has_table_privilege('authenticated', 'public.online_payments', 'TRUNCATE') THEN
    RAISE EXCEPTION 'FALHOU: authenticated tem INSERT/UPDATE/DELETE/TRUNCATE nas tabelas online';
  END IF;
  IF has_table_privilege('service_role', 'public.online_memberships', 'INSERT')
     OR has_table_privilege('service_role', 'public.online_memberships', 'UPDATE')
     OR has_table_privilege('service_role', 'public.online_memberships', 'DELETE')
     OR has_table_privilege('service_role', 'public.online_payments', 'INSERT')
     OR has_table_privilege('service_role', 'public.online_payments', 'UPDATE')
     OR has_table_privilege('service_role', 'public.online_payments', 'DELETE') THEN
    RAISE EXCEPTION 'FALHOU: service_role escreve nas tabelas online (deveria só ler, para o backup)';
  END IF;
  IF NOT has_table_privilege('authenticated', 'public.online_memberships', 'SELECT')
     OR NOT has_table_privilege('authenticated', 'public.online_payments', 'SELECT')
     OR NOT has_table_privilege('service_role', 'public.online_memberships', 'SELECT')
     OR NOT has_table_privilege('service_role', 'public.online_payments', 'SELECT') THEN
    RAISE EXCEPTION 'FALHOU: authenticated/service_role não têm SELECT nas tabelas online';
  END IF;
  IF has_table_privilege('anon', 'public.online_memberships', 'SELECT')
     OR has_table_privilege('anon', 'public.online_payments', 'SELECT') THEN
    RAISE EXCEPTION 'FALHOU: anon lê as tabelas online';
  END IF;

  -- RPCs: SECURITY DEFINER, search_path fixo, só authenticated executa.
  FOREACH v_fn IN ARRAY ARRAY[
    'public.request_online_plan(text)',
    'public.set_online_membership(uuid,text,text)',
    'public.register_online_payment(uuid,text,text,date,date,date,numeric,text,date)',
    'public.void_online_payment(uuid,text)'
  ] LOOP
    IF to_regprocedure(v_fn) IS NULL THEN
      RAISE EXCEPTION 'FALHOU: função % não existe', v_fn;
    END IF;
    IF NOT (SELECT prosecdef FROM pg_proc WHERE oid = to_regprocedure(v_fn))
       OR NOT coalesce((SELECT 'search_path=public' = ANY (proconfig) FROM pg_proc WHERE oid = to_regprocedure(v_fn)), false) THEN
      RAISE EXCEPTION 'FALHOU: % não é SECURITY DEFINER com search_path = public', v_fn;
    END IF;
    IF has_function_privilege('anon', v_fn, 'EXECUTE')
       OR has_function_privilege('service_role', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'FALHOU: anon/service_role pode chamar %', v_fn;
    END IF;
    IF NOT has_function_privilege('authenticated', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'FALHOU: authenticated não pode chamar %', v_fn;
    END IF;
  END LOOP;

  -- Uma policy por tabela, só SELECT.
  SELECT count(*) INTO n FROM pg_policies
  WHERE schemaname = 'public' AND tablename IN ('online_memberships', 'online_payments');
  IF n <> 2 OR EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
                       AND tablename IN ('online_memberships', 'online_payments') AND cmd <> 'SELECT') THEN
    RAISE EXCEPTION 'FALHOU: tabelas online têm % policies (esperado 2, só SELECT)', n;
  END IF;

  -- "Apagar de vez": FK com ON DELETE CASCADE e nenhum trigger de DELETE/TRUNCATE.
  SELECT count(*) INTO n FROM pg_constraint
  WHERE contype = 'f' AND confrelid = 'public.profiles'::regclass AND confdeltype = 'c'
    AND conrelid IN ('public.online_memberships'::regclass, 'public.online_payments'::regclass);
  IF n <> 2 THEN
    RAISE EXCEPTION 'FALHOU: as FKs para profiles nas tabelas online não são ON DELETE CASCADE (% de 2)', n;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger
             WHERE tgrelid IN ('public.online_memberships'::regclass, 'public.online_payments'::regclass)
               AND NOT tgisinternal AND (tgtype & (8 | 32)) <> 0) THEN
    RAISE EXCEPTION 'FALHOU: existe trigger de DELETE/TRUNCATE nas tabelas online (quebraria o "apagar de vez")';
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 1. ALUNO A: pede, não pede de novo, não escreve direto, não chama RPC da professora
-- ════════════════════════════════════════════════════════════════════════════
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  json_build_object('sub', current_setting('josi.aluno'), 'role', 'authenticated')::text, true);

DO $$
DECLARE
  a uuid := current_setting('josi.aluno')::uuid;
  v_today date := (now() AT TIME ZONE 'America/Montreal')::date;
  v_row record;
  e text;
BEGIN
  PERFORM public.request_online_plan('coached');

  SELECT * INTO v_row FROM public.online_memberships WHERE student_id = a;
  IF NOT FOUND OR v_row.plan <> 'coached' OR v_row.status <> 'requested'
     OR v_row.requested_at IS NULL OR v_row.started_on IS NOT NULL THEN
    RAISE EXCEPTION 'FALHOU: pedido do aluno A gravado errado (%)', to_jsonb(v_row);
  END IF;

  e := NULL;
  BEGIN PERFORM public.request_online_plan('recorded');
  EXCEPTION WHEN others THEN e := SQLERRM; END;
  IF e IS DISTINCT FROM 'online_plan_exists' THEN
    RAISE EXCEPTION 'FALHOU: pedido repetido (esperado online_plan_exists, veio %)', coalesce(e, 'sucesso');
  END IF;

  -- RPCs da professora: recusadas.
  e := NULL;
  BEGIN PERFORM public.set_online_membership(a, 'coached', 'active');
  EXCEPTION WHEN others THEN e := SQLERRM; END;
  IF e IS DISTINCT FROM 'online_not_allowed' THEN
    RAISE EXCEPTION 'FALHOU: aluno chamou set_online_membership (veio %)', coalesce(e, 'sucesso');
  END IF;
  e := NULL;
  BEGIN PERFORM public.register_online_payment(a, 'dropin', NULL, NULL, NULL, v_today, 1, 'cash', v_today);
  EXCEPTION WHEN others THEN e := SQLERRM; END;
  IF e IS DISTINCT FROM 'online_not_allowed' THEN
    RAISE EXCEPTION 'FALHOU: aluno chamou register_online_payment (veio %)', coalesce(e, 'sucesso');
  END IF;
  e := NULL;
  BEGIN PERFORM public.void_online_payment(gen_random_uuid(), 'aluno');
  EXCEPTION WHEN others THEN e := SQLERRM; END;
  IF e IS DISTINCT FROM 'online_not_allowed' THEN
    RAISE EXCEPTION 'FALHOU: aluno chamou void_online_payment (veio %)', coalesce(e, 'sucesso');
  END IF;

  -- Escrita direta: negada.
  e := NULL;
  BEGIN UPDATE public.online_memberships SET status = 'active' WHERE student_id = a;
  EXCEPTION WHEN others THEN e := SQLSTATE; END;
  IF e IS DISTINCT FROM '42501' THEN RAISE EXCEPTION 'FALHOU: aluno fez UPDATE direto em online_memberships'; END IF;
  e := NULL;
  BEGIN DELETE FROM public.online_memberships WHERE student_id = a;
  EXCEPTION WHEN others THEN e := SQLSTATE; END;
  IF e IS DISTINCT FROM '42501' THEN RAISE EXCEPTION 'FALHOU: aluno fez DELETE direto em online_memberships'; END IF;
  e := NULL;
  BEGIN INSERT INTO public.online_memberships (student_id, plan, status) VALUES (a, 'recorded', 'active');
  EXCEPTION WHEN others THEN e := SQLSTATE; END;
  IF e IS DISTINCT FROM '42501' THEN RAISE EXCEPTION 'FALHOU: aluno fez INSERT direto em online_memberships'; END IF;
  e := NULL;
  BEGIN
    INSERT INTO public.online_payments (student_id, kind, class_date, amount, payment_method, paid_on)
    VALUES (a, 'dropin', v_today, 0, 'cash', v_today);
  EXCEPTION WHEN others THEN e := SQLSTATE; END;
  IF e IS DISTINCT FROM '42501' THEN RAISE EXCEPTION 'FALHOU: aluno fez INSERT direto em online_payments'; END IF;
  e := NULL;
  BEGIN UPDATE public.online_payments SET amount = 0 WHERE student_id = a;
  EXCEPTION WHEN others THEN e := SQLSTATE; END;
  IF e IS DISTINCT FROM '42501' THEN RAISE EXCEPTION 'FALHOU: aluno fez UPDATE direto em online_payments'; END IF;
  e := NULL;
  BEGIN DELETE FROM public.online_payments WHERE student_id = a;
  EXCEPTION WHEN others THEN e := SQLSTATE; END;
  IF e IS DISTINCT FROM '42501' THEN RAISE EXCEPTION 'FALHOU: aluno fez DELETE direto em online_payments'; END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. ALUNO B: não vê o pedido do A; plano inválido recusado; pede
-- ════════════════════════════════════════════════════════════════════════════
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  json_build_object('sub', current_setting('josi.aluno_b'), 'role', 'authenticated')::text, true);

DO $$
DECLARE
  a uuid := current_setting('josi.aluno')::uuid;
  b uuid := current_setting('josi.aluno_b')::uuid;
  n int;
  e text;
BEGIN
  SELECT count(*) INTO n FROM public.online_memberships WHERE student_id = a OR student_id <> b;
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: aluno B vê % modalidades de outros alunos', n; END IF;

  e := NULL;
  BEGIN PERFORM public.request_online_plan('premium');
  EXCEPTION WHEN others THEN e := SQLERRM; END;
  IF e IS DISTINCT FROM 'online_invalid_plan' THEN
    RAISE EXCEPTION 'FALHOU: pedido com plano inválido (esperado online_invalid_plan, veio %)', coalesce(e, 'sucesso');
  END IF;

  PERFORM public.request_online_plan('recorded');
  SELECT count(*) INTO n FROM public.online_memberships
  WHERE student_id = b AND plan = 'recorded' AND status = 'requested';
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: pedido do aluno B não foi gravado'; END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. PROFESSORA: aprova, recusa, registra, valida, anula
-- ════════════════════════════════════════════════════════════════════════════
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  json_build_object('sub', current_setting('josi.professora'), 'role', 'authenticated')::text, true);

DO $$
DECLARE
  a uuid := current_setting('josi.aluno')::uuid;
  b uuid := current_setting('josi.aluno_b')::uuid;
  t uuid := current_setting('josi.professora')::uuid;
  v_today date := (now() AT TIME ZONE 'America/Montreal')::date;
  v_end1  date;
  p1 uuid; p2 uuid; p3 uuid; p4 uuid;
  v_row record;
  n int;
  e text;
BEGIN
  -- Professora não "pede" modalidade.
  e := NULL;
  BEGIN PERFORM public.request_online_plan('coached');
  EXCEPTION WHEN others THEN e := SQLERRM; END;
  IF e IS DISTINCT FROM 'online_not_allowed' THEN
    RAISE EXCEPTION 'FALHOU: professora chamou request_online_plan (veio %)', coalesce(e, 'sucesso');
  END IF;

  -- Vê as modalidades dos dois alunos.
  SELECT count(*) INTO n FROM public.online_memberships WHERE student_id IN (a, b);
  IF n <> 2 THEN RAISE EXCEPTION 'FALHOU: professora não vê as modalidades dos alunos (% de 2)', n; END IF;

  -- Aprova o A; recusa o B.
  PERFORM public.set_online_membership(a, 'coached', 'active');
  SELECT * INTO v_row FROM public.online_memberships WHERE student_id = a;
  IF v_row.status <> 'active' OR v_row.plan <> 'coached' OR v_row.started_on IS DISTINCT FROM v_today
     OR v_row.ended_on IS NOT NULL OR v_row.updated_by IS DISTINCT FROM t THEN
    RAISE EXCEPTION 'FALHOU: aprovação do A gravada errada (%)', to_jsonb(v_row);
  END IF;
  PERFORM public.set_online_membership(b, 'recorded', 'ended');
  SELECT * INTO v_row FROM public.online_memberships WHERE student_id = b;
  IF v_row.status <> 'ended' OR v_row.ended_on IS DISTINCT FROM v_today THEN
    RAISE EXCEPTION 'FALHOU: recusa do B gravada errada (%)', to_jsonb(v_row);
  END IF;

  -- Validações de set_online_membership.
  e := NULL;
  BEGIN PERFORM public.set_online_membership(t, 'coached', 'active');
  EXCEPTION WHEN others THEN e := SQLERRM; END;
  IF e IS DISTINCT FROM 'online_invalid_student' THEN
    RAISE EXCEPTION 'FALHOU: modalidade para quem não é aluno (veio %)', coalesce(e, 'sucesso');
  END IF;
  e := NULL;
  BEGIN PERFORM public.set_online_membership(a, 'premium', 'active');
  EXCEPTION WHEN others THEN e := SQLERRM; END;
  IF e IS DISTINCT FROM 'online_invalid_plan' THEN
    RAISE EXCEPTION 'FALHOU: set_online_membership com plano inválido (veio %)', coalesce(e, 'sucesso');
  END IF;
  e := NULL;
  BEGIN PERFORM public.set_online_membership(a, 'coached', 'requested');
  EXCEPTION WHEN others THEN e := SQLERRM; END;
  IF e IS DISTINCT FROM 'online_invalid_status' THEN
    RAISE EXCEPTION 'FALHOU: set_online_membership com status requested (veio %)', coalesce(e, 'sucesso');
  END IF;

  -- Mensalidade do A: hoje → hoje + 1 mês − 1 dia.
  v_end1 := (v_today + interval '1 month' - interval '1 day')::date;
  p1 := public.register_online_payment(a, 'monthly', 'coached', v_today, v_end1, NULL, 58, 'interac', v_today);
  SELECT * INTO v_row FROM public.online_payments WHERE id = p1;
  IF NOT FOUND OR v_row.kind <> 'monthly' OR v_row.plan <> 'coached' OR v_row.amount <> 58
     OR v_row.period_start <> v_today OR v_row.period_end <> v_end1 OR v_row.class_date IS NOT NULL
     OR v_row.status <> 'valid' OR v_row.created_by IS DISTINCT FROM t OR v_row.paid_on <> v_today THEN
    RAISE EXCEPTION 'FALHOU: mensalidade gravada errada (%)', to_jsonb(v_row);
  END IF;
  -- Registrar pagamento não mexe na modalidade.
  SELECT * INTO v_row FROM public.online_memberships WHERE student_id = a;
  IF v_row.status <> 'active' OR v_row.plan <> 'coached' THEN
    RAISE EXCEPTION 'FALHOU: register_online_payment mexeu em online_memberships';
  END IF;

  -- Sobreposição recusada.
  e := NULL;
  BEGIN PERFORM public.register_online_payment(a, 'monthly', 'coached', v_today + 10, v_today + 40, NULL, 58, 'cash', v_today);
  EXCEPTION WHEN others THEN e := SQLERRM; END;
  IF e IS DISTINCT FROM 'online_period_overlap' THEN
    RAISE EXCEPTION 'FALHOU: período sobreposto (esperado online_period_overlap, veio %)', coalesce(e, 'sucesso');
  END IF;
  e := NULL;
  BEGIN PERFORM public.register_online_payment(a, 'monthly', 'recorded', v_end1, v_end1 + 30, NULL, 26, 'cash', v_today);
  EXCEPTION WHEN others THEN e := SQLERRM; END;
  IF e IS DISTINCT FROM 'online_period_overlap' THEN
    RAISE EXCEPTION 'FALHOU: período que começa no último dia do anterior (esperado online_period_overlap, veio %)', coalesce(e, 'sucesso');
  END IF;

  -- Período seguinte aceito.
  p2 := public.register_online_payment(a, 'monthly', 'coached', v_end1 + 1, v_end1 + 30, NULL, 58, 'cash', v_today);

  -- Drop-in do B (sem modalidade ativa: permitido), 16.10.
  p3 := public.register_online_payment(b, 'dropin', NULL, NULL, NULL, v_today, 16.10, 'credit_card', v_today);
  SELECT * INTO v_row FROM public.online_payments WHERE id = p3;
  IF v_row.kind <> 'dropin' OR v_row.plan IS NOT NULL OR v_row.period_start IS NOT NULL
     OR v_row.class_date <> v_today OR v_row.amount <> 16.10 THEN
    RAISE EXCEPTION 'FALHOU: drop-in gravado errado (%)', to_jsonb(v_row);
  END IF;
  e := NULL;
  BEGIN PERFORM public.register_online_payment(b, 'dropin', NULL, NULL, NULL, v_today, 16.10, 'cash', v_today);
  EXCEPTION WHEN others THEN e := SQLERRM; END;
  IF e IS DISTINCT FROM 'online_dropin_duplicate' THEN
    RAISE EXCEPTION 'FALHOU: drop-in repetido (esperado online_dropin_duplicate, veio %)', coalesce(e, 'sucesso');
  END IF;

  -- Validações (cada uma recusada com o código certo).
  e := NULL;
  BEGIN PERFORM public.register_online_payment(b, 'dropin', NULL, NULL, NULL, v_today - 1, 10.005, 'cash', v_today);
  EXCEPTION WHEN others THEN e := SQLERRM; END;
  IF e IS DISTINCT FROM 'online_invalid_amount' THEN
    RAISE EXCEPTION 'FALHOU: valor com 3 casas (esperado online_invalid_amount, veio %)', coalesce(e, 'sucesso');
  END IF;
  e := NULL;
  BEGIN PERFORM public.register_online_payment(b, 'dropin', NULL, NULL, NULL, v_today - 1, -1, 'cash', v_today);
  EXCEPTION WHEN others THEN e := SQLERRM; END;
  IF e IS DISTINCT FROM 'online_invalid_amount' THEN
    RAISE EXCEPTION 'FALHOU: valor negativo (esperado online_invalid_amount, veio %)', coalesce(e, 'sucesso');
  END IF;
  e := NULL;
  BEGIN PERFORM public.register_online_payment(b, 'dropin', NULL, NULL, NULL, v_today - 1, 100000, 'cash', v_today);
  EXCEPTION WHEN others THEN e := SQLERRM; END;
  IF e IS DISTINCT FROM 'online_invalid_amount' THEN
    RAISE EXCEPTION 'FALHOU: valor 100000 (esperado online_invalid_amount, veio %)', coalesce(e, 'sucesso');
  END IF;
  e := NULL;
  BEGIN PERFORM public.register_online_payment(b, 'dropin', NULL, NULL, NULL, v_today - 1, 10, 'cash', v_today + 1);
  EXCEPTION WHEN others THEN e := SQLERRM; END;
  IF e IS DISTINCT FROM 'online_invalid_date' THEN
    RAISE EXCEPTION 'FALHOU: pagamento com data futura (esperado online_invalid_date, veio %)', coalesce(e, 'sucesso');
  END IF;
  e := NULL;
  BEGIN PERFORM public.register_online_payment(b, 'dropin', NULL, NULL, NULL, v_today - 1, 10, 'cash', DATE '2019-12-31');
  EXCEPTION WHEN others THEN e := SQLERRM; END;
  IF e IS DISTINCT FROM 'online_invalid_date' THEN
    RAISE EXCEPTION 'FALHOU: pagamento antes de 2020 (esperado online_invalid_date, veio %)', coalesce(e, 'sucesso');
  END IF;
  e := NULL;
  BEGIN PERFORM public.register_online_payment(b, 'dropin', NULL, NULL, NULL, NULL, 10, 'cash', v_today);
  EXCEPTION WHEN others THEN e := SQLERRM; END;
  IF e IS DISTINCT FROM 'online_invalid_date' THEN
    RAISE EXCEPTION 'FALHOU: drop-in sem data da aula (esperado online_invalid_date, veio %)', coalesce(e, 'sucesso');
  END IF;
  e := NULL;
  BEGIN PERFORM public.register_online_payment(b, 'monthly', 'coached', v_today + 400, v_today + 399, NULL, 58, 'cash', v_today);
  EXCEPTION WHEN others THEN e := SQLERRM; END;
  IF e IS DISTINCT FROM 'online_invalid_period' THEN
    RAISE EXCEPTION 'FALHOU: fim antes do início (esperado online_invalid_period, veio %)', coalesce(e, 'sucesso');
  END IF;
  e := NULL;
  BEGIN PERFORM public.register_online_payment(b, 'monthly', 'coached', v_today + 400, v_today + 400 + 367, NULL, 58, 'cash', v_today);
  EXCEPTION WHEN others THEN e := SQLERRM; END;
  IF e IS DISTINCT FROM 'online_invalid_period' THEN
    RAISE EXCEPTION 'FALHOU: período de mais de 366 dias (esperado online_invalid_period, veio %)', coalesce(e, 'sucesso');
  END IF;
  e := NULL;
  BEGIN PERFORM public.register_online_payment(b, 'monthly', 'coached', v_today + 400, NULL, NULL, 58, 'cash', v_today);
  EXCEPTION WHEN others THEN e := SQLERRM; END;
  IF e IS DISTINCT FROM 'online_invalid_period' THEN
    RAISE EXCEPTION 'FALHOU: mensalidade sem fim (esperado online_invalid_period, veio %)', coalesce(e, 'sucesso');
  END IF;
  e := NULL;
  BEGIN PERFORM public.register_online_payment(b, 'monthly', 'dropin', v_today + 400, v_today + 420, NULL, 58, 'cash', v_today);
  EXCEPTION WHEN others THEN e := SQLERRM; END;
  IF e IS DISTINCT FROM 'online_invalid_plan' THEN
    RAISE EXCEPTION 'FALHOU: mensalidade com plano dropin (esperado online_invalid_plan, veio %)', coalesce(e, 'sucesso');
  END IF;
  e := NULL;
  BEGIN PERFORM public.register_online_payment(b, 'yearly', 'coached', v_today, v_today, NULL, 58, 'cash', v_today);
  EXCEPTION WHEN others THEN e := SQLERRM; END;
  IF e IS DISTINCT FROM 'online_invalid_kind' THEN
    RAISE EXCEPTION 'FALHOU: tipo inválido (esperado online_invalid_kind, veio %)', coalesce(e, 'sucesso');
  END IF;
  e := NULL;
  BEGIN PERFORM public.register_online_payment(b, 'dropin', NULL, NULL, NULL, v_today - 1, 10, 'paypal', v_today);
  EXCEPTION WHEN others THEN e := SQLERRM; END;
  IF e IS DISTINCT FROM 'online_invalid_method' THEN
    RAISE EXCEPTION 'FALHOU: forma de pagamento inválida (esperado online_invalid_method, veio %)', coalesce(e, 'sucesso');
  END IF;
  e := NULL;
  BEGIN PERFORM public.register_online_payment(t, 'dropin', NULL, NULL, NULL, v_today - 1, 10, 'cash', v_today);
  EXCEPTION WHEN others THEN e := SQLERRM; END;
  IF e IS DISTINCT FROM 'online_invalid_student' THEN
    RAISE EXCEPTION 'FALHOU: pagamento para quem não é aluno (esperado online_invalid_student, veio %)', coalesce(e, 'sucesso');
  END IF;

  -- Escrita direta: negada também para a professora.
  e := NULL;
  BEGIN UPDATE public.online_payments SET amount = 1 WHERE id = p1;
  EXCEPTION WHEN others THEN e := SQLSTATE; END;
  IF e IS DISTINCT FROM '42501' THEN RAISE EXCEPTION 'FALHOU: professora fez UPDATE direto em online_payments'; END IF;
  e := NULL;
  BEGIN DELETE FROM public.online_payments WHERE id = p1;
  EXCEPTION WHEN others THEN e := SQLSTATE; END;
  IF e IS DISTINCT FROM '42501' THEN RAISE EXCEPTION 'FALHOU: professora fez DELETE direto em online_payments'; END IF;
  e := NULL;
  BEGIN UPDATE public.online_memberships SET plan = 'recorded' WHERE student_id = a;
  EXCEPTION WHEN others THEN e := SQLSTATE; END;
  IF e IS DISTINCT FROM '42501' THEN RAISE EXCEPTION 'FALHOU: professora fez UPDATE direto em online_memberships'; END IF;

  -- Anulação: motivo obrigatório (1 a 500); uma vez só.
  e := NULL;
  BEGIN PERFORM public.void_online_payment(p2, '   ');
  EXCEPTION WHEN others THEN e := SQLERRM; END;
  IF e IS DISTINCT FROM 'online_reason_required' THEN
    RAISE EXCEPTION 'FALHOU: anulou sem motivo (veio %)', coalesce(e, 'sucesso');
  END IF;
  e := NULL;
  BEGIN PERFORM public.void_online_payment(p2, repeat('x', 501));
  EXCEPTION WHEN others THEN e := SQLERRM; END;
  IF e IS DISTINCT FROM 'online_reason_required' THEN
    RAISE EXCEPTION 'FALHOU: anulou com motivo de 501 caracteres (veio %)', coalesce(e, 'sucesso');
  END IF;
  e := NULL;
  BEGIN PERFORM public.void_online_payment(gen_random_uuid(), 'Teste');
  EXCEPTION WHEN others THEN e := SQLERRM; END;
  IF e IS DISTINCT FROM 'online_payment_not_found' THEN
    RAISE EXCEPTION 'FALHOU: anular pagamento inexistente (esperado online_payment_not_found, veio %)', coalesce(e, 'sucesso');
  END IF;

  PERFORM public.void_online_payment(p2, '  Teste: valor errado  ');
  SELECT * INTO v_row FROM public.online_payments WHERE id = p2;
  IF v_row.status <> 'void' OR v_row.voided_at IS NULL OR v_row.voided_by IS DISTINCT FROM t
     OR v_row.void_reason <> 'Teste: valor errado' OR v_row.amount <> 58 THEN
    RAISE EXCEPTION 'FALHOU: anulação gravada errada (%)', to_jsonb(v_row);
  END IF;
  e := NULL;
  BEGIN PERFORM public.void_online_payment(p2, 'de novo');
  EXCEPTION WHEN others THEN e := SQLERRM; END;
  IF e IS DISTINCT FROM 'online_already_void' THEN
    RAISE EXCEPTION 'FALHOU: anulou duas vezes (esperado online_already_void, veio %)', coalesce(e, 'sucesso');
  END IF;

  -- Pagamento anulado não conta na sobreposição: o mesmo período entra de novo.
  p4 := public.register_online_payment(a, 'monthly', 'coached', v_end1 + 1, v_end1 + 30, NULL, 58, 'interac', v_today);

  PERFORM set_config('josi.p1', p1::text, true);
  PERFORM set_config('josi.p2', p2::text, true);
  PERFORM set_config('josi.p3', p3::text, true);
  PERFORM set_config('josi.p4', p4::text, true);
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 4. ALUNO A: lê só o que é dele
-- ════════════════════════════════════════════════════════════════════════════
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  json_build_object('sub', current_setting('josi.aluno'), 'role', 'authenticated')::text, true);

DO $$
DECLARE
  a uuid := current_setting('josi.aluno')::uuid;
  n int;
  e text;
BEGIN
  SELECT count(*) INTO n FROM public.online_payments
  WHERE id IN (current_setting('josi.p1')::uuid, current_setting('josi.p2')::uuid, current_setting('josi.p4')::uuid);
  IF n <> 3 THEN RAISE EXCEPTION 'FALHOU: aluno A não vê os próprios pagamentos (% de 3)', n; END IF;
  SELECT count(*) INTO n FROM public.online_payments
  WHERE id = current_setting('josi.p3')::uuid OR student_id <> a;
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: aluno A vê % pagamentos de outros alunos', n; END IF;
  SELECT count(*) INTO n FROM public.online_memberships WHERE student_id <> a;
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: aluno A vê % modalidades de outros alunos', n; END IF;
  SELECT count(*) INTO n FROM public.online_memberships WHERE student_id = a AND status = 'active';
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: aluno A não vê a própria modalidade ativa'; END IF;

  -- Já ativo: não pede de novo.
  e := NULL;
  BEGIN PERFORM public.request_online_plan('dropin');
  EXCEPTION WHEN others THEN e := SQLERRM; END;
  IF e IS DISTINCT FROM 'online_plan_exists' THEN
    RAISE EXCEPTION 'FALHOU: aluno ativo pediu de novo (esperado online_plan_exists, veio %)', coalesce(e, 'sucesso');
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 5. ALUNO B: pedido recusado (ended) pode ser refeito; lê só o que é dele
-- ════════════════════════════════════════════════════════════════════════════
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  json_build_object('sub', current_setting('josi.aluno_b'), 'role', 'authenticated')::text, true);

DO $$
DECLARE
  b uuid := current_setting('josi.aluno_b')::uuid;
  v_row record;
  n int;
BEGIN
  PERFORM public.request_online_plan('dropin');
  SELECT * INTO v_row FROM public.online_memberships WHERE student_id = b;
  IF v_row.status <> 'requested' OR v_row.plan <> 'dropin' OR v_row.requested_at IS NULL
     OR v_row.started_on IS NOT NULL OR v_row.ended_on IS NOT NULL THEN
    RAISE EXCEPTION 'FALHOU: novo pedido depois de encerrada gravado errado (%)', to_jsonb(v_row);
  END IF;

  SELECT count(*) INTO n FROM public.online_payments WHERE id = current_setting('josi.p3')::uuid;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: aluno B não vê o próprio drop-in'; END IF;
  SELECT count(*) INTO n FROM public.online_payments WHERE student_id <> b;
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: aluno B vê % pagamentos do aluno A', n; END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 6. Visitante (anon): nada
-- ════════════════════════════════════════════════════════════════════════════
RESET ROLE;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);

DO $$
DECLARE
  e text;
BEGIN
  e := NULL;
  BEGIN PERFORM count(*) FROM public.online_memberships;
  EXCEPTION WHEN others THEN e := SQLSTATE; END;
  IF e IS DISTINCT FROM '42501' THEN RAISE EXCEPTION 'FALHOU: anon lê online_memberships'; END IF;
  e := NULL;
  BEGIN PERFORM count(*) FROM public.online_payments;
  EXCEPTION WHEN others THEN e := SQLSTATE; END;
  IF e IS DISTINCT FROM '42501' THEN RAISE EXCEPTION 'FALHOU: anon lê online_payments'; END IF;
  e := NULL;
  BEGIN PERFORM public.request_online_plan('coached');
  EXCEPTION WHEN others THEN e := SQLSTATE; END;
  IF e IS DISTINCT FROM '42501' THEN RAISE EXCEPTION 'FALHOU: anon chamou request_online_plan'; END IF;
  e := NULL;
  BEGIN PERFORM public.set_online_membership(current_setting('josi.aluno')::uuid, 'coached', 'active');
  EXCEPTION WHEN others THEN e := SQLSTATE; END;
  IF e IS DISTINCT FROM '42501' THEN RAISE EXCEPTION 'FALHOU: anon chamou set_online_membership'; END IF;
  e := NULL;
  BEGIN PERFORM public.register_online_payment(current_setting('josi.aluno')::uuid, 'dropin', NULL, NULL, NULL,
          CURRENT_DATE, 1, 'cash', CURRENT_DATE);
  EXCEPTION WHEN others THEN e := SQLSTATE; END;
  IF e IS DISTINCT FROM '42501' THEN RAISE EXCEPTION 'FALHOU: anon chamou register_online_payment'; END IF;
  e := NULL;
  BEGIN PERFORM public.void_online_payment(current_setting('josi.p1')::uuid, 'anon');
  EXCEPTION WHEN others THEN e := SQLSTATE; END;
  IF e IS DISTINCT FROM '42501' THEN RAISE EXCEPTION 'FALHOU: anon chamou void_online_payment'; END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 7. service_role (backup): só lê
-- ════════════════════════════════════════════════════════════════════════════
RESET ROLE;
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);

DO $$
DECLARE
  n int;
  e text;
BEGIN
  SELECT count(*) INTO n FROM public.online_payments
  WHERE id IN (current_setting('josi.p1')::uuid, current_setting('josi.p3')::uuid);
  IF n <> 2 THEN RAISE EXCEPTION 'FALHOU: service_role não lê online_payments'; END IF;
  SELECT count(*) INTO n FROM public.online_memberships
  WHERE student_id IN (current_setting('josi.aluno')::uuid, current_setting('josi.aluno_b')::uuid);
  IF n <> 2 THEN RAISE EXCEPTION 'FALHOU: service_role não lê online_memberships'; END IF;
  e := NULL;
  BEGIN UPDATE public.online_payments SET amount = 1 WHERE id = current_setting('josi.p1')::uuid;
  EXCEPTION WHEN others THEN e := SQLSTATE; END;
  IF e IS DISTINCT FROM '42501' THEN RAISE EXCEPTION 'FALHOU: service_role fez UPDATE em online_payments'; END IF;
  e := NULL;
  BEGIN PERFORM public.void_online_payment(current_setting('josi.p1')::uuid, 'service');
  EXCEPTION WHEN others THEN e := SQLSTATE; END;
  IF e IS DISTINCT FROM '42501' THEN RAISE EXCEPTION 'FALHOU: service_role chamou void_online_payment'; END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 8. postgres (SQL Editor): guarda de imutabilidade, audit_log, "apagar de vez"
-- ════════════════════════════════════════════════════════════════════════════
RESET ROLE;
SELECT set_config('request.jwt.claims', '', true);

DO $$
DECLARE
  a uuid := current_setting('josi.aluno')::uuid;
  b uuid := current_setting('josi.aluno_b')::uuid;
  p1 uuid := current_setting('josi.p1')::uuid;
  p2 uuid := current_setting('josi.p2')::uuid;
  v_ids text[] := ARRAY[current_setting('josi.p1'), current_setting('josi.p2'),
                        current_setting('josi.p3'), current_setting('josi.p4')];
  v_tbl text;
  v_cascata_testada boolean := true;
  n int;
  e text;
BEGIN
  -- Guarda: vale até para o dono da tabela.
  e := NULL;
  BEGIN UPDATE public.online_payments SET amount = 1 WHERE id = p1;
  EXCEPTION WHEN others THEN e := SQLSTATE; END;
  IF e IS DISTINCT FROM '42501' THEN RAISE EXCEPTION 'FALHOU: UPDATE de amount passou (guarda de imutabilidade)'; END IF;
  e := NULL;
  BEGIN UPDATE public.online_payments
        SET status = 'valid', voided_at = NULL, voided_by = NULL, void_reason = NULL WHERE id = p2;
  EXCEPTION WHEN others THEN e := SQLSTATE; END;
  IF e IS DISTINCT FROM '42501' THEN RAISE EXCEPTION 'FALHOU: pagamento anulado voltou para valid'; END IF;
  e := NULL;
  BEGIN UPDATE public.online_payments SET void_reason = 'outro motivo' WHERE id = p2;
  EXCEPTION WHEN others THEN e := SQLSTATE; END;
  IF e IS DISTINCT FROM '42501' THEN RAISE EXCEPTION 'FALHOU: motivo de anulação foi alterado'; END IF;
  e := NULL;
  BEGIN UPDATE public.online_payments
        SET status = 'void', voided_at = now(), void_reason = 'x', amount = 0 WHERE id = p1;
  EXCEPTION WHEN others THEN e := SQLSTATE; END;
  IF e IS DISTINCT FROM '42501' THEN RAISE EXCEPTION 'FALHOU: anulação mudando o valor passou'; END IF;

  -- audit_log: 2 modalidades (aprovar A, recusar B), 4 registros, 1 anulação; só ids/tipo/plano/valor.
  SELECT count(*) INTO n FROM public.audit_log
  WHERE action = 'online_membership.set' AND target_id IN (a, b)
    AND (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(snapshot_data) k)
        = ARRAY['plan', 'status', 'student_id'];
  IF n <> 2 THEN RAISE EXCEPTION 'FALHOU: audit_log tem % de 2 linhas online_membership.set (com só student_id/plan/status)', n; END IF;

  SELECT count(*) INTO n FROM public.audit_log
  WHERE action = 'online_payment.register' AND snapshot_data ->> 'payment_id' = ANY (v_ids)
    AND (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(snapshot_data) k)
        = ARRAY['amount', 'kind', 'payment_id', 'plan', 'student_id'];
  IF n <> 4 THEN RAISE EXCEPTION 'FALHOU: audit_log tem % de 4 linhas online_payment.register (com só ids/tipo/plano/valor)', n; END IF;

  SELECT count(*) INTO n FROM public.audit_log
  WHERE action = 'online_payment.void' AND snapshot_data ->> 'payment_id' = current_setting('josi.p2')
    AND target_id = a
    AND (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(snapshot_data) k)
        = ARRAY['payment_id', 'student_id'];
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: audit_log sem a linha online_payment.void (só ids, sem o motivo)'; END IF;

  -- "Apagar de vez" do aluno B, na mesma ordem da Edge Function manage-student:
  -- tabelas sem CASCADE primeiro, depois o perfil. A modalidade e o drop-in do
  -- B têm de sair junto (ON DELETE CASCADE). Desfeito pelo ROLLBACK do fim.
  BEGIN
    FOREACH v_tbl IN ARRAY ARRAY['student_class_link', 'check_ins', 'balance_history', 'email_notifications'] LOOP
      IF to_regclass('public.' || v_tbl) IS NOT NULL THEN
        EXECUTE format('DELETE FROM public.%I WHERE student_id = $1', v_tbl) USING b;
      END IF;
    END LOOP;
    DELETE FROM public.profiles WHERE id = b;
  EXCEPTION WHEN others THEN
    IF SQLERRM LIKE '%online_%' THEN
      RAISE EXCEPTION 'FALHOU: as tabelas online impediram apagar o aluno de vez (%)', SQLERRM;
    END IF;
    -- Outra tabela do banco impediu (não é desta migration): a estrutura do
    -- CASCADE já foi conferida na seção 0.
    RAISE NOTICE 'Aviso: "apagar de vez" não testado com DELETE real (outra tabela impediu: %). FK CASCADE conferida na seção 0.', SQLERRM;
    v_cascata_testada := false;
  END;

  IF v_cascata_testada THEN
    SELECT count(*) INTO n FROM public.online_memberships WHERE student_id = b;
    IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: modalidade do aluno apagado não saiu em cascata'; END IF;
    SELECT count(*) INTO n FROM public.online_payments WHERE student_id = b;
    IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: pagamentos do aluno apagado não saíram em cascata'; END IF;
    -- Os do aluno A continuam.
    SELECT count(*) INTO n FROM public.online_payments WHERE student_id = a;
    IF n <> 3 THEN RAISE EXCEPTION 'FALHOU: apagar o aluno B mexeu nos pagamentos do A (% de 3)', n; END IF;
  END IF;
END $$;

ROLLBACK;
