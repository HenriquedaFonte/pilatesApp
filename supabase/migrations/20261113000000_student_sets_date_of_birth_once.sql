-- Migration: o aluno preenche a própria data de nascimento uma vez só
--
-- Contexto: os recibos de seguro saem pelo sistema com a data de nascimento do
-- aluno (profiles.date_of_birth). Em "Meu perfil" (src/pages/StudentProfile.jsx)
-- o aluno passa a poder preencher essa data quando ela está vazia. Depois de
-- preenchida, só a professora corrige (tela do aluno → Editar perfil).
--
-- O que esta migration faz: recria public.prevent_privilege_escalation() igual
-- à da 20261112060000, acrescentando só a regra de date_of_birth para o aluno
-- (não staff) em requisição REST direta (papéis authenticated/anon):
--   • NULL → data: permitido, se a data estiver entre 1900-01-01 e hoje
--     (fora disso: erro 23514);
--   • data → outra data, ou data → NULL: bloqueado (erro 42501
--     'date_of_birth can only be changed by the teacher');
--   • UPDATE com o mesmo valor (o site manda a linha inteira em
--     useAuth.updateProfile) continua passando.
-- Nada mais muda:
--   • professora/admin (is_staff) continuam mudando a data pela API;
--   • service_role (Edge Functions), RPCs SECURITY DEFINER, triggers do Auth e
--     SQL direto continuam liberados (o guarda só olha authenticated/anon);
--   • o trigger é BEFORE UPDATE: o INSERT do cadastro (handle_new_user, e o
--     insert de useAuth quando o perfil não existe) não passa por ele.
-- O trigger enforce_privilege_escalation_guard já existe e não é recriado.
--
-- Rodar no Supabase SQL Editor de uma vez. Idempotente (CREATE OR REPLACE).
-- Não altera nem apaga dados.
--
-- REVERSÃO: docs/testes/data-nascimento-reversao.sql (volta exatamente a
-- função da 20261112060000).

DO $$
BEGIN
  IF to_regprocedure('public.is_staff()') IS NULL THEN
    RAISE EXCEPTION 'public.is_staff() não existe: rodar antes a 20261112010000. Nada foi aplicado.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.profiles'::regclass
      AND tgname = 'enforce_privilege_escalation_guard'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'Trigger enforce_privilege_escalation_guard não existe em profiles: rodar antes a 20261112010000. Nada foi aplicado.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles'
      AND column_name = 'date_of_birth' AND data_type = 'date'
  ) THEN
    RAISE EXCEPTION 'Coluna profiles.date_of_birth (date) não existe. Nada foi aplicado.';
  END IF;
END $$;

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
  -- email: o aluno não muda o próprio email em profiles; a professora troca
  -- pela Edge Function manage-student, que muda auth.users e profiles juntos.
  -- (anon não tem EXECUTE em is_staff(), por isso o IF separado)
  IF current_user = 'anon' THEN
    v_staff := false;
  ELSE
    v_staff := public.is_staff();
  END IF;

  IF NOT v_staff THEN
    v_new := to_jsonb(NEW);
    v_old := to_jsonb(OLD);
    FOREACH v_col IN ARRAY ARRAY['observations', 'is_active', 'deleted_at', 'deleted_by', 'email'] LOOP
      IF (v_new -> v_col) IS DISTINCT FROM (v_old -> v_col) THEN
        RAISE EXCEPTION 'permission denied: % can only be changed by the teacher', v_col
          USING ERRCODE = '42501';
      END IF;
    END LOOP;

    -- date_of_birth: o aluno preenche uma vez (vazia → data); depois, só a
    -- professora corrige.
    IF NEW.date_of_birth IS DISTINCT FROM OLD.date_of_birth THEN
      IF OLD.date_of_birth IS NOT NULL THEN
        RAISE EXCEPTION 'permission denied: date_of_birth can only be changed by the teacher'
          USING ERRCODE = '42501';
      END IF;
      IF NEW.date_of_birth < DATE '1900-01-01' OR NEW.date_of_birth > current_date THEN
        RAISE EXCEPTION 'date_of_birth must be between 1900-01-01 and today'
          USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
