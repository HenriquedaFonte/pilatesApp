-- Migration: modalidade online por aluno + pagamentos online (mensalidade e drop-in)
-- Plano: docs/planos/2026-11-23-online-modalidades.md (PR A, passo 1)
--
-- DEPENDE de:
--   • 20261112010000_fix_profiles_privilege_escalation_and_rls.sql (public.is_staff())
--   • 20260617100000_create_audit_log.sql (public.audit_log)
--   • 20260201040001_create_testimonials_table.sql (public.update_updated_at_column())
-- Se faltar alguma, esta migration para logo no início e nada é aplicado.
--
-- Cria:
--   • public.online_memberships — 1 linha por aluno: plan (coached | recorded |
--       dropin) e status (requested | active | ended). Independente dos
--       créditos presenciais (nada muda em profiles nem em balance_history).
--   • public.online_payments — 1 pagamento por linha:
--       kind = 'monthly' → plan coached/recorded + period_start/period_end
--       kind = 'dropin'  → class_date (uma aula por linha)
--       valor, forma de pagamento, data do pagamento; erro se corrige
--       ANULANDO com motivo (valid → void). Nada é editado nem apagado.
--   • Guarda online_payments_guard() (BEFORE UPDATE, vale para todos os papéis,
--     inclusive SQL Editor): só deixa passar valid → void mexendo em status,
--     voided_at, voided_by, void_reason. NÃO há trigger de DELETE: o "apagar de
--     vez" do aluno (Edge Function manage-student) apaga o perfil e as linhas
--     daqui saem junto pelo ON DELETE CASCADE.
--   • RPCs (SECURITY DEFINER, search_path = public, só authenticated):
--       request_online_plan(p_plan)                       → aluno pede (requested)
--       set_online_membership(p_student_id, p_plan, p_status) → professora: active/ended
--       register_online_payment(...) RETURNS uuid         → professora registra
--       void_online_payment(p_payment_id, p_reason)       → professora anula
--     Erros: RAISE EXCEPTION com a mensagem = código ('online_...'); o site
--     traduz o código (online.errors.<código sem o prefixo>).
--
-- RLS: as duas tabelas só têm privilégio SELECT pela API (authenticated,
-- service_role para o backup). Uma policy SELECT: o próprio aluno ou a
-- professora/admin (is_staff()). Nenhuma policy de escrita: tudo pelas RPCs.
-- anon não lê nada nem chama nenhuma RPC.
--
-- "Hoje" = dia de Montréal: (now() AT TIME ZONE 'America/Montreal')::date.
--
-- Rodar no Supabase SQL Editor de uma vez. Está dentro de BEGIN/COMMIT: se
-- algo falhar, nada é aplicado. Idempotente: pode rodar de novo. Não altera
-- nem apaga dados nem colunas existentes.
--
-- TESTE:    docs/testes/online-modalidade-teste.sql
-- REVERSÃO: docs/testes/online-modalidade-reversao.sql (recusa se já houver
--           algum pagamento online, salvo v_forcar = true).

BEGIN;

-- ─── 0. Pré-condições ───────────────────────────────────────────────────────
DO $$
DECLARE
  v_is_staff regprocedure := to_regprocedure('public.is_staff()');
  v_tbl text;
