-- Teste — termo de consentimento digital e ficha de saúde
-- (migration 20261128000000_create_consents_and_health_profiles.sql; plano
--  docs/planos/2026-11-28-perfil-e-consentimento-digital.md, PR A passo 2)
--
-- Rodar no Supabase SQL Editor DEPOIS da migration. Funciona antes e depois
-- da publicação da versão 1: o script cria versões de TESTE acima da maior
-- versão existente (e tudo é desfeito no fim).
--
-- Não precisa editar nada: o script escolhe sozinho a professora (role =
-- 'teacher') e os dois primeiros alunos (role = 'student', ordem do id) que
-- não estão apagados, ainda não têm aceite nem ficha de saúde e não têm
-- recibo de seguro (recibo impede o "apagar de vez", testado no fim).
--
-- Tudo roda dentro de uma transação que termina em ROLLBACK: nada fica gravado
-- (nem versões de teste, nem aceites, nem ficha, nem audit_log, nem a
-- exclusão de teste do aluno B no fim).
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
  v_tbl text;
  v_priv text;
  v_fn text;
  n int;
BEGIN
  IF a IS NULL OR b IS NULL OR a = b THEN
    RAISE EXCEPTION 'FALHOU: não há dois alunos disponíveis para o teste (role = student, não apagados, sem aceite/ficha e sem recibo)';
  END IF;
  IF t IS NULL THEN
    RAISE EXCEPTION 'FALHOU: professora de teste não encontrada (role = teacher)';
  END IF;

  IF to_regclass('public.consent_versions') IS NULL OR to_regclass('public.consent_acceptances') IS NULL
     OR to_regclass('public.student_health_profiles') IS NULL THEN
    RAISE EXCEPTION 'FALHOU: migration 20261128000000 não rodou (tabelas não existem)';
  END IF;

  FOREACH v_tbl IN ARRAY ARRAY['consent_versions', 'consent_acceptances', 'student_health_profiles'] LOOP
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = ('public.' || v_tbl)::regclass) THEN
      RAISE EXCEPTION 'FALHOU: RLS desligada em %', v_tbl;
    END IF;
    IF NOT has_table_privilege('authenticated', 'public.' || v_tbl, 'SELECT')
       OR NOT has_table_privilege('service_role', 'public.' || v_tbl, 'SELECT') THEN
      RAISE EXCEPTION 'FALHOU: authenticated/service_role sem SELECT em %', v_tbl;
    END IF;
    FOREACH v_priv IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'] LOOP
      IF has_table_privilege('anon', 'public.' || v_tbl, v_priv) THEN
        RAISE EXCEPTION 'FALHOU: anon tem % em %', v_priv, v_tbl;
      END IF;
    END LOOP;
    FOREACH v_priv IN ARRAY ARRAY['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'] LOOP
      IF has_table_privilege('service_role', 'public.' || v_tbl, v_priv) THEN
        RAISE EXCEPTION 'FALHOU: service_role tem % em % (deveria só ler, para o backup)', v_priv, v_tbl;
      END IF;
    END LOOP;
    FOREACH v_priv IN ARRAY ARRAY['TRUNCATE', 'REFERENCES', 'TRIGGER'] LOOP
      IF has_table_privilege('authenticated', 'public.' || v_tbl, v_priv) THEN
        RAISE EXCEPTION 'FALHOU: authenticated tem % em %', v_priv, v_tbl;
      END IF;
    END LOOP;
  END LOOP;

  -- Versões e aceites: a API só lê. Ficha: INSERT/UPDATE/DELETE (filtrados pela RLS).
  FOREACH v_tbl IN ARRAY ARRAY['consent_versions', 'consent_acceptances'] LOOP
    FOREACH v_priv IN ARRAY ARRAY['INSERT', 'UPDATE', 'DELETE'] LOOP
      IF has_table_privilege('authenticated', 'public.' || v_tbl, v_priv) THEN
        RAISE EXCEPTION 'FALHOU: authenticated tem % em % (só RPC grava)', v_priv, v_tbl;
      END IF;
    END LOOP;
  END LOOP;
  IF NOT has_table_privilege('authenticated', 'public.student_health_profiles', 'INSERT')
     OR NOT has_table_privilege('authenticated', 'public.student_health_profiles', 'UPDATE')
     OR NOT has_table_privilege('authenticated', 'public.student_health_profiles', 'DELETE') THEN
    RAISE EXCEPTION 'FALHOU: authenticated sem INSERT/UPDATE/DELETE em student_health_profiles';
  END IF;

  -- Policies: versões 1 (SELECT), aceites 1 (SELECT), ficha 4 (SELECT, INSERT, UPDATE, DELETE).
  SELECT count(*) INTO n FROM pg_policies WHERE schemaname = 'public' AND tablename = 'consent_versions';
  IF n <> 1 OR EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'consent_versions' AND cmd <> 'SELECT') THEN
    RAISE EXCEPTION 'FALHOU: consent_versions tem % policies (esperado 1, só SELECT)', n;
  END IF;
  SELECT count(*) INTO n FROM pg_policies WHERE schemaname = 'public' AND tablename = 'consent_acceptances';
  IF n <> 1 OR EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'consent_acceptances' AND cmd <> 'SELECT') THEN
    RAISE EXCEPTION 'FALHOU: consent_acceptances tem % policies (esperado 1, só SELECT)', n;
  END IF;
  IF (SELECT array_agg(cmd::text ORDER BY cmd) FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'student_health_profiles')
     IS DISTINCT FROM ARRAY['DELETE', 'INSERT', 'SELECT', 'UPDATE'] THEN
    RAISE EXCEPTION 'FALHOU: student_health_profiles não tem exatamente as policies SELECT/INSERT/UPDATE/DELETE';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
             AND tablename IN ('consent_versions', 'consent_acceptances', 'student_health_profiles')
             AND NOT ('authenticated' = ANY (roles))) THEN
    RAISE EXCEPTION 'FALHOU: alguma policy das tabelas novas não é só para authenticated';
  END IF;

  -- RPCs: SECURITY DEFINER, search_path fixo, só authenticated executa.
  FOREACH v_fn IN ARRAY ARRAY[
    'public.accept_consent(uuid,text,text)',
    'public.register_paper_consent(uuid,uuid,date,text,text)',
    'public.my_pending_consents()',
    'public.staff_consent_overview()'
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

  -- "Apagar de vez": aceites e ficha com ON DELETE CASCADE para profiles(id).
  SELECT count(*) INTO n FROM pg_constraint
  WHERE contype = 'f' AND confrelid = 'public.profiles'::regclass AND confdeltype = 'c'
    AND conrelid IN ('public.consent_acceptances'::regclass, 'public.student_health_profiles'::regclass);
  IF n <> 2 THEN
    RAISE EXCEPTION 'FALHOU: as FKs student_id → profiles não são ON DELETE CASCADE (% de 2)', n;
  END IF;
  -- Versão aceita não pode ser apagada: FK para consent_versions sem cascata.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE contype = 'f' AND conrelid = 'public.consent_acceptances'::regclass
                   AND confrelid = 'public.consent_versions'::regclass AND confdeltype IN ('a', 'r')) THEN
    RAISE EXCEPTION 'FALHOU: FK consent_acceptances → consent_versions não é NO ACTION/RESTRICT';
  END IF;
  -- Nenhum trigger de DELETE/TRUNCATE nos aceites (bloquearia a cascata).
  IF EXISTS (SELECT 1 FROM pg_trigger
             WHERE tgrelid = 'public.consent_acceptances'::regclass
               AND NOT tgisinternal AND (tgtype & (8 | 32)) <> 0) THEN
    RAISE EXCEPTION 'FALHOU: existe trigger de DELETE/TRUNCATE em consent_acceptances (quebraria o "apagar de vez")';
  END IF;
