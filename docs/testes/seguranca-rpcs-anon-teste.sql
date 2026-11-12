-- Teste — anônimo sem EXECUTE nas funções SECURITY DEFINER, sem SELECT em
-- email_stats, audit_log fechado e profiles sem TRUNCATE
--
-- Rodar no Supabase SQL Editor DEPOIS da migration
-- 20261112030000_revoke_anon_rpcs_and_views.sql.
--
-- Não precisa substituir nada: o script escolhe sozinho 1 aluno e a professora.
-- Colar o arquivo inteiro e rodar.
--
-- Tudo roda dentro de uma transação que termina em ROLLBACK: nada fica gravado.
-- Nenhum email é enviado: as funções de disparo só são chamadas como aluno e
-- anônimo, e o teste espera que sejam recusadas.
-- Resultado:
--   • Sucesso → "Success. No rows returned" (nenhum erro).
--   • Falha   → erro começando com "FALHOU: ..." dizendo o que falhou.

BEGIN;

DO $$
DECLARE
  a uuid; t uuid;
BEGIN
  SELECT id INTO a FROM public.profiles WHERE role = 'student' ORDER BY id LIMIT 1;
  SELECT id INTO t FROM public.profiles WHERE role = 'teacher' ORDER BY id LIMIT 1;
  IF a IS NULL OR t IS NULL THEN
    RAISE EXCEPTION 'Precisa de pelo menos 1 aluno e 1 professora em profiles.';
  END IF;
  PERFORM set_config('josi.aluno', a::text, true);
  PERFORM set_config('josi.professora', t::text, true);
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 0. PRIVILÉGIOS (catálogo)
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid, p.oid::regprocedure::text AS fn, p.proname::text AS nome,
           coalesce((SELECT bool_or(a.grantee = 0)
                     FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                     WHERE a.privilege_type = 'EXECUTE'), false) AS publico
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('get_attendance_report', 'get_low_credits_report', 'get_zero_credits_students',
                        'get_students_for_notification', 'get_email_notification_stats',
                        'log_email_notification', 'is_profile_complete',
                        'manual_trigger_notifications', 'trigger_email_notifications',
                        'schedule_email_notifications', 'handle_new_user',
                        'is_staff', 'update_class_balance', 'mark_attendance')
  LOOP
    IF has_function_privilege('anon', r.oid, 'EXECUTE') OR r.publico THEN
      RAISE EXCEPTION 'FALHOU: anônimo (ou PUBLIC) ainda executa %', r.fn;
    END IF;
    IF r.nome IN ('manual_trigger_notifications', 'trigger_email_notifications',
                  'schedule_email_notifications', 'handle_new_user')
       AND has_function_privilege('authenticated', r.oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'FALHOU: usuário logado ainda executa %', r.fn;
    END IF;
    IF r.nome IN ('get_attendance_report', 'get_low_credits_report', 'get_zero_credits_students',
                  'log_email_notification', 'is_staff', 'update_class_balance', 'mark_attendance')
       AND NOT has_function_privilege('authenticated', r.oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'FALHOU: a professora (authenticated) perdeu EXECUTE em %', r.fn;
    END IF;
  END LOOP;

  IF to_regclass('public.email_stats') IS NOT NULL THEN
    IF has_table_privilege('anon', 'public.email_stats', 'SELECT') THEN
      RAISE EXCEPTION 'FALHOU: anônimo ainda lê a view email_stats';
    END IF;
    IF has_table_privilege('authenticated', 'public.email_stats', 'INSERT,UPDATE,DELETE') THEN
      RAISE EXCEPTION 'FALHOU: authenticated ainda grava pela view email_stats';
    END IF;
    IF NOT has_table_privilege('authenticated', 'public.email_stats', 'SELECT') THEN
      RAISE EXCEPTION 'FALHOU: authenticated perdeu SELECT na view email_stats';
    END IF;
  END IF;

  IF to_regclass('public.audit_log') IS NOT NULL THEN
    IF has_table_privilege('anon', 'public.audit_log', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') THEN
      RAISE EXCEPTION 'FALHOU: anônimo ainda tem privilégio em audit_log';
    END IF;
    IF has_table_privilege('authenticated', 'public.audit_log', 'INSERT,UPDATE,DELETE,TRUNCATE') THEN
      RAISE EXCEPTION 'FALHOU: authenticated ainda pode gravar/truncar audit_log';
    END IF;
    IF NOT has_table_privilege('service_role', 'public.audit_log', 'INSERT') THEN
      RAISE EXCEPTION 'FALHOU: service_role (Edge Function manage-student) perdeu INSERT em audit_log';
    END IF;
  END IF;

  IF has_table_privilege('anon', 'public.profiles', 'TRUNCATE')
     OR has_table_privilege('authenticated', 'public.profiles', 'TRUNCATE') THEN
    RAISE EXCEPTION 'FALHOU: anon/authenticated ainda têm TRUNCATE em profiles';
  END IF;
  IF NOT has_table_privilege('authenticated', 'public.profiles', 'SELECT,UPDATE') THEN
    RAISE EXCEPTION 'FALHOU: authenticated perdeu SELECT/UPDATE em profiles';
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 1. ANÔNIMO (sem login, chave anon do site)
-- ════════════════════════════════════════════════════════════════════════════
SET LOCAL ROLE anon;
SET LOCAL request.jwt.claims = '{"role":"anon"}';

DO $$
DECLARE
  n int;
BEGIN
  IF to_regprocedure('public.get_zero_credits_students()') IS NOT NULL THEN
    BEGIN
      PERFORM * FROM public.get_zero_credits_students();
      RAISE EXCEPTION 'FALHOU: anônimo chamou get_zero_credits_students';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
  END IF;
  BEGIN
    EXECUTE 'SELECT count(*) FROM public.get_low_credits_report(total_threshold => 2)' INTO n;
    RAISE EXCEPTION 'FALHOU: anônimo chamou get_low_credits_report';
  EXCEPTION WHEN insufficient_privilege OR undefined_function THEN NULL;
  END;
  IF to_regprocedure('public.trigger_email_notifications(character varying)') IS NOT NULL THEN
    BEGIN
      EXECUTE $q$SELECT public.trigger_email_notifications('low_credits')$q$;
      RAISE EXCEPTION 'FALHOU: anônimo disparou trigger_email_notifications';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
  END IF;
  IF to_regclass('public.email_stats') IS NOT NULL THEN
    BEGIN
      EXECUTE 'SELECT count(*) FROM public.email_stats' INTO n;
      RAISE EXCEPTION 'FALHOU: anônimo leu email_stats';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
  END IF;
  IF to_regclass('public.audit_log') IS NOT NULL THEN
    BEGIN
      EXECUTE 'SELECT count(*) FROM public.audit_log' INTO n;
      RAISE EXCEPTION 'FALHOU: anônimo leu audit_log';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
  END IF;
END $$;

RESET ROLE;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. ALUNO
-- ════════════════════════════════════════════════════════════════════════════
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  json_build_object('sub', current_setting('josi.aluno'), 'role', 'authenticated')::text, true);

DO $$
DECLARE
  n int;
BEGIN
  -- Não dispara envio de emails
  IF to_regprocedure('public.trigger_email_notifications(character varying)') IS NOT NULL THEN
    BEGIN
      EXECUTE $q$SELECT public.trigger_email_notifications('low_credits')$q$;
      RAISE EXCEPTION 'FALHOU: aluno disparou trigger_email_notifications';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
  END IF;
  IF to_regprocedure('public.schedule_email_notifications()') IS NOT NULL THEN
    BEGIN
      EXECUTE 'SELECT public.schedule_email_notifications()';
      RAISE EXCEPTION 'FALHOU: aluno chamou schedule_email_notifications';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
  END IF;
  -- Não lê o log de auditoria (policy só da professora)
  IF to_regclass('public.audit_log') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.audit_log' INTO n;
    IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: aluno lê audit_log'; END IF;
  END IF;
END $$;

RESET ROLE;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. PROFESSORA: relatórios do site continuam funcionando
-- ════════════════════════════════════════════════════════════════════════════
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  json_build_object('sub', current_setting('josi.professora'), 'role', 'authenticated')::text, true);

DO $$
DECLARE
  n int;
BEGIN
  -- lowCreditsReport.jsx (mesmas chamadas do site)
  EXECUTE 'SELECT count(*) FROM public.get_low_credits_report(total_threshold => 2)' INTO n;
  EXECUTE 'SELECT count(*) FROM public.get_zero_credits_students()' INTO n;
  -- AttendanceReport.jsx
  IF to_regprocedure('public.get_attendance_report(date,date,uuid)') IS NOT NULL THEN
    SELECT count(*) INTO n FROM public.get_attendance_report(DATE '2000-01-01', DATE '2100-01-01', NULL);
  END IF;
  -- Estatísticas de email e log de auditoria (leitura)
  IF to_regclass('public.email_stats') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.email_stats' INTO n;
  END IF;
  IF to_regclass('public.audit_log') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.audit_log' INTO n;
  END IF;
  -- Edição de perfil continua (UPDATE em profiles não depende de TRUNCATE)
  UPDATE public.profiles SET observations = observations
  WHERE id = current_setting('josi.aluno')::uuid;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: professora não editou o perfil do aluno'; END IF;
END $$;

RESET ROLE;

ROLLBACK;
