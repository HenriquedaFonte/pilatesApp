-- Teste — retirada do consentimento de saúde e travas de imutabilidade
-- (migration 20261128010000_consent_withdrawal_and_locks.sql; plano
--  docs/planos/2026-11-28-perfil-e-consentimento-digital.md, PR B1 passo 4b)
--
-- Rodar no Supabase SQL Editor DEPOIS das migrations 20261128000000 e
-- 20261128010000. Funciona antes e depois da publicação da versão 1: o script
-- cria versões de TESTE acima da maior versão existente.
--
-- Não precisa editar nada: o script escolhe sozinho a professora (role =
-- 'teacher') e os dois primeiros alunos (role = 'student', ordem do id) que
-- não estão apagados, ainda não têm aceite nem ficha de saúde e não têm
-- recibo de seguro.
--
-- Tudo roda dentro de uma transação que termina em ROLLBACK: nada fica gravado
-- (nem versões de teste, nem aceites, nem retiradas, nem ficha, nem audit_log,
-- nem as exclusões de teste do aluno e da professora).
-- Resultado:
--   • Sucesso → nenhum erro (o editor mostra só o último resultado; é normal).
--   • Falha   → erro começando com "FALHOU: ..." dizendo o que falhou.

BEGIN;

-- Escolha dos participantes (como postgres).
DO $$
DECLARE
  v_sql text := $q$
    SELECT p.id::text FROM public.profiles p
    WHERE p.role = 'student' AND p.deleted_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM public.consent_acceptances a WHERE a.student_id = p.id)
      AND NOT EXISTS (SELECT 1 FROM public.student_health_profiles h WHERE h.student_id = p.id)
      %s
    ORDER BY p.id OFFSET $1 LIMIT 1 $q$;
  v_receipts text := '';
  v_a text;
  v_b text;
BEGIN
  IF to_regclass('public.insurance_receipts') IS NOT NULL THEN
    v_receipts := 'AND NOT EXISTS (SELECT 1 FROM public.insurance_receipts r WHERE r.student_id = p.id)';
  END IF;
  EXECUTE format(v_sql, v_receipts) INTO v_a USING 0;
  EXECUTE format(v_sql, v_receipts) INTO v_b USING 1;
  PERFORM set_config('josi.aluno', coalesce(v_a, ''), true);
  PERFORM set_config('josi.aluno_b', coalesce(v_b, ''), true);
  PERFORM set_config('josi.professora',
    coalesce((SELECT id::text FROM public.profiles WHERE role = 'teacher' ORDER BY id LIMIT 1), ''), true);