END $$;

-- Versões de TESTE (acima das existentes): termo antigo + termo atual + saúde atual.
DO $$
DECLARE
  v_cp int := coalesce((SELECT max(version) FROM public.consent_versions WHERE kind = 'class_policies'), 0);
  v_hd int := coalesce((SELECT max(version) FROM public.consent_versions WHERE kind = 'health_data'), 0);
  v_old uuid; v_cur uuid; v_health uuid;
BEGIN
  INSERT INTO public.consent_versions (kind, version, title_pt, title_en, title_fr, body_pt, body_en, body_fr)
  VALUES ('class_policies', v_cp + 1, 'T', 'T', 'T', 'teste antigo', 'old test', 'vieux test')
  RETURNING id INTO v_old;
  INSERT INTO public.consent_versions (kind, version, title_pt, title_en, title_fr, body_pt, body_en, body_fr)
  VALUES ('class_policies', v_cp + 2, 'T', 'T', 'T', 'teste atual', 'current test', 'test actuel')
  RETURNING id INTO v_cur;
  INSERT INTO public.consent_versions (kind, version, title_pt, title_en, title_fr, body_pt, body_en, body_fr)
  VALUES ('health_data', v_hd + 1, 'S', 'S', 'S', 'saúde', 'health', 'santé')
  RETURNING id INTO v_health;
  PERFORM set_config('josi.v_old', v_old::text, true);
  PERFORM set_config('josi.v_cur', v_cur::text, true);
  PERFORM set_config('josi.v_health', v_health::text, true);
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 1. ALUNO A: pendências, aceite, validações, escrita direta, ficha
-- ════════════════════════════════════════════════════════════════════════════
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  json_build_object('sub', current_setting('josi.aluno'), 'role', 'authenticated')::text, true),
       set_config('request.headers',
  '{"x-forwarded-for":"203.0.113.7, 10.0.0.1","user-agent":"TesteNavegador/1.0"}', true);

DO $$
DECLARE
  a uuid := current_setting('josi.aluno')::uuid;
  b uuid := current_setting('josi.aluno_b')::uuid;
  v_old uuid := current_setting('josi.v_old')::uuid;
  v_cur uuid := current_setting('josi.v_cur')::uuid;
  v_health uuid := current_setting('josi.v_health')::uuid;
  v_id uuid; v_id2 uuid;
  v_row record;
  n int;
  e text;
