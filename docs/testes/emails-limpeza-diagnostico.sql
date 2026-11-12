-- Diagnóstico (só leitura) — desligar os emails automáticos e limpar o resto
--
-- Rodar no Supabase SQL Editor ANTES e DEPOIS da migration
-- 20261112050000_cleanup_email_automation.sql.
-- Só consulta o catálogo do Postgres e as tabelas do pg_cron; não altera
-- nada e não chama nenhuma função. Colar o arquivo inteiro e rodar: é uma
-- consulta só. Guardar o resultado (Export → CSV).
--
-- Chaves/tokens que apareçam nos comandos e corpos (JWT, "Bearer ...",
-- chaves do Resend re_...) saem como <oculto>: dá para mandar o CSV.
--
-- Colunas: tipo | nome | detalhe. Tipos, na ordem:
--   0 migracao_040000  a migration 20261112040000 (relatórios só para
--                  professora) já foi aplicada? aplicada=true quando existem
--                  assert_staff_caller, get_students_for_notification_impl e
--                  os invólucros. aplicada=false: ainda não rodou.
--   1 cron         todos os jobs: plano (remover/manter), dono, agenda, ativo,
--                  comando
--   2 cron_exec    últimas 3 execuções de cada job (status, hora, mensagem)
--   3 funcao       get_students_for_notification (e _impl) e as funções de
--                  disparo antigas: SECURITY DEFINER, dono, quem executa,
--                  invólucro, retorno
--   4 corpo        definição de cada uma dessas funções
--   5 citada_por   quem cita/usa cada uma (job, função, trigger, pg_depend)
--   6 plano        o que a migration deve fazer com cada função de disparo
--   7 alerta       motivo para a migration PARAR: um job que fica ligado a
--                  email, ou algo automático que fica (job ativo, trigger)
--                  chegando a get_students_for_notification
--   8 outras       outras funções de public que parecem de email/notificação
--                  (a migration não mexe nelas; ficam como pendência)
--   9 backup       DEPOIS: o que a migration guardou em josi_backup
--
-- ANTES, o esperado é:
--   cron      low-credits-daily, zero-credits-daily, low-credits-report-daily
--             e send-low-credits-notifications-daily com plano=remover;
--             qualquer outro job com plano=manter e SEM linha de alerta.
--   alerta    nenhuma linha. Se houver: NÃO rodar a migration (ela pararia);
--             mandar o CSV para o dev-critico.
--   plano     cada função de disparo com "apagar" (esperado: as 3) ou
--             "manter (usada por: ...)".
-- DEPOIS, o esperado é:
--   cron      nenhum dos 4 jobs; só jobs que não têm a ver com email (se
--             houver);
--   funcao    só get_students_for_notification (e _impl, se a 040000 rodou);
--   backup    uma linha por job removido e por função apagada/corrigida.

