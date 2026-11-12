-- Diagnóstico (só leitura) — RLS e privilégios das tabelas de public
--
-- Rodar no Supabase SQL Editor ANTES e DEPOIS da migration
-- 20261112020000_fix_rls_operational_tables.sql.
-- Só consulta o catálogo do Postgres; não altera nada.
-- Colar o arquivo inteiro e rodar: é uma consulta só (os SELECTs internos
-- são unidos por UNION ALL e saem numa tabela única).
--
-- ANTES da migration: exportar o resultado (botão de download CSV) e guardar.
-- As linhas "recriar" são o SQL exato de cada policy que existe hoje; é com
-- elas que se volta ao estado anterior em emergência
-- (ver docs/testes/seguranca-rls-tabelas-reversao.sql).
--
-- Colunas: tipo | nome | detalhe. Tipos, na ordem:
--   1 tabela     rls, dono, e o que anon/authenticated podem fazer na tabela
--   2 policy     todas as policies de public (cmd, papéis, using, check);
--                "ALERTA(...)" marca policy que cita 'admin', que deixa gravar
--                sem checar professora, ou que abre leitura a todos
--   3 duplicada  mais de uma policy PERMISSIVE para a mesma tabela+comando+papel
--   4 papel      quantos perfis existem por role; 5 admin: quem tem role='admin'
--   6 trigger    triggers das tabelas (função e se é SECURITY DEFINER)
--   7 view       views de public e se respeitam a RLS (security_invoker)
--   8 funcao     funções SECURITY DEFINER de public e quem pode chamar
--   9 recriar    SQL para recriar cada policy existente (guardar ANTES)
--
-- Esperado DEPOIS da migration:
--   tabela  balance_history, check_ins, student_class_link, classes,
--           class_schedules, attendance, email_notifications, email_logs,
--           enrollments, *_backup → rls=true | anon=- | auth_truncate=false
--   tabela  testimonials, schedule_slots → rls=true | anon=SELECT
--   policy  nessas tabelas: só as de nome <tabela>_<comando>_<quem>, todas
--           TO authenticated, exceto testimonials_select_active_anon e
--           schedule_slots_select_published_anon (TO anon); nenhum ALERTA
--           nessas tabelas (profiles: só as 4 profiles_*)
--   duplicada → nenhuma linha
--   funcao  get_attendance_report, get_students_for_notification,
--           log_email_notification → anon=false | public=false
--   view    email_stats → security_invoker=true