BEGIN
  -- Pendências: termo atual e saúde atual (as versões de teste), nada da antiga.
  SELECT count(*) INTO n FROM public.my_pending_consents()
  WHERE (kind = 'class_policies' AND version_id = v_cur) OR (kind = 'health_data' AND version_id = v_health);
  IF n <> 2 THEN RAISE EXCEPTION 'FALHOU: my_pending_consents não lista termo e saúde atuais (% de 2)', n; END IF;
  SELECT count(*) INTO n FROM public.my_pending_consents();
  IF n <> 2 THEN RAISE EXCEPTION 'FALHOU: my_pending_consents devolve % linhas (esperado 2, uma por kind)', n; END IF;

  -- Versão antiga recusada.
  e := NULL;
  BEGIN PERFORM public.accept_consent(v_old, 'pt', 'Aluna A');
  EXCEPTION WHEN others THEN e := SQLERRM; END;
  IF e IS DISTINCT FROM 'consent_version_outdated' THEN
    RAISE EXCEPTION 'FALHOU: aceitou versão antiga (esperado consent_version_outdated, veio %)', coalesce(e, 'sucesso');
  END IF;
  -- Versão inexistente.
  e := NULL;
  BEGIN PERFORM public.accept_consent(gen_random_uuid(), 'pt', 'Aluna A');
  EXCEPTION WHEN others THEN e := SQLERRM; END;
  IF e IS DISTINCT FROM 'consent_version_not_found' THEN
    RAISE EXCEPTION 'FALHOU: versão inexistente (esperado consent_version_not_found, veio %)', coalesce(e, 'sucesso');
  END IF;
  -- Língua inválida.
  e := NULL;
  BEGIN PERFORM public.accept_consent(v_cur, 'es', 'Aluna A');
  EXCEPTION WHEN others THEN e := SQLERRM; END;
  IF e IS DISTINCT FROM 'consent_invalid_language' THEN
    RAISE EXCEPTION 'FALHOU: língua inválida (esperado consent_invalid_language, veio %)', coalesce(e, 'sucesso');
  END IF;
  -- Nome digitado: obrigatório no termo, 2 a 200.
  e := NULL;
  BEGIN PERFORM public.accept_consent(v_cur, 'pt', '   ');
  EXCEPTION WHEN others THEN e := SQLERRM; END;
  IF e IS DISTINCT FROM 'consent_invalid_name' THEN
    RAISE EXCEPTION 'FALHOU: termo sem nome (esperado consent_invalid_name, veio %)', coalesce(e, 'sucesso');
  END IF;
  e := NULL;
  BEGIN PERFORM public.accept_consent(v_cur, 'pt', ' A ');
  EXCEPTION WHEN others THEN e := SQLERRM; END;
  IF e IS DISTINCT FROM 'consent_invalid_name' THEN
    RAISE EXCEPTION 'FALHOU: nome de 1 caractere (esperado consent_invalid_name, veio %)', coalesce(e, 'sucesso');
  END IF;
  e := NULL;
  BEGIN PERFORM public.accept_consent(v_cur, 'pt', repeat('x', 201));
  EXCEPTION WHEN others THEN e := SQLERRM; END;
  IF e IS DISTINCT FROM 'consent_invalid_name' THEN
    RAISE EXCEPTION 'FALHOU: nome de 201 caracteres (esperado consent_invalid_name, veio %)', coalesce(e, 'sucesso');
  END IF;

  -- Aceite do termo atual.
  v_id := public.accept_consent(v_cur, 'fr', '  Aluna Teste A  ');
  SELECT * INTO v_row FROM public.consent_acceptances WHERE id = v_id;
  IF NOT FOUND OR v_row.student_id <> a OR v_row.consent_version_id <> v_cur OR v_row.method <> 'digital'
     OR v_row.language <> 'fr' OR v_row.typed_name <> 'Aluna Teste A'
     OR v_row.profile_name IS DISTINCT FROM (SELECT full_name::text FROM public.profiles WHERE id = a)
     OR v_row.signed_on IS NOT NULL OR v_row.recorded_by IS NOT NULL OR v_row.guardian_name IS NOT NULL
     OR v_row.ip IS DISTINCT FROM '203.0.113.7' OR v_row.user_agent IS DISTINCT FROM 'TesteNavegador/1.0' THEN
    RAISE EXCEPTION 'FALHOU: aceite digital gravado errado (método/língua/nome/perfil/ip/navegador)';
  END IF;

  -- Duplo clique: mesmo id, uma linha só.
  v_id2 := public.accept_consent(v_cur, 'pt', 'Outro Nome');
  IF v_id2 IS DISTINCT FROM v_id THEN RAISE EXCEPTION 'FALHOU: aceite repetido devolveu outro id'; END IF;
  SELECT count(*) INTO n FROM public.consent_acceptances WHERE student_id = a AND consent_version_id = v_cur;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: aceite repetido gravou % linhas', n; END IF;

  -- Escrita direta: negada.
  e := NULL;
  BEGIN
    INSERT INTO public.consent_acceptances (student_id, consent_version_id, method, language)
    VALUES (a, v_old, 'digital', 'pt');
  EXCEPTION WHEN others THEN e := SQLSTATE; END;
  IF e IS DISTINCT FROM '42501' THEN RAISE EXCEPTION 'FALHOU: aluno fez INSERT direto em consent_acceptances'; END IF;
  e := NULL;
  BEGIN UPDATE public.consent_acceptances SET typed_name = 'x' WHERE id = v_id;
  EXCEPTION WHEN others THEN e := SQLSTATE; END;
  IF e IS DISTINCT FROM '42501' THEN RAISE EXCEPTION 'FALHOU: aluno fez UPDATE direto em consent_acceptances'; END IF;
  e := NULL;
  BEGIN DELETE FROM public.consent_acceptances WHERE id = v_id;
  EXCEPTION WHEN others THEN e := SQLSTATE; END;
  IF e IS DISTINCT FROM '42501' THEN RAISE EXCEPTION 'FALHOU: aluno fez DELETE direto em consent_acceptances'; END IF;
  e := NULL;
  BEGIN
    INSERT INTO public.consent_versions (kind, version, title_pt, title_en, title_fr, body_pt, body_en, body_fr)
    VALUES ('class_policies', 9999, 'x', 'x', 'x', 'x', 'x', 'x');
  EXCEPTION WHEN others THEN e := SQLSTATE; END;
  IF e IS DISTINCT FROM '42501' THEN RAISE EXCEPTION 'FALHOU: aluno publicou versão em consent_versions'; END IF;
  e := NULL;
  BEGIN UPDATE public.consent_versions SET body_pt = 'x' WHERE id = v_cur;
  EXCEPTION WHEN others THEN e := SQLSTATE; END;
  IF e IS DISTINCT FROM '42501' THEN RAISE EXCEPTION 'FALHOU: aluno alterou texto em consent_versions'; END IF;

  -- RPCs da professora: recusadas.
  e := NULL;
  BEGIN PERFORM public.register_paper_consent(a, v_cur, CURRENT_DATE, 'Aluna A');
  EXCEPTION WHEN others THEN e := SQLERRM; END;
  IF e IS DISTINCT FROM 'consent_not_allowed' THEN
    RAISE EXCEPTION 'FALHOU: aluno chamou register_paper_consent (veio %)', coalesce(e, 'sucesso');
  END IF;
  e := NULL;
  BEGIN PERFORM count(*) FROM public.staff_consent_overview();
  EXCEPTION WHEN others THEN e := SQLERRM; END;
  IF e IS DISTINCT FROM 'consent_not_allowed' THEN
    RAISE EXCEPTION 'FALHOU: aluno chamou staff_consent_overview (veio %)', coalesce(e, 'sucesso');
  END IF;

  -- Ficha SEM consentimento de saúde: recusada.
  e := NULL;
  BEGIN INSERT INTO public.student_health_profiles (student_id, main_goal) VALUES (a, 'teste');
  EXCEPTION WHEN others THEN e := SQLSTATE; END;
  IF e IS DISTINCT FROM '42501' THEN RAISE EXCEPTION 'FALHOU: aluno sem consentimento de saúde gravou ficha'; END IF;

  -- Consentimento de saúde: nome opcional.
  v_id := public.accept_consent(v_health, 'pt', NULL);
  SELECT * INTO v_row FROM public.consent_acceptances WHERE id = v_id;
  IF NOT FOUND OR v_row.typed_name IS NOT NULL OR v_row.consent_version_id <> v_health THEN
    RAISE EXCEPTION 'FALHOU: consentimento de saúde sem nome gravado errado';
  END IF;
  SELECT count(*) INTO n FROM public.my_pending_consents();
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: depois dos dois aceites ainda há % pendências', n; END IF;

  -- Com consentimento: grava a própria ficha.
  INSERT INTO public.student_health_profiles (student_id, main_goal, conditions, sleep_quality, updated_by, created_at)
  VALUES (a, 'Postura', ARRAY['respiratory'], 'good', b, '2000-01-01');
  SELECT * INTO v_row FROM public.student_health_profiles WHERE student_id = a;
  IF NOT FOUND OR v_row.updated_by IS DISTINCT FROM a OR v_row.created_at < now() - interval '1 minute' THEN
    RAISE EXCEPTION 'FALHOU: ficha do aluno A gravada errada (updated_by/created_at não vieram do trigger)';
  END IF;
  UPDATE public.student_health_profiles SET medications = 'nenhum' WHERE student_id = a;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: aluno A não atualizou a própria ficha'; END IF;

  -- Validações da ficha (CHECKs).
  e := NULL;
  BEGIN UPDATE public.student_health_profiles SET conditions = ARRAY['cancer'] WHERE student_id = a;
  EXCEPTION WHEN others THEN e := SQLSTATE; END;
  IF e IS DISTINCT FROM '23514' THEN RAISE EXCEPTION 'FALHOU: condição fora da lista foi aceita'; END IF;
  e := NULL;
  BEGIN UPDATE public.student_health_profiles SET pregnancy_weeks = 43 WHERE student_id = a;
  EXCEPTION WHEN others THEN e := SQLSTATE; END;
  IF e IS DISTINCT FROM '23514' THEN RAISE EXCEPTION 'FALHOU: 43 semanas de gestação foi aceito'; END IF;
  e := NULL;
  BEGIN UPDATE public.student_health_profiles SET main_goal = repeat('x', 2001) WHERE student_id = a;
  EXCEPTION WHEN others THEN e := SQLSTATE; END;
  IF e IS DISTINCT FROM '23514' THEN RAISE EXCEPTION 'FALHOU: texto de 2001 caracteres foi aceito'; END IF;
  e := NULL;
  BEGIN UPDATE public.student_health_profiles SET diet_quality = 'great' WHERE student_id = a;
  EXCEPTION WHEN others THEN e := SQLSTATE; END;
  IF e IS DISTINCT FROM '23514' THEN RAISE EXCEPTION 'FALHOU: diet_quality fora da lista foi aceito'; END IF;

  -- Não grava ficha de outro nem troca student_id.
  e := NULL;
  BEGIN INSERT INTO public.student_health_profiles (student_id, main_goal) VALUES (b, 'invasão');
  EXCEPTION WHEN others THEN e := SQLSTATE; END;
  IF e IS DISTINCT FROM '42501' THEN RAISE EXCEPTION 'FALHOU: aluno A gravou ficha do aluno B'; END IF;
  e := NULL;
  BEGIN UPDATE public.student_health_profiles SET student_id = b WHERE student_id = a;
  EXCEPTION WHEN others THEN e := SQLSTATE; END;
  IF e IS DISTINCT FROM '42501' THEN RAISE EXCEPTION 'FALHOU: aluno A trocou o student_id da própria ficha'; END IF;

  -- Não apaga a própria ficha (sem policy de DELETE para aluno: 0 linhas).
  DELETE FROM public.student_health_profiles WHERE student_id = a;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: aluno apagou a própria ficha'; END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. ALUNO B: não vê nem altera nada do A; sem consentimento não grava ficha
