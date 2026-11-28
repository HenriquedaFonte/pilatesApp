-- Migration: retirada do consentimento de saúde e travas de imutabilidade
-- Plano: docs/planos/2026-11-28-perfil-e-consentimento-digital.md (PR B1, passo 4a)
--
-- DEPENDE de: 20261128000000_create_consents_and_health_profiles.sql (PR A).
-- Se ela não rodou, esta migration para logo no início e nada é aplicado.
--
-- Faz:
--   • consent_acceptances ganha withdrawn_at / withdrawn_by (sem FK). Só
--       aceites health_data podem ser retirados, uma única vez.
--   • O UNIQUE (student_id, consent_version_id) vira índice único PARCIAL
--       consent_acceptances_active_key (WHERE withdrawn_at IS NULL): depois de
--       retirar, o aluno pode consentir de novo na mesma versão (linha nova; a
--       antiga fica como registro do período com consentimento).
--   • Trava em consent_acceptances (BEFORE UPDATE, erro consent_immutable):
--       nada muda num aceite, exceto (1) withdrawn_at/withdrawn_by de NULL
--       para valor, uma vez, só em health_data; (2) recorded_by indo para NULL
--       (é o ON DELETE SET NULL quando o perfil da professora é apagado).
--       Vale para todos, inclusive postgres/SQL Editor. Sem trigger de DELETE
--       (a cascata do "apagar de vez" continua funcionando).
--   • Trava em consent_versions (BEFORE UPDATE, erro consent_version_locked):
--       versão que já tem aceite não pode ser alterada (nem pelo SQL Editor).
--       Corrigir texto = publicar versão nova.
--   • Ficha de saúde (student_health_profiles):
--       INSERT/UPDATE: staff ou o próprio aluno, e SEMPRE com consentimento de
--         saúde ATIVO do aluno da linha (a professora também não grava sem).
--       SELECT: o próprio aluno sempre; staff só com consentimento ativo.
--       DELETE: pela API, só pela RPC delete_health_profile (staff). A policy
--         de DELETE e o GRANT DELETE a authenticated saem: o DELETE direto não
--         alcançaria a ficha congelada (só vê o que a SELECT deixa ver).
--     Retirar o consentimento CONGELA a ficha: ela fica guardada (obrigação de
--     seguro/legal), ninguém grava, o aluno ainda lê, e a professora só lê pela
--     RPC read_retained_health_profile (com motivo, registrado no audit_log).
--     "Congelada" não é coluna: é "existe ficha e não há aceite health_data
--     ativo".
--   • RPCs (CREATE OR REPLACE, mesmas assinaturas): accept_consent,
--       register_paper_consent, my_pending_consents, staff_consent_overview
--       passam a considerar só aceites ativos (withdrawn_at IS NULL).
--   • RPCs novas (SECURITY DEFINER, search_path = public, só authenticated):
--       withdraw_health_consent(p_student_id) RETURNS integer — só staff
--         (o aluno pede à Josi; não há retirada pelo próprio aluno). Marca os
--         aceites health_data ativos do aluno; NÃO apaga a ficha. Devolve
--         quantos marcou; > 0 grava audit_log consent.health_withdraw.
--       read_retained_health_profile(p_student_id, p_reason) RETURNS SETOF
--         student_health_profiles — só staff; id nulo → consent_invalid_student;
--         motivo insurance | legal |
--         student_request; grava audit_log health_profile.restricted_read
--         (student_id e motivo, nunca conteúdo) e devolve a ficha (0 linhas se
--         não há ficha; grava o log mesmo assim).
--       delete_health_profile(p_student_id) RETURNS integer — só staff; apaga
--         a ficha (ativa ou congelada) e devolve quantas linhas (0 não é erro).
--         O audit_log health_profile.delete vem do trigger do PR A.
--     Erros novos: consent_immutable, consent_version_locked,
--     consent_invalid_reason.
--
-- Dados de saúde nunca vão para o audit_log: só ids, quantidade e motivo.
--
-- Rodar no Supabase SQL Editor de uma vez. Está dentro de BEGIN/COMMIT: se
-- algo falhar, nada é aplicado. Idempotente: pode rodar de novo. Não apaga
-- dados nem colunas.
--
-- TESTE:    docs/testes/consentimento-retirada-teste.sql e
--           docs/testes/consentimento-teste.sql (ajustado para esta migration)
-- REVERSÃO: docs/testes/consentimento-retirada-reversao.sql (recusa se já houver
--           retirada registrada, salvo v_forcar = true). Bloco no fim.

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

  IF to_regclass('public.audit_log') IS NULL THEN
    RAISE EXCEPTION 'public.audit_log não encontrada. Nada foi aplicado.';
  END IF;

  FOREACH v_tbl IN ARRAY ARRAY['consent_versions', 'consent_acceptances', 'student_health_profiles'] LOOP
    IF to_regclass('public.' || v_tbl) IS NULL
       OR coalesce(obj_description(to_regclass('public.' || v_tbl), 'pg_class'), '') NOT LIKE 'josi-pilates:%' THEN
      RAISE EXCEPTION 'public.% não encontrada (ou não criada pela migration 20261128000000_create_consents_and_health_profiles.sql). Rode antes a migration do PR A. Nada foi aplicado.', v_tbl;
    END IF;
  END LOOP;