SELECT tipo, nome, detalhe
FROM (
  -- 1. Tabelas: RLS e privilégios
  SELECT 1 AS ordem, 'tabela' AS tipo, c.relname::text AS nome,
         'rls=' || c.relrowsecurity || ' | force_rls=' || c.relforcerowsecurity
         || ' | dono=' || pg_get_userbyid(c.relowner)
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
              CASE WHEN has_table_privilege('authenticated', c.oid, 'DELETE') THEN 'DELETE' END), ''), '-')
         || ' | auth_truncate=' || has_table_privilege('authenticated', c.oid, 'TRUNCATE')
         || ' | policies=' || (SELECT count(*) FROM pg_policies p
                               WHERE p.schemaname = 'public' AND p.tablename = c.relname)
         AS detalhe
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')

  UNION ALL
  -- 2. Todas as policies de public
  SELECT 2, 'policy', p.tablename || ' . ' || p.policyname,
         coalesce('ALERTA(' || nullif(concat_ws(', ',
           CASE WHEN coalesce(p.qual, '') || coalesce(p.with_check, '') ILIKE '%admin%'
                THEN 'usa admin' END,
           CASE WHEN p.cmd <> 'SELECT' AND p.tablename <> 'profiles'
                 AND coalesce(p.qual, '') || coalesce(p.with_check, '') NOT ILIKE '%teacher%'
                 AND coalesce(p.qual, '') || coalesce(p.with_check, '') NOT ILIKE '%is_staff%'
                THEN 'escrita sem checar professora' END,
           CASE WHEN p.cmd IN ('SELECT', 'ALL') AND coalesce(p.qual, '') = 'true'
                 AND p.roles && ARRAY['public', 'anon']::name[]
                 AND p.tablename NOT IN ('testimonials', 'schedule_slots')
                THEN 'leitura aberta a todos' END
         ), '') || ') | ', '')
         || p.permissive || ' ' || p.cmd || ' | roles=' || array_to_string(p.roles, ',')
         || ' | using=' || coalesce(p.qual, '-')
         || ' | check=' || coalesce(p.with_check, '-')
  FROM pg_policies p
  WHERE p.schemaname = 'public'

  UNION ALL
  -- 3. Policies duplicadas (mesma tabela + comando + papel, PERMISSIVE: valem com OR)
  SELECT 3, 'duplicada', d.tablename || ' ' || d.cmd || ' ' || d.role,
         d.n || ' policies: ' || d.nomes
  FROM (
    SELECT p.tablename, p.cmd, r.role::text AS role, count(*) AS n,
           string_agg(p.policyname, ' / ' ORDER BY p.policyname) AS nomes
    FROM pg_policies p
    CROSS JOIN LATERAL unnest(p.roles) AS r(role)
    WHERE p.schemaname = 'public' AND p.permissive = 'PERMISSIVE'
    GROUP BY p.tablename, p.cmd, r.role
    HAVING count(*) > 1
  ) d

  UNION ALL
  -- 4. Quantos perfis por role
  SELECT 4, 'papel', coalesce(pr.role, '(nulo)'), count(*)::text || ' perfis'
  FROM public.profiles pr
  GROUP BY pr.role

  UNION ALL
  -- 5. Quem tem role = 'admin' (id e nome; nada mais)
  SELECT 5, 'admin', pr.id::text, coalesce(pr.full_name, '-')
  FROM public.profiles pr
  WHERE pr.role = 'admin'

  UNION ALL
  -- 6. Triggers das tabelas de public
  SELECT 6, 'trigger', c.relname || ' . ' || t.tgname,
         CASE t.tgenabled WHEN 'D' THEN 'DESATIVADO' ELSE 'ATIVO' END
         || ' | funcao=' || f.proname
         || ' | ' || CASE WHEN f.prosecdef THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_proc f ON f.oid = t.tgfoid
  WHERE n.nspname = 'public' AND NOT t.tgisinternal

  UNION ALL
  -- 7. Views (sem security_invoker, a view ignora a RLS de quem consulta)
  SELECT 7, 'view', c.relname::text,
         'security_invoker=' || coalesce((
           SELECT split_part(o, '=', 2) FROM unnest(c.reloptions) o
           WHERE o LIKE 'security_invoker=%'), 'false')
         || ' | anon_select=' || has_table_privilege('anon', c.oid, 'SELECT')
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('v', 'm')

  UNION ALL
  -- 8. Funções SECURITY DEFINER de public (não passam pela RLS) e quem chama
  SELECT 8, 'funcao', p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
         'authenticated=' || has_function_privilege('authenticated', p.oid, 'EXECUTE')
         || ' | anon=' || has_function_privilege('anon', p.oid, 'EXECUTE')
         || ' | public=' || coalesce((
              SELECT bool_or(a.grantee = 0)
              FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
              WHERE a.privilege_type = 'EXECUTE'), false)
         || ' | config=' || coalesce(array_to_string(p.proconfig, ','), '-')
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prosecdef

  UNION ALL
  -- 9. SQL para recriar cada policy que existe agora (guardar ANTES da migration)
  SELECT 9, 'recriar', p.tablename || ' . ' || p.policyname,
         format('CREATE POLICY %I ON public.%I AS %s FOR %s TO %s%s%s;',
                p.policyname, p.tablename, p.permissive, p.cmd,
                (SELECT string_agg(CASE WHEN r = 'public' THEN 'public' ELSE quote_ident(r) END, ', ')
                 FROM unnest(p.roles) AS r),
                CASE WHEN p.qual IS NOT NULL THEN ' USING (' || p.qual || ')' ELSE '' END,
                CASE WHEN p.with_check IS NOT NULL THEN ' WITH CHECK (' || p.with_check || ')' ELSE '' END)
  FROM pg_policies p
  WHERE p.schemaname = 'public'
) d
ORDER BY ordem, nome;
