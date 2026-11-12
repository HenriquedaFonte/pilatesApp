-- Migration: limpeza dos emails automáticos
--   1. corrige get_students_for_notification (erro 42804 em produção);
--   2. apaga os jobs do pg_cron que só fazem SELECT
--      (low-credits-report-daily, send-low-credits-notifications-daily);
--   3. apaga as funções antigas de disparo que mais ninguém usa
--      (manual_trigger_notifications, trigger_email_notifications,
--      schedule_email_notifications — só as que sobrarem sem uso).
--
-- Pode rodar ANTES ou DEPOIS da 20261112040000 (invólucros dos relatórios):
--   • depois dela: corrige public.get_students_for_notification_impl (o
--     invólucro não muda);
--   • antes dela: corrige public.get_students_for_notification; quando a
--     040000 rodar, ela renomeia essa função (já corrigida) para _impl.
--
-- CAUSA DO DEFEITO (reproduzida em Postgres 16 local com o corpo do
-- repositório, notification_functions.sql): a função declara
-- preferred_language como text, mas profiles.preferred_language é varchar.
-- Em plpgsql, RETURN QUERY exige tipos idênticos, então TODA chamada falha
-- com "42804 structure of query does not match function result type —
-- Returned type character varying does not match expected type text in
-- column 8", mesmo sem linhas. Correção: COALESCE(p.preferred_language,
-- 'pt')::text. Só essa expressão muda; o resto do corpo de produção fica
-- exatamente igual (o corpo é lido do banco, não do repositório).
--
-- SUPOSIÇÃO: o corpo de produção contém COALESCE(<x>.preferred_language,
-- 'pt') como o do repositório. Se não contiver, a migration PARA sem
-- aplicar nada. Depois de corrigir, ela chama a função com 'low_credits' e
-- 'zero_credits' (só leitura); se ainda der erro, PARA sem aplicar nada.
--
-- Funções de disparo: cada uma só é apagada se NADA que fica a cita ou
-- depende dela — jobs do pg_cron que ficam (inclusive inativos), outras
-- funções de qualquer schema, triggers, event triggers, policies, views ou
-- defaults (pg_depend). As que ainda forem usadas ficam (NOTICE no fim) e
-- viram pendência. O site, as Edge Functions do repositório e o backup não
-- chamam nenhuma delas (levantado em src/, supabase/functions/, scripts/ e
-- .github/).
--
-- PARA sem aplicar nada se:
--   • o comando de um job a remover fizer algo além de SELECT (net.http,
--     INSERT/UPDATE/DELETE, cron.schedule) ou chamar uma função de disparo;
--   • algo automático que FICA (job ativo do pg_cron, trigger, event
--     trigger) chegar (direto ou por outras funções) a
--     get_students_for_notification: corrigir a função mudaria o que ele faz
--     (hoje falha; corrigido, poderia passar a enviar emails) — decisão do
--     usuário antes;
--   • a correção não se aplicar como esperado (ver SUPOSIÇÃO).
--
-- CÓPIA DE SEGURANÇA: antes de mudar/apagar, guarda a definição exata de
-- cada função (pg_get_functiondef + GRANTs) e de cada job (cron.schedule)
-- em josi_backup.email_cleanup_20261112 (schema fora da API: nenhum papel
-- da API tem acesso). REVERSÃO: docs/testes/emails-limpeza-reversao.sql.
--
-- Rodar no Supabase SQL Editor de uma vez (como postgres). Está dentro de
-- BEGIN/COMMIT: se algo falhar, nada é aplicado. Idempotente: pode rodar de
-- novo. Não altera nem apaga dados de alunos.
--
-- ANTES: docs/testes/emails-limpeza-diagnostico.sql (guardar o resultado).

BEGIN;

-- ─── 0. Cópia de segurança (fora da API) ───────────────────────────────────
CREATE SCHEMA IF NOT EXISTS josi_backup;
REVOKE ALL ON SCHEMA josi_backup FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS josi_backup.email_cleanup_20261112 (
  kind       text        NOT NULL,  -- 'cron' | 'funcao_apagada' | 'funcao_corrigida'
  name       text        NOT NULL,  -- jobname ou assinatura da função
  definition text        NOT NULL,  -- SQL para recriar
  grants     text,                  -- SQL dos privilégios (funções) / estado (jobs)
  saved_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (kind, name)
);
REVOKE ALL ON TABLE josi_backup.email_cleanup_20261112 FROM PUBLIC, anon, authenticated, service_role;

