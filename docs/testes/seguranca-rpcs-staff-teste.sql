-- Teste — relatórios, notificações e is_profile_complete só para professora
--
-- Rodar no Supabase SQL Editor DEPOIS da migration
-- 20261112040000_require_staff_in_report_rpcs.sql.
--
-- Não precisa substituir nada: o script escolhe sozinho 2 alunos e a professora.
-- Colar o arquivo inteiro e rodar.
--
-- Tudo roda dentro de uma transação que termina em ROLLBACK: nada fica gravado
-- (a linha de teste em email_notifications some). Nenhum email é enviado.
-- Resultado:
--   • Sucesso → "Success. No rows returned" (nenhum erro).
--   • Falha   → erro começando com "FALHOU: ..." dizendo o que falhou.
--
-- O que confere, para cada versão de get_attendance_report,
-- get_low_credits_report, get_zero_credits_students,
-- get_students_for_notification, get_email_notification_stats,
-- log_email_notification e is_profile_complete:
--   0. catálogo: invólucro SECURITY DEFINER com search_path=public; a _impl
--      sem EXECUTE para anon/authenticated/service_role; anon sem EXECUTE no
--      invólucro; assert_staff_caller sem EXECUTE para a API.
--   1. anônimo: recusado.
--   2. aluno: recusado (is_profile_complete com o próprio id: liberado; com o
--      id de outro aluno: recusado).
--   3. professora: funciona.
--   4. service_role (Edge Functions): funciona.
--   5. sem JWT (pg_cron / SQL Editor): funciona.

BEGIN;

DO $$
DECLARE
  a uuid; b uuid; t uuid;
BEGIN
  SELECT id INTO a FROM public.profiles WHERE role = 'student' ORDER BY id LIMIT 1;
  SELECT id INTO b FROM public.profiles WHERE role = 'student' AND id <> a ORDER BY id LIMIT 1;
  SELECT id INTO t FROM public.profiles WHERE role = 'teacher' ORDER BY id LIMIT 1;
  IF a IS NULL OR b IS NULL OR t IS NULL THEN
    RAISE EXCEPTION 'Precisa de pelo menos 2 alunos e 1 professora em profiles.';
  END IF;
  PERFORM set_config('josi.aluno', a::text, true);
  PERFORM set_config('josi.aluno_b', b::text, true);
  PERFORM set_config('josi.professora', t::text, true);
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 0. CATÁLOGO
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  r record;
  n int := 0;