-- ════════════════════════════════════════════════════════════════════════════
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  json_build_object('sub', current_setting('josi.aluno_b'), 'role', 'authenticated')::text, true),
       set_config('request.headers', '', true);

DO $$
DECLARE
  a uuid := current_setting('josi.aluno')::uuid;
  b uuid := current_setting('josi.aluno_b')::uuid;
  n int;
  e text;
BEGIN
  SELECT count(*) INTO n FROM public.consent_acceptances WHERE student_id <> b;
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: aluno B vê % aceites de outros alunos', n; END IF;
  SELECT count(*) INTO n FROM public.student_health_profiles WHERE student_id <> b;
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: aluno B vê % fichas de saúde de outros alunos', n; END IF;

  UPDATE public.student_health_profiles SET main_goal = 'alterado por B' WHERE student_id = a;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: aluno B alterou a ficha do aluno A'; END IF;
  DELETE FROM public.student_health_profiles WHERE student_id = a;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: aluno B apagou a ficha do aluno A'; END IF;

  -- Versões publicadas: todo logado lê.
  SELECT count(*) INTO n FROM public.consent_versions
  WHERE id IN (current_setting('josi.v_cur')::uuid, current_setting('josi.v_health')::uuid);
  IF n <> 2 THEN RAISE EXCEPTION 'FALHOU: aluno não lê consent_versions'; END IF;

  -- Sem consentimento de saúde: não grava a própria ficha.
  e := NULL;
  BEGIN INSERT INTO public.student_health_profiles (student_id, main_goal) VALUES (b, 'teste');
  EXCEPTION WHEN others THEN e := SQLSTATE; END;
  IF e IS DISTINCT FROM '42501' THEN RAISE EXCEPTION 'FALHOU: aluno B sem consentimento de saúde gravou ficha'; END IF;

