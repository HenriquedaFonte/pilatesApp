-- Migration: relatórios, notificações e is_profile_complete passam a exigir
-- professora (is_staff()) — aluno logado deixa de chamá-las pela API.
--
-- DEPENDE de 20261112010000 (is_staff()) e de 20261112030000 (anon já sem
-- EXECUTE). Se is_staff() não existir, para logo no início e nada é aplicado.
--
-- Estado de PRODUÇÃO antes desta migration (2026-11-12):
--   • get_attendance_report, get_low_credits_report, get_zero_credits_students,
--     get_students_for_notification, get_email_notification_stats,
--     log_email_notification e is_profile_complete são SECURITY DEFINER, sem
--     search_path fixo e sem conferir quem chama. Qualquer aluno logado
--     consegue, pela API, baixar nome, email e créditos de todos os alunos e
--     gravar linhas no log de emails.
--   • Os corpos de produção não estão no repositório.
--
-- Quem chama (levantado em src/, supabase/functions/ e scripts/):
--   • get_attendance_report (AttendanceReport.jsx), get_low_credits_report e
--     get_zero_credits_students (lowCreditsReport.jsx), log_email_notification
--     (EmailNotifications.jsx): só telas da professora
--     (ProtectedRoute requireRole="teacher"), papel authenticated.
--   • get_students_for_notification, get_email_notification_stats,
--     is_profile_complete: nenhum código do site nem Edge Function chama.
--     Podem ser chamadas por outras funções de email (trigger_email_notifications
--     etc.), que rodam pelo pg_cron como postgres — sem JWT, continuam liberadas.
--   • Nenhuma Edge Function chama RPC.
--
-- O que esta migration faz — sem reescrever o corpo de nenhuma função (o
-- mesmo padrão de update_class_balance/mark_attendance na 20261112010000):
--   1. public.assert_staff_caller(nome, p_self): confere quem chama.
--      Liberado: sem JWT (pg_cron, SQL Editor, postgres), service_role,
--      professora/admin (is_staff()) e, só quando p_self é passado, o próprio
--      usuário (p_self = auth.uid()). Senão: erro 42501.
--      Sem EXECUTE para nenhum papel da API (só o dono, que é quem roda os
--      invólucros SECURITY DEFINER).
--   2. Para cada função da lista, em TODAS as versões/assinaturas existentes:
--        • a original é renomeada para <nome>_impl, ganha search_path = public
--          e perde EXECUTE de PUBLIC, anon, authenticated e service_role;
--        • no lugar entra um invólucro com o MESMO nome, argumentos, defaults e
--          tipo de retorno (lidos do catálogo), SECURITY DEFINER,
--          SET search_path = public, que chama assert_staff_caller e depois a
--          _impl com os mesmos argumentos. A lógica fica exatamente igual.
--        • EXECUTE do invólucro: só authenticated e service_role.
--   3. is_profile_complete: se o primeiro argumento for uuid (o id do perfil),
--      a regra é "professora OU o próprio usuário" (p_self = $1). Assim um
--      eventual trigger/função que a chame para o perfil de quem está editando
--      não quebra. Se não tiver argumento uuid, só professora.
--   4. log_email_notification: professora (EmailNotifications.jsx),
--      service_role e pg_cron/postgres continuam; aluno não grava mais.
--
-- Proteções:
--   • Se algum objeto depender da função original pelo OID (policy, view,
--     default, constraint, função BEGIN ATOMIC), a migration PARA sem aplicar
--     nada: renomear faria esse objeto chamar a _impl, sem EXECUTE.
--   • Funções de trigger, agregadas ou procedures com esses nomes: PARA.
--   • Funções que não existirem são puladas.
--
-- Rodar no Supabase SQL Editor de uma vez. Está dentro de BEGIN/COMMIT: se
-- algo falhar, nada é aplicado. Idempotente: pode rodar de novo (na 2ª vez
-- só recria os invólucros iguais e reaplica os privilégios).
-- Não altera nem apaga dados.
--
-- VERIFICAÇÃO: docs/testes/seguranca-rpcs-staff-teste.sql
-- REVERSÃO:    docs/testes/seguranca-rpcs-staff-reversao.sql

BEGIN;

-- ─── 0. Pré-condições ───────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regprocedure('public.is_staff()') IS NULL THEN
    RAISE EXCEPTION 'public.is_staff() não existe. Rode antes a migration 20261112010000. Nada foi aplicado.';
  END IF;
  IF to_regprocedure('auth.role()') IS NULL OR to_regprocedure('auth.uid()') IS NULL THEN
    RAISE EXCEPTION 'auth.role()/auth.uid() não existem. Nada foi aplicado.';
  END IF;