BEGIN
  FOR r IN
    SELECT p.oid, p.oid::regprocedure::text AS fn, p.prosecdef, p.proconfig,
           coalesce(obj_description(p.oid, 'pg_proc'), '') AS comentario,
           to_regprocedure(format('public.%I(%s)', p.proname || '_impl', oidvectortypes(p.proargtypes))) AS impl
    FROM pg_proc p
    JOIN pg_namespace ns ON ns.oid = p.pronamespace
    WHERE ns.nspname = 'public'
      AND p.proname IN ('get_attendance_report', 'get_low_credits_report', 'get_zero_credits_students',
                        'get_students_for_notification', 'get_email_notification_stats',
                        'log_email_notification', 'is_profile_complete')
  LOOP
    n := n + 1;
    IF r.comentario NOT LIKE 'josi-pilates: invólucro%' OR r.impl IS NULL THEN
      RAISE EXCEPTION 'FALHOU: % não é invólucro (a migration 20261112040000 rodou?)', r.fn;
    END IF;
    IF NOT r.prosecdef OR NOT ('search_path=public' = ANY (coalesce(r.proconfig, '{}'))) THEN
      RAISE EXCEPTION 'FALHOU: % sem SECURITY DEFINER ou sem search_path=public', r.fn;
    END IF;
    IF has_function_privilege('anon', r.oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'FALHOU: anônimo executa %', r.fn;
    END IF;
    IF NOT has_function_privilege('authenticated', r.oid, 'EXECUTE')
       OR NOT has_function_privilege('service_role', r.oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'FALHOU: authenticated/service_role perderam EXECUTE em %', r.fn;
    END IF;
    IF has_function_privilege('anon', r.impl, 'EXECUTE')
       OR has_function_privilege('authenticated', r.impl, 'EXECUTE')
       OR has_function_privilege('service_role', r.impl, 'EXECUTE') THEN
      RAISE EXCEPTION 'FALHOU: a API ainda executa a original %', r.impl;
    END IF;
    IF NOT ('search_path=public' = ANY (coalesce((SELECT proconfig FROM pg_proc WHERE oid = r.impl), '{}'))) THEN
      RAISE EXCEPTION 'FALHOU: % sem search_path=public', r.impl;
    END IF;
  END LOOP;
  IF n = 0 THEN
    RAISE EXCEPTION 'FALHOU: nenhuma das funções encontrada';
  END IF;
  IF has_function_privilege('authenticated', 'public.assert_staff_caller(text,uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.assert_staff_caller(text,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FALHOU: a API executa assert_staff_caller';
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 1–5. CHAMADAS COMO CADA PAPEL
-- Cada função é chamada com argumentos de exemplo (uuid = id do aluno A,
-- date = hoje, número = 2, texto = 'low_credits'). log_email_notification é
-- chamada como no site (EmailNotifications.jsx).
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  c_aluno    constant uuid := current_setting('josi.aluno')::uuid;
  c_aluno_b  constant uuid := current_setting('josi.aluno_b')::uuid;
  c_prof     constant uuid := current_setting('josi.professora')::uuid;
  v_caso     record;
  r          record;
  v_args     text;
  v_sql      text;
  v_t        oid;
  v_ok       boolean;
  v_err      text;
  v_esperado text;
  i          int;
  n          bigint;
BEGIN
  FOR v_caso IN
    SELECT * FROM (VALUES
      (1, 'anônimo',      'anon',          '{"role":"anon"}'::text,                                          'recusa'),
      (2, 'aluno',        'authenticated', json_build_object('sub', c_aluno, 'role', 'authenticated')::text, 'recusa'),
      (3, 'professora',   'authenticated', json_build_object('sub', c_prof,  'role', 'authenticated')::text, 'aceita'),
      (4, 'service_role', 'service_role',  '{"role":"service_role"}',                                        'aceita'),
      (5, 'sem JWT',      NULL,            '',                                                               'aceita')
    ) AS x(ordem, nome, papel, claims, esperado)
    ORDER BY ordem
  LOOP
    FOR r IN
      SELECT p.oid, p.proname::text AS proname, p.pronargs, p.proargtypes,
             p.oid::regprocedure::text AS fn
      FROM pg_proc p
      JOIN pg_namespace ns ON ns.oid = p.pronamespace
      WHERE ns.nspname = 'public'
        AND p.proname IN ('get_attendance_report', 'get_low_credits_report', 'get_zero_credits_students',
                          'get_students_for_notification', 'get_email_notification_stats',
                          'log_email_notification', 'is_profile_complete')
      ORDER BY 1
    LOOP
      -- Monta a chamada
      IF r.proname = 'log_email_notification' AND r.pronargs >= 5 THEN
        v_args := format('p_student_id => %L::uuid, p_email_type => %L, p_recipient_email => %L, '
                         'p_subject => %L, p_status => %L',
                         c_aluno, 'low_credits', 'teste@example.com', 'TESTE (rollback)', 'sent');
      ELSE
        v_args := '';
        FOR i IN 0 .. r.pronargs - 1 LOOP
          v_t := r.proargtypes[i];
          v_args := v_args || CASE WHEN i > 0 THEN ', ' ELSE '' END || CASE
            WHEN v_t = 'uuid'::regtype THEN quote_literal(c_aluno) || '::uuid'
            WHEN v_t = 'date'::regtype THEN 'current_date'
            WHEN v_t IN ('integer'::regtype, 'bigint'::regtype, 'smallint'::regtype, 'numeric'::regtype)
              THEN '2::' || format_type(v_t, NULL)
            WHEN v_t IN ('text'::regtype, 'character varying'::regtype) THEN '''low_credits''::' || format_type(v_t, NULL)
            WHEN v_t = 'boolean'::regtype THEN 'false'
            WHEN v_t IN ('timestamp with time zone'::regtype, 'timestamp without time zone'::regtype)
              THEN 'now()::' || format_type(v_t, NULL)
            WHEN v_t IN ('jsonb'::regtype, 'json'::regtype) THEN '''{}''::' || format_type(v_t, NULL)
            ELSE 'NULL::' || format_type(v_t, NULL)
          END;
        END LOOP;
      END IF;
      v_sql := format('SELECT count(*) FROM (SELECT public.%I(%s)) s', r.proname, v_args);

      -- Aluno chamando is_profile_complete com o próprio id: liberado.
      v_esperado := v_caso.esperado;
      IF v_caso.nome = 'aluno' AND r.proname = 'is_profile_complete'
         AND r.pronargs >= 1 AND r.proargtypes[0] = 'uuid'::regtype THEN
        v_esperado := 'aceita';
      END IF;

      -- Executa como o papel do caso
      IF v_caso.papel IS NOT NULL THEN
        EXECUTE format('SET LOCAL ROLE %I', v_caso.papel);
      END IF;
      PERFORM set_config('request.jwt.claims', v_caso.claims, true);
      v_err := NULL;
      BEGIN
        EXECUTE v_sql INTO n;
        v_ok := true;
      EXCEPTION
        WHEN insufficient_privilege THEN v_ok := false;
        WHEN OTHERS THEN v_ok := NULL; v_err := SQLSTATE || ' ' || SQLERRM;
      END;
      RESET ROLE;
      PERFORM set_config('request.jwt.claims', '', true);

      -- Defeito antigo de produção (anterior à migration): o corpo de
      -- get_students_for_notification devolve preferred_language como varchar
      -- e a função declara text (42804). O erro vem de dentro da _impl, ou seja,
      -- a chamada já passou pela checagem de quem chama: conta como "aceita".
      IF v_ok IS NULL AND r.proname = 'get_students_for_notification' AND v_err LIKE '42804 %' THEN
        RAISE NOTICE 'AVISO: % passou pela checagem como %, mas a função original tem o defeito antigo de tipo (preferred_language varchar). Ver docs/PENDENCIAS.md.', r.fn, v_caso.nome;
        v_ok := true;
      END IF;

      IF v_ok IS NULL THEN
        RAISE EXCEPTION 'FALHOU: % chamando % deu erro inesperado: %', v_caso.nome, r.fn, v_err;
      ELSIF v_esperado = 'recusa' AND v_ok THEN
        RAISE EXCEPTION 'FALHOU: % conseguiu chamar %', v_caso.nome, r.fn;
      ELSIF v_esperado = 'aceita' AND NOT v_ok THEN
        RAISE EXCEPTION 'FALHOU: % foi recusado(a) em %', v_caso.nome, r.fn;
      END IF;

      -- Aluno: is_profile_complete com o id de OUTRO aluno é recusado.
      IF v_caso.nome = 'aluno' AND r.proname = 'is_profile_complete'
         AND r.pronargs >= 1 AND r.proargtypes[0] = 'uuid'::regtype THEN
        EXECUTE 'SET LOCAL ROLE authenticated';
        PERFORM set_config('request.jwt.claims', v_caso.claims, true);
        BEGIN
          EXECUTE replace(v_sql, quote_literal(c_aluno), quote_literal(c_aluno_b)) INTO n;
          v_ok := true;
        EXCEPTION WHEN insufficient_privilege THEN v_ok := false;
        END;
        RESET ROLE;
        PERFORM set_config('request.jwt.claims', '', true);
        IF v_ok THEN
          RAISE EXCEPTION 'FALHOU: aluno chamou % para outro aluno', r.fn;
        END IF;
      END IF;
    END LOOP;
  END LOOP;
END $$;

ROLLBACK;