END $$;

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
    RAISE EXCEPTION 'FALHOU: não há dois alunos disponíveis para o teste (role = student, não apagados, sem aceite/ficha e sem recibo)';
  END IF;
  IF t IS NULL THEN
    RAISE EXCEPTION 'FALHOU: professora de teste não encontrada (role = teacher)';
  END IF;

  -- Colunas de retirada, sem FK em withdrawn_by, CHECK de coerência.
  SELECT count(*) INTO n FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'consent_acceptances'
    AND column_name IN ('withdrawn_at', 'withdrawn_by');
  IF n <> 2 THEN RAISE EXCEPTION 'FALHOU: migration 20261128010000 não rodou (colunas withdrawn_at/withdrawn_by)'; END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint c
             JOIN pg_attribute att ON att.attrelid = c.conrelid AND att.attnum = ANY (c.conkey)
             WHERE c.contype = 'f' AND c.conrelid = 'public.consent_acceptances'::regclass
               AND att.attname = 'withdrawn_by') THEN
    RAISE EXCEPTION 'FALHOU: withdrawn_by tem FK (não deveria)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.consent_acceptances'::regclass
                 AND conname = 'consent_acceptances_withdrawn_fields' AND contype = 'c') THEN
    RAISE EXCEPTION 'FALHOU: CHECK consent_acceptances_withdrawn_fields não existe';
  END IF;

  -- UNIQUE antigo removido; índice único parcial no lugar.
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.consent_acceptances'::regclass
             AND conname = 'consent_acceptances_student_version_key') THEN
    RAISE EXCEPTION 'FALHOU: UNIQUE consent_acceptances_student_version_key ainda existe';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
                 WHERE c.relname = 'consent_acceptances_active_key'
                   AND i.indrelid = 'public.consent_acceptances'::regclass
                   AND i.indisunique AND i.indpred IS NOT NULL
                   AND pg_get_expr(i.indpred, i.indrelid) LIKE '%withdrawn_at IS NULL%') THEN
    RAISE EXCEPTION 'FALHOU: índice único parcial consent_acceptances_active_key não existe';
  END IF;

  -- Travas: BEFORE UPDATE nas duas tabelas; nenhum trigger de DELETE/TRUNCATE nos aceites.
  SELECT count(*) INTO n FROM pg_trigger
  WHERE NOT tgisinternal AND tgenabled <> 'D'
    AND ((tgrelid = 'public.consent_acceptances'::regclass AND tgname = 'trg_consent_acceptances_guard_update')
      OR (tgrelid = 'public.consent_versions'::regclass AND tgname = 'trg_consent_versions_guard_update'))
    AND (tgtype & 2) <> 0 AND (tgtype & 16) <> 0;
  IF n <> 2 THEN RAISE EXCEPTION 'FALHOU: travas BEFORE UPDATE em consent_acceptances/consent_versions (% de 2)', n; END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger
             WHERE tgrelid = 'public.consent_acceptances'::regclass
               AND NOT tgisinternal AND (tgtype & (8 | 32)) <> 0) THEN
    RAISE EXCEPTION 'FALHOU: existe trigger de DELETE/TRUNCATE em consent_acceptances (quebraria o "apagar de vez")';
  END IF;

  -- Ficha: exatamente SELECT/INSERT/UPDATE (DELETE só pela RPC), todas com aceite ativo.
  IF (SELECT array_agg(cmd::text ORDER BY cmd) FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'student_health_profiles')
     IS DISTINCT FROM ARRAY['INSERT', 'SELECT', 'UPDATE'] THEN
    RAISE EXCEPTION 'FALHOU: student_health_profiles não tem exatamente as policies SELECT/INSERT/UPDATE';
  END IF;
  IF has_table_privilege('authenticated', 'public.student_health_profiles', 'DELETE') THEN
    RAISE EXCEPTION 'FALHOU: authenticated tem DELETE em student_health_profiles (só pela RPC delete_health_profile)';
  END IF;
  SELECT count(*) INTO n FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'student_health_profiles' AND cmd IN ('SELECT', 'INSERT', 'UPDATE')
    AND coalesce(qual, '') || coalesce(with_check, '') LIKE '%withdrawn_at IS NULL%'
    AND coalesce(qual, '') || coalesce(with_check, '') LIKE '%student_health_profiles.student_id%';
  IF n <> 3 THEN RAISE EXCEPTION 'FALHOU: policies SELECT/INSERT/UPDATE da ficha sem consentimento ativo qualificado (% de 3)', n; END IF;

  -- RPCs: SECURITY DEFINER, search_path fixo, só authenticated executa.
  FOREACH v_fn IN ARRAY ARRAY[
    'public.accept_consent(uuid,text,text)',
    'public.register_paper_consent(uuid,uuid,date,text,text)',
    'public.my_pending_consents()',
    'public.staff_consent_overview()',
    'public.withdraw_health_consent(uuid)',
    'public.read_retained_health_profile(uuid,text)',
    'public.delete_health_profile(uuid)'
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
  IF (SELECT pronargdefaults FROM pg_proc WHERE oid = to_regprocedure('public.withdraw_health_consent(uuid)')) <> 0
     OR (SELECT pronargdefaults FROM pg_proc WHERE oid = to_regprocedure('public.delete_health_profile(uuid)')) <> 0 THEN
    RAISE EXCEPTION 'FALHOU: withdraw_health_consent/delete_health_profile tem parâmetro com DEFAULT (deveria ser obrigatório)';
  END IF;
  IF (SELECT provolatile FROM pg_proc WHERE oid = to_regprocedure('public.read_retained_health_profile(uuid,text)')) <> 'v' THEN
    RAISE EXCEPTION 'FALHOU: read_retained_health_profile não é VOLATILE (grava audit_log)';
  END IF;
  -- Funções das travas: ninguém chama direto.
  FOREACH v_fn IN ARRAY ARRAY['public.consent_acceptances_guard_update()', 'public.consent_versions_guard_update()'] LOOP
    IF to_regprocedure(v_fn) IS NULL THEN RAISE EXCEPTION 'FALHOU: função % não existe', v_fn; END IF;
    IF has_function_privilege('anon', v_fn, 'EXECUTE') OR has_function_privilege('authenticated', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'FALHOU: anon/authenticated pode chamar %', v_fn;
    END IF;
  END LOOP;

  -- COMMENT da ficha.
  IF coalesce(obj_description('public.student_health_profiles'::regclass, 'pg_class'), '')
     NOT ILIKE 'josi-pilates:%congelada na retirada%leitura da professora só por RPC%' THEN
    RAISE EXCEPTION 'FALHOU: COMMENT de student_health_profiles não diz "congelada na retirada ... leitura da professora só por RPC"';
  END IF;
END $$;

-- Versões de TESTE (acima das existentes): termo sem aceite (antigo), termo atual, saúde atual.
DO $$
DECLARE
  v_cp int := coalesce((SELECT max(version) FROM public.consent_versions WHERE kind = 'class_policies'), 0);
  v_hd int := coalesce((SELECT max(version) FROM public.consent_versions WHERE kind = 'health_data'), 0);
  v_free uuid; v_cur uuid; v_health uuid;
BEGIN
  INSERT INTO public.consent_versions (kind, version, title_pt, title_en, title_fr, body_pt, body_en, body_fr)
  VALUES ('class_policies', v_cp + 1, 'T', 'T', 'T', 'teste sem aceite', 'no acceptance', 'sans acceptation')
  RETURNING id INTO v_free;
  INSERT INTO public.consent_versions (kind, version, title_pt, title_en, title_fr, body_pt, body_en, body_fr)
  VALUES ('class_policies', v_cp + 2, 'T', 'T', 'T', 'teste atual', 'current test', 'test actuel')
  RETURNING id INTO v_cur;
  INSERT INTO public.consent_versions (kind, version, title_pt, title_en, title_fr, body_pt, body_en, body_fr)
  VALUES ('health_data', v_hd + 1, 'S', 'S', 'S', 'saúde', 'health', 'santé')
  RETURNING id INTO v_health;
  PERFORM set_config('josi.v_free', v_free::text, true);
  PERFORM set_config('josi.v_cur', v_cur::text, true);
  PERFORM set_config('josi.v_health', v_health::text, true);
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 1. ALUNO A: aceita termo e saúde, preenche a ficha; não consegue retirar
-- ════════════════════════════════════════════════════════════════════════════
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  json_build_object('sub', current_setting('josi.aluno'), 'role', 'authenticated')::text, true);

DO $$
DECLARE
  a uuid := current_setting('josi.aluno')::uuid;
  b uuid := current_setting('josi.aluno_b')::uuid;
  v_cur uuid := current_setting('josi.v_cur')::uuid;
  v_health uuid := current_setting('josi.v_health')::uuid;
  v_pid uuid; v_hid uuid;
  n int;
  e text;
BEGIN
  v_pid := public.accept_consent(v_cur, 'fr', 'Aluna Teste A');
  v_hid := public.accept_consent(v_health, 'fr', NULL);
  PERFORM set_config('josi.a_policies', v_pid::text, true);
  PERFORM set_config('josi.a_health1', v_hid::text, true);

  INSERT INTO public.student_health_profiles (student_id, main_goal, conditions, medications)
  VALUES (a, 'Postura', ARRAY['back_neck_shoulder'], 'nenhum');
  PERFORM set_config('josi.ficha_antes',
    (SELECT to_jsonb(h)::text FROM public.student_health_profiles h WHERE h.student_id = a), true);

  -- Aluno não retira (nem o próprio, nem de outro, nem nulo).
  e := NULL;
  BEGIN PERFORM public.withdraw_health_consent(a);
  EXCEPTION WHEN others THEN e := SQLERRM; END;
  IF e IS DISTINCT FROM 'consent_not_allowed' THEN
    RAISE EXCEPTION 'FALHOU: aluno retirou o próprio consentimento (esperado consent_not_allowed, veio %)', coalesce(e, 'sucesso');
  END IF;
  e := NULL;
  BEGIN PERFORM public.withdraw_health_consent(b);
  EXCEPTION WHEN others THEN e := SQLERRM; END;
  IF e IS DISTINCT FROM 'consent_not_allowed' THEN
    RAISE EXCEPTION 'FALHOU: aluno chamou withdraw_health_consent para outro aluno (veio %)', coalesce(e, 'sucesso');
  END IF;
  e := NULL;
  BEGIN PERFORM public.withdraw_health_consent(NULL);
  EXCEPTION WHEN others THEN e := SQLERRM; END;
  IF e IS DISTINCT FROM 'consent_not_allowed' THEN
    RAISE EXCEPTION 'FALHOU: aluno chamou withdraw_health_consent com nulo (veio %)', coalesce(e, 'sucesso');
  END IF;
  SELECT count(*) INTO n FROM public.consent_acceptances WHERE id = v_hid AND withdrawn_at IS NULL AND withdrawn_by IS NULL;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: tentativa do aluno mexeu no aceite de saúde'; END IF;

  -- Aluno não lê ficha guardada pela RPC da professora.
  e := NULL;
  BEGIN PERFORM count(*) FROM public.read_retained_health_profile(a, 'insurance');
  EXCEPTION WHEN others THEN e := SQLERRM; END;
  IF e IS DISTINCT FROM 'consent_not_allowed' THEN
    RAISE EXCEPTION 'FALHOU: aluno chamou read_retained_health_profile (veio %)', coalesce(e, 'sucesso');
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. PROFESSORA: validações, retira pelo aluno A, ficha congelada, leitura motivada
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
  v_cur uuid := current_setting('josi.v_cur')::uuid;
  v_hid uuid := current_setting('josi.a_health1')::uuid;
  v_today date := (now() AT TIME ZONE 'America/Montreal')::date;
  v_row record;
  n int;
  e text;
BEGIN
  -- Com consentimento ativo, lê a ficha pela tabela.
  SELECT count(*) INTO n FROM public.student_health_profiles WHERE student_id = a;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: professora não vê a ficha do aluno A com consentimento ativo'; END IF;

  -- Id nulo ou de quem não é aluno.
  e := NULL;
  BEGIN PERFORM public.withdraw_health_consent(NULL);
  EXCEPTION WHEN others THEN e := SQLERRM; END;
  IF e IS DISTINCT FROM 'consent_invalid_student' THEN
    RAISE EXCEPTION 'FALHOU: retirada com id nulo (esperado consent_invalid_student, veio %)', coalesce(e, 'sucesso');
  END IF;
  e := NULL;
  BEGIN PERFORM public.withdraw_health_consent(t);
  EXCEPTION WHEN others THEN e := SQLERRM; END;
  IF e IS DISTINCT FROM 'consent_invalid_student' THEN
    RAISE EXCEPTION 'FALHOU: retirada com id de professora (esperado consent_invalid_student, veio %)', coalesce(e, 'sucesso');
  END IF;

  -- Sem aceite de saúde ativo: devolve 0 (sem audit_log, conferido na seção 4).
  n := public.withdraw_health_consent(b);
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: retirada do aluno B sem aceite devolveu % (esperado 0)', n; END IF;

  -- Termo em papel do B (recorded_by = professora), usado nos testes de trava.
  PERFORM set_config('josi.b_paper',
    public.register_paper_consent(b, v_cur, v_today, 'Aluno Teste B')::text, true);

  -- Retira pelo aluno A.
  n := public.withdraw_health_consent(a);
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: retirada do aluno A marcou % aceites (esperado 1)', n; END IF;
  SELECT * INTO v_row FROM public.consent_acceptances WHERE id = v_hid;
  IF v_row.withdrawn_at IS NULL OR v_row.withdrawn_by IS DISTINCT FROM t THEN
    RAISE EXCEPTION 'FALHOU: aceite de saúde do A não marcado (withdrawn_at/withdrawn_by = professora)';
  END IF;
  -- O termo das aulas não é retirado.
  SELECT count(*) INTO n FROM public.consent_acceptances
  WHERE id = current_setting('josi.a_policies')::uuid AND withdrawn_at IS NULL;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: a retirada marcou o termo das aulas'; END IF;
  -- Segunda chamada: nada mais a retirar.
  n := public.withdraw_health_consent(a);
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: segunda retirada do A devolveu % (esperado 0)', n; END IF;

  -- Ficha congelada: a professora não lê, não altera, não cria pela tabela.
  SELECT count(*) INTO n FROM public.student_health_profiles WHERE student_id = a;
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: professora lê pela tabela a ficha congelada do A'; END IF;
  UPDATE public.student_health_profiles SET main_goal = 'alterado pela professora' WHERE student_id = a;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: professora alterou a ficha congelada do A'; END IF;
  e := NULL;
  BEGIN INSERT INTO public.student_health_profiles (student_id, main_goal) VALUES (b, 'sem consentimento');
  EXCEPTION WHEN others THEN e := SQLSTATE; END;
  IF e IS DISTINCT FROM '42501' THEN RAISE EXCEPTION 'FALHOU: professora criou ficha do B sem consentimento de saúde'; END IF;

  -- Leitura motivada.
  e := NULL;
  BEGIN PERFORM count(*) FROM public.read_retained_health_profile(a, 'curiosidade');
  EXCEPTION WHEN others THEN e := SQLERRM; END;
  IF e IS DISTINCT FROM 'consent_invalid_reason' THEN
    RAISE EXCEPTION 'FALHOU: motivo inválido (esperado consent_invalid_reason, veio %)', coalesce(e, 'sucesso');
  END IF;
  e := NULL;
  BEGIN PERFORM count(*) FROM public.read_retained_health_profile(a, NULL);
  EXCEPTION WHEN others THEN e := SQLERRM; END;
  IF e IS DISTINCT FROM 'consent_invalid_reason' THEN
    RAISE EXCEPTION 'FALHOU: motivo nulo (esperado consent_invalid_reason, veio %)', coalesce(e, 'sucesso');
  END IF;
  e := NULL;
  BEGIN PERFORM count(*) FROM public.read_retained_health_profile(NULL, 'insurance');
  EXCEPTION WHEN others THEN e := SQLERRM; END;
  IF e IS DISTINCT FROM 'consent_invalid_student' THEN
    RAISE EXCEPTION 'FALHOU: read_retained_health_profile com id nulo (esperado consent_invalid_student, veio %)', coalesce(e, 'sucesso');
  END IF;
  SELECT count(*) INTO n FROM public.read_retained_health_profile(a, 'insurance') h
  WHERE to_jsonb(h)::text = current_setting('josi.ficha_antes');
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: read_retained_health_profile não devolveu a ficha do A intacta'; END IF;
  SELECT count(*) INTO n FROM public.read_retained_health_profile(b, 'legal');
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: read_retained_health_profile devolveu ficha para aluno sem ficha'; END IF;

  -- Visão geral: consentimento retirado com ficha guardada.
  SELECT * INTO v_row FROM public.staff_consent_overview() WHERE student_id = a;
  IF NOT FOUND OR v_row.policies_status <> 'current' OR v_row.health_consent OR NOT v_row.health_profile THEN
    RAISE EXCEPTION 'FALHOU: staff_consent_overview do A depois da retirada (esperado current/false/true, veio %)', to_jsonb(v_row);
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. ALUNO A depois da retirada: lê a ficha intacta, não grava, saúde pendente
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
  SELECT count(*) INTO n FROM public.student_health_profiles h
  WHERE h.student_id = a AND to_jsonb(h)::text = current_setting('josi.ficha_antes');
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: depois da retirada o aluno A não lê a própria ficha intacta (conteúdo/updated_at)'; END IF;

  UPDATE public.student_health_profiles SET main_goal = 'alterado pelo aluno' WHERE student_id = a;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: aluno A alterou a ficha congelada'; END IF;
  e := NULL;
  BEGIN INSERT INTO public.student_health_profiles (student_id, main_goal) VALUES (a, 'nova');
  EXCEPTION WHEN others THEN e := SQLSTATE; END;
  IF e IS DISTINCT FROM '42501' THEN RAISE EXCEPTION 'FALHOU: INSERT do aluno A com consentimento retirado (esperado 42501, veio %)', coalesce(e, 'sucesso'); END IF;
  SELECT count(*) INTO n FROM public.student_health_profiles h
  WHERE h.student_id = a AND to_jsonb(h)::text = current_setting('josi.ficha_antes');
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: a ficha congelada do A mudou'; END IF;

  -- Saúde volta a ficar pendente; o termo das aulas não.
  SELECT count(*) INTO n FROM public.my_pending_consents()
  WHERE kind = 'health_data' AND version_id = current_setting('josi.v_health')::uuid;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: my_pending_consents não lista health_data depois da retirada'; END IF;
  SELECT count(*) INTO n FROM public.my_pending_consents() WHERE kind = 'class_policies';
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: depois da retirada o termo das aulas ficou pendente'; END IF;

  -- Vê a própria retirada.
  SELECT count(*) INTO n FROM public.consent_acceptances
  WHERE id = current_setting('josi.a_health1')::uuid AND withdrawn_at IS NOT NULL;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: aluno A não vê a retirada no próprio aceite'; END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 4. postgres (SQL Editor): imutabilidade, trava de versões, audit_log
-- ════════════════════════════════════════════════════════════════════════════
RESET ROLE;
SELECT set_config('request.jwt.claims', '', true);

DO $$
DECLARE
  a uuid := current_setting('josi.aluno')::uuid;
  b uuid := current_setting('josi.aluno_b')::uuid;
  t uuid := current_setting('josi.professora')::uuid;
  v_hid uuid := current_setting('josi.a_health1')::uuid;
  v_pid uuid := current_setting('josi.a_policies')::uuid;
  v_paper uuid := current_setting('josi.b_paper')::uuid;
  n int;
  e text;
BEGIN
  -- Nenhuma outra coluna muda, nem a retirada é desfeita ou trocada.
  e := NULL;
  BEGIN UPDATE public.consent_acceptances SET typed_name = 'x' WHERE id = v_pid;
  EXCEPTION WHEN others THEN e := SQLERRM; END;
  IF e IS DISTINCT FROM 'consent_immutable' THEN RAISE EXCEPTION 'FALHOU: postgres alterou typed_name de um aceite (veio %)', coalesce(e, 'sucesso'); END IF;
  e := NULL;
  BEGIN UPDATE public.consent_acceptances SET accepted_at = now() - interval '1 day' WHERE id = v_hid;
  EXCEPTION WHEN others THEN e := SQLERRM; END;
  IF e IS DISTINCT FROM 'consent_immutable' THEN RAISE EXCEPTION 'FALHOU: postgres alterou accepted_at de um aceite retirado (veio %)', coalesce(e, 'sucesso'); END IF;
  e := NULL;
  BEGIN UPDATE public.consent_acceptances SET withdrawn_at = NULL, withdrawn_by = NULL WHERE id = v_hid;
  EXCEPTION WHEN others THEN e := SQLERRM; END;
  IF e IS DISTINCT FROM 'consent_immutable' THEN RAISE EXCEPTION 'FALHOU: postgres desfez a retirada (veio %)', coalesce(e, 'sucesso'); END IF;
  e := NULL;
  BEGIN UPDATE public.consent_acceptances SET withdrawn_at = now() - interval '1 day' WHERE id = v_hid;
  EXCEPTION WHEN others THEN e := SQLERRM; END;
  IF e IS DISTINCT FROM 'consent_immutable' THEN RAISE EXCEPTION 'FALHOU: postgres trocou a data da retirada (veio %)', coalesce(e, 'sucesso'); END IF;
  e := NULL;
  BEGIN UPDATE public.consent_acceptances SET withdrawn_by = gen_random_uuid() WHERE id = v_hid;
  EXCEPTION WHEN others THEN e := SQLERRM; END;
  IF e IS DISTINCT FROM 'consent_immutable' THEN RAISE EXCEPTION 'FALHOU: postgres trocou quem retirou (veio %)', coalesce(e, 'sucesso'); END IF;
  -- Termo das aulas não se "retira" por UPDATE.
  e := NULL;
  BEGIN UPDATE public.consent_acceptances SET withdrawn_at = now(), withdrawn_by = t WHERE id = v_pid;
  EXCEPTION WHEN others THEN e := SQLERRM; END;
  IF e IS DISTINCT FROM 'consent_immutable' THEN RAISE EXCEPTION 'FALHOU: termo das aulas foi "retirado" por UPDATE (veio %)', coalesce(e, 'sucesso'); END IF;
  -- recorded_by: não troca por outro valor...
  e := NULL;
  BEGIN UPDATE public.consent_acceptances SET recorded_by = a WHERE id = v_paper;
  EXCEPTION WHEN others THEN e := SQLERRM; END;
  IF e IS DISTINCT FROM 'consent_immutable' THEN RAISE EXCEPTION 'FALHOU: recorded_by trocado por outro valor (veio %)', coalesce(e, 'sucesso'); END IF;
  -- ...mas vai para NULL (o que o ON DELETE SET NULL faz). Desfeito logo depois.
  BEGIN
    UPDATE public.consent_acceptances SET recorded_by = NULL WHERE id = v_paper;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: recorded_by para NULL não passou'; END IF;
    RAISE EXCEPTION 'desfazer';
  EXCEPTION WHEN others THEN
    IF SQLERRM <> 'desfazer' THEN
      RAISE EXCEPTION 'FALHOU: recorded_by para NULL bloqueado pela trava (%)', SQLERRM;
    END IF;
  END;
  SELECT count(*) INTO n FROM public.consent_acceptances WHERE id = v_paper AND recorded_by = t;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: teste de recorded_by não foi desfeito'; END IF;
  -- Nada mudou nos aceites do A.
  SELECT count(*) INTO n FROM public.consent_acceptances
  WHERE id = v_hid AND withdrawn_by = t AND withdrawn_at IS NOT NULL;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: aceite retirado do A mudou durante os testes de trava'; END IF;

  -- Versão com aceite: travada. Sem aceite: altera.
  e := NULL;
  BEGIN UPDATE public.consent_versions SET body_pt = 'alterado' WHERE id = current_setting('josi.v_cur')::uuid;
  EXCEPTION WHEN others THEN e := SQLERRM; END;
  IF e IS DISTINCT FROM 'consent_version_locked' THEN RAISE EXCEPTION 'FALHOU: versão com aceite foi alterada (veio %)', coalesce(e, 'sucesso'); END IF;
  e := NULL;
  BEGIN UPDATE public.consent_versions SET title_fr = 'x' WHERE id = current_setting('josi.v_health')::uuid;
  EXCEPTION WHEN others THEN e := SQLERRM; END;
  IF e IS DISTINCT FROM 'consent_version_locked' THEN RAISE EXCEPTION 'FALHOU: versão de saúde aceita (e retirada) foi alterada (veio %)', coalesce(e, 'sucesso'); END IF;
  UPDATE public.consent_versions SET body_pt = 'corrigido' WHERE id = current_setting('josi.v_free')::uuid;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: versão sem aceite não pôde ser alterada'; END IF;

  -- audit_log da retirada: 1 linha (a 2ª chamada devolveu 0), só ids e quantidade.
  SELECT count(*) INTO n FROM public.audit_log
  WHERE action = 'consent.health_withdraw' AND target_id = a AND actor_id = t
    AND (snapshot_data ->> 'withdrawn_count') = '1'
    AND (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(snapshot_data) k) = ARRAY['student_id', 'withdrawn_count'];
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: audit_log tem % de 1 linha consent.health_withdraw do A (só ids e quantidade)', n; END IF;
  SELECT count(*) INTO n FROM public.audit_log WHERE action = 'consent.health_withdraw' AND target_id = b;
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: retirada que devolveu 0 gravou audit_log'; END IF;

  -- audit_log da leitura motivada: 1 por chamada válida, sem conteúdo de saúde.
  SELECT count(*) INTO n FROM public.audit_log
  WHERE action = 'health_profile.restricted_read' AND target_id = a AND actor_id = t
    AND snapshot_data ->> 'reason' = 'insurance'
    AND (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(snapshot_data) k) = ARRAY['reason', 'student_id'];
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: audit_log tem % de 1 linha health_profile.restricted_read do A (só student_id e motivo)', n; END IF;
  SELECT count(*) INTO n FROM public.audit_log
  WHERE action = 'health_profile.restricted_read' AND target_id = b AND snapshot_data ->> 'reason' = 'legal';
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: leitura sem ficha não gravou audit_log'; END IF;
  SELECT count(*) INTO n FROM public.audit_log
  WHERE action = 'health_profile.restricted_read' AND target_id IN (a, b);
  IF n <> 2 THEN RAISE EXCEPTION 'FALHOU: chamadas recusadas (motivo inválido/aluno) gravaram audit_log (% de 2)', n; END IF;
  SELECT count(*) INTO n FROM public.audit_log
  WHERE action IN ('health_profile.restricted_read', 'consent.health_withdraw') AND target_id IN (a, b)
    AND (snapshot_data::text LIKE '%Postura%' OR snapshot_data::text LIKE '%back_neck_shoulder%' OR snapshot_data::text LIKE '%nenhum%');
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: conteúdo da ficha de saúde foi para o audit_log'; END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 5. ALUNO A consente de novo: linha nova, a mesma ficha volta a ser editável
-- ════════════════════════════════════════════════════════════════════════════
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  json_build_object('sub', current_setting('josi.aluno'), 'role', 'authenticated')::text, true);