-- SQL que recria os privilégios atuais de uma função.
CREATE OR REPLACE FUNCTION josi_backup.function_grants_sql(p_oid oid)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = pg_catalog
AS $$
  SELECT format('REVOKE ALL ON FUNCTION %s FROM PUBLIC;', p_oid::regprocedure)
         || coalesce(' ' || string_agg(
              format('GRANT EXECUTE ON FUNCTION %s TO %s;', p_oid::regprocedure,
                     CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(a.grantee)) END),
              ' ' ORDER BY a.grantee) FILTER (WHERE a.grantee IS NOT NULL), '')
  FROM pg_proc pr
  LEFT JOIN LATERAL aclexplode(coalesce(pr.proacl, acldefault('f', pr.proowner))) a
    ON a.privilege_type = 'EXECUTE' AND a.grantee <> pr.proowner
  WHERE pr.oid = p_oid
$$;
REVOKE ALL ON FUNCTION josi_backup.function_grants_sql(oid) FROM PUBLIC, anon, authenticated, service_role;

-- ─── 1. Plano e conferências (nada é alterado aqui) ─────────────────────────
CREATE TEMP TABLE josi_plan (
  kind   text NOT NULL,   -- 'job_remover' | 'funcao_apagar' | 'funcao_manter' | 'funcao_corrigir'
  oid    oid,
  name   text NOT NULL,
  motivo text,
  call   text             -- funcao_corrigir: chamada de teste, com %L para o tipo
) ON COMMIT DROP;

DO $$
DECLARE
  c_jobs_remove constant text[] := ARRAY['low-credits-report-daily', 'send-low-credits-notifications-daily'];
  c_candidates  constant text[] := ARRAY['manual_trigger_notifications', 'trigger_email_notifications',
                                         'schedule_email_notifications'];
  c_marker      constant text   := 'josi-pilates: invólucro';
  v_has_cron boolean := to_regclass('cron.job') IS NOT NULL;
  j record;
  r record;
  v_changed boolean;
  v_reach text;
