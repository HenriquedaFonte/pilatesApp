-- Reversão — termo de consentimento digital e ficha de saúde
-- (migrations 20261128000000_create_consents_and_health_profiles.sql e
--  20261128010000_consent_withdrawal_and_locks.sql: desfaz as duas)
--
-- Só para emergência. ANTES: fazer o Revert dos PRs de tela que usam estas
-- tabelas (PR C: assistente do aluno e bloqueio; PR D: card da professora e
-- badge), senão o site passa a dar erro ao ler tabelas e RPCs que não existem.
--
-- Aceite de termo é prova legal e a ficha é dado de saúde: este script se
-- RECUSA a rodar se existir qualquer aceite ou ficha de saúde. Para apagar
-- mesmo assim (por exemplo, só havia dados de teste), trocar v_forcar para
-- true na linha marcada logo abaixo — e, antes, guardar uma cópia
-- (Table Editor → consent_acceptances / student_health_profiles /
-- consent_versions → Export to CSV, ou o backup do GitHub).
--
-- Remove: as RPCs accept_consent, register_paper_consent,
-- my_pending_consents, staff_consent_overview, withdraw_health_consent,
-- delete_health_profile e read_retained_health_profile (esta antes da tabela: o tipo de retorno dela
-- depende de student_health_profiles); as tabelas
-- student_health_profiles, consent_acceptances e consent_versions (com as
-- policies, índices e triggers delas) e as funções de trigger
-- student_health_profiles_set_audit_fields(),
-- student_health_profiles_log_delete(), consent_acceptances_guard_update() e
-- consent_versions_guard_update(). Não mexe em profiles, audit_log (as
-- linhas consent.* e health_profile.* do audit_log ficam) nem is_staff().
--
-- Rodar no Supabase SQL Editor de uma vez. Está dentro de BEGIN/COMMIT: se
-- algo falhar, nada é aplicado. Pode rodar de novo (IF EXISTS).

BEGIN;

DO $$
DECLARE
  v_forcar boolean := false;   -- ← trocar para true só para apagar aceites/fichas existentes
  n_acc bigint := 0;
  n_fic bigint := 0;
  n_ver bigint := 0;
BEGIN
  -- Como dono, a RLS não filtra: conta todas as linhas.
  IF to_regclass('public.consent_acceptances') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.consent_acceptances' INTO n_acc;
  END IF;
  IF to_regclass('public.student_health_profiles') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.student_health_profiles' INTO n_fic;
  END IF;
  IF to_regclass('public.consent_versions') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.consent_versions' INTO n_ver;
  END IF;

  IF (n_acc > 0 OR n_fic > 0) AND NOT v_forcar THEN
    RAISE EXCEPTION 'Existem % aceites e % fichas de saúde. São dados legais/de saúde: a reversão não os apaga (trocar v_forcar para true no topo, depois de guardar uma cópia). Nada foi aplicado.', n_acc, n_fic;
  END IF;
  IF n_acc > 0 OR n_fic > 0 THEN
    RAISE NOTICE 'v_forcar = true: % aceites e % fichas de saúde serão apagados.', n_acc, n_fic;
  END IF;
  IF n_ver > 0 THEN
    RAISE NOTICE '% versões de termo publicadas serão apagadas (o texto está na migration de publicação).', n_ver;
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.accept_consent(uuid, text, text);
DROP FUNCTION IF EXISTS public.register_paper_consent(uuid, uuid, date, text, text);
DROP FUNCTION IF EXISTS public.my_pending_consents();
DROP FUNCTION IF EXISTS public.staff_consent_overview();
DROP FUNCTION IF EXISTS public.withdraw_health_consent(uuid);
DROP FUNCTION IF EXISTS public.read_retained_health_profile(uuid, text);
DROP FUNCTION IF EXISTS public.delete_health_profile(uuid);

-- DROP TABLE leva junto policies, índices e triggers.
DROP TABLE IF EXISTS public.student_health_profiles;
DROP TABLE IF EXISTS public.consent_acceptances;
DROP TABLE IF EXISTS public.consent_versions;
DROP FUNCTION IF EXISTS public.student_health_profiles_set_audit_fields();
DROP FUNCTION IF EXISTS public.student_health_profiles_log_delete();
DROP FUNCTION IF EXISTS public.consent_acceptances_guard_update();
DROP FUNCTION IF EXISTS public.consent_versions_guard_update();

COMMIT;

-- Conferência (deve devolver só nulos):
--   SELECT to_regclass('public.consent_versions'), to_regclass('public.consent_acceptances'),
--          to_regclass('public.student_health_profiles'),
--          to_regprocedure('public.accept_consent(uuid,text,text)'),
--          to_regprocedure('public.register_paper_consent(uuid,uuid,date,text,text)'),
--          to_regprocedure('public.my_pending_consents()'),
--          to_regprocedure('public.staff_consent_overview()'),
--          to_regprocedure('public.student_health_profiles_set_audit_fields()'),
--          to_regprocedure('public.student_health_profiles_log_delete()'),
--          to_regprocedure('public.withdraw_health_consent(uuid)'),
--          to_regprocedure('public.read_retained_health_profile(uuid,text)'),
--          to_regprocedure('public.delete_health_profile(uuid)'),
--          to_regprocedure('public.consent_acceptances_guard_update()'),
--          to_regprocedure('public.consent_versions_guard_update()');