BEGIN
  IF v_is_staff IS NULL
     OR coalesce(obj_description(v_is_staff, 'pg_proc'), '') NOT LIKE 'josi-pilates:%' THEN
    RAISE EXCEPTION 'public.is_staff() não encontrada. Rode antes a migration 20261112010000_fix_profiles_privilege_escalation_and_rls.sql. Nada foi aplicado.';
  END IF;

  IF to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'public.profiles não encontrada. Nada foi aplicado.';
  END IF;

  IF (SELECT count(*) FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'profiles'
        AND column_name IN ('id', 'role', 'email', 'deleted_at')) <> 4 THEN
    RAISE EXCEPTION 'public.profiles sem as colunas esperadas (id, role, email, deleted_at). Nada foi aplicado.';
  END IF;

  IF to_regclass('public.audit_log') IS NULL
     OR (SELECT count(*) FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'audit_log'
           AND column_name IN ('actor_id', 'actor_email', 'action', 'target_id', 'snapshot_data')) <> 5 THEN
    RAISE EXCEPTION 'public.audit_log não encontrada (ou sem as colunas esperadas). Rode antes 20260617100000_create_audit_log.sql. Nada foi aplicado.';
  END IF;

  IF to_regprocedure('public.update_updated_at_column()') IS NULL THEN
    RAISE EXCEPTION 'public.update_updated_at_column() não encontrada. Rode antes 20260201040001_create_testimonials_table.sql. Nada foi aplicado.';
  END IF;

  -- Não assumir tabelas com esses nomes criadas por outra coisa.
  FOREACH v_tbl IN ARRAY ARRAY['online_memberships', 'online_payments'] LOOP
    IF to_regclass('public.' || v_tbl) IS NOT NULL
       AND coalesce(obj_description(to_regclass('public.' || v_tbl), 'pg_class'), '') NOT LIKE 'josi-pilates:%' THEN
      RAISE EXCEPTION 'public.% já existe e não foi criada por esta migration. Nada foi aplicado.', v_tbl;
    END IF;
  END LOOP;
END $$;

-- ─── 1. online_memberships ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.online_memberships (
  student_id    UUID        PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan          TEXT        NOT NULL CHECK (plan IN ('coached', 'recorded', 'dropin')),
  status        TEXT        NOT NULL CHECK (status IN ('requested', 'active', 'ended')),
  requested_at  TIMESTAMPTZ,
  started_on    DATE,
  ended_on      DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by    UUID        -- sem FK (quem mexeu por último; pode ser apagado depois)
);
COMMENT ON TABLE public.online_memberships IS
  'josi-pilates: modalidade online do aluno (coached/recorded/dropin; requested/active/ended). Escrita só pelas RPCs request_online_plan e set_online_membership.';

DROP TRIGGER IF EXISTS trg_online_memberships_updated_at ON public.online_memberships;
CREATE TRIGGER trg_online_memberships_updated_at
  BEFORE UPDATE ON public.online_memberships
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── 2. online_payments ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.online_payments (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      UUID          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind            TEXT          NOT NULL CHECK (kind IN ('monthly', 'dropin')),
  plan            TEXT,
  period_start    DATE,
  period_end      DATE,
  class_date      DATE,
  amount          NUMERIC(10,2) NOT NULL CHECK (amount >= 0 AND amount < 100000),
  payment_method  TEXT          NOT NULL
                                CHECK (payment_method IN ('cash', 'interac', 'credit_card', 'other')),
  paid_on         DATE          NOT NULL,
  status          TEXT          NOT NULL DEFAULT 'valid' CHECK (status IN ('valid', 'void')),
  voided_at       TIMESTAMPTZ,
  voided_by       UUID,         -- sem FK (a professora pode ser apagada um dia)
  void_reason     TEXT,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_by      UUID,         -- sem FK

  -- Coerência por tipo (segunda barreira; a RPC já valida).
  CONSTRAINT online_payments_kind_fields CHECK (
    (kind = 'monthly' AND plan IN ('coached', 'recorded') AND period_start IS NOT NULL
      AND period_end >= period_start AND period_end <= period_start + 366 AND class_date IS NULL)
    OR (kind = 'dropin' AND plan IS NULL AND period_start IS NULL AND period_end IS NULL
      AND class_date IS NOT NULL)
  ),
  -- Anulação: void ⇔ voided_at preenchido, e então motivo não vazio.
  CONSTRAINT online_payments_void_fields CHECK (
    (status = 'void') = (voided_at IS NOT NULL)
    AND (status = 'valid' OR (void_reason IS NOT NULL AND length(btrim(void_reason)) > 0))
  )
);
COMMENT ON TABLE public.online_payments IS
  'josi-pilates: pagamentos das aulas online (mensalidade com período ou drop-in com data da aula). Imutável: só valid → void. Escrita só pelas RPCs register_online_payment e void_online_payment.';