DO $$
DECLARE
  a uuid := current_setting('josi.aluno')::uuid;
  v_health uuid := current_setting('josi.v_health')::uuid;
  v_h1 uuid := current_setting('josi.a_health1')::uuid;
  v_h2 uuid; v_h3 uuid;
  n int;
BEGIN
  v_h2 := public.accept_consent(v_health, 'pt', NULL);
  IF v_h2 IS NULL OR v_h2 = v_h1 THEN RAISE EXCEPTION 'FALHOU: consentir de novo não criou linha nova'; END IF;
  v_h3 := public.accept_consent(v_health, 'pt', NULL);
  IF v_h3 IS DISTINCT FROM v_h2 THEN RAISE EXCEPTION 'FALHOU: aceite repetido depois de consentir de novo devolveu outro id'; END IF;
  SELECT count(*) INTO n FROM public.consent_acceptances WHERE student_id = a AND consent_version_id = v_health;
  IF n <> 2 THEN RAISE EXCEPTION 'FALHOU: esperado 2 aceites de saúde do A (retirado + novo), veio %', n; END IF;
  SELECT count(*) INTO n FROM public.consent_acceptances WHERE id = v_h1 AND withdrawn_at IS NOT NULL;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: o aceite retirado perdeu a retirada ao consentir de novo'; END IF;
  PERFORM set_config('josi.a_health2', v_h2::text, true);

  SELECT count(*) INTO n FROM public.my_pending_consents();
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: depois de consentir de novo ainda há % pendências', n; END IF;

  UPDATE public.student_health_profiles SET medications = 'vitamina D' WHERE student_id = a;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: depois de consentir de novo o aluno A não edita a mesma ficha'; END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 6. PROFESSORA: volta a ler pela tabela; retira de novo