END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. PROFESSORA: lê tudo, visão geral, registra papel, edita e apaga ficha
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
  v_old uuid := current_setting('josi.v_old')::uuid;
  v_cur uuid := current_setting('josi.v_cur')::uuid;
  v_today date := (now() AT TIME ZONE 'America/Montreal')::date;
  v_id uuid;
  v_row record;
  n int;
  e text;
BEGIN
  -- Professora não "aceita" pelo app.
  e := NULL;
  BEGIN PERFORM public.accept_consent(v_cur, 'pt', 'Josi');
  EXCEPTION WHEN others THEN e := SQLERRM; END;
  IF e IS DISTINCT FROM 'consent_not_allowed' THEN
    RAISE EXCEPTION 'FALHOU: professora chamou accept_consent (veio %)', coalesce(e, 'sucesso');
  END IF;

  -- Lê aceites e ficha dos alunos.
  SELECT count(*) INTO n FROM public.consent_acceptances WHERE student_id IN (a, b);
  IF n <> 2 THEN RAISE EXCEPTION 'FALHOU: professora não vê os aceites do aluno A (% de 2)', n; END IF;
  SELECT count(*) INTO n FROM public.student_health_profiles WHERE student_id = a;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: professora não vê a ficha do aluno A'; END IF;

  -- Visão geral: A current + consentimento + ficha.
  SELECT * INTO v_row FROM public.staff_consent_overview() WHERE student_id = a;
  IF NOT FOUND OR v_row.policies_status <> 'current' OR NOT v_row.health_consent OR NOT v_row.health_profile THEN
    RAISE EXCEPTION 'FALHOU: staff_consent_overview do aluno A errado (%)', to_jsonb(v_row);
  END IF;
  SELECT * INTO v_row FROM public.staff_consent_overview() WHERE student_id = b;
  IF NOT FOUND OR v_row.policies_status <> 'none' OR v_row.health_consent OR v_row.health_profile THEN
    RAISE EXCEPTION 'FALHOU: staff_consent_overview do aluno B sem aceite errado (%)', to_jsonb(v_row);
  END IF;
  -- Só alunos ativos.
  SELECT count(*) INTO n FROM public.staff_consent_overview() o
  JOIN public.profiles p ON p.id = o.student_id
  WHERE p.role <> 'student' OR p.deleted_at IS NOT NULL;
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: staff_consent_overview lista % não-alunos ou apagados', n; END IF;

  -- Validações do papel.
  e := NULL;
  BEGIN PERFORM public.register_paper_consent(b, v_old, v_today + 1, 'Aluno B');
  EXCEPTION WHEN others THEN e := SQLERRM; END;
  IF e IS DISTINCT FROM 'consent_invalid_date' THEN
    RAISE EXCEPTION 'FALHOU: papel com data futura (esperado consent_invalid_date, veio %)', coalesce(e, 'sucesso');
  END IF;
  e := NULL;
  BEGIN PERFORM public.register_paper_consent(b, v_old, DATE '1999-12-31', 'Aluno B');
  EXCEPTION WHEN others THEN e := SQLERRM; END;
  IF e IS DISTINCT FROM 'consent_invalid_date' THEN
    RAISE EXCEPTION 'FALHOU: papel antes de 2000 (esperado consent_invalid_date, veio %)', coalesce(e, 'sucesso');
  END IF;
  e := NULL;
  BEGIN PERFORM public.register_paper_consent(b, v_old, NULL, 'Aluno B');
  EXCEPTION WHEN others THEN e := SQLERRM; END;
  IF e IS DISTINCT FROM 'consent_invalid_date' THEN
    RAISE EXCEPTION 'FALHOU: papel sem data (esperado consent_invalid_date, veio %)', coalesce(e, 'sucesso');
  END IF;
  e := NULL;
  BEGIN PERFORM public.register_paper_consent(b, v_old, v_today, '  ');
  EXCEPTION WHEN others THEN e := SQLERRM; END;
  IF e IS DISTINCT FROM 'consent_invalid_name' THEN
    RAISE EXCEPTION 'FALHOU: papel sem nome (esperado consent_invalid_name, veio %)', coalesce(e, 'sucesso');
  END IF;
  e := NULL;
  BEGIN PERFORM public.register_paper_consent(b, v_old, v_today, 'Aluno B', repeat('x', 201));
  EXCEPTION WHEN others THEN e := SQLERRM; END;
  IF e IS DISTINCT FROM 'consent_invalid_name' THEN
    RAISE EXCEPTION 'FALHOU: responsável com 201 caracteres (esperado consent_invalid_name, veio %)', coalesce(e, 'sucesso');
  END IF;
  e := NULL;
  BEGIN PERFORM public.register_paper_consent(t, v_old, v_today, 'Josi');
  EXCEPTION WHEN others THEN e := SQLERRM; END;
  IF e IS DISTINCT FROM 'consent_invalid_student' THEN
    RAISE EXCEPTION 'FALHOU: papel para quem não é aluno (esperado consent_invalid_student, veio %)', coalesce(e, 'sucesso');
  END IF;
  e := NULL;
  BEGIN PERFORM public.register_paper_consent(b, gen_random_uuid(), v_today, 'Aluno B');
  EXCEPTION WHEN others THEN e := SQLERRM; END;
  IF e IS DISTINCT FROM 'consent_version_not_found' THEN
    RAISE EXCEPTION 'FALHOU: papel com versão inexistente (esperado consent_version_not_found, veio %)', coalesce(e, 'sucesso');
  END IF;

  -- Papel de versão antiga (qualquer versão existente vale), com responsável.
  v_id := public.register_paper_consent(b, v_old, v_today - 3, '  Aluno Teste B  ', '  Responsável B  ');
  SELECT * INTO v_row FROM public.consent_acceptances WHERE id = v_id;
  IF NOT FOUND OR v_row.student_id <> b OR v_row.method <> 'paper' OR v_row.language IS NOT NULL
     OR v_row.typed_name <> 'Aluno Teste B' OR v_row.guardian_name <> 'Responsável B'
     OR v_row.signed_on <> v_today - 3 OR v_row.recorded_by IS DISTINCT FROM t
     OR v_row.profile_name IS DISTINCT FROM (SELECT full_name::text FROM public.profiles WHERE id = b)
     OR v_row.ip IS NOT NULL OR v_row.user_agent IS NOT NULL THEN
    RAISE EXCEPTION 'FALHOU: termo em papel gravado errado';
  END IF;
  PERFORM set_config('josi.paper_id', v_id::text, true);

  -- Papel repetido da mesma versão: recusado (não grava outra linha).
  e := NULL;
  BEGIN PERFORM public.register_paper_consent(b, v_old, v_today, 'Aluno B');
  EXCEPTION WHEN others THEN e := SQLERRM; END;
  IF e IS DISTINCT FROM 'consent_already_accepted' THEN
    RAISE EXCEPTION 'FALHOU: papel de versão já aceita (esperado consent_already_accepted, veio %)', coalesce(e, 'sucesso');
  END IF;

  -- B só com a versão antiga → outdated.
  SELECT * INTO v_row FROM public.staff_consent_overview() WHERE student_id = b;
  IF v_row.policies_status <> 'outdated' THEN
    RAISE EXCEPTION 'FALHOU: aluno B com versão antiga não aparece outdated (%)', to_jsonb(v_row);
  END IF;

  -- Escrita direta nos aceites: negada também para a professora.
  e := NULL;
  BEGIN
    INSERT INTO public.consent_acceptances (student_id, consent_version_id, method, signed_on)
    VALUES (a, v_old, 'paper', v_today);
  EXCEPTION WHEN others THEN e := SQLSTATE; END;
  IF e IS DISTINCT FROM '42501' THEN RAISE EXCEPTION 'FALHOU: professora fez INSERT direto em consent_acceptances'; END IF;
  e := NULL;
  BEGIN DELETE FROM public.consent_acceptances WHERE id = v_id;
  EXCEPTION WHEN others THEN e := SQLSTATE; END;
  IF e IS DISTINCT FROM '42501' THEN RAISE EXCEPTION 'FALHOU: professora fez DELETE direto em consent_acceptances'; END IF;

  -- Professora grava ficha do B (mesmo sem consentimento de saúde do aluno) e edita a do A.
  INSERT INTO public.student_health_profiles (student_id, emergency_contact_name, pregnant, pregnancy_weeks)
  VALUES (b, 'Contato B', true, 12);
  SELECT * INTO v_row FROM public.student_health_profiles WHERE student_id = b;
  IF NOT FOUND OR v_row.updated_by IS DISTINCT FROM t THEN
    RAISE EXCEPTION 'FALHOU: ficha do B gravada pela professora errada (updated_by)';
  END IF;
  UPDATE public.student_health_profiles SET surgeries = 'joelho 2020' WHERE student_id = a;
  SELECT * INTO v_row FROM public.student_health_profiles WHERE student_id = a;
  IF v_row.surgeries IS DISTINCT FROM 'joelho 2020' OR v_row.updated_by IS DISTINCT FROM t
     OR v_row.main_goal IS DISTINCT FROM 'Postura' THEN
    RAISE EXCEPTION 'FALHOU: edição da professora na ficha do A errada (ou o aluno B alterou a ficha)';
  END IF;

  -- Professora apaga a ficha do A.
  DELETE FROM public.student_health_profiles WHERE student_id = a;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: professora não apagou a ficha do aluno A'; END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 3b. ALUNO B: aceita o termo atual pelo app (sem cabeçalhos: ip/navegador nulos)
