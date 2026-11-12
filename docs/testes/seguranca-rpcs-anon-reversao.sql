-- REVERSÃO da migration 20261112030000_revoke_anon_rpcs_and_views.sql
--
-- ATENÇÃO: REABRE as falhas (anônimo baixa nome, email e créditos de todos os
-- alunos pelos relatórios e dispara envio de emails). Só usar em emergência,
-- se a correção quebrar algo crítico, e corrigir em seguida.
--
-- Volta ao estado logo depois da migration 20261112020000: get_attendance_report,
-- get_students_for_notification e log_email_notification continuam sem anon
-- (isso é da 20261112020000; para desfazer, ver
-- docs/testes/seguranca-rls-tabelas-reversao.sql).
--
-- Rodar no Supabase SQL Editor de uma vez. Idempotente. Não altera dados.

BEGIN;

DO $$
DECLARE
  v_fn regprocedure;
BEGIN
  FOR v_fn IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('get_low_credits_report', 'get_zero_credits_students',
                        'get_email_notification_stats', 'is_profile_complete',
                        'manual_trigger_notifications', 'trigger_email_notifications',
                        'schedule_email_notifications', 'handle_new_user')
  LOOP
    -- Padrão do Supabase
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO PUBLIC, anon, authenticated, service_role', v_fn);
  END LOOP;

  IF to_regclass('public.email_stats') IS NOT NULL THEN
    GRANT ALL ON TABLE public.email_stats TO anon, authenticated, service_role;
  END IF;
  IF to_regclass('public.audit_log') IS NOT NULL THEN
    GRANT ALL ON TABLE public.audit_log TO anon, authenticated, service_role;
  END IF;
END $$;

GRANT ALL ON TABLE public.profiles TO anon, authenticated, service_role;

COMMIT;