-- ════════════════════════════════════════════════════════════════════════════
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  json_build_object('sub', current_setting('josi.professora'), 'role', 'authenticated')::text, true);

DO $$
DECLARE
  a uuid := current_setting('josi.aluno')::uuid;
  v_row record;
  n int;
BEGIN
  SELECT count(*) INTO n FROM public.student_health_profiles
  WHERE student_id = a AND medications = 'vitamina D' AND main_goal = 'Postura';
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: depois do novo consentimento a professora não lê a ficha do A pela tabela'; END IF;
  SELECT * INTO v_row FROM public.staff_consent_overview() WHERE student_id = a;
  IF NOT v_row.health_consent OR NOT v_row.health_profile THEN
    RAISE EXCEPTION 'FALHOU: staff_consent_overview do A depois do novo consentimento (%)', to_jsonb(v_row);
  END IF;

  n := public.withdraw_health_consent(a);
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: segunda retirada do A marcou % aceites (esperado 1)', n; END IF;
  SELECT count(*) INTO n FROM public.student_health_profiles WHERE student_id = a;
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: professora lê a ficha do A congelada de novo'; END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 7. "Apagar de vez" (desfeito logo depois): aluno A com aceites retirados e
--    ficha congelada (service_role, como a Edge Function); perfil da
--    professora com recorded_by (ON DELETE SET NULL passa pela trava).
-- ════════════════════════════════════════════════════════════════════════════
RESET ROLE;
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);