END $$;

-- ─── 1. Colunas de retirada ─────────────────────────────────────────────────
ALTER TABLE public.consent_acceptances ADD COLUMN IF NOT EXISTS withdrawn_at TIMESTAMPTZ;
ALTER TABLE public.consent_acceptances ADD COLUMN IF NOT EXISTS withdrawn_by UUID;  -- sem FK (como updated_by)

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'public.consent_acceptances'::regclass
                   AND conname = 'consent_acceptances_withdrawn_fields') THEN
    ALTER TABLE public.consent_acceptances
      ADD CONSTRAINT consent_acceptances_withdrawn_fields
      CHECK (withdrawn_by IS NULL OR withdrawn_at IS NOT NULL);
  END IF;
END $$;

COMMENT ON COLUMN public.consent_acceptances.withdrawn_at IS
  'josi-pilates: quando o consentimento de saúde foi retirado (só health_data; preenchido uma vez por withdraw_health_consent). NULL = ativo.';
COMMENT ON COLUMN public.consent_acceptances.withdrawn_by IS
  'josi-pilates: quem registrou a retirada (professora). Sem FK.';

-- ─── 2. Único só entre aceites ativos ───────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS consent_acceptances_active_key
  ON public.consent_acceptances (student_id, consent_version_id)
  WHERE withdrawn_at IS NULL;

ALTER TABLE public.consent_acceptances
  DROP CONSTRAINT IF EXISTS consent_acceptances_student_version_key;

-- ─── 3. Trava em consent_acceptances ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.consent_acceptances_guard_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  -- Nenhuma outra coluna muda; recorded_by só pode ir para NULL
  -- (ON DELETE SET NULL do perfil da professora).
  IF (to_jsonb(NEW) - ARRAY['withdrawn_at', 'withdrawn_by', 'recorded_by'])
       IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['withdrawn_at', 'withdrawn_by', 'recorded_by'])
     OR (NEW.recorded_by IS DISTINCT FROM OLD.recorded_by AND NEW.recorded_by IS NOT NULL) THEN
    RAISE EXCEPTION 'consent_immutable' USING ERRCODE = '55000';
  END IF;

  -- Retirada: de NULL para valor, uma única vez, só em health_data.
  IF NEW.withdrawn_at IS DISTINCT FROM OLD.withdrawn_at
     OR NEW.withdrawn_by IS DISTINCT FROM OLD.withdrawn_by THEN
    IF OLD.withdrawn_at IS NOT NULL OR OLD.withdrawn_by IS NOT NULL OR NEW.withdrawn_at IS NULL THEN
      RAISE EXCEPTION 'consent_immutable' USING ERRCODE = '55000';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.consent_versions v
                   WHERE v.id = NEW.consent_version_id AND v.kind = 'health_data') THEN
      RAISE EXCEPTION 'consent_immutable' USING ERRCODE = '55000';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