CREATE INDEX IF NOT EXISTS online_payments_student_kind_status_idx
  ON public.online_payments (student_id, kind, status);
CREATE INDEX IF NOT EXISTS online_payments_paid_on_idx
  ON public.online_payments (paid_on);

-- ─── 3. Guarda de imutabilidade dos pagamentos ──────────────────────────────
-- Só UPDATE. Sem DELETE de propósito: o ON DELETE CASCADE do "apagar de vez"
-- do aluno tem de passar.
CREATE OR REPLACE FUNCTION public.online_payments_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  c_mutable CONSTANT text[] := ARRAY['status', 'voided_at', 'voided_by', 'void_reason'];
BEGIN
  IF OLD.status <> 'valid' OR NEW.status <> 'void' THEN
    RAISE EXCEPTION 'online payments are immutable (only valid → void is allowed)'
      USING ERRCODE = '42501';
  END IF;

  IF (to_jsonb(NEW) - c_mutable) IS DISTINCT FROM (to_jsonb(OLD) - c_mutable) THEN
    RAISE EXCEPTION 'online payments are immutable (only voiding is allowed)'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;
COMMENT ON FUNCTION public.online_payments_guard() IS
  'josi-pilates: impede qualquer UPDATE em online_payments além de anular (valid → void).';
REVOKE ALL ON FUNCTION public.online_payments_guard() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_online_payments_guard ON public.online_payments;
CREATE TRIGGER trg_online_payments_guard
  BEFORE UPDATE ON public.online_payments
  FOR EACH ROW EXECUTE FUNCTION public.online_payments_guard();

-- ─── 4. RLS e privilégios das tabelas ───────────────────────────────────────
-- Apaga TODAS as policies dessas duas tabelas (seja qual for o nome) e cria
-- só a de leitura.
DO $$
DECLARE
  v_pol record;
BEGIN
  FOR v_pol IN
    SELECT tablename, policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN ('online_memberships', 'online_payments')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', v_pol.policyname, v_pol.tablename);
  END LOOP;
END $$;

ALTER TABLE public.online_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.online_payments    ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.online_memberships FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.online_payments    FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.online_memberships TO authenticated, service_role;
GRANT SELECT ON TABLE public.online_payments    TO authenticated, service_role;

CREATE POLICY "online_memberships_select_own_or_staff" ON public.online_memberships
  FOR SELECT TO authenticated
  USING (student_id = (SELECT auth.uid()) OR (SELECT public.is_staff()));

CREATE POLICY "online_payments_select_own_or_staff" ON public.online_payments
  FOR SELECT TO authenticated
  USING (student_id = (SELECT auth.uid()) OR (SELECT public.is_staff()));

-- ─── 5. RPCs ────────────────────────────────────────────────────────────────

-- 5a. Pedido do aluno
-- Só o próprio aluno (role = 'student', não apagado). Sem linha → insere
-- 'requested'. Linha 'ended' → volta a 'requested' com o plano novo.
-- Linha 'requested'/'active' → online_plan_exists.
CREATE OR REPLACE FUNCTION public.request_online_plan(p_plan text)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller  uuid := auth.uid();
  v_status  text;
  v_rows    integer;