DO $$
DECLARE
  a uuid := current_setting('josi.aluno')::uuid;
  v_tbl text;
  n int;
BEGIN
  BEGIN
    FOREACH v_tbl IN ARRAY ARRAY['student_class_link', 'check_ins', 'balance_history', 'email_notifications'] LOOP
      IF to_regclass('public.' || v_tbl) IS NOT NULL THEN
        EXECUTE format('DELETE FROM public.%I WHERE student_id = $1', v_tbl) USING a;
      END IF;
    END LOOP;
    DELETE FROM public.profiles WHERE id = a;
    SELECT count(*) INTO n FROM public.consent_acceptances WHERE student_id = a;
    IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: aceites (com retirada) do aluno apagado não saíram em cascata'; END IF;
    SELECT count(*) INTO n FROM public.student_health_profiles WHERE student_id = a;
    IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: ficha congelada do aluno apagado não saiu em cascata'; END IF;
    RAISE EXCEPTION 'desfazer';
  EXCEPTION WHEN others THEN
    IF SQLERRM LIKE 'FALHOU:%' THEN RAISE; END IF;
    IF SQLERRM <> 'desfazer' THEN
      IF SQLERRM LIKE '%consent_%' OR SQLERRM LIKE '%health_profile%' OR SQLERRM LIKE '%audit_log%' THEN
        RAISE EXCEPTION 'FALHOU: as tabelas de consentimento impediram apagar o aluno de vez (%)', SQLERRM;
      END IF;
      RAISE NOTICE 'Aviso: "apagar de vez" do aluno não testado com DELETE real (outra coisa impediu: %).', SQLERRM;
    END IF;
  END;