COMMENT ON FUNCTION public.consent_acceptances_guard_update() IS
  'josi-pilates: aceite imutável; só deixa registrar a retirada (health_data, uma vez) e recorded_by ir para NULL.';
REVOKE ALL ON FUNCTION public.consent_acceptances_guard_update() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_consent_acceptances_guard_update ON public.consent_acceptances;
CREATE TRIGGER trg_consent_acceptances_guard_update
  BEFORE UPDATE ON public.consent_acceptances
  FOR EACH ROW EXECUTE FUNCTION public.consent_acceptances_guard_update();

-- ─── 4. Trava em consent_versions ───────────────────────────────────────────
-- SECURITY DEFINER: conta todos os aceites, sem filtro de RLS.
CREATE OR REPLACE FUNCTION public.consent_versions_guard_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.consent_acceptances a WHERE a.consent_version_id = OLD.id) THEN
    RAISE EXCEPTION 'consent_version_locked' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;
COMMENT ON FUNCTION public.consent_versions_guard_update() IS
  'josi-pilates: versão de termo com aceite não pode ser alterada (publicar versão nova).';
REVOKE ALL ON FUNCTION public.consent_versions_guard_update() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_consent_versions_guard_update ON public.consent_versions;
CREATE TRIGGER trg_consent_versions_guard_update
  BEFORE UPDATE ON public.consent_versions
  FOR EACH ROW EXECUTE FUNCTION public.consent_versions_guard_update();

-- ─── 5. Policies da ficha de saúde (DELETE só pela RPC delete_health_profile) ─
-- Armadilha: dentro da subconsulta, student_id sem qualificar viraria
-- a.student_id; por isso student_health_profiles.student_id.
DROP POLICY IF EXISTS "student_health_profiles_select_own_or_staff" ON public.student_health_profiles;
DROP POLICY IF EXISTS "student_health_profiles_insert_staff_or_consented_self" ON public.student_health_profiles;
DROP POLICY IF EXISTS "student_health_profiles_update_staff_or_consented_self" ON public.student_health_profiles;
DROP POLICY IF EXISTS "student_health_profiles_select_own_or_staff_consented" ON public.student_health_profiles;
DROP POLICY IF EXISTS "student_health_profiles_insert_consented" ON public.student_health_profiles;
DROP POLICY IF EXISTS "student_health_profiles_update_consented" ON public.student_health_profiles;

CREATE POLICY "student_health_profiles_select_own_or_staff_consented" ON public.student_health_profiles
  FOR SELECT TO authenticated
  USING (
    student_id = (SELECT auth.uid())
    OR (
      (SELECT public.is_staff()) AND EXISTS (
        SELECT 1 FROM public.consent_acceptances a
        JOIN public.consent_versions v ON v.id = a.consent_version_id
        WHERE a.student_id = student_health_profiles.student_id
          AND v.kind = 'health_data' AND a.withdrawn_at IS NULL)
    )
  );

CREATE POLICY "student_health_profiles_insert_consented" ON public.student_health_profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    ((SELECT public.is_staff()) OR student_id = (SELECT auth.uid()))
    AND EXISTS (
      SELECT 1 FROM public.consent_acceptances a
      JOIN public.consent_versions v ON v.id = a.consent_version_id
      WHERE a.student_id = student_health_profiles.student_id
        AND v.kind = 'health_data' AND a.withdrawn_at IS NULL)
  );