BEGIN
  -- Jobs do pg_cron (se a extensão existir) numa tabela temporária.
  CREATE TEMP TABLE josi_jobs (jobid bigint, jobname text, schedule text, command text,
                               username text, active boolean, remover boolean) ON COMMIT DROP;
  IF v_has_cron THEN
    EXECUTE 'INSERT INTO josi_jobs SELECT jobid, jobname, schedule, command, username, active, jobname = ANY ($1) FROM cron.job'
      USING c_jobs_remove;
  ELSE
    RAISE NOTICE 'pg_cron não existe neste banco: nenhum job para remover.';
  END IF;

  -- 1a. Jobs a remover: só se o comando for consulta pura.
  FOR j IN SELECT * FROM josi_jobs WHERE remover LOOP
    IF j.command ~* ('(net\.|http|insert\s+into|update\s+\S+\s+set|delete\s+from|cron\.|'
                     || array_to_string(c_candidates, '|') || ')') THEN
      RAISE EXCEPTION 'O job % não é só um SELECT (comando: %). Nada foi aplicado; mande o diagnóstico para o dev-critico.',
        j.jobname, left(j.command, 200);
    END IF;
    INSERT INTO josi_plan VALUES ('job_remover', NULL, j.jobname, 'só faz SELECT; resultado se perde', NULL);
  END LOOP;

  -- Funções de todos os schemas de usuário (para saber quem cita quem).
  CREATE TEMP TABLE josi_fns ON COMMIT DROP AS
    SELECT p.oid, p.proname::text AS proname, n.nspname::text AS nspname,
           lower(coalesce(p.prosrc, '') || ' ' || coalesce(pg_get_function_sqlbody(p.oid), '')) AS src
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
      AND n.nspname NOT LIKE 'pg_toast%' AND n.nspname NOT LIKE 'pg_temp%';

  -- 1b. Nada automático que FICA (job ativo do pg_cron, trigger de tabela,
  --     event trigger) pode chegar, direta ou indiretamente, a
  --     get_students_for_notification: hoje isso falha; corrigida, passaria a
  --     rodar (e talvez enviar emails) sem ninguém ter decidido.
  FOR r IN
    WITH RECURSIVE seeds(origem, oid) AS (
      SELECT 'o job ativo ' || jj.jobname, f.oid
      FROM josi_jobs jj
      JOIN josi_fns f ON f.nspname = 'public' AND strpos(lower(jj.command), lower(f.proname)) > 0
      WHERE NOT jj.remover AND jj.active
      UNION
      SELECT 'o trigger ' || t.tgname || ' em ' || t.tgrelid::regclass::text, t.tgfoid
      FROM pg_trigger t WHERE NOT t.tgisinternal AND t.tgenabled <> 'D'
      UNION
      SELECT 'o event trigger ' || e.evtname, e.evtfoid
      FROM pg_event_trigger e WHERE e.evtenabled <> 'D'
    ),
    reach(origem, oid) AS (
      SELECT origem, oid FROM seeds
      UNION
      SELECT rc.origem, f2.oid
      FROM reach rc
      JOIN josi_fns f1 ON f1.oid = rc.oid
      JOIN josi_fns f2 ON f2.nspname = 'public' AND f2.oid <> f1.oid AND strpos(f1.src, lower(f2.proname)) > 0
    )
    SELECT DISTINCT rc.origem
    FROM reach rc JOIN josi_fns f ON f.oid = rc.oid
    WHERE f.nspname = 'public'
      AND f.proname IN ('get_students_for_notification', 'get_students_for_notification_impl')
  LOOP
    RAISE EXCEPTION '% chega a get_students_for_notification (hoje quebrada). Corrigi-la mudaria o que ele faz (pode passar a enviar emails). Nada foi aplicado; mande o diagnóstico para o dev-critico.',
      r.origem;
  END LOOP;

  -- 1c. Funções de disparo: começa com todas as existentes e tira as que
  --     algo que FICA ainda usa, até estabilizar.
  CREATE TEMP TABLE josi_drop ON COMMIT DROP AS
    SELECT f.oid, f.proname FROM josi_fns f WHERE f.nspname = 'public' AND f.proname = ANY (c_candidates);
  CREATE TEMP TABLE josi_keep (proname text PRIMARY KEY, motivo text) ON COMMIT DROP;

  LOOP
    v_changed := false;
    FOR r IN SELECT DISTINCT proname FROM josi_drop LOOP
      SELECT motivo INTO v_reach FROM (
        -- job que fica
        SELECT 'job ' || jj.jobname AS motivo FROM josi_jobs jj
        WHERE NOT jj.remover AND strpos(lower(jj.command), lower(r.proname)) > 0
        UNION ALL
        -- outra função que fica (qualquer schema)
        SELECT 'função ' || f.oid::regprocedure::text FROM josi_fns f
        WHERE f.oid NOT IN (SELECT oid FROM josi_drop) AND strpos(f.src, lower(r.proname)) > 0
        UNION ALL
        -- trigger de tabela
        SELECT 'trigger ' || t.tgname || ' em ' || t.tgrelid::regclass::text FROM pg_trigger t
        WHERE t.tgfoid IN (SELECT oid FROM josi_drop d WHERE d.proname = r.proname)
        UNION ALL
        -- event trigger
        SELECT 'event trigger ' || e.evtname FROM pg_event_trigger e
        WHERE e.evtfoid IN (SELECT oid FROM josi_drop d WHERE d.proname = r.proname)
        UNION ALL
        -- policy, view, default, etc. (pg_depend), menos outra função a apagar
        SELECT pg_describe_object(dp.classid, dp.objid, dp.objsubid) FROM pg_depend dp
        WHERE dp.refclassid = 'pg_proc'::regclass
          AND dp.refobjid IN (SELECT oid FROM josi_drop d WHERE d.proname = r.proname)
          AND NOT (dp.classid = 'pg_proc'::regclass AND dp.objid IN (SELECT oid FROM josi_drop))
          AND dp.deptype IN ('n', 'a')
        UNION ALL
        -- policy pelo texto (por garantia)
        SELECT 'policy ' || pol.tablename || ' / ' || pol.policyname FROM pg_policies pol
        WHERE strpos(lower(coalesce(pol.qual, '') || ' ' || coalesce(pol.with_check, '')), lower(r.proname)) > 0
        UNION ALL
        -- view pelo texto (por garantia)
        SELECT 'view ' || v.schemaname || '.' || v.viewname FROM pg_views v
        WHERE v.schemaname NOT IN ('pg_catalog', 'information_schema')
          AND strpos(lower(v.definition), lower(r.proname)) > 0
      ) m LIMIT 1;

      IF v_reach IS NOT NULL THEN
        DELETE FROM josi_drop WHERE proname = r.proname;
        INSERT INTO josi_keep VALUES (r.proname, v_reach) ON CONFLICT DO NOTHING;
        v_changed := true;
      END IF;
    END LOOP;
    EXIT WHEN NOT v_changed;
  END LOOP;

  INSERT INTO josi_plan SELECT 'funcao_apagar', d.oid, d.oid::regprocedure::text, 'ninguém que fica usa', NULL FROM josi_drop d;
  INSERT INTO josi_plan SELECT 'funcao_manter', NULL, k.proname, 'usada por: ' || k.motivo, NULL FROM josi_keep k;

  -- 1d. Alvo da correção: a _impl (depois da 040000) ou a própria função
  --     (antes da 040000). Só a assinatura (text) é conhecida.
  FOR r IN
    SELECT p.oid, p.proname::text AS proname, p.prokind, p.pronargs, p.proargtypes,
           coalesce(obj_description(p.oid, 'pg_proc'), '') AS comentario
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('get_students_for_notification', 'get_students_for_notification_impl')
  LOOP
    IF r.proname = 'get_students_for_notification' AND r.comentario LIKE c_marker || '%' THEN
      CONTINUE;  -- invólucro da 040000: não muda
    END IF;
    IF r.proname = 'get_students_for_notification'
       AND to_regprocedure('public.get_students_for_notification_impl(' || oidvectortypes(r.proargtypes) || ')') IS NOT NULL THEN
      RAISE EXCEPTION 'get_students_for_notification e _impl existem sem invólucro. Estado inesperado; nada foi aplicado.';
    END IF;
    IF r.prokind <> 'f' OR r.pronargs <> 1
       OR r.proargtypes[0] NOT IN ('text'::regtype, 'character varying'::regtype) THEN
      RAISE EXCEPTION '%(%) tem assinatura inesperada. Nada foi aplicado; mande o diagnóstico para o dev-critico.',
        r.proname, oidvectortypes(r.proargtypes);
    END IF;
    INSERT INTO josi_plan VALUES ('funcao_corrigir', r.oid, r.oid::regprocedure::text, NULL,
      format('SELECT count(*) FROM public.%I(%%L::%s)', r.proname, format_type(r.proargtypes[0], NULL)));
  END LOOP;