END $$;

RESET ROLE;
SELECT set_config('request.jwt.claims', '', true);

DO $$
DECLARE
  t uuid := current_setting('josi.professora')::uuid;
  v_paper uuid := current_setting('josi.b_paper')::uuid;
  n int;
BEGIN
  SELECT count(*) INTO n FROM public.consent_acceptances WHERE student_id = current_setting('josi.aluno')::uuid;
  IF n <> 3 THEN RAISE EXCEPTION 'FALHOU: teste de "apagar de vez" do aluno não foi desfeito (% de 3 aceites)', n; END IF;

  BEGIN
    DELETE FROM public.profiles WHERE id = t;
    SELECT count(*) INTO n FROM public.consent_acceptances WHERE id = v_paper AND recorded_by IS NULL;
    IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: apagar a professora não pôs recorded_by em NULL'; END IF;
    -- withdrawn_by não tem FK: continua com o id.
    SELECT count(*) INTO n FROM public.consent_acceptances
    WHERE id = current_setting('josi.a_health1')::uuid AND withdrawn_by = t;
    IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: apagar a professora mexeu em withdrawn_by'; END IF;
    RAISE EXCEPTION 'desfazer';
  EXCEPTION WHEN others THEN
    IF SQLERRM LIKE 'FALHOU:%' THEN RAISE; END IF;
    IF SQLERRM <> 'desfazer' THEN
      IF SQLERRM LIKE '%consent_immutable%' THEN
        RAISE EXCEPTION 'FALHOU: a trava dos aceites impediu apagar o perfil da professora (%)', SQLERRM;
      END IF;
      RAISE NOTICE 'Aviso: apagar o perfil da professora não testado com DELETE real (outra coisa impediu: %). recorded_by → NULL testado na seção 4.', SQLERRM;
    END IF;
  END;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 8. Apagar a ficha congelada (fim do prazo de guarda): só pela RPC da professora