-- ════════════════════════════════════════════════════════════════════════════
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  json_build_object('sub', current_setting('josi.aluno_b'), 'role', 'authenticated')::text, true);

DO $$
DECLARE
  b uuid := current_setting('josi.aluno_b')::uuid;
  n int;
BEGIN
  -- Pendente: termo atual (o papel era da versão antiga) e saúde.
  SELECT count(*) INTO n FROM public.my_pending_consents()
  WHERE kind = 'class_policies' AND version_id = current_setting('josi.v_cur')::uuid;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: aluno B com versão antiga não tem o termo atual pendente'; END IF;

  PERFORM public.accept_consent(current_setting('josi.v_cur')::uuid, 'en', 'Aluno Teste B');
  SELECT count(*) INTO n FROM public.consent_acceptances
  WHERE student_id = b AND consent_version_id = current_setting('josi.v_cur')::uuid
    AND ip IS NULL AND user_agent IS NULL AND language = 'en' AND method = 'digital';
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: aceite sem cabeçalhos gravado errado'; END IF;

  -- Vê os próprios aceites (papel + digital) e a ficha que a professora fez.
  SELECT count(*) INTO n FROM public.consent_acceptances WHERE student_id = b;
  IF n <> 2 THEN RAISE EXCEPTION 'FALHOU: aluno B não vê os próprios aceites (% de 2)', n; END IF;
  SELECT count(*) INTO n FROM public.student_health_profiles WHERE student_id = b;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: aluno B não vê a própria ficha'; END IF;
  -- Sem consentimento de saúde: não edita a ficha (feita pela professora).
  UPDATE public.student_health_profiles SET main_goal = 'x' WHERE student_id = b;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: aluno B sem consentimento de saúde editou a ficha'; END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 3c. PROFESSORA: B agora em dia
