-- REVERSÃO da migration 20261112010000_fix_profiles_privilege_escalation_and_rls.sql
--
-- ATENÇÃO: volta exatamente ao estado de produção de 2026-11-12, ou seja,
-- REABRE as falhas (aluno vira professora, aluno lê/edita/apaga qualquer
-- perfil, aluno e anônimo chamam as RPCs de crédito). Só usar em emergência,
-- se a correção quebrar algo crítico, e corrigir em seguida.
--
-- Rodar no Supabase SQL Editor de uma vez. Idempotente. Não altera dados.

-- ─── 1. RPCs: remove os invólucros e devolve o nome às originais ────────────
DO $$
BEGIN
  IF to_regprocedure('public.update_class_balance_impl(uuid,integer,text,text,text,numeric)') IS NOT NULL THEN
    DROP FUNCTION IF EXISTS public.update_class_balance(uuid, integer, text, text, text, numeric);
    ALTER FUNCTION public.update_class_balance_impl(uuid, integer, text, text, text, numeric)
      RENAME TO update_class_balance;
  END IF;
  IF to_regprocedure('public.mark_attendance_impl(uuid,uuid,uuid,date,character varying,character varying)') IS NOT NULL THEN
    DROP FUNCTION IF EXISTS public.mark_attendance(uuid, uuid, uuid, date, character varying, character varying);
    ALTER FUNCTION public.mark_attendance_impl(uuid, uuid, uuid, date, character varying, character varying)
      RENAME TO mark_attendance;
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.update_class_balance(uuid, integer, text, text, text, numeric)
  TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mark_attendance(uuid, uuid, uuid, date, character varying, character varying)
  TO PUBLIC, anon, authenticated, service_role;

-- ─── 2. Policies de profiles: volta a policy única aberta ───────────────────
DROP POLICY IF EXISTS "profiles_select_own_or_staff"   ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own_or_staff"   ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own_as_student" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_staff"          ON public.profiles;
DROP POLICY IF EXISTS "Allow all authenticated operations" ON public.profiles;
CREATE POLICY "Allow all authenticated operations" ON public.profiles
  FOR ALL TO public
  USING (auth.role() = 'authenticated');

-- ─── 3. Guarda: volta a versão SECURITY DEFINER (migration 20260620000003) ──
CREATE OR REPLACE FUNCTION public.prevent_privilege_escalation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Permite: SECURITY DEFINER functions, service_role, migrações diretas.
  -- Bloqueia apenas: requisições HTTP autenticadas diretas (REST API).
  IF current_user IS DISTINCT FROM 'authenticated' THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'permission denied: role cannot be changed via direct update'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.individual_credits IS DISTINCT FROM OLD.individual_credits
     OR NEW.duo_credits IS DISTINCT FROM OLD.duo_credits
     OR NEW.group_credits IS DISTINCT FROM OLD.group_credits THEN
    RAISE EXCEPTION 'permission denied: credits cannot be changed via direct update'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_privilege_escalation_guard ON public.profiles;
CREATE TRIGGER enforce_privilege_escalation_guard
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_privilege_escalation();

-- ─── 4. Remove is_staff() (não existia antes) ───────────────────────────────
DROP FUNCTION IF EXISTS public.is_staff();