-- ════════════════════════════════════════════════════════════════════════════
-- 8a. ALUNO A: nem a RPC nem o DELETE direto.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  json_build_object('sub', current_setting('josi.aluno'), 'role', 'authenticated')::text, true);

DO $$
DECLARE
  a uuid := current_setting('josi.aluno')::uuid;
  n int;
  e text;
BEGIN
  e := NULL;
  BEGIN PERFORM public.delete_health_profile(a);
  EXCEPTION WHEN others THEN e := SQLERRM; END;
  IF e IS DISTINCT FROM 'consent_not_allowed' THEN
    RAISE EXCEPTION 'FALHOU: aluno chamou delete_health_profile (esperado consent_not_allowed, veio %)', coalesce(e, 'sucesso');
  END IF;
  e := NULL;
  BEGIN DELETE FROM public.student_health_profiles WHERE student_id = a;
  EXCEPTION WHEN others THEN e := SQLSTATE; END;
  IF e IS DISTINCT FROM '42501' THEN RAISE EXCEPTION 'FALHOU: DELETE direto do aluno (esperado 42501, veio %)', coalesce(e, 'sucesso'); END IF;
  SELECT count(*) INTO n FROM public.student_health_profiles WHERE student_id = a;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: a ficha congelada do A sumiu com as tentativas do aluno'; END IF;
