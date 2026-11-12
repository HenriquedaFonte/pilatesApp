-- Migration: anônimo perde EXECUTE nas funções SECURITY DEFINER restantes,
-- SELECT na view email_stats e privilégios em audit_log; ninguém da API
-- fica com TRUNCATE em profiles.
--
-- DEPENDE de 20261112020000_fix_rls_operational_tables.sql (que depende de
-- 20261112010000). Se ela não tiver rodado, esta para logo no início e nada é
-- aplicado.
--
-- Estado de PRODUÇÃO (diagnóstico docs/testes/seguranca-rls-tabelas-
-- diagnostico.sql rodado em 2026-11-12, antes da 20261112020000):
--   • 11 funções SECURITY DEFINER, sem search_path, com EXECUTE para
--     anon/PUBLIC (padrão do Supabase): get_attendance_report,
--     get_email_notification_stats, get_low_credits_report,
--     get_students_for_notification, get_zero_credits_students,
--     handle_new_user, is_profile_complete, log_email_notification,
--     manual_trigger_notifications(varchar, boolean),
--     schedule_email_notifications(), trigger_email_notifications(varchar).
--     → Com a chave anon (pública, está no site) dava para baixar nome, email
--       e créditos de todos os alunos e disparar envio de emails.
--     (A 20261112020000 já tirou anon de get_attendance_report,
--      get_students_for_notification e log_email_notification.)
--   • View email_stats: security_invoker=true, mas anon com SELECT.
--   • audit_log: policies corretas, mas anon com todos os privilégios de
--     tabela e authenticated com TRUNCATE.
--   • profiles: anon e authenticated com TRUNCATE (TRUNCATE ignora a RLS).
--   • Nenhum trigger de tabela chama as funções de email (só há triggers de
--     updated_at e o guarda de profiles).
--
-- Quem chama cada função (levantado em src/, supabase/functions/ e scripts/):
--   • get_attendance_report (AttendanceReport.jsx), get_low_credits_report e
--     get_zero_credits_students (lowCreditsReport.jsx), log_email_notification
--     (EmailNotifications.jsx): professora, papel authenticated.
--   • get_students_for_notification, get_email_notification_stats,
--     is_profile_complete: nenhum código do site chama.
--   • manual_trigger_notifications, trigger_email_notifications,
--     schedule_email_notifications: nenhum código do site nem Edge Function
--     chama. Se houver job no pg_cron, ele roda como o dono do job (postgres,
--     que é o dono das funções e executa sem precisar de GRANT).
--   • handle_new_user: só como trigger em auth.users. O Postgres confere
--     EXECUTE da função de trigger apenas ao criar o trigger, não ao disparar.
--   • Edge Functions e o backup do GitHub usam service_role.
--
-- O que esta migration faz (só privilégios; nenhuma policy, dado ou corpo de
-- função muda):
--   1. Relatórios/log (get_attendance_report, get_low_credits_report,
--      get_zero_credits_students, get_students_for_notification,
--      get_email_notification_stats, log_email_notification,
--      is_profile_complete): PUBLIC e anon perdem EXECUTE; authenticated e
--      service_role ficam. Aluno logado ainda consegue chamá-las: corrigir
--      exigindo is_staff() dentro delas (próxima tarefa, ver PENDENCIAS).
--   2. Disparo de emails (manual_trigger_notifications,
--      trigger_email_notifications, schedule_email_notifications): PUBLIC,
--      anon e authenticated perdem EXECUTE; fica service_role (e o dono).
--   3. handle_new_user: PUBLIC, anon e authenticated perdem EXECUTE.
--   4. email_stats (nenhum código do site usa): PUBLIC e anon perdem tudo;
--      authenticated fica só com SELECT (antes também podia INSERT/UPDATE/
--      DELETE através da view).
--   5. audit_log: PUBLIC, anon e authenticated perdem tudo; authenticated
--      volta só com SELECT (policy audit_log_select_teacher); service_role ALL.
--   6. profiles: PUBLIC, anon e authenticated perdem TRUNCATE, TRIGGER e
--      REFERENCES. SELECT/INSERT/UPDATE/DELETE ficam (a RLS decide).
--
-- Funções que não existirem são puladas; todas as versões/assinaturas com o
-- nome são tratadas.
--
-- Rodar no Supabase SQL Editor de uma vez. Está dentro de BEGIN/COMMIT: se
-- algo falhar, nada é aplicado. Idempotente: pode rodar de novo.
--
-- REVERSÃO: docs/testes/seguranca-rpcs-anon-reversao.sql.

BEGIN;

-- ─── 0. Pré-condição: 20261112020000 já aplicada ────────────────────────────
DO $$
BEGIN
  IF to_regprocedure('public.is_staff()') IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'balance_history'
         AND policyname = 'balance_history_select_own_or_staff'
     ) THEN
    RAISE EXCEPTION 'Rode antes a migration 20261112020000_fix_rls_operational_tables.sql. Nada foi aplicado.';
  END IF;
END $$;

-- ─── 1–3. Funções SECURITY DEFINER ──────────────────────────────────────────
DO $$
DECLARE
  v_fn regprocedure;
  v_name text;
BEGIN
  FOR v_fn, v_name IN
    SELECT p.oid::regprocedure, p.proname::text
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'get_attendance_report', 'get_low_credits_report', 'get_zero_credits_students',
        'get_students_for_notification', 'get_email_notification_stats',
        'log_email_notification', 'is_profile_complete',
        'manual_trigger_notifications', 'trigger_email_notifications',
        'schedule_email_notifications',
        'handle_new_user'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', v_fn);
    IF v_name IN ('manual_trigger_notifications', 'trigger_email_notifications',
                  'schedule_email_notifications') THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', v_fn);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', v_fn);
    ELSIF v_name = 'handle_new_user' THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', v_fn);
    ELSE
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', v_fn);
    END IF;
  END LOOP;
END $$;

-- ─── 4–5. View email_stats e audit_log ──────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.email_stats') IS NOT NULL THEN
    REVOKE ALL ON TABLE public.email_stats FROM PUBLIC, anon, authenticated;
    GRANT SELECT ON TABLE public.email_stats TO authenticated, service_role;
  END IF;

  IF to_regclass('public.audit_log') IS NOT NULL THEN
    REVOKE ALL ON TABLE public.audit_log FROM PUBLIC, anon, authenticated;
    GRANT SELECT ON TABLE public.audit_log TO authenticated;
    GRANT ALL ON TABLE public.audit_log TO service_role;
  END IF;
END $$;

-- ─── 6. profiles: sem TRUNCATE/TRIGGER/REFERENCES pela API ─────────────────
REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLE public.profiles FROM PUBLIC, anon, authenticated;

COMMIT;