-- ════════════════════════════════════════════════════════════════════════════
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  json_build_object('sub', current_setting('josi.professora'), 'role', 'authenticated')::text, true);

DO $$
DECLARE
  v_row record;
BEGIN
  SELECT * INTO v_row FROM public.staff_consent_overview() WHERE student_id = current_setting('josi.aluno_b')::uuid;
  IF v_row.policies_status <> 'current' OR v_row.health_consent OR NOT v_row.health_profile THEN
    RAISE EXCEPTION 'FALHOU: staff_consent_overview do aluno B depois do aceite errado (%)', to_jsonb(v_row);
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 4. Visitante (anon): nada
-- ════════════════════════════════════════════════════════════════════════════
RESET ROLE;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);

DO $$
DECLARE
  e text;
BEGIN
  e := NULL;
  BEGIN PERFORM count(*) FROM public.consent_versions;
  EXCEPTION WHEN others THEN e := SQLSTATE; END;
  IF e IS DISTINCT FROM '42501' THEN RAISE EXCEPTION 'FALHOU: anon lê consent_versions'; END IF;
  e := NULL;
  BEGIN PERFORM count(*) FROM public.consent_acceptances;
  EXCEPTION WHEN others THEN e := SQLSTATE; END;
  IF e IS DISTINCT FROM '42501' THEN RAISE EXCEPTION 'FALHOU: anon lê consent_acceptances'; END IF;
  e := NULL;
  BEGIN PERFORM count(*) FROM public.student_health_profiles;
  EXCEPTION WHEN others THEN e := SQLSTATE; END;
  IF e IS DISTINCT FROM '42501' THEN RAISE EXCEPTION 'FALHOU: anon lê student_health_profiles'; END IF;
  e := NULL;
  BEGIN INSERT INTO public.student_health_profiles (student_id) VALUES (current_setting('josi.aluno')::uuid);
  EXCEPTION WHEN others THEN e := SQLSTATE; END;
  IF e IS DISTINCT FROM '42501' THEN RAISE EXCEPTION 'FALHOU: anon gravou ficha de saúde'; END IF;
  e := NULL;
  BEGIN PERFORM public.accept_consent(current_setting('josi.v_cur')::uuid, 'pt', 'Anon');
  EXCEPTION WHEN others THEN e := SQLSTATE; END;
  IF e IS DISTINCT FROM '42501' THEN RAISE EXCEPTION 'FALHOU: anon chamou accept_consent'; END IF;
  e := NULL;
  BEGIN PERFORM public.register_paper_consent(current_setting('josi.aluno')::uuid,
          current_setting('josi.v_cur')::uuid, CURRENT_DATE, 'Anon');
  EXCEPTION WHEN others THEN e := SQLSTATE; END;
  IF e IS DISTINCT FROM '42501' THEN RAISE EXCEPTION 'FALHOU: anon chamou register_paper_consent'; END IF;
  e := NULL;
  BEGIN PERFORM count(*) FROM public.my_pending_consents();
  EXCEPTION WHEN others THEN e := SQLSTATE; END;
  IF e IS DISTINCT FROM '42501' THEN RAISE EXCEPTION 'FALHOU: anon chamou my_pending_consents'; END IF;
  e := NULL;
  BEGIN PERFORM count(*) FROM public.staff_consent_overview();
  EXCEPTION WHEN others THEN e := SQLSTATE; END;
  IF e IS DISTINCT FROM '42501' THEN RAISE EXCEPTION 'FALHOU: anon chamou staff_consent_overview'; END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 5. service_role (backup): só lê
-- ════════════════════════════════════════════════════════════════════════════
RESET ROLE;
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);

DO $$
DECLARE
  n int;
  e text;