CREATE POLICY "student_health_profiles_update_consented" ON public.student_health_profiles
  FOR UPDATE TO authenticated
  USING (
    ((SELECT public.is_staff()) OR student_id = (SELECT auth.uid()))
    AND EXISTS (
      SELECT 1 FROM public.consent_acceptances a
      JOIN public.consent_versions v ON v.id = a.consent_version_id
      WHERE a.student_id = student_health_profiles.student_id
        AND v.kind = 'health_data' AND a.withdrawn_at IS NULL)
  )
  WITH CHECK (
    ((SELECT public.is_staff()) OR student_id = (SELECT auth.uid()))
    AND EXISTS (
      SELECT 1 FROM public.consent_acceptances a
      JOIN public.consent_versions v ON v.id = a.consent_version_id
      WHERE a.student_id = student_health_profiles.student_id
        AND v.kind = 'health_data' AND a.withdrawn_at IS NULL)
  );

-- DELETE: um único caminho, a RPC delete_health_profile (seção 7c). Pela API,
-- o DELETE direto não alcançaria a ficha congelada (o DELETE só vê as linhas
-- que a SELECT deixa ver). A cascata do "apagar de vez" não depende de GRANT
-- nem de policy (a ação referencial roda como dono da tabela).
DROP POLICY IF EXISTS "student_health_profiles_delete_staff" ON public.student_health_profiles;
REVOKE DELETE ON TABLE public.student_health_profiles FROM authenticated;

-- ─── 6. RPCs existentes: só aceites ativos ──────────────────────────────────

