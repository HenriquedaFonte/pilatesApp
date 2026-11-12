-- Diagnóstico (só leitura) — guarda de escalada de privilégio em profiles
--
-- Rodar no Supabase SQL Editor ANTES e DEPOIS da migration
-- 20261112010000_fix_privilege_escalation_security_invoker.sql.
-- Só consulta o catálogo do Postgres; não altera nada (transação READ ONLY
-- que termina em ROLLBACK).
--
-- Se o editor mostrar só "Success. No rows returned", selecione apenas o
-- SELECT (do "SELECT" até o ";" antes do ROLLBACK) e rode a seleção.
--
-- Como ler o resultado:
--   funcao  prevent_privilege_escalation  → ANTES: SECURITY DEFINER (falha aberta)
--                                           DEPOIS: SECURITY INVOKER (corrigido)
--   trigger enforce_privilege_escalation_guard → precisa estar ATIVO
--   funcao  update_class_balance / mark_attendance → precisam ser
--           SECURITY DEFINER (senão a professora perde a troca de créditos
--           depois da correção). Conferir também a linha "execute".
--   policy  → policies de profiles (para conferir quem pode dar UPDATE).

BEGIN TRANSACTION READ ONLY;

SELECT tipo, nome, detalhe
FROM (
  SELECT 1 AS ordem, 'funcao' AS tipo, p.proname::text AS nome,
         CASE WHEN p.prosecdef THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END
         || ' | dono=' || pg_get_userbyid(p.proowner)
         || ' | config=' || coalesce(array_to_string(p.proconfig, ','), '-') AS detalhe
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN ('prevent_privilege_escalation', 'update_class_balance',
                      'mark_attendance', 'handle_new_user')

  UNION ALL
  SELECT 2, 'trigger', t.tgname::text,
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
  SELECT 3, 'execute', p.proname::text,
         'authenticated=' || has_function_privilege('authenticated', p.oid, 'EXECUTE')
         || ' | anon=' || has_function_privilege('anon', p.oid, 'EXECUTE')
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN ('update_class_balance', 'mark_attendance')

  UNION ALL
  SELECT 4, 'policy', pol.policyname::text,
         pol.cmd || ' | roles=' || array_to_string(pol.roles, ',')
         || ' | using=' || coalesce(pol.qual, '-')
         || ' | check=' || coalesce(pol.with_check, '-')
  FROM pg_policies pol
  WHERE pol.schemaname = 'public' AND pol.tablename = 'profiles'
) d
ORDER BY ordem, nome;

ROLLBACK;
