-- Reversão — retirada do consentimento de saúde e travas
-- (migration 20261128010000_consent_withdrawal_and_locks.sql)
--
-- Só para emergência. ANTES: fazer o Revert dos PRs de tela que usam a
-- retirada (PR C: Meu perfil; PR D: card da professora), senão o site passa a
-- chamar RPCs que não existem.
--
-- A retirada do consentimento é registro legal: este script se RECUSA a rodar
-- se existir qualquer aceite com withdrawn_at preenchido. Para reverter mesmo
-- assim (por exemplo, só havia retiradas de teste), trocar v_forcar para true
-- na linha marcada logo abaixo — e, antes, guardar uma cópia (Table Editor →
-- consent_acceptances → Export to CSV, ou o backup do GitHub).
-- Com v_forcar = true os aceites RETIRADOS são APAGADOS: sem as colunas de
-- retirada, eles voltariam a valer como consentimento ativo, e o UNIQUE antigo
-- não aceita o aceite retirado e o novo da mesma versão. As fichas de saúde
-- não são apagadas: as fichas CONGELADAS (retiradas) voltam a ficar visíveis e
-- editáveis pela professora pela tabela (policies do PR A). Antes de forçar,
-- exportar essas fichas (Table Editor → student_health_profiles → Export to
-- CSV) e, se não puderem voltar a ser usadas nas aulas, apagá-las.
--
-- Remove: as RPCs withdraw_health_consent, read_retained_health_profile e
-- delete_health_profile; as
-- travas (triggers e funções consent_acceptances_guard_update e
-- consent_versions_guard_update); as 3 policies da ficha criadas pela
-- 20261128010000; o índice consent_acceptances_active_key, o CHECK e as
-- colunas withdrawn_at/withdrawn_by. Devolve o UNIQUE
-- consent_acceptances_student_version_key.
--
-- DEPOIS DESTE SCRIPT, rodar DE NOVO a migration
-- supabase/migrations/20261128000000_create_consents_and_health_profiles.sql:
-- ela recria as policies da ficha e as 4 RPCs (accept_consent,
-- register_paper_consent, my_pending_consents, staff_consent_overview) como
-- eram no PR A, e devolve a policy de DELETE de staff e o GRANT DELETE.
-- Entre os dois, a ficha fica sem nenhuma policy e sem DELETE (ninguém lê,
-- grava nem apaga pela API) e as 4 RPCs dão erro.
--
-- Rodar no Supabase SQL Editor de uma vez. Está dentro de BEGIN/COMMIT: se
-- algo falhar, nada é aplicado. Pode rodar de novo (IF EXISTS).

BEGIN;

DO $$
DECLARE
  v_forcar boolean := false;   -- ← trocar para true só para reverter mesmo com retiradas registradas (apaga os aceites retirados)
  n_ret bigint := 0;
BEGIN
  IF to_regclass('public.consent_acceptances') IS NULL THEN
    RAISE EXCEPTION 'public.consent_acceptances não existe: nada a reverter. Nada foi aplicado.';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'consent_acceptances'
               AND column_name = 'withdrawn_at') THEN
    -- Como dono, a RLS não filtra: conta todas as linhas.
    EXECUTE 'SELECT count(*) FROM public.consent_acceptances WHERE withdrawn_at IS NOT NULL' INTO n_ret;
  END IF;

  IF n_ret > 0 AND NOT v_forcar THEN
    RAISE EXCEPTION 'Existem % aceites com retirada registrada. É registro legal: a reversão não o apaga (trocar v_forcar para true no topo, depois de guardar uma cópia). Nada foi aplicado.', n_ret;
  END IF;
  IF n_ret > 0 THEN
    RAISE NOTICE 'v_forcar = true: % aceites retirados serão apagados.', n_ret;
    -- Apagar uma linha de aceite não passa pela trava (só UPDATE é travado).
    EXECUTE 'DELETE FROM public.consent_acceptances WHERE withdrawn_at IS NOT NULL';
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.withdraw_health_consent(uuid);
DROP FUNCTION IF EXISTS public.read_retained_health_profile(uuid, text);
DROP FUNCTION IF EXISTS public.delete_health_profile(uuid);

DROP TRIGGER IF EXISTS trg_consent_acceptances_guard_update ON public.consent_acceptances;
DROP TRIGGER IF EXISTS trg_consent_versions_guard_update ON public.consent_versions;
DROP FUNCTION IF EXISTS public.consent_acceptances_guard_update();
DROP FUNCTION IF EXISTS public.consent_versions_guard_update();

-- As policies dependem de withdrawn_at: saem antes da coluna.
DROP POLICY IF EXISTS "student_health_profiles_select_own_or_staff_consented" ON public.student_health_profiles;
DROP POLICY IF EXISTS "student_health_profiles_insert_consented" ON public.student_health_profiles;
DROP POLICY IF EXISTS "student_health_profiles_update_consented" ON public.student_health_profiles;

DROP INDEX IF EXISTS public.consent_acceptances_active_key;
ALTER TABLE public.consent_acceptances DROP CONSTRAINT IF EXISTS consent_acceptances_withdrawn_fields;
ALTER TABLE public.consent_acceptances DROP COLUMN IF EXISTS withdrawn_by;
ALTER TABLE public.consent_acceptances DROP COLUMN IF EXISTS withdrawn_at;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'public.consent_acceptances'::regclass
                   AND conname = 'consent_acceptances_student_version_key') THEN
    ALTER TABLE public.consent_acceptances
      ADD CONSTRAINT consent_acceptances_student_version_key UNIQUE (student_id, consent_version_id);
  END IF;
END $$;

COMMIT;

-- AGORA: rodar de novo supabase/migrations/20261128000000_create_consents_and_health_profiles.sql
--
-- Conferência (depois das duas; deve devolver nulos nas 6 primeiras e 4 na última):
--   SELECT to_regprocedure('public.withdraw_health_consent(uuid)'),
--          to_regprocedure('public.delete_health_profile(uuid)'),
--          to_regprocedure('public.read_retained_health_profile(uuid,text)'),
--          to_regprocedure('public.consent_acceptances_guard_update()'),
--          to_regprocedure('public.consent_versions_guard_update()'),
--          to_regclass('public.consent_acceptances_active_key'),
--          (SELECT count(*) FROM pg_policies WHERE schemaname = 'public'
--             AND tablename = 'student_health_profiles');
