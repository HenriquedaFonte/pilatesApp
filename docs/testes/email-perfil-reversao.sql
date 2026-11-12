-- REVERSÃO da migration 20261112060000_lock_student_profile_email.sql
--
-- Volta public.prevent_privilege_escalation() exatamente à versão da
-- 20261112010000 (sem 'email' na lista). Efeito: o aluno volta a poder mudar o
-- próprio email em profiles pela API (só em profiles, não no login). Só usar
-- se a migration quebrar algo; o site novo não manda mais email em "Meu perfil".
--
-- Rodar no Supabase SQL Editor de uma vez. Idempotente. Não altera dados.

CREATE OR REPLACE FUNCTION public.prevent_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_new jsonb;
  v_old jsonb;
  v_col text;
  v_staff boolean;
BEGIN
  -- Libera: RPCs SECURITY DEFINER, service_role, migrations e SQL direto.
  -- Bloqueia: requisições REST diretas (papéis authenticated e anon).
  IF current_user NOT IN ('authenticated', 'anon') THEN
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

  -- Campos que só a professora muda. Comparados via jsonb para não depender
  -- de a coluna existir.
  -- (anon não tem EXECUTE em is_staff(), por isso o IF separado)
  IF current_user = 'anon' THEN
    v_staff := false;
  ELSE
    v_staff := public.is_staff();
  END IF;

  IF NOT v_staff THEN
    v_new := to_jsonb(NEW);
    v_old := to_jsonb(OLD);
    FOREACH v_col IN ARRAY ARRAY['observations', 'is_active', 'deleted_at', 'deleted_by'] LOOP
      IF (v_new -> v_col) IS DISTINCT FROM (v_old -> v_col) THEN
        RAISE EXCEPTION 'permission denied: % can only be changed by the teacher', v_col
          USING ERRCODE = '42501';
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;
