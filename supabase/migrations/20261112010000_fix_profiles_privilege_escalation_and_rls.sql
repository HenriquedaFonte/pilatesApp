-- Migration: segurança de profiles (escalada de privilégio, RLS e RPCs de crédito)
--
-- Estado de PRODUÇÃO antes desta migration (levantado em 2026-11-12 com
-- docs/testes/seguranca-privilegios-diagnostico.sql):
--   • prevent_privilege_escalation() é SECURITY DEFINER → current_user lá dentro
--     é sempre postgres → o guarda nunca bloqueia: aluno vira professora e se
--     dá créditos pela REST API.
--   • profiles tem UMA policy: "Allow all authenticated operations" (ALL,
--     USING auth.role() = 'authenticated') → qualquer aluno lê, edita e apaga
--     o perfil de qualquer pessoa.
--   • update_class_balance é SECURITY INVOKER e mark_attendance é SECURITY
--     DEFINER; nenhuma confere quem chama, e anon/authenticated têm EXECUTE.
--
-- O que esta migration faz:
--   1. public.is_staff(): SECURITY DEFINER, diz se auth.uid() é teacher/admin
--      (lê profiles sem passar pela RLS, evita recursão nas policies).
--   2. prevent_privilege_escalation() passa a SECURITY INVOKER. Para requisições
--      REST (papéis authenticated/anon):
--        • ninguém muda role nem créditos por UPDATE direto (créditos só pelas
--          RPCs, que gravam o histórico);
--        • aluno (não staff) também não muda observations, is_active,
--          deleted_at, deleted_by. Nome, telefone, email, idioma, tema, data de
--          nascimento continuam editáveis pelo aluno.
--      RPCs SECURITY DEFINER, service_role e SQL direto continuam liberados.
--   3. Policies de profiles (só para authenticated; anon não tem nenhuma):
--        SELECT/UPDATE: própria linha ou staff
--        INSERT: só a própria linha, com role 'student' e créditos 0/NULL
--        DELETE: só staff
--   4. update_class_balance e mark_attendance: o corpo de produção NÃO é
--      reescrito. A função original é renomeada para *_impl (sem EXECUTE para
--      ninguém além do dono) e no lugar dela entra um invólucro SECURITY
--      DEFINER, com a mesma assinatura e os mesmos parâmetros, que:
--        • recusa quem tem JWT e não é staff nem service_role (aluno, anon);
--        • chama a original com os mesmos argumentos.
--      Assim o comportamento (saldo, histórico, check-in) fica exatamente igual.
--      EXECUTE do invólucro: authenticated e service_role (anon e PUBLIC não).
--
-- Rodar no Supabase SQL Editor de uma vez (o editor executa tudo numa
-- transação: se algo falhar, nada é aplicado). Idempotente: pode rodar de novo.
-- Não altera nem apaga dados.
--
-- REVERSÃO: docs/testes/seguranca-privilegios-reversao.sql (volta exatamente ao
-- estado de produção descrito acima, inclusive a falha).

-- ─── 0. Pré-condições ───────────────────────────────────────────────────────
DO $$
DECLARE
  v_is_staff regprocedure := to_regprocedure('public.is_staff()');
BEGIN
  -- Não sobrescrever um is_staff() que já exista com outro propósito.
  IF v_is_staff IS NOT NULL
     AND coalesce(obj_description(v_is_staff, 'pg_proc'), '') NOT LIKE 'josi-pilates:%' THEN
    RAISE EXCEPTION 'public.is_staff() já existe e não foi criada por esta migration. Nada foi aplicado.';
  END IF;

  IF to_regprocedure('public.update_class_balance(uuid,integer,text,text,text,numeric)') IS NULL
     AND to_regprocedure('public.update_class_balance_impl(uuid,integer,text,text,text,numeric)') IS NULL THEN
    RAISE EXCEPTION 'public.update_class_balance(uuid,integer,text,text,text,numeric) não encontrada. Nada foi aplicado.';
  END IF;

  IF to_regprocedure('public.mark_attendance(uuid,uuid,uuid,date,character varying,character varying)') IS NULL
     AND to_regprocedure('public.mark_attendance_impl(uuid,uuid,uuid,date,character varying,character varying)') IS NULL THEN
    RAISE EXCEPTION 'public.mark_attendance(uuid,uuid,uuid,date,varchar,varchar) não encontrada. Nada foi aplicado.';
  END IF;
END $$;

-- ─── 1. is_staff() ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('teacher', 'admin')
  );