-- 6a. Aceite digital pelo próprio aluno (igual ao PR A, mas o "já aceitou"
-- olha só aceites ativos: depois de uma retirada, consentir de novo cria
-- linha nova).
CREATE OR REPLACE FUNCTION public.accept_consent(
  p_version_id  uuid,
  p_language    text,
  p_typed_name  text
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller        uuid := auth.uid();
  v_profile_name  text;
  v_kind          text;
  v_version       integer;
  v_name          text := nullif(btrim(p_typed_name, E' \t\r\n'), '');
  v_headers       json;
  v_ip            text;
  v_ua            text;
  v_id            uuid;
BEGIN
  SELECT full_name::text INTO v_profile_name
  FROM public.profiles
  WHERE id = v_caller AND role = 'student' AND deleted_at IS NULL;
  IF v_caller IS NULL OR NOT FOUND THEN
    RAISE EXCEPTION 'consent_not_allowed' USING ERRCODE = '42501';
  END IF;

  IF p_language IS NULL OR p_language NOT IN ('pt', 'en', 'fr') THEN
    RAISE EXCEPTION 'consent_invalid_language' USING ERRCODE = '22023';
  END IF;

  SELECT kind, version INTO v_kind, v_version
  FROM public.consent_versions
  WHERE id = p_version_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'consent_version_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_version < (SELECT max(version) FROM public.consent_versions WHERE kind = v_kind) THEN
    RAISE EXCEPTION 'consent_version_outdated' USING ERRCODE = '22023';
  END IF;

  IF v_name IS NULL THEN
    IF v_kind = 'class_policies' THEN
      RAISE EXCEPTION 'consent_invalid_name' USING ERRCODE = '22023';
    END IF;
  ELSIF char_length(v_name) < 2 OR char_length(v_name) > 200 THEN
    RAISE EXCEPTION 'consent_invalid_name' USING ERRCODE = '22023';
  END IF;

  -- IP e navegador (cabeçalhos do PostgREST). Cabeçalho ausente ou malformado
  -- não impede o aceite.
  BEGIN
    v_headers := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json;
    v_ip := left(nullif(trim(split_part(coalesce(v_headers->>'x-forwarded-for', ''), ',', 1)), ''), 100);
    v_ua := left(v_headers->>'user-agent', 500);
  EXCEPTION WHEN others THEN
    v_ip := NULL;
    v_ua := NULL;
  END;

  INSERT INTO public.consent_acceptances (
    student_id, consent_version_id, method, language, typed_name, profile_name,
    ip, user_agent
  ) VALUES (
    v_caller, p_version_id, 'digital', p_language, v_name, v_profile_name,
    v_ip, v_ua
  )
  ON CONFLICT (student_id, consent_version_id) WHERE withdrawn_at IS NULL DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM public.consent_acceptances
    WHERE student_id = v_caller AND consent_version_id = p_version_id
      AND withdrawn_at IS NULL;
  END IF;

  RETURN v_id;
END;
$$;
COMMENT ON FUNCTION public.accept_consent(uuid, text, text) IS
  'josi-pilates: aluno aceita a versão atual de um termo (digital). Devolve o id do aceite ativo (o existente, se já aceitou).';

-- 6b. Professora registra um termo assinado em papel (o "já aceitou" olha só
-- aceites ativos).
CREATE OR REPLACE FUNCTION public.register_paper_consent(
  p_student_id     uuid,
  p_version_id     uuid,
  p_signed_on      date,
  p_signer_name    text,
  p_guardian_name  text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller        uuid := auth.uid();
  v_today         date := (now() AT TIME ZONE 'America/Montreal')::date;
  v_profile_name  text;
  v_signer        text := nullif(btrim(p_signer_name, E' \t\r\n'), '');
  v_guardian      text := nullif(btrim(p_guardian_name, E' \t\r\n'), '');
  v_id            uuid;
  v_actor_email   text;
BEGIN
  IF v_caller IS NULL OR NOT public.is_staff() THEN
    RAISE EXCEPTION 'consent_not_allowed' USING ERRCODE = '42501';
  END IF;

  SELECT full_name::text INTO v_profile_name
  FROM public.profiles
  WHERE id = p_student_id AND role = 'student';
  IF p_student_id IS NULL OR NOT FOUND THEN
    RAISE EXCEPTION 'consent_invalid_student' USING ERRCODE = '22023';
  END IF;

  IF p_version_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.consent_versions WHERE id = p_version_id) THEN
    RAISE EXCEPTION 'consent_version_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF p_signed_on IS NULL OR p_signed_on < DATE '2000-01-01' OR p_signed_on > v_today THEN
    RAISE EXCEPTION 'consent_invalid_date' USING ERRCODE = '22023';
  END IF;

  IF v_signer IS NULL OR char_length(v_signer) < 2 OR char_length(v_signer) > 200 THEN
    RAISE EXCEPTION 'consent_invalid_name' USING ERRCODE = '22023';
  END IF;

  IF v_guardian IS NOT NULL AND (char_length(v_guardian) < 2 OR char_length(v_guardian) > 200) THEN
    RAISE EXCEPTION 'consent_invalid_name' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.consent_acceptances (
    student_id, consent_version_id, method, typed_name, profile_name,
    guardian_name, signed_on, recorded_by
  ) VALUES (
    p_student_id, p_version_id, 'paper', v_signer, v_profile_name,
    v_guardian, p_signed_on, v_caller
  )
  ON CONFLICT (student_id, consent_version_id) WHERE withdrawn_at IS NULL DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'consent_already_accepted' USING ERRCODE = '22023';
  END IF;

  -- Auditoria: só ids.
  SELECT email::text INTO v_actor_email FROM public.profiles WHERE id = v_caller;
  INSERT INTO public.audit_log (actor_id, actor_email, action, target_id, snapshot_data)
  VALUES (
    v_caller,
    COALESCE(v_actor_email, auth.jwt() ->> 'email', ''),
    'consent.paper_register',
    p_student_id,
    jsonb_build_object(
      'acceptance_id', v_id,
      'student_id', p_student_id,
      'consent_version_id', p_version_id
    )
  );

  RETURN v_id;
END;
$$;
COMMENT ON FUNCTION public.register_paper_consent(uuid, uuid, date, text, text) IS
  'josi-pilates: professora registra um termo assinado em papel. Devolve o id do aceite.';

-- 6c. Versões atuais (de cada kind) sem aceite ATIVO do chamador
CREATE OR REPLACE FUNCTION public.my_pending_consents()
RETURNS TABLE (kind text, version_id uuid, version integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cur.kind, cur.id, cur.version
  FROM (
    SELECT DISTINCT ON (cv.kind) cv.kind, cv.id, cv.version
    FROM public.consent_versions cv
    ORDER BY cv.kind, cv.version DESC
  ) cur
  WHERE auth.uid() IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.consent_acceptances a
      WHERE a.student_id = auth.uid() AND a.consent_version_id = cur.id
        AND a.withdrawn_at IS NULL
    )
  ORDER BY cur.kind;
$$;
COMMENT ON FUNCTION public.my_pending_consents() IS
  'josi-pilates: versões atuais de cada termo que o usuário logado ainda não aceitou (ou cujo consentimento foi retirado).';

-- 6d. Visão da professora. health_consent: algum aceite health_data ATIVO.
-- health_profile: tem ficha (ativa ou congelada). Retirada com ficha =
-- health_consent false e health_profile true.
CREATE OR REPLACE FUNCTION public.staff_consent_overview()
RETURNS TABLE (student_id uuid, policies_status text, health_consent boolean, health_profile boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_current uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_staff() THEN
    RAISE EXCEPTION 'consent_not_allowed' USING ERRCODE = '42501';
  END IF;

  SELECT cv.id INTO v_current
  FROM public.consent_versions cv
  WHERE cv.kind = 'class_policies'
  ORDER BY cv.version DESC
  LIMIT 1;

  RETURN QUERY
  SELECT
    p.id,
    CASE
      WHEN v_current IS NULL THEN 'current'
      WHEN EXISTS (SELECT 1 FROM public.consent_acceptances a
                   WHERE a.student_id = p.id AND a.consent_version_id = v_current) THEN 'current'
      WHEN EXISTS (SELECT 1 FROM public.consent_acceptances a
                   JOIN public.consent_versions cv ON cv.id = a.consent_version_id
                   WHERE a.student_id = p.id AND cv.kind = 'class_policies') THEN 'outdated'
      ELSE 'none'
    END,
    EXISTS (SELECT 1 FROM public.consent_acceptances a
            JOIN public.consent_versions cv ON cv.id = a.consent_version_id
            WHERE a.student_id = p.id AND cv.kind = 'health_data' AND a.withdrawn_at IS NULL),
    EXISTS (SELECT 1 FROM public.student_health_profiles h WHERE h.student_id = p.id)
  FROM public.profiles p
  WHERE p.role = 'student' AND p.deleted_at IS NULL
  ORDER BY p.id;
END;
$$;
COMMENT ON FUNCTION public.staff_consent_overview() IS
  'josi-pilates: professora vê, por aluno ativo, o status do termo (current/outdated/none), o consentimento de saúde ativo e se há ficha (ativa ou congelada).';

-- ─── 7. RPCs novas ──────────────────────────────────────────────────────────

-- 7a. Professora registra a retirada do consentimento de saúde de um aluno.
-- Só staff (o aluno pede à Josi). Parâmetro obrigatório. NÃO apaga a ficha.
CREATE OR REPLACE FUNCTION public.withdraw_health_consent(p_student_id uuid)
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller       uuid := auth.uid();
  v_count        integer;
  v_actor_email  text;
BEGIN
  IF v_caller IS NULL OR NOT public.is_staff() THEN
    RAISE EXCEPTION 'consent_not_allowed' USING ERRCODE = '42501';
  END IF;

  IF p_student_id IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_student_id AND role = 'student') THEN
    RAISE EXCEPTION 'consent_invalid_student' USING ERRCODE = '22023';
  END IF;

  UPDATE public.consent_acceptances a
  SET withdrawn_at = now(), withdrawn_by = v_caller
  FROM public.consent_versions v
  WHERE v.id = a.consent_version_id
    AND v.kind = 'health_data'
    AND a.student_id = p_student_id
    AND a.withdrawn_at IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count > 0 THEN
    -- Auditoria: só ids e quantidade.
    SELECT email::text INTO v_actor_email FROM public.profiles WHERE id = v_caller;
    INSERT INTO public.audit_log (actor_id, actor_email, action, target_id, snapshot_data)
    VALUES (
      v_caller,
      COALESCE(v_actor_email, auth.jwt() ->> 'email', ''),
      'consent.health_withdraw',
      p_student_id,
      jsonb_build_object('student_id', p_student_id, 'withdrawn_count', v_count)
    );
  END IF;

  RETURN v_count;
END;
$$;
COMMENT ON FUNCTION public.withdraw_health_consent(uuid) IS
  'josi-pilates: professora registra a retirada do consentimento de saúde do aluno (marca os aceites health_data ativos; a ficha fica congelada, não é apagada). Devolve quantos aceites marcou.';

-- 7b. Professora consulta a ficha guardada (congelada), com motivo registrado.
-- VOLATILE porque grava no audit_log. Funciona com ou sem consentimento ativo.
CREATE OR REPLACE FUNCTION public.read_retained_health_profile(p_student_id uuid, p_reason text)
RETURNS SETOF public.student_health_profiles
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller       uuid := auth.uid();
  v_actor_email  text;
BEGIN
  IF v_caller IS NULL OR NOT public.is_staff() THEN
    RAISE EXCEPTION 'consent_not_allowed' USING ERRCODE = '42501';
  END IF;

  IF p_student_id IS NULL THEN
    RAISE EXCEPTION 'consent_invalid_student' USING ERRCODE = '22023';
  END IF;

  IF p_reason IS NULL OR p_reason NOT IN ('insurance', 'legal', 'student_request') THEN
    RAISE EXCEPTION 'consent_invalid_reason' USING ERRCODE = '22023';
  END IF;

  -- Auditoria antes de devolver: student_id e motivo, nunca conteúdo.
  SELECT email::text INTO v_actor_email FROM public.profiles WHERE id = v_caller;
  INSERT INTO public.audit_log (actor_id, actor_email, action, target_id, snapshot_data)
  VALUES (
    v_caller,
    COALESCE(v_actor_email, auth.jwt() ->> 'email', ''),
    'health_profile.restricted_read',
    p_student_id,
    jsonb_build_object('student_id', p_student_id, 'reason', p_reason)
  );

  RETURN QUERY
  SELECT h.* FROM public.student_health_profiles h WHERE h.student_id = p_student_id;
END;
$$;
COMMENT ON FUNCTION public.read_retained_health_profile(uuid, text) IS
  'josi-pilates: professora lê a ficha de saúde guardada (consentimento retirado) informando o motivo (insurance/legal/student_request); cada leitura vai para o audit_log.';

-- 7c. Professora apaga a ficha de saúde (ativa ou congelada; fim do prazo de
-- guarda). Único caminho de apagamento pela API. Sem audit_log aqui: o trigger
-- AFTER DELETE do PR A já grava health_profile.delete com auth.uid() (quem
-- chamou, vindo do JWT, mesmo dentro de SECURITY DEFINER).
CREATE OR REPLACE FUNCTION public.delete_health_profile(p_student_id uuid)
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_staff() THEN
    RAISE EXCEPTION 'consent_not_allowed' USING ERRCODE = '42501';
  END IF;

  IF p_student_id IS NULL THEN
    RAISE EXCEPTION 'consent_invalid_student' USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.student_health_profiles WHERE student_id = p_student_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
COMMENT ON FUNCTION public.delete_health_profile(uuid) IS
  'josi-pilates: professora apaga a ficha de saúde do aluno (ativa ou congelada). Devolve quantas linhas apagou (0 ou 1). Auditada pelo trigger de DELETE.';

-- EXECUTE: só authenticated (a checagem de aluno/professora é feita dentro).
REVOKE ALL ON FUNCTION public.delete_health_profile(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_health_profile(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.accept_consent(uuid, text, text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.register_paper_consent(uuid, uuid, date, text, text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.my_pending_consents()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.staff_consent_overview()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.withdraw_health_consent(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.read_retained_health_profile(uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.accept_consent(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_paper_consent(uuid, uuid, date, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_pending_consents() TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_consent_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.withdraw_health_consent(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.read_retained_health_profile(uuid, text) TO authenticated;

-- ─── 8. Comentários das tabelas (prefixo josi-pilates: obrigatório) ─────────
COMMENT ON TABLE public.consent_versions IS
  'josi-pilates: textos versionados do termo das aulas (class_policies) e do consentimento de saúde (health_data), pt/en/fr. Publicados só por migration; a API só lê. Versão com aceite não pode ser alterada (trigger consent_version_locked).';
COMMENT ON TABLE public.consent_acceptances IS
  'josi-pilates: aceites do termo/consentimento (digital pelo app ou papel registrado pela professora). Imutável (trigger consent_immutable): só a retirada do health_data (withdrawn_at/withdrawn_by, uma vez, por withdraw_health_consent) e recorded_by indo para NULL. Escrita só pelas RPCs.';
COMMENT ON TABLE public.student_health_profiles IS
  'josi-pilates: ficha de saúde do aluno (1:1). Gravada (pelo aluno ou pela professora) só com consentimento health_data ativo. Congelada na retirada do consentimento: guardada, ninguém grava, o aluno lê, leitura da professora só por RPC (read_retained_health_profile, com motivo no audit_log). Só a professora apaga, pela RPC delete_health_profile. Conteúdo nunca vai para o audit_log.';

COMMIT;

-- ROLLBACK (emergência): docs/testes/consentimento-retirada-reversao.sql
--   Recusa se já existir retirada registrada (withdrawn_at preenchido), a menos
--   que v_forcar = true no topo. Depois dele, rodar DE NOVO a migration
--   20261128000000_create_consents_and_health_profiles.sql (recria as
--   policies e as 4 RPCs do PR A). Em resumo, ele faz:
--
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.withdraw_health_consent(uuid);
-- DROP FUNCTION IF EXISTS public.read_retained_health_profile(uuid, text);
-- DROP FUNCTION IF EXISTS public.delete_health_profile(uuid);
-- DROP TRIGGER IF EXISTS trg_consent_acceptances_guard_update ON public.consent_acceptances;
-- DROP TRIGGER IF EXISTS trg_consent_versions_guard_update ON public.consent_versions;
-- DROP FUNCTION IF EXISTS public.consent_acceptances_guard_update();
-- DROP FUNCTION IF EXISTS public.consent_versions_guard_update();
-- DROP POLICY IF EXISTS "student_health_profiles_select_own_or_staff_consented" ON public.student_health_profiles;
-- DROP POLICY IF EXISTS "student_health_profiles_insert_consented" ON public.student_health_profiles;
-- DROP POLICY IF EXISTS "student_health_profiles_update_consented" ON public.student_health_profiles;
-- (com v_forcar: DELETE dos aceites retirados)
-- DROP INDEX IF EXISTS public.consent_acceptances_active_key;
-- ALTER TABLE public.consent_acceptances DROP CONSTRAINT IF EXISTS consent_acceptances_withdrawn_fields;
-- ALTER TABLE public.consent_acceptances DROP COLUMN IF EXISTS withdrawn_by;
-- ALTER TABLE public.consent_acceptances DROP COLUMN IF EXISTS withdrawn_at;
-- ALTER TABLE public.consent_acceptances
--   ADD CONSTRAINT consent_acceptances_student_version_key UNIQUE (student_id, consent_version_id);
-- COMMIT;
-- -- e então: rodar de novo 20261128000000_create_consents_and_health_profiles.sql
-- --   (devolve a policy de DELETE de staff e o GRANT DELETE a authenticated)