END $$;

-- ─── 2. Corrige get_students_for_notification (ou a _impl) ─────────────────
DO $$
DECLARE
  r record;
  v_src text;
  v_new text;
  v_def text;
  v_err text;
  v_tipo text;
BEGIN
  FOR r IN SELECT * FROM josi_plan WHERE kind = 'funcao_corrigir' LOOP
    -- Funciona hoje? (só leitura)
    v_err := NULL;
    FOREACH v_tipo IN ARRAY ARRAY['low_credits', 'zero_credits'] LOOP
      BEGIN
        EXECUTE format(r.call, v_tipo);
      EXCEPTION WHEN OTHERS THEN
        v_err := coalesce(v_err, SQLSTATE || ' ' || SQLERRM);
      END;
    END LOOP;

    IF v_err IS NULL THEN
      RAISE NOTICE '% já funciona: nada a corrigir.', r.name;
      CONTINUE;
    END IF;
    IF v_err NOT LIKE '42804 %' THEN
      RAISE EXCEPTION '% falha com um erro diferente do esperado: %. Nada foi aplicado; mande para o dev-critico.',
        r.name, v_err;
    END IF;

    SELECT p.prosrc INTO v_src FROM pg_proc p WHERE p.oid = r.oid;
    v_new := regexp_replace(
      v_src,
      '(coalesce\s*\(\s*(?:\w+\.)?preferred_language\s*,\s*''pt''(?:\s*::\s*\w+(?:\s+\w+)?)?\s*\))(?!\s*::)',
      '\1::text', 'gi');
    IF v_new = v_src THEN
      RAISE EXCEPTION '% falha com 42804, mas o corpo não tem COALESCE(preferred_language, ''pt'') como o esperado. Nada foi aplicado; mande o diagnóstico para o dev-critico.',
        r.name;
    END IF;

    v_def := pg_get_functiondef(r.oid);
    IF position(v_src IN v_def) = 0
       OR position(v_src IN substr(v_def, position(v_src IN v_def) + 1)) > 0 THEN
      RAISE EXCEPTION 'Não consegui localizar o corpo de % na definição. Nada foi aplicado.', r.name;
    END IF;

    INSERT INTO josi_backup.email_cleanup_20261112 (kind, name, definition, grants)
    VALUES ('funcao_corrigida', r.name, v_def, josi_backup.function_grants_sql(r.oid))
    ON CONFLICT (kind, name) DO NOTHING;

    -- Mesma definição (SECURITY DEFINER, search_path, dono e GRANTs ficam),
    -- só com o ::text.
    EXECUTE replace(v_def, v_src, v_new);

    -- Confere de novo; se falhar, nada é aplicado.
    FOREACH v_tipo IN ARRAY ARRAY['low_credits', 'zero_credits'] LOOP
      BEGIN
        EXECUTE format(r.call, v_tipo);
      EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION '% continua falhando depois da correção (%: %). Nada foi aplicado; mande para o dev-critico.',
          r.name, SQLSTATE, SQLERRM;
      END;
    END LOOP;
    RAISE NOTICE '% corrigida (preferred_language::text).', r.name;
  END LOOP;
