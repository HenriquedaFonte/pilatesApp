-- Diagnóstico (só leitura) — relatórios, notificações e is_profile_complete
--
-- Rodar no Supabase SQL Editor ANTES e DEPOIS da migration
-- 20261112040000_require_staff_in_report_rpcs.sql.
-- Só consulta o catálogo do Postgres; não altera nada.
-- Colar o arquivo inteiro e rodar: é uma consulta só.
--
-- Colunas: tipo | nome | detalhe. Tipos, na ordem:
--   1 funcao       as 7 funções e as *_impl: SECURITY DEFINER, search_path,
--                  se é invólucro, quem executa, tipo de retorno
--   2 dependencia  objetos que dependem delas pelo OID (policy, view, default,
--                  constraint). ANTES: tem que vir vazio; senão a migration
--                  para sem aplicar nada (mandar o resultado para o dev-critico)
--   3 chamador     outras funções de public cujo corpo cita alguma delas
--                  (passam a chamar o invólucro: liberado só sem JWT,
--                  service_role, professora; trigger=true merece atenção)
--   4 policy       policies cujo texto cita alguma delas
--   5 cron         jobs do pg_cron cujo comando cita alguma delas
--
-- Esperado DEPOIS da migration:
--   funcao  <nome>(...)      → secdef=true | search_path=public | involucro=true
--                              | authenticated=true | anon=false | service_role=true
--   funcao  <nome>_impl(...) → search_path=public | involucro=false
--                              | authenticated=false | anon=false | service_role=false
--   funcao  assert_staff_caller(...) → authenticated=false | anon=false | service_role=false
--   dependencia, policy: nenhuma linha

WITH alvo AS (
  SELECT unnest(ARRAY[
    'get_attendance_report', 'get_low_credits_report', 'get_zero_credits_students',
    'get_students_for_notification', 'get_email_notification_stats',
    'log_email_notification', 'is_profile_complete'
  ]) AS nome
),
fn AS (
  SELECT p.oid, p.proname::text AS proname
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND (p.proname IN (SELECT nome FROM alvo)
         OR p.proname IN (SELECT nome || '_impl' FROM alvo)
         OR p.proname = 'assert_staff_caller')
)
SELECT tipo, nome, detalhe
FROM (
  -- 1. Funções
  SELECT 1 AS ordem, 'funcao' AS tipo,
         p.oid::regprocedure::text AS nome,
         'secdef=' || p.prosecdef
         || ' | search_path=' || coalesce((SELECT substr(c, 13) FROM unnest(p.proconfig) c
                                           WHERE c LIKE 'search_path=%'), '-')
         || ' | involucro=' || (coalesce(obj_description(p.oid, 'pg_proc'), '') LIKE 'josi-pilates: invólucro%')
         || ' | authenticated=' || has_function_privilege('authenticated', p.oid, 'EXECUTE')
         || ' | anon=' || has_function_privilege('anon', p.oid, 'EXECUTE')
         || ' | service_role=' || has_function_privilege('service_role', p.oid, 'EXECUTE')
         || ' | dono=' || pg_get_userbyid(p.proowner)
         || ' | retorno=' || pg_get_function_result(p.oid) AS detalhe
  FROM fn f
  JOIN pg_proc p ON p.oid = f.oid

  UNION ALL
  -- 2. Objetos que dependem delas pelo OID
  SELECT 2, 'dependencia', f.oid::regprocedure::text,
         pg_describe_object(d.classid, d.objid, d.objsubid)
  FROM fn f
  JOIN pg_depend d ON d.refclassid = 'pg_proc'::regclass AND d.refobjid = f.oid

  UNION ALL
  -- 3. Outras funções que citam alguma delas no corpo
  SELECT 3, 'chamador', p.oid::regprocedure::text,
         'cita=' || string_agg(a.nome, ',')
         || ' | secdef=' || p.prosecdef
         || ' | trigger=' || (p.prorettype = 'trigger'::regtype)
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  JOIN alvo a ON p.prosrc ILIKE '%' || a.nome || '%'
  WHERE n.nspname = 'public'
    AND p.oid NOT IN (SELECT oid FROM fn)
  GROUP BY p.oid, p.prosecdef, p.prorettype

  UNION ALL
  -- 4. Policies que citam alguma delas
  SELECT 4, 'policy', pol.schemaname || '.' || pol.tablename || ' / ' || pol.policyname,
         'cita=' || string_agg(a.nome, ',')
  FROM pg_policies pol
  JOIN alvo a ON coalesce(pol.qual, '') || ' ' || coalesce(pol.with_check, '') ILIKE '%' || a.nome || '%'
  GROUP BY pol.schemaname, pol.tablename, pol.policyname

  UNION ALL
  -- 5. Jobs do pg_cron que citam alguma delas (se o pg_cron existir)
  SELECT 5, 'cron', x.jobname, x.detalhe
  FROM (
    SELECT CASE WHEN to_regclass('cron.job') IS NOT NULL
                THEN query_to_xml('SELECT jobname, username, command FROM cron.job', false, false, '')
           END AS doc
  ) d,
  XMLTABLE('/table/row' PASSING d.doc
    COLUMNS jobname text PATH 'jobname',
            detalhe text PATH 'concat("username=", username, " | comando=", command)') x
  WHERE EXISTS (SELECT 1 FROM alvo a WHERE x.detalhe ILIKE '%' || a.nome || '%')
) d
ORDER BY ordem, nome;
