-- Diagnóstico (só leitura) — quem executa as funções SECURITY DEFINER e quem
-- acessa email_stats, audit_log e profiles
--
-- Rodar no Supabase SQL Editor ANTES e DEPOIS da migration
-- 20261112030000_revoke_anon_rpcs_and_views.sql.
-- Só consulta o catálogo do Postgres; não altera nada.
-- Colar o arquivo inteiro e rodar: é uma consulta só.
--
-- Colunas: tipo | nome | detalhe. Tipos, na ordem:
--   1 funcao   funções SECURITY DEFINER de public e quem pode executar
--   2 objeto   email_stats, audit_log e profiles: privilégios de anon e
--              authenticated
--   3 cron     jobs do pg_cron (dono, agenda, comando), se o pg_cron existir
--              — para conferir que nenhum job roda como anon/authenticated
--
-- Esperado DEPOIS da migration:
--   funcao  get_attendance_report, get_low_credits_report,
--           get_zero_credits_students, get_students_for_notification,
--           get_email_notification_stats, log_email_notification,
--           is_profile_complete → authenticated=true | anon=false | public=false
--   funcao  manual_trigger_notifications, trigger_email_notifications,
--           schedule_email_notifications, handle_new_user
--           → authenticated=false | anon=false | public=false
--   funcao  is_staff, update_class_balance, mark_attendance → como na
--           migration 20261112010000 (authenticated=true | anon=false)
--   objeto  email_stats → anon=- | authenticated=SELECT
--   objeto  audit_log   → anon=- | authenticated=SELECT
--   objeto  profiles    → sem TRUNCATE em anon nem em authenticated
--   cron    se houver: username=postgres (ou outro dono das funções)

SELECT tipo, nome, detalhe
FROM (
  -- 1. Funções SECURITY DEFINER de public
  SELECT 1 AS ordem, 'funcao' AS tipo,
         p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' AS nome,
         'authenticated=' || has_function_privilege('authenticated', p.oid, 'EXECUTE')
         || ' | anon=' || has_function_privilege('anon', p.oid, 'EXECUTE')
         || ' | public=' || coalesce((
              SELECT bool_or(a.grantee = 0)
              FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
              WHERE a.privilege_type = 'EXECUTE'), false)
         || ' | service_role=' || has_function_privilege('service_role', p.oid, 'EXECUTE')
         || ' | dono=' || pg_get_userbyid(p.proowner)
         || ' | config=' || coalesce(array_to_string(p.proconfig, ','), '-') AS detalhe
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prosecdef

  UNION ALL
  -- 2. View email_stats, audit_log e profiles
  SELECT 2, 'objeto', c.relname::text,
         'tipo=' || CASE c.relkind WHEN 'v' THEN 'view' ELSE 'tabela' END
         || ' | anon=' || coalesce(nullif(concat_ws(',',
              CASE WHEN has_table_privilege('anon', c.oid, 'SELECT') THEN 'SELECT' END,
              CASE WHEN has_table_privilege('anon', c.oid, 'INSERT') THEN 'INSERT' END,
              CASE WHEN has_table_privilege('anon', c.oid, 'UPDATE') THEN 'UPDATE' END,
              CASE WHEN has_table_privilege('anon', c.oid, 'DELETE') THEN 'DELETE' END,
              CASE WHEN has_table_privilege('anon', c.oid, 'TRUNCATE') THEN 'TRUNCATE' END), ''), '-')
         || ' | authenticated=' || coalesce(nullif(concat_ws(',',
              CASE WHEN has_table_privilege('authenticated', c.oid, 'SELECT') THEN 'SELECT' END,
              CASE WHEN has_table_privilege('authenticated', c.oid, 'INSERT') THEN 'INSERT' END,
              CASE WHEN has_table_privilege('authenticated', c.oid, 'UPDATE') THEN 'UPDATE' END,
              CASE WHEN has_table_privilege('authenticated', c.oid, 'DELETE') THEN 'DELETE' END,
              CASE WHEN has_table_privilege('authenticated', c.oid, 'TRUNCATE') THEN 'TRUNCATE' END), ''), '-')
         || ' | service_role_select=' || has_table_privilege('service_role', c.oid, 'SELECT')
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname IN ('email_stats', 'audit_log', 'profiles')

  UNION ALL
  -- 3. Jobs do pg_cron (só se a extensão existir; senão, nenhuma linha)
  SELECT 3, 'cron', x.jobname, x.detalhe
  FROM (
    SELECT CASE WHEN to_regclass('cron.job') IS NOT NULL
                THEN query_to_xml('SELECT jobname, username, schedule, active, command FROM cron.job',
                                  false, false, '')
           END AS doc
  ) d,
  XMLTABLE('/table/row' PASSING d.doc
    COLUMNS jobname text PATH 'jobname',
            detalhe text PATH 'concat("username=", username, " | agenda=", schedule,
                                      " | ativo=", active, " | comando=", command)') x
) d
ORDER BY ordem, nome;