BEGIN
  SELECT count(*) INTO n FROM public.consent_acceptances
  WHERE student_id IN (current_setting('josi.aluno')::uuid, current_setting('josi.aluno_b')::uuid);
  IF n <> 4 THEN RAISE EXCEPTION 'FALHOU: service_role não lê consent_acceptances (% de 4)', n; END IF;
  SELECT count(*) INTO n FROM public.student_health_profiles WHERE student_id = current_setting('josi.aluno_b')::uuid;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: service_role não lê student_health_profiles'; END IF;
  SELECT count(*) INTO n FROM public.consent_versions WHERE id = current_setting('josi.v_cur')::uuid;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: service_role não lê consent_versions'; END IF;
  e := NULL;
  BEGIN UPDATE public.student_health_profiles SET main_goal = 'x' WHERE student_id = current_setting('josi.aluno_b')::uuid;
  EXCEPTION WHEN others THEN e := SQLSTATE; END;
  IF e IS DISTINCT FROM '42501' THEN RAISE EXCEPTION 'FALHOU: service_role fez UPDATE em student_health_profiles'; END IF;
  e := NULL;
  BEGIN DELETE FROM public.consent_acceptances WHERE id = current_setting('josi.paper_id')::uuid;
  EXCEPTION WHEN others THEN e := SQLSTATE; END;
  IF e IS DISTINCT FROM '42501' THEN RAISE EXCEPTION 'FALHOU: service_role fez DELETE em consent_acceptances'; END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 6. postgres (SQL Editor): audit_log, versão aceita não se apaga
-- ════════════════════════════════════════════════════════════════════════════
RESET ROLE;
SELECT set_config('request.jwt.claims', '', true);

DO $$
DECLARE
  a uuid := current_setting('josi.aluno')::uuid;
  b uuid := current_setting('josi.aluno_b')::uuid;
  n int;
  e text;
BEGIN
  -- Papel: 1 linha, só ids.
  SELECT count(*) INTO n FROM public.audit_log
  WHERE action = 'consent.paper_register' AND target_id = b
    AND snapshot_data ->> 'acceptance_id' = current_setting('josi.paper_id')
    AND (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(snapshot_data) k)
        = ARRAY['acceptance_id', 'consent_version_id', 'student_id'];
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: audit_log tem % de 1 linha consent.paper_register (só ids)', n; END IF;

  -- Ficha apagada pela professora: 1 linha, só o id do aluno (nenhum dado de saúde).
  SELECT count(*) INTO n FROM public.audit_log
  WHERE action = 'health_profile.delete' AND target_id = a
    AND actor_id = current_setting('josi.professora')::uuid
    AND (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(snapshot_data) k) = ARRAY['student_id'];
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: audit_log tem % de 1 linha health_profile.delete (só student_id)', n; END IF;

  -- Versão já aceita não pode ser apagada.
  e := NULL;
  BEGIN DELETE FROM public.consent_versions WHERE id = current_setting('josi.v_cur')::uuid;
  EXCEPTION WHEN others THEN e := SQLSTATE; END;
  IF e IS DISTINCT FROM '23503' THEN RAISE EXCEPTION 'FALHOU: versão aceita foi apagada (FK não segurou)'; END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 7. "Apagar de vez" do aluno B como a Edge Function manage-student
--    (service_role, sem auth.uid()): aceites e ficha saem junto.
-- ════════════════════════════════════════════════════════════════════════════
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);

DO $$
DECLARE
  b uuid := current_setting('josi.aluno_b')::uuid;
  v_tbl text;
BEGIN
  -- Mesma ordem da Edge Function: tabelas sem CASCADE primeiro, depois o perfil.
  FOREACH v_tbl IN ARRAY ARRAY['student_class_link', 'check_ins', 'balance_history', 'email_notifications'] LOOP
    IF to_regclass('public.' || v_tbl) IS NOT NULL THEN
      EXECUTE format('DELETE FROM public.%I WHERE student_id = $1', v_tbl) USING b;
    END IF;
  END LOOP;
  DELETE FROM public.profiles WHERE id = b;
  PERFORM set_config('josi.cascata_testada', 'sim', true);
EXCEPTION WHEN others THEN
  IF SQLERRM LIKE '%consent_%' OR SQLERRM LIKE '%health_profile%' OR SQLERRM LIKE '%audit_log%' THEN
    RAISE EXCEPTION 'FALHOU: as tabelas novas impediram apagar o aluno de vez (%)', SQLERRM;
  END IF;
  -- Outra tabela do banco impediu (não é desta migration): a estrutura do
  -- CASCADE já foi conferida na seção 0.
  RAISE NOTICE 'Aviso: "apagar de vez" não testado com DELETE real (outra coisa impediu: %). FK CASCADE conferida na seção 0.', SQLERRM;
  PERFORM set_config('josi.cascata_testada', 'nao', true);
END $$;

RESET ROLE;
SELECT set_config('request.jwt.claims', '', true);

DO $$
DECLARE
  a uuid := current_setting('josi.aluno')::uuid;
  b uuid := current_setting('josi.aluno_b')::uuid;
  n int;
BEGIN
  IF current_setting('josi.cascata_testada', true) = 'sim' THEN
    SELECT count(*) INTO n FROM public.consent_acceptances WHERE student_id = b;
    IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: aceites do aluno apagado não saíram em cascata'; END IF;
    SELECT count(*) INTO n FROM public.student_health_profiles WHERE student_id = b;
    IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: ficha do aluno apagado não saiu em cascata'; END IF;
    -- Os aceites do aluno A continuam.
    SELECT count(*) INTO n FROM public.consent_acceptances WHERE student_id = a;
    IF n <> 2 THEN RAISE EXCEPTION 'FALHOU: apagar o aluno B mexeu nos aceites do A (% de 2)', n; END IF;
    -- A cascata não gravou nada no audit_log (sem usuário logado).
    SELECT count(*) INTO n FROM public.audit_log WHERE action = 'health_profile.delete' AND target_id = b;
    IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: a cascata gravou health_profile.delete no audit_log'; END IF;
  END IF;
END $$;

ROLLBACK;