$$;
COMMENT ON FUNCTION public.is_staff() IS
  'josi-pilates: true se auth.uid() for teacher/admin. SECURITY DEFINER para uso em policies de profiles sem recursão.';
REVOKE ALL ON FUNCTION public.is_staff() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated, service_role;

-- ─── 2. Guarda de escalada de privilégio ────────────────────────────────────
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

DROP TRIGGER IF EXISTS enforce_privilege_escalation_guard ON public.profiles;
CREATE TRIGGER enforce_privilege_escalation_guard
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_privilege_escalation();

-- ─── 3. Policies de profiles ────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all authenticated operations"  ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile"    ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile"  ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile"  ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own_or_staff"        ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own_or_staff"        ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own_as_student"      ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_staff"               ON public.profiles;

CREATE POLICY "profiles_select_own_or_staff" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()) OR (SELECT public.is_staff()));

CREATE POLICY "profiles_update_own_or_staff" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()) OR (SELECT public.is_staff()))
  WITH CHECK (id = (SELECT auth.uid()) OR (SELECT public.is_staff()));

CREATE POLICY "profiles_insert_own_as_student" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    id = (SELECT auth.uid())
    AND COALESCE(role, 'student') = 'student'
    AND COALESCE(individual_credits, 0) = 0
    AND COALESCE(duo_credits, 0) = 0
    AND COALESCE(group_credits, 0) = 0
  );

CREATE POLICY "profiles_delete_staff" ON public.profiles
  FOR DELETE TO authenticated
  USING ((SELECT public.is_staff()));

-- ─── 4. RPCs de crédito: invólucro com checagem de quem chama ───────────────
-- 4a. Renomeia as originais (só na primeira execução).
DO $$
BEGIN
  IF to_regprocedure('public.update_class_balance_impl(uuid,integer,text,text,text,numeric)') IS NULL THEN
    ALTER FUNCTION public.update_class_balance(uuid, integer, text, text, text, numeric)
      RENAME TO update_class_balance_impl;
  END IF;
  IF to_regprocedure('public.mark_attendance_impl(uuid,uuid,uuid,date,character varying,character varying)') IS NULL THEN
    ALTER FUNCTION public.mark_attendance(uuid, uuid, uuid, date, character varying, character varying)
      RENAME TO mark_attendance_impl;
  END IF;
END $$;

-- As originais ficam sem EXECUTE para os papéis da API.
REVOKE ALL ON FUNCTION public.update_class_balance_impl(uuid, integer, text, text, text, numeric)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.mark_attendance_impl(uuid, uuid, uuid, date, character varying, character varying)
  FROM PUBLIC, anon, authenticated, service_role;

-- 4b. Invólucros com o nome, a assinatura e os defaults de produção.
CREATE OR REPLACE FUNCTION public.update_class_balance(
  student_uuid uuid,
  change_amount integer,
  description_text text,
  credit_type_param text,
  payment_method_param text DEFAULT NULL,
  amount_paid_param numeric DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Com JWT (requisição pela API): só professora/admin ou service_role.
  -- Sem JWT (SQL Editor, psql): liberado.
  IF auth.role() IS NOT NULL
     AND auth.role() <> 'service_role'
     AND NOT public.is_staff() THEN
    RAISE EXCEPTION 'permission denied: only the teacher can change credits'
      USING ERRCODE = '42501';
  END IF;

  PERFORM public.update_class_balance_impl(
    student_uuid, change_amount, description_text, credit_type_param,
    payment_method_param, amount_paid_param
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_attendance(
  student_uuid uuid,
  class_uuid uuid,
  schedule_uuid uuid,
  attendance_date date,
  attendance_status character varying,
  credit_type_used character varying DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() IS NOT NULL
     AND auth.role() <> 'service_role'
     AND NOT public.is_staff() THEN
    RAISE EXCEPTION 'permission denied: only the teacher can mark attendance'
      USING ERRCODE = '42501';
  END IF;

  PERFORM public.mark_attendance_impl(
    student_uuid, class_uuid, schedule_uuid, attendance_date,
    attendance_status, credit_type_used
  );
END;
$$;

REVOKE ALL ON FUNCTION public.update_class_balance(uuid, integer, text, text, text, numeric)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_class_balance(uuid, integer, text, text, text, numeric)
  TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.mark_attendance(uuid, uuid, uuid, date, character varying, character varying)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_attendance(uuid, uuid, uuid, date, character varying, character varying)
  TO authenticated, service_role;
