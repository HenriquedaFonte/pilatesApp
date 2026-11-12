-- Diagnóstico (só leitura) — segurança de profiles e das RPCs de crédito
--
-- Rodar no Supabase SQL Editor ANTES e DEPOIS da migration
-- 20261112010000_fix_profiles_privilege_escalation_and_rls.sql.
-- Só consulta o catálogo do Postgres; não altera nada.
-- Colar o arquivo inteiro e rodar: é uma consulta só (os SELECTs internos
-- são unidos por UNION ALL e saem numa tabela única).
--
-- Esperado DEPOIS da migration:
--   funcao  prevent_privilege_escalation → SECURITY INVOKER | config=search_path=public
--   funcao  is_staff                     → SECURITY DEFINER | config=search_path=public
--   funcao  update_class_balance         → SECURITY DEFINER | config=search_path=public (invólucro)
--   funcao  mark_attendance              → SECURITY DEFINER | config=search_path=public (invólucro)
--   funcao  update_class_balance_impl    → SECURITY INVOKER (original de produção)
--   funcao  mark_attendance_impl         → SECURITY DEFINER (original de produção)
--   execute update_class_balance / mark_attendance → authenticated=true | anon=false | public=false
--   execute *_impl                        → authenticated=false | anon=false | public=false
--   execute is_staff                      → authenticated=true | anon=false | public=false
--   trigger enforce_privilege_escalation_guard → ATIVO
--   tabela  profiles → rls=true | dono=postgres
--   policy  → só as 4 profiles_* (TO authenticated); nenhuma "Allow all ..."

SELECT tipo, nome, detalhe
FROM (
  SELECT 1 AS ordem, 'funcao' AS tipo, p.proname::text AS nome,
         CASE WHEN p.prosecdef THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END
         || ' | dono=' || pg_get_userbyid(p.proowner)
         || ' | config=' || coalesce(array_to_string(p.proconfig, ','), '-')
         || ' | args=' || pg_get_function_identity_arguments(p.oid) AS detalhe
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN ('prevent_privilege_escalation', 'is_staff',
                      'update_class_balance', 'update_class_balance_impl',
                      'mark_attendance', 'mark_attendance_impl', 'handle_new_user')

  UNION ALL
  SELECT 2, 'execute', p.proname::text,
         'authenticated=' || has_function_privilege('authenticated', p.oid, 'EXECUTE')
         || ' | anon=' || has_function_privilege('anon', p.oid, 'EXECUTE')
         || ' | public=' || coalesce((
              SELECT bool_or(a.grantee = 0)
              FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
              WHERE a.privilege_type = 'EXECUTE'), false)
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN ('is_staff', 'update_class_balance', 'update_class_balance_impl',
                      'mark_attendance', 'mark_attendance_impl')

  UNION ALL
  SELECT 3, 'trigger', t.tgname::text,
         CASE t.tgenabled
           WHEN 'O' THEN 'ATIVO'
           WHEN 'A' THEN 'ATIVO (always)'
           WHEN 'R' THEN 'SO EM REPLICA (inativo no uso normal)'
           WHEN 'D' THEN 'DESATIVADO'
         END || ' | funcao=' || f.proname
  FROM pg_trigger t
  JOIN pg_proc f ON f.oid = t.tgfoid
  WHERE t.tgrelid = 'public.profiles'::regclass
    AND NOT t.tgisinternal

  UNION ALL
  SELECT 4, 'tabela', c.relname::text,
         'rls=' || c.relrowsecurity || ' | force_rls=' || c.relforcerowsecurity
         || ' | dono=' || pg_get_userbyid(c.relowner)
         || ' | dono_bypassrls=' || r.rolbypassrls
  FROM pg_class c
  JOIN pg_roles r ON r.oid = c.relowner
  WHERE c.oid = 'public.profiles'::regclass

  UNION ALL
  SELECT 5, 'policy', pol.policyname::text,
         pol.cmd || ' | roles=' || array_to_string(pol.roles, ',')
         || ' | using=' || coalesce(pol.qual, '-')
         || ' | check=' || coalesce(pol.with_check, '-')
  FROM pg_policies pol
  WHERE pol.schemaname = 'public' AND pol.tablename = 'profiles'
) d
ORDER BY ordem, nome;