BEGIN
  IF v_caller IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_caller AND role = 'student' AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'online_not_allowed' USING ERRCODE = '42501';
  END IF;

  IF p_plan IS NULL OR p_plan NOT IN ('coached', 'recorded', 'dropin') THEN
    RAISE EXCEPTION 'online_invalid_plan' USING ERRCODE = '22023';
  END IF;

  SELECT status INTO v_status
  FROM public.online_memberships
  WHERE student_id = v_caller
  FOR UPDATE;

  IF FOUND THEN
    IF v_status IN ('requested', 'active') THEN
      RAISE EXCEPTION 'online_plan_exists' USING ERRCODE = '22023';
    END IF;

    -- v_status = 'ended'
    UPDATE public.online_memberships
    SET plan = p_plan,
        status = 'requested',
        requested_at = now(),
        started_on = NULL,
        ended_on = NULL,
        updated_by = v_caller
    WHERE student_id = v_caller;
    RETURN;
  END IF;

  -- Sem linha. ON CONFLICT cobre dois pedidos ao mesmo tempo.
  INSERT INTO public.online_memberships (student_id, plan, status, requested_at, updated_by)
  VALUES (v_caller, p_plan, 'requested', now(), v_caller)
  ON CONFLICT (student_id) DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RAISE EXCEPTION 'online_plan_exists' USING ERRCODE = '22023';
  END IF;
END;
$$;
COMMENT ON FUNCTION public.request_online_plan(text) IS
  'josi-pilates: aluno pede uma modalidade online (fica requested até a professora aprovar).';

-- 5b. Professora atribui/aprova (active) ou encerra/recusa (ended)
CREATE OR REPLACE FUNCTION public.set_online_membership(
  p_student_id  uuid,
  p_plan        text,
  p_status      text
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller       uuid := auth.uid();
  v_today        date := (now() AT TIME ZONE 'America/Montreal')::date;
  v_actor_email  text;
BEGIN
  IF v_caller IS NULL OR NOT public.is_staff() THEN
    RAISE EXCEPTION 'online_not_allowed' USING ERRCODE = '42501';
  END IF;

  IF p_student_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = p_student_id AND role = 'student'
  ) THEN
    RAISE EXCEPTION 'online_invalid_student' USING ERRCODE = '22023';
  END IF;

  IF p_plan IS NULL OR p_plan NOT IN ('coached', 'recorded', 'dropin') THEN
    RAISE EXCEPTION 'online_invalid_plan' USING ERRCODE = '22023';
  END IF;

  IF p_status IS NULL OR p_status NOT IN ('active', 'ended') THEN
    RAISE EXCEPTION 'online_invalid_status' USING ERRCODE = '22023';
  END IF;

  -- active: started_on = hoje se estava vazio ou se não vinha de active
  --         (mudar de plano estando ativo mantém a data de início); ended_on nulo.
  -- ended:  ended_on = hoje (se já estava encerrada, mantém a data antiga).
  INSERT INTO public.online_memberships AS m
    (student_id, plan, status, started_on, ended_on, updated_by)
  VALUES (
    p_student_id, p_plan, p_status,
    CASE WHEN p_status = 'active' THEN v_today END,
    CASE WHEN p_status = 'ended' THEN v_today END,
    v_caller
  )
  ON CONFLICT (student_id) DO UPDATE
  SET plan = EXCLUDED.plan,
      status = EXCLUDED.status,
      started_on = CASE
        WHEN EXCLUDED.status = 'active' THEN
          CASE WHEN m.status = 'active' AND m.started_on IS NOT NULL THEN m.started_on
               ELSE v_today END
        ELSE m.started_on
      END,
      ended_on = CASE
        WHEN EXCLUDED.status = 'active' THEN NULL
        WHEN m.status = 'ended' AND m.ended_on IS NOT NULL THEN m.ended_on
        ELSE v_today
      END,
      updated_by = v_caller;

  SELECT email INTO v_actor_email FROM public.profiles WHERE id = v_caller;
  INSERT INTO public.audit_log (actor_id, actor_email, action, target_id, snapshot_data)
  VALUES (
    v_caller,
    COALESCE(v_actor_email, auth.jwt() ->> 'email', ''),
    'online_membership.set',
    p_student_id,
    jsonb_build_object('student_id', p_student_id, 'plan', p_plan, 'status', p_status)
  );
END;
$$;
COMMENT ON FUNCTION public.set_online_membership(uuid, text, text) IS
  'josi-pilates: professora atribui/aprova (active) ou encerra/recusa (ended) a modalidade online de um aluno.';