WITH
alvo(nome, papel) AS (
  VALUES ('get_students_for_notification', 'corrigir'),
         ('get_students_for_notification_impl', 'corrigir'),
         ('manual_trigger_notifications', 'disparo'),
         ('trigger_email_notifications', 'disparo'),
         ('schedule_email_notifications', 'disparo')
),
jobs AS (
  SELECT x.jobid, x.jobname, x.username, x.schedule, x.active, x.command,
         x.jobname IN ('low-credits-daily', 'zero-credits-daily',
                       'low-credits-report-daily', 'send-low-credits-notifications-daily') AS remover
  FROM (
    SELECT CASE WHEN to_regclass('cron.job') IS NOT NULL
                THEN query_to_xml('SELECT jobid, jobname, username, schedule, active, command FROM cron.job',
                                  true, false, '')
           END AS doc
  ) d,
  XMLTABLE('/table/row' PASSING d.doc
    COLUMNS jobid bigint PATH 'jobid', jobname text PATH 'jobname', username text PATH 'username',
            schedule text PATH 'schedule', active boolean PATH 'active', command text PATH 'command') x
),
execs AS (
  SELECT x.*
  FROM (
    SELECT CASE WHEN to_regclass('cron.job_run_details') IS NOT NULL AND to_regclass('cron.job') IS NOT NULL
                THEN query_to_xml($q$
                  SELECT j.jobname, d.status, d.start_time, d.return_message
                  FROM (SELECT r.*, row_number() OVER (PARTITION BY r.jobid ORDER BY r.start_time DESC NULLS LAST) AS n
                        FROM cron.job_run_details r) d
                  JOIN cron.job j ON j.jobid = d.jobid
                  WHERE d.n <= 3$q$, true, false, '')
           END AS doc
  ) d,
  XMLTABLE('/table/row' PASSING d.doc
    COLUMNS jobname text PATH 'jobname', status text PATH 'status',
            start_time text PATH 'start_time', return_message text PATH 'return_message') x
),
fns AS (
  SELECT p.oid, p.proname::text AS proname, n.nspname::text AS nspname,
         lower(coalesce(p.prosrc, '') || ' ' || coalesce(pg_get_function_sqlbody(p.oid), '')) AS src
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
    AND n.nspname NOT LIKE 'pg_toast%' AND n.nspname NOT LIKE 'pg_temp%'
),
alvo_fn AS (
  SELECT f.oid, f.proname, a.papel FROM fns f JOIN alvo a ON a.nome = f.proname WHERE f.nspname = 'public'
),
-- quem cita/usa cada função alvo (fora as próprias funções de disparo)
citacoes AS (
  SELECT a.proname, 'job ' || j.jobname AS quem,
         NOT j.remover AS fica
  FROM alvo_fn a JOIN jobs j ON strpos(lower(j.command), lower(a.proname)) > 0
  UNION
  SELECT a.proname, 'função ' || f.oid::regprocedure::text
         || CASE WHEN p.prorettype = 'trigger'::regtype THEN ' (função de trigger)' ELSE '' END,
         f.proname NOT IN (SELECT nome FROM alvo WHERE papel = 'disparo')
  FROM alvo_fn a
  JOIN fns f ON f.oid <> a.oid AND strpos(f.src, lower(a.proname)) > 0
  JOIN pg_proc p ON p.oid = f.oid
  UNION
  SELECT a.proname, 'trigger ' || t.tgname || ' em ' || t.tgrelid::regclass::text, true
  FROM alvo_fn a JOIN pg_trigger t ON t.tgfoid = a.oid
  UNION
  SELECT a.proname, 'event trigger ' || e.evtname, true
  FROM alvo_fn a JOIN pg_event_trigger e ON e.evtfoid = a.oid
  UNION
  SELECT a.proname, 'depende (pg_depend): ' || pg_describe_object(dp.classid, dp.objid, dp.objsubid), true
  FROM alvo_fn a JOIN pg_depend dp ON dp.refclassid = 'pg_proc'::regclass AND dp.refobjid = a.oid
  WHERE dp.deptype IN ('n', 'a')
),
-- algo automático que fica chega a get_students_for_notification?
seeds(origem, oid) AS (
  SELECT 'job ativo ' || j.jobname, f.oid
  FROM jobs j JOIN fns f ON f.nspname = 'public' AND strpos(lower(j.command), lower(f.proname)) > 0
  WHERE NOT j.remover AND j.active
  UNION
  SELECT 'trigger ' || t.tgname || ' em ' || t.tgrelid::regclass::text, t.tgfoid
  FROM pg_trigger t WHERE NOT t.tgisinternal AND t.tgenabled <> 'D'
  UNION
  SELECT 'event trigger ' || e.evtname, e.evtfoid FROM pg_event_trigger e WHERE e.evtenabled <> 'D'
)
SELECT tipo, nome, detalhe
FROM (
  -- 0. A 20261112040000 já foi aplicada?
  SELECT 0 AS ordem, 'migracao_040000' AS tipo, '20261112040000_require_staff_in_report_rpcs' AS nome,
         'aplicada=' || (to_regprocedure('public.assert_staff_caller(text,uuid)') IS NOT NULL
                         AND EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                                     WHERE n.nspname = 'public' AND p.proname = 'get_students_for_notification_impl'))
         || ' | assert_staff_caller=' || (to_regprocedure('public.assert_staff_caller(text,uuid)') IS NOT NULL)
         || ' | get_students_for_notification_impl=' || EXISTS (
              SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'public' AND p.proname = 'get_students_for_notification_impl')
         || ' | involucros=' || (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'public'
                AND coalesce(obj_description(p.oid, 'pg_proc'), '') LIKE 'josi-pilates: invólucro%')
         || ' (em produção: 7 quando aplicada)' AS detalhe

  UNION ALL
  -- 1. Jobs do pg_cron
  SELECT 1, 'cron' AS tipo, j.jobname AS nome,
         'plano=' || CASE WHEN j.remover THEN 'remover' ELSE 'manter' END
         || ' | dono=' || coalesce(j.username, '-') || ' | agenda=' || coalesce(j.schedule, '-')
         || ' | ativo=' || coalesce(j.active::text, '-')
         || ' | comando=' || regexp_replace(regexp_replace(regexp_replace(coalesce(j.command, ''),
              'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*', '<oculto>', 'g'),
              '(bearer\s+)[A-Za-z0-9._~+/=-]+', '\1<oculto>', 'gi'),
              '\mre_[A-Za-z0-9_]{8,}', '<oculto>', 'g')
  FROM jobs j

  UNION ALL
  -- 2. Últimas execuções
  SELECT 2, 'cron_exec', e.jobname,
         'status=' || coalesce(e.status, '-') || ' | inicio=' || coalesce(e.start_time, '-')
         || ' | mensagem=' || left(coalesce(e.return_message, '-'), 200)
  FROM execs e

  UNION ALL
  -- 3. Funções alvo
  SELECT 3, 'funcao', p.oid::regprocedure::text,
         'papel=' || a.papel
         || ' | secdef=' || p.prosecdef
         || ' | dono=' || pg_get_userbyid(p.proowner)
         || ' | involucro=' || (coalesce(obj_description(p.oid, 'pg_proc'), '') LIKE 'josi-pilates: invólucro%')
         || ' | authenticated=' || has_function_privilege('authenticated', p.oid, 'EXECUTE')
         || ' | anon=' || has_function_privilege('anon', p.oid, 'EXECUTE')
         || ' | service_role=' || has_function_privilege('service_role', p.oid, 'EXECUTE')
         || ' | config=' || coalesce(array_to_string(p.proconfig, ','), '-')
         || ' | retorno=' || pg_get_function_result(p.oid)
  FROM alvo_fn a JOIN pg_proc p ON p.oid = a.oid

  UNION ALL
  -- 4. Corpo
  SELECT 4, 'corpo', a.oid::regprocedure::text,
         regexp_replace(regexp_replace(regexp_replace(pg_get_functiondef(a.oid),
           'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*', '<oculto>', 'g'),
           '(bearer\s+)[A-Za-z0-9._~+/=-]+', '\1<oculto>', 'gi'),
           '\mre_[A-Za-z0-9_]{8,}', '<oculto>', 'g')
  FROM alvo_fn a

  UNION ALL
  -- 5. Quem cita/usa
  SELECT 5, 'citada_por', c.proname, c.quem || CASE WHEN c.fica THEN '' ELSE ' [também sai]' END
  FROM citacoes c

  UNION ALL
  -- 6. Plano para as funções de disparo (a migration recalcula na hora)
  SELECT 6, 'plano', a.proname,
         coalesce('manter (usada por: ' || (
           SELECT string_agg(c.quem, '; ') FROM citacoes c WHERE c.proname = a.proname AND c.fica
         ) || ')', 'apagar')
  FROM (SELECT DISTINCT proname FROM alvo_fn WHERE papel = 'disparo') a

  UNION ALL
  -- 7. Alerta: algo automático que fica chega a get_students_for_notification
  SELECT 7, 'alerta', r.origem,
         'chega a get_students_for_notification → a migration vai PARAR; mandar o CSV para o dev-critico'
  FROM (
    WITH RECURSIVE rr(origem, oid) AS (
      SELECT origem, oid FROM seeds
      UNION
      SELECT rr.origem, f2.oid
      FROM rr
      JOIN fns f1 ON f1.oid = rr.oid
      JOIN fns f2 ON f2.nspname = 'public' AND f2.oid <> f1.oid AND strpos(f1.src, lower(f2.proname)) > 0
    )
    SELECT DISTINCT rr.origem FROM rr JOIN fns f ON f.oid = rr.oid
    WHERE f.nspname = 'public'
      AND f.proname IN ('get_students_for_notification', 'get_students_for_notification_impl')
  ) r

  UNION ALL
  -- 7b. Alerta: job que fica e parece ligado a email (a migration não apaga
  --     jobs desconhecidos: para)
  SELECT 7, 'alerta', 'job ' || j.jobname,
         'parece ligado a email e não é um dos 4 conhecidos → a migration vai PARAR; mandar o CSV para o dev-critico'
  FROM jobs j
  WHERE NOT j.remover
    AND (j.jobname ~* '(e-?mail|notif|resend|send|http_post|net\.http)'
         OR j.command ~* '(e-?mail|notif|resend|send|http_post|net\.http)'
         OR EXISTS (
           WITH RECURSIVE rj(oid) AS (
             SELECT f.oid FROM fns f
             WHERE f.nspname = 'public' AND strpos(lower(j.command), lower(f.proname)) > 0
             UNION
             SELECT f2.oid FROM rj
             JOIN fns f1 ON f1.oid = rj.oid
             JOIN fns f2 ON f2.nspname = 'public' AND f2.oid <> f1.oid AND strpos(f1.src, lower(f2.proname)) > 0
           )
           SELECT 1 FROM rj JOIN fns f ON f.oid = rj.oid
           WHERE f.src ~* '(e-?mail|notif|resend|send|http_post|net\.http)'
              OR f.proname IN (SELECT nome FROM alvo)))

  UNION ALL
  -- 8. Outras funções que parecem de email/notificação (não mexidas)
  SELECT 8, 'outras', f.oid::regprocedure::text,
         'secdef=' || p.prosecdef || ' | trigger=' || (p.prorettype = 'trigger'::regtype)
         || ' | http=' || (f.src LIKE '%http%') || ' | não mexida pela migration'
  FROM fns f JOIN pg_proc p ON p.oid = f.oid
  WHERE f.nspname = 'public'
    AND f.proname NOT IN (SELECT nome FROM alvo)
    AND f.proname NOT IN ('log_email_notification', 'log_email_notification_impl',
                          'get_email_notification_stats', 'get_email_notification_stats_impl')
    AND (f.proname ~* '(notif|email|cron)' OR f.src LIKE '%http_post%' OR f.src LIKE '%send-email%')

  UNION ALL
  -- 9. Cópia de segurança (DEPOIS da migration)
  SELECT 9, 'backup', x.kind || ' / ' || x.name, 'guardado em ' || x.saved_at
  FROM (
    SELECT CASE WHEN to_regclass('josi_backup.email_cleanup_20261112') IS NOT NULL
                THEN query_to_xml('SELECT kind, name, saved_at FROM josi_backup.email_cleanup_20261112',
                                  true, false, '')
           END AS doc
  ) d,
  XMLTABLE('/table/row' PASSING d.doc
    COLUMNS kind text PATH 'kind', name text PATH 'name', saved_at text PATH 'saved_at') x
) d
ORDER BY ordem, nome, detalhe;
