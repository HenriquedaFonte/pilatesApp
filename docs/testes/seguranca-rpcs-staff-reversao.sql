-- REVERSÃO da migration 20261112040000_require_staff_in_report_rpcs.sql
--
-- SÓ EM EMERGÊNCIA: volta ao estado de depois da 20261112030000, ou seja,
-- REABRE a falha (aluno logado volta a chamar relatórios, lista de alunos e
-- log de emails). Usar apenas se algum relatório da professora quebrar e não
-- der para esperar a correção.
--
-- O que faz, para cada invólucro criado pela migration:
--   • apaga o invólucro;
--   • devolve à <nome>_impl o nome original e tira o search_path fixo;
--   • EXECUTE como depois da 20261112030000: authenticated e service_role
--     (anon e PUBLIC continuam sem);
--   • apaga public.assert_staff_caller.
-- Não altera dados. Idempotente.

BEGIN;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT w.oid::regprocedure AS wrapper, i.oid::regprocedure AS impl, w.proname::text AS nome
    FROM pg_proc w
    JOIN pg_namespace n ON n.oid = w.pronamespace AND n.nspname = 'public'
    JOIN pg_proc i ON i.pronamespace = w.pronamespace
                  AND i.proname = w.proname || '_impl'
                  AND i.proargtypes = w.proargtypes
    WHERE coalesce(obj_description(w.oid, 'pg_proc'), '') LIKE 'josi-pilates: invólucro%'
      AND w.proname IN ('get_attendance_report', 'get_low_credits_report', 'get_zero_credits_students',
                        'get_students_for_notification', 'get_email_notification_stats',
                        'log_email_notification', 'is_profile_complete')
  LOOP
    EXECUTE format('DROP FUNCTION %s', r.wrapper);
    EXECUTE format('ALTER FUNCTION %s RESET search_path', r.impl);
    EXECUTE format('ALTER FUNCTION %s RENAME TO %I', r.impl, r.nome);
  END LOOP;

  FOR r IN
    SELECT p.oid::regprocedure AS fn
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
    WHERE p.proname IN ('get_attendance_report', 'get_low_credits_report', 'get_zero_credits_students',
                        'get_students_for_notification', 'get_email_notification_stats',
                        'log_email_notification', 'is_profile_complete')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', r.fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.fn);
  END LOOP;
END $$;

DROP FUNCTION IF EXISTS public.assert_staff_caller(text, uuid);

COMMIT;
