-- Migration: aluno não muda o próprio email em profiles pela API
--
-- Problema: "Meu perfil" (src/pages/StudentProfile.jsx) gravava o email só em
-- public.profiles, sem mudar o email de login (auth.users). Os dois ficavam
-- diferentes: o aluno continuava entrando com o email antigo, e os emails do
-- estúdio (créditos, avisos, recibos) iam para o email novo, que ninguém
-- confirmou. Um aluno podia até pôr o email de outra pessoa no próprio perfil.
--
-- Correção: o email do aluno passa a ser trocado só pela professora (tela do
-- aluno → Editar perfil), que usa a Edge Function manage-student
-- (action 'update-email'): ela muda auth.users e profiles juntos, com
-- service_role. No site, o campo email de "Meu perfil" fica somente leitura.
--
-- O que esta migration faz: recria public.prevent_privilege_escalation() igual
-- à da 20261112010000, só acrescentando 'email' à lista de colunas que o aluno
-- (não staff) não muda por UPDATE direto. Nada mais muda:
--   • professora/admin (is_staff) continuam podendo mudar email pela API;
--   • service_role (Edge Functions), RPCs SECURITY DEFINER, triggers do Auth e
--     SQL direto continuam liberados (o guarda só olha os papéis
--     authenticated/anon);
--   • UPDATE que manda o mesmo email de antes continua passando (o site manda a
--     linha inteira em useAuth.updateProfile).
-- O trigger enforce_privilege_escalation_guard já existe e não é recriado.
--
-- Rodar no Supabase SQL Editor de uma vez. Idempotente (CREATE OR REPLACE).
-- Não altera nem apaga dados.
--
-- REVERSÃO: docs/testes/email-perfil-reversao.sql (volta a função da
-- 20261112010000, sem 'email' na lista).

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
  END IF;

  RETURN NEW;
END;
$$;