END $$;

-- 8b. PROFESSORA: DELETE direto recusado; id nulo recusado; RPC apaga (1, depois 0).
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  json_build_object('sub', current_setting('josi.professora'), 'role', 'authenticated')::text, true);

DO $$
DECLARE
  a uuid := current_setting('josi.aluno')::uuid;
  n int;
  e text;
BEGIN
  e := NULL;
  BEGIN DELETE FROM public.student_health_profiles WHERE student_id = a;
  EXCEPTION WHEN others THEN e := SQLSTATE; END;
  IF e IS DISTINCT FROM '42501' THEN RAISE EXCEPTION 'FALHOU: DELETE direto da professora (esperado 42501, veio %)', coalesce(e, 'sucesso'); END IF;
  e := NULL;
  BEGIN PERFORM public.delete_health_profile(NULL);
  EXCEPTION WHEN others THEN e := SQLERRM; END;
  IF e IS DISTINCT FROM 'consent_invalid_student' THEN
    RAISE EXCEPTION 'FALHOU: delete_health_profile com id nulo (esperado consent_invalid_student, veio %)', coalesce(e, 'sucesso');
  END IF;

  n := public.delete_health_profile(a);
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: professora não apagou a ficha congelada do A pela RPC (% linhas)', n; END IF;
  n := public.delete_health_profile(a);
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: segunda chamada de delete_health_profile devolveu % (esperado 0)', n; END IF;
END $$;

RESET ROLE;
SELECT set_config('request.jwt.claims', '', true);

DO $$
DECLARE
  a uuid := current_setting('josi.aluno')::uuid;
  n int;
BEGIN
  SELECT count(*) INTO n FROM public.student_health_profiles WHERE student_id = a;
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: ficha congelada do A ainda existe'; END IF;
  -- 1 linha só (trigger do PR A; a RPC não grava outra), só o id do aluno.
  SELECT count(*) INTO n FROM public.audit_log
  WHERE action = 'health_profile.delete' AND target_id = a;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: audit_log tem % de 1 linha health_profile.delete do A', n; END IF;
  SELECT count(*) INTO n FROM public.audit_log
  WHERE action = 'health_profile.delete' AND target_id = a
    AND actor_id = current_setting('josi.professora')::uuid
    AND (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(snapshot_data) k) = ARRAY['student_id'];
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: audit_log health_profile.delete do A sem a professora como autora ou com mais que o student_id'; END IF;
  -- Os aceites (com as retiradas) continuam como registro.
  SELECT count(*) INTO n FROM public.consent_acceptances WHERE student_id = a;
  IF n <> 3 THEN RAISE EXCEPTION 'FALHOU: apagar a ficha mexeu nos aceites do A (% de 3)', n; END IF;
END $$;

ROLLBACK;