END $$;

-- ─── 1. Quem pode chamar ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.assert_staff_caller(p_function text, p_self uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_role text := auth.role();
BEGIN
  -- Sem JWT (pg_cron, SQL Editor, psql como postgres) ou service_role (Edge
  -- Functions, backup): liberado.
  IF v_role IS NULL OR v_role = 'service_role' THEN
    RETURN;
  END IF;
  -- O próprio usuário, quando a função recebe o id dele.
  IF p_self IS NOT NULL AND p_self = auth.uid() THEN
    RETURN;
  END IF;
  IF public.is_staff() THEN
    RETURN;
  END IF;
  RAISE EXCEPTION 'permission denied: only the teacher can call %', p_function
    USING ERRCODE = '42501';
END;
$$;
COMMENT ON FUNCTION public.assert_staff_caller(text, uuid) IS
  'josi-pilates: confere quem chama os invólucros de relatórios/notificações (sem JWT, service_role, staff ou o próprio usuário).';
REVOKE ALL ON FUNCTION public.assert_staff_caller(text, uuid) FROM PUBLIC, anon, authenticated, service_role;

-- ─── 2. Invólucros ──────────────────────────────────────────────────────────
DO $$
DECLARE
  c_names constant text[] := ARRAY[
    'get_attendance_report', 'get_low_credits_report', 'get_zero_credits_students',
    'get_students_for_notification', 'get_email_notification_stats',
    'log_email_notification', 'is_profile_complete'
  ];
  c_marker constant text := 'josi-pilates: invólucro';
  v_oids oid[];
  v_oid oid;
  p record;
  d record;
  v_base text;
  v_types text;
  v_wrapper regprocedure;
  v_call text;
  v_self text;
  v_query text;
  v_vol text;
  v_extra text;
  i int;
BEGIN
  -- 2a. Originais (ainda não envolvidas): conferências e renomeação.
  SELECT coalesce(array_agg(pr.oid), '{}') INTO v_oids
  FROM pg_proc pr
  JOIN pg_namespace n ON n.oid = pr.pronamespace
  WHERE n.nspname = 'public'
    AND pr.proname = ANY (c_names)
    AND coalesce(obj_description(pr.oid, 'pg_proc'), '') NOT LIKE c_marker || '%';

  FOREACH v_oid IN ARRAY v_oids LOOP
    SELECT pr.oid, pr.proname::text AS proname, pr.prokind, pr.prorettype,
           oidvectortypes(pr.proargtypes) AS types
      INTO p
    FROM pg_proc pr WHERE pr.oid = v_oid;

    IF p.prokind <> 'f' OR p.prorettype IN ('trigger'::regtype, 'event_trigger'::regtype) THEN
      RAISE EXCEPTION 'public.%(%) não é uma função comum (procedure, agregada ou de trigger). Nada foi aplicado.',
        p.proname, p.types;
    END IF;

    FOR d IN
      SELECT pg_describe_object(dp.classid, dp.objid, dp.objsubid) AS obj
      FROM pg_depend dp
      WHERE dp.refclassid = 'pg_proc'::regclass AND dp.refobjid = v_oid
    LOOP
      RAISE EXCEPTION '% depende de public.%(%). Renomear quebraria esse objeto. Nada foi aplicado.',
        d.obj, p.proname, p.types;
    END LOOP;

    IF to_regprocedure(format('public.%I(%s)', p.proname || '_impl', p.types)) IS NOT NULL THEN
      RAISE EXCEPTION 'public.%(%) já existe ao lado de public.%(%) sem ser invólucro. Estado inesperado; nada foi aplicado.',
        p.proname || '_impl', p.types, p.proname, p.types;
    END IF;

    EXECUTE format('ALTER FUNCTION %s RENAME TO %I', v_oid::regprocedure, p.proname || '_impl');
  END LOOP;

  -- 2b. Para cada _impl: fecha o acesso e (re)cria o invólucro.
  SELECT coalesce(array_agg(pr.oid), '{}') INTO v_oids
  FROM pg_proc pr
  JOIN pg_namespace n ON n.oid = pr.pronamespace
  WHERE n.nspname = 'public'
    AND pr.proname IN (SELECT x || '_impl' FROM unnest(c_names) AS x);

  FOREACH v_oid IN ARRAY v_oids LOOP
    SELECT pr.oid, pr.proname::text AS proname, pr.prokind, pr.prorettype, pr.proretset,
           pr.provolatile, pr.proisstrict, pr.prorows, pr.pronargs, pr.provariadic,
           pr.proargtypes, oidvectortypes(pr.proargtypes) AS types,
           pg_get_function_arguments(pr.oid) AS args,
           pg_get_function_result(pr.oid) AS result,
           t.typtype
      INTO p
    FROM pg_proc pr
    JOIN pg_type t ON t.oid = pr.prorettype
    WHERE pr.oid = v_oid;

    v_base := left(p.proname, length(p.proname) - length('_impl'));

    IF p.prokind <> 'f' OR p.prorettype IN ('trigger'::regtype, 'event_trigger'::regtype) THEN
      RAISE EXCEPTION 'public.%(%) não é uma função comum. Nada foi aplicado.', p.proname, p.types;
    END IF;

    -- A original: sem EXECUTE para a API; search_path fixo.
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', v_oid::regprocedure);
    EXECUTE format('ALTER FUNCTION %s SET search_path = public', v_oid::regprocedure);
    IF NOT has_function_privilege(current_user, v_oid, 'EXECUTE') THEN
      RAISE EXCEPTION '% não consegue executar %; rode a migration como o dono das funções (postgres). Nada foi aplicado.',
        current_user, v_oid::regprocedure;
    END IF;

    -- Argumentos da chamada: $1..$n (VARIADIC no último, se for o caso).
    v_call := '';
    FOR i IN 1 .. p.pronargs LOOP
      v_call := v_call
        || CASE WHEN i > 1 THEN ', ' ELSE '' END
        || CASE WHEN i = p.pronargs AND p.provariadic <> 0 THEN 'VARIADIC ' ELSE '' END
        || '$' || i;
    END LOOP;

    -- is_profile_complete(uuid, ...): professora OU o próprio usuário.
    v_self := 'NULL::uuid';
    IF v_base = 'is_profile_complete' AND p.pronargs >= 1 AND p.proargtypes[0] = 'uuid'::regtype THEN
      v_self := '$1';
    END IF;

    IF p.proretset OR p.typtype = 'c' OR p.prorettype = 'record'::regtype THEN
      v_query := format('SELECT * FROM public.%I(%s);', p.proname, v_call);
    ELSE
      v_query := format('SELECT public.%I(%s);', p.proname, v_call);
    END IF;

    -- Nunca IMMUTABLE: o resultado depende de quem chama.
    v_vol := CASE p.provolatile WHEN 'v' THEN 'VOLATILE' ELSE 'STABLE' END;
    v_extra := CASE WHEN p.proisstrict THEN ' STRICT' ELSE '' END
            || CASE WHEN p.proretset AND p.prorows > 0 THEN ' ROWS ' || p.prorows ELSE '' END;

    EXECUTE format(
      'CREATE OR REPLACE FUNCTION public.%I(%s) RETURNS %s LANGUAGE sql %s%s SECURITY DEFINER SET search_path = public AS %L',
      v_base, p.args, p.result, v_vol, v_extra,
      format(E'SELECT public.assert_staff_caller(%L, %s);\n%s', v_base, v_self, v_query)
    );

    v_wrapper := to_regprocedure(format('public.%I(%s)', v_base, p.types));
    EXECUTE format('COMMENT ON FUNCTION %s IS %L', v_wrapper,
      c_marker || ': exige professora (assert_staff_caller) e chama public.' || p.proname || ' sem mudar a lógica.');
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', v_wrapper);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', v_wrapper);
  END LOOP;

  -- 2c. Conferência final: nenhuma função da lista ficou sem invólucro.
  FOR p IN
    SELECT pr.oid::regprocedure AS fn
    FROM pg_proc pr
    JOIN pg_namespace n ON n.oid = pr.pronamespace
    WHERE n.nspname = 'public'
      AND pr.proname = ANY (c_names)
      AND (NOT pr.prosecdef
           OR coalesce(obj_description(pr.oid, 'pg_proc'), '') NOT LIKE c_marker || '%'
           OR has_function_privilege('anon', pr.oid, 'EXECUTE'))
  LOOP
    RAISE EXCEPTION '% ficou sem invólucro. Nada foi aplicado.', p.fn;
  END LOOP;
END $$;

COMMIT;