-- 5c. Professora registra um pagamento online
-- monthly: p_plan coached/recorded, p_period_start/p_period_end (fim >= início,
--          até início + 366); p_class_date é ignorado (gravado nulo).
-- dropin:  p_class_date obrigatório; p_plan e o período são ignorados (nulos).
-- Recusa mensalidade que se sobrepõe a outra válida do mesmo aluno e drop-in
-- válido repetido na mesma data. Não mexe em online_memberships.
CREATE OR REPLACE FUNCTION public.register_online_payment(
  p_student_id      uuid,
  p_kind            text,
  p_plan            text,
  p_period_start    date,
  p_period_end      date,
  p_class_date      date,
  p_amount          numeric,
  p_payment_method  text,
  p_paid_on         date
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller       uuid := auth.uid();
  v_today        date := (now() AT TIME ZONE 'America/Montreal')::date;
  v_plan         text;
  v_start        date;
  v_end          date;
  v_class_date   date;
  v_id           uuid;
  v_actor_email  text;
BEGIN
  IF v_caller IS NULL OR NOT public.is_staff() THEN
    RAISE EXCEPTION 'online_not_allowed' USING ERRCODE = '42501';
  END IF;

  -- Trava por aluno: duas gravações ao mesmo tempo para o mesmo aluno esperam
  -- uma pela outra, então a checagem de sobreposição abaixo não é furada.
  PERFORM 1 FROM public.profiles
  WHERE id = p_student_id AND role = 'student'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'online_invalid_student' USING ERRCODE = '22023';
  END IF;

  IF p_kind IS NULL OR p_kind NOT IN ('monthly', 'dropin') THEN
    RAISE EXCEPTION 'online_invalid_kind' USING ERRCODE = '22023';
  END IF;

  IF p_kind = 'monthly' THEN
    IF p_plan IS NULL OR p_plan NOT IN ('coached', 'recorded') THEN
      RAISE EXCEPTION 'online_invalid_plan' USING ERRCODE = '22023';
    END IF;
    IF p_period_start IS NULL OR p_period_end IS NULL
       OR p_period_end < p_period_start
       OR p_period_end > p_period_start + 366 THEN
      RAISE EXCEPTION 'online_invalid_period' USING ERRCODE = '22023';
    END IF;
    v_plan := p_plan;
    v_start := p_period_start;
    v_end := p_period_end;
    v_class_date := NULL;
  ELSE
    IF p_class_date IS NULL THEN
      RAISE EXCEPTION 'online_invalid_date' USING ERRCODE = '22023';
    END IF;
    v_plan := NULL;
    v_start := NULL;
    v_end := NULL;
    v_class_date := p_class_date;
  END IF;

  IF p_paid_on IS NULL OR p_paid_on > v_today OR p_paid_on < DATE '2020-01-01' THEN
    RAISE EXCEPTION 'online_invalid_date' USING ERRCODE = '22023';
  END IF;

  IF p_amount IS NULL OR p_amount < 0 OR p_amount >= 100000
     OR round(p_amount, 2) <> p_amount THEN
    RAISE EXCEPTION 'online_invalid_amount' USING ERRCODE = '22023';
  END IF;

  IF p_payment_method IS NULL
     OR p_payment_method NOT IN ('cash', 'interac', 'credit_card', 'other') THEN
    RAISE EXCEPTION 'online_invalid_method' USING ERRCODE = '22023';
  END IF;

  IF p_kind = 'monthly' THEN
    IF EXISTS (
      SELECT 1 FROM public.online_payments
      WHERE student_id = p_student_id AND kind = 'monthly' AND status = 'valid'
        AND period_start <= v_end AND period_end >= v_start
    ) THEN
      RAISE EXCEPTION 'online_period_overlap' USING ERRCODE = '22023';
    END IF;
  ELSE
    IF EXISTS (
      SELECT 1 FROM public.online_payments
      WHERE student_id = p_student_id AND kind = 'dropin' AND status = 'valid'
        AND class_date = v_class_date
    ) THEN
      RAISE EXCEPTION 'online_dropin_duplicate' USING ERRCODE = '22023';
    END IF;
  END IF;

  INSERT INTO public.online_payments (
    student_id, kind, plan, period_start, period_end, class_date,
    amount, payment_method, paid_on, created_by
  ) VALUES (
    p_student_id, p_kind, v_plan, v_start, v_end, v_class_date,
    p_amount, p_payment_method, p_paid_on, v_caller
  )
  RETURNING id INTO v_id;

  -- Auditoria: só ids, tipo, plano e valor.
  SELECT email INTO v_actor_email FROM public.profiles WHERE id = v_caller;
  INSERT INTO public.audit_log (actor_id, actor_email, action, target_id, snapshot_data)
  VALUES (
    v_caller,
    COALESCE(v_actor_email, auth.jwt() ->> 'email', ''),
    'online_payment.register',
    p_student_id,
    jsonb_build_object(
      'payment_id', v_id,
      'student_id', p_student_id,
      'kind', p_kind,
      'plan', v_plan,
      'amount', p_amount
    )
  );

  RETURN v_id;
END;
$$;
COMMENT ON FUNCTION public.register_online_payment(uuid, text, text, date, date, date, numeric, text, date) IS
  'josi-pilates: professora registra um pagamento online (mensalidade ou drop-in). Devolve o id.';

-- 5d. Professora anula um pagamento (motivo obrigatório)
CREATE OR REPLACE FUNCTION public.void_online_payment(
  p_payment_id  uuid,
  p_reason      text
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller       uuid := auth.uid();
  v_reason       text := btrim(p_reason, E' \t\r\n');
  v_payment      record;
  v_actor_email  text;
BEGIN
  IF v_caller IS NULL OR NOT public.is_staff() THEN
    RAISE EXCEPTION 'online_not_allowed' USING ERRCODE = '42501';
  END IF;

  IF v_reason IS NULL OR v_reason = '' OR char_length(v_reason) > 500 THEN
    RAISE EXCEPTION 'online_reason_required' USING ERRCODE = '22023';
  END IF;

  SELECT id, student_id, status INTO v_payment
  FROM public.online_payments
  WHERE id = p_payment_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'online_payment_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_payment.status <> 'valid' THEN
    RAISE EXCEPTION 'online_already_void' USING ERRCODE = '22023';
  END IF;

  UPDATE public.online_payments
  SET status = 'void',
      voided_at = now(),
      voided_by = v_caller,
      void_reason = v_reason
  WHERE id = p_payment_id;

  -- Auditoria: só ids (o motivo fica no próprio pagamento).
  SELECT email INTO v_actor_email FROM public.profiles WHERE id = v_caller;
  INSERT INTO public.audit_log (actor_id, actor_email, action, target_id, snapshot_data)
  VALUES (
    v_caller,
    COALESCE(v_actor_email, auth.jwt() ->> 'email', ''),
    'online_payment.void',
    v_payment.student_id,
    jsonb_build_object('payment_id', v_payment.id, 'student_id', v_payment.student_id)
  );
END;
$$;
COMMENT ON FUNCTION public.void_online_payment(uuid, text) IS
  'josi-pilates: professora anula um pagamento online, com motivo.';

-- EXECUTE: só authenticated (a checagem de aluno/professora é feita dentro).
REVOKE ALL ON FUNCTION public.request_online_plan(text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.set_online_membership(uuid, text, text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.register_online_payment(uuid, text, text, date, date, date, numeric, text, date)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.void_online_payment(uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.request_online_plan(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_online_membership(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_online_payment(uuid, text, text, date, date, date, numeric, text, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.void_online_payment(uuid, text) TO authenticated;

COMMIT;

-- ROLLBACK (emergência): docs/testes/online-modalidade-reversao.sql
--   Apaga as 4 RPCs, a guarda e as duas tabelas. Recusa se já existir algum
--   pagamento online (dado financeiro), a menos que v_forcar = true no topo.
--   Antes, fazer Revert dos PRs de tela que usam estas tabelas.