END $$;

-- ─── 3. Remove os jobs que só fazem SELECT ──────────────────────────────────
DO $$
DECLARE
  j record;
BEGIN
  FOR j IN
    SELECT jj.* FROM josi_jobs jj JOIN josi_plan p ON p.kind = 'job_remover' AND p.name = jj.jobname
  LOOP
    INSERT INTO josi_backup.email_cleanup_20261112 (kind, name, definition, grants)
    VALUES ('cron', j.jobname,
            format('SELECT cron.schedule(%L, %L, %L);', j.jobname, j.schedule, j.command),
            format('username=%s active=%s', j.username, j.active))
    ON CONFLICT (kind, name) DO NOTHING;
    EXECUTE 'SELECT cron.unschedule($1::bigint)' USING j.jobid;
    RAISE NOTICE 'Job % removido do pg_cron.', j.jobname;
  END LOOP;
END $$;

-- ─── 4. Apaga as funções de disparo sem uso ─────────────────────────────────
DO $$
DECLARE
  r record;
  d record;
BEGIN
  FOR r IN SELECT * FROM josi_plan WHERE kind = 'funcao_apagar' LOOP
    -- Proteção final: nada fora do conjunto a apagar pode depender dela.
    FOR d IN
      SELECT pg_describe_object(dp.classid, dp.objid, dp.objsubid) AS obj
      FROM pg_depend dp
      WHERE dp.refclassid = 'pg_proc'::regclass AND dp.refobjid = r.oid
        AND dp.deptype IN ('n', 'a')
        AND NOT (dp.classid = 'pg_proc'::regclass
                 AND dp.objid IN (SELECT oid FROM josi_plan WHERE kind = 'funcao_apagar'))
    LOOP
      RAISE EXCEPTION '% depende de %. Nada foi aplicado.', d.obj, r.name;
    END LOOP;

    INSERT INTO josi_backup.email_cleanup_20261112 (kind, name, definition, grants)
    VALUES ('funcao_apagada', r.name, pg_get_functiondef(r.oid), josi_backup.function_grants_sql(r.oid))
    ON CONFLICT (kind, name) DO NOTHING;
    EXECUTE format('DROP FUNCTION IF EXISTS %s', r.oid::regprocedure);
    RAISE NOTICE 'Função % apagada (cópia em josi_backup.email_cleanup_20261112).', r.name;
  END LOOP;

  FOR r IN SELECT * FROM josi_plan WHERE kind = 'funcao_manter' LOOP
    RAISE NOTICE 'Função % MANTIDA (%). Fica como pendência.', r.name, r.motivo;
  END LOOP;
END $$;

COMMIT;
