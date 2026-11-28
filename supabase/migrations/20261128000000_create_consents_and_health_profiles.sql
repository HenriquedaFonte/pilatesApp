-- Migration: termo de consentimento digital (versões + aceites) e ficha de saúde
-- Plano: docs/planos/2026-11-28-perfil-e-consentimento-digital.md (PR A, passo 1)
--
-- ATENÇÃO: NÃO rodar de novo depois da 20261128010000_consent_withdrawal_and_locks.sql,
-- salvo na reversão (docs/testes/consentimento-retirada-reversao.sql manda
-- rodar esta logo depois). Rodada sozinha por cima da 20261128010000, ela
-- devolveria as policies antigas da ficha e as RPCs sem a retirada.
--
-- DEPENDE de:
--   • 20261112010000_fix_profiles_privilege_escalation_and_rls.sql (public.is_staff())
--   • 20260617100000_create_audit_log.sql (public.audit_log)
-- Se faltar alguma, esta migration para logo no início e nada é aplicado.
--
-- Cria:
--   • public.consent_versions — textos versionados (kind = class_policies |
--       health_data), título e corpo em pt/en/fr, texto puro. Linhas
--       publicadas só por migration (a API só lê). ESTA MIGRATION NÃO PUBLICA
--       NENHUMA VERSÃO: sem versão publicada, ninguém fica pendente.
--   • public.consent_acceptances — 1 aceite por aluno e versão (digital pelo
--       app ou papel registrado pela professora). Imutável pela API: só
--       SELECT; gravação só pelas RPCs. FK para consent_versions sem cascata
--       (uma versão já aceita não pode ser apagada). NÃO há trigger de DELETE:
--       o "apagar de vez" do aluno (Edge Function manage-student) apaga o
--       perfil e os aceites saem junto pelo ON DELETE CASCADE.
--   • public.student_health_profiles — ficha de saúde 1:1 por aluno.
--       Trigger BEFORE INSERT/UPDATE grava updated_at/updated_by (auth.uid()).
--       Trigger AFTER DELETE grava no audit_log (só ids) quando quem apaga é
--       um usuário logado; na cascata do "apagar de vez" pela service_role
--       (auth.uid() nulo) não grava nada e não bloqueia.
--   • RPCs (SECURITY DEFINER, search_path = public, só authenticated):
--       accept_consent(p_version_id, p_language, p_typed_name) RETURNS uuid
--       register_paper_consent(p_student_id, p_version_id, p_signed_on,
--                              p_signer_name, p_guardian_name) RETURNS uuid
--       my_pending_consents() RETURNS TABLE (kind, version_id, version)
--       staff_consent_overview() RETURNS TABLE (student_id, policies_status,
--                                               health_consent, health_profile)
--     Erros: RAISE EXCEPTION com a mensagem = código ('consent_...'); o site
--     traduz o código.
--
-- RLS (anon não lê nada nem chama nenhuma RPC):
--   consent_versions        SELECT: authenticated. Nenhuma escrita pela API.
--   consent_acceptances     SELECT: o próprio aluno ou staff. Nenhuma escrita.
--   student_health_profiles SELECT: o próprio aluno ou staff.
--                           INSERT/UPDATE: staff, ou o próprio aluno SE já deu
--                             o consentimento de saúde (aceite health_data).
--                             UPDATE com USING = WITH CHECK (não troca student_id).
--                           DELETE: só staff.
--   service_role: só SELECT nas 3 tabelas (backup).
--
-- Dados de saúde nunca vão para o audit_log: só ids.
-- "Hoje" = dia de Montréal: (now() AT TIME ZONE 'America/Montreal')::date.
--
-- Rodar no Supabase SQL Editor de uma vez. Está dentro de BEGIN/COMMIT: se
-- algo falhar, nada é aplicado. Idempotente: pode rodar de novo. Não altera
-- nem apaga dados nem colunas existentes (nada muda em profiles).
--
-- TESTE:    docs/testes/consentimento-teste.sql
-- REVERSÃO: docs/testes/consentimento-reversao.sql (recusa se já houver
--           aceite ou ficha de saúde, salvo v_forcar = true). Bloco no fim.

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

  IF to_regprocedure('auth.uid()') IS NULL THEN
    RAISE EXCEPTION 'auth.uid() não encontrada (banco não é Supabase?). Nada foi aplicado.';
  END IF;

  IF to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'public.profiles não encontrada. Nada foi aplicado.';
  END IF;

  IF (SELECT count(*) FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'profiles'
        AND column_name IN ('id', 'role', 'email', 'full_name', 'deleted_at')) <> 5 THEN
    RAISE EXCEPTION 'public.profiles sem as colunas esperadas (id, role, email, full_name, deleted_at). Nada foi aplicado.';
  END IF;

  IF to_regclass('public.audit_log') IS NULL
     OR (SELECT count(*) FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'audit_log'
           AND column_name IN ('actor_id', 'actor_email', 'action', 'target_id', 'snapshot_data')) <> 5 THEN
    RAISE EXCEPTION 'public.audit_log não encontrada (ou sem as colunas esperadas). Rode antes 20260617100000_create_audit_log.sql. Nada foi aplicado.';
  END IF;

  -- Não assumir tabelas com esses nomes criadas por outra coisa.
  FOREACH v_tbl IN ARRAY ARRAY['consent_versions', 'consent_acceptances', 'student_health_profiles'] LOOP
    IF to_regclass('public.' || v_tbl) IS NOT NULL
       AND coalesce(obj_description(to_regclass('public.' || v_tbl), 'pg_class'), '') NOT LIKE 'josi-pilates:%' THEN
      RAISE EXCEPTION 'public.% já existe e não foi criada por esta migration. Nada foi aplicado.', v_tbl;
    END IF;
  END LOOP;
END $$;

-- ─── 1. consent_versions ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.consent_versions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  kind          TEXT        NOT NULL CHECK (kind IN ('class_policies', 'health_data')),
  version       INTEGER     NOT NULL CHECK (version >= 1),
  title_pt      TEXT        NOT NULL,
  title_en      TEXT        NOT NULL,
  title_fr      TEXT        NOT NULL,
  body_pt       TEXT        NOT NULL,   -- texto puro, parágrafos com \n (nunca HTML)
  body_en       TEXT        NOT NULL,
  body_fr       TEXT        NOT NULL,
  published_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT consent_versions_kind_version_key UNIQUE (kind, version)
);
COMMENT ON TABLE public.consent_versions IS
  'josi-pilates: textos versionados do termo das aulas (class_policies) e do consentimento de saúde (health_data), pt/en/fr. Publicados só por migration; a API só lê.';

-- ─── 2. consent_acceptances ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.consent_acceptances (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id          UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  consent_version_id  UUID        NOT NULL REFERENCES public.consent_versions(id),
  method              TEXT        NOT NULL CHECK (method IN ('digital', 'paper')),
  language            TEXT        CHECK (language IN ('pt', 'en', 'fr')),
  typed_name          TEXT        CHECK (char_length(typed_name) <= 200),
  profile_name        TEXT,       -- profiles.full_name no momento do aceite
  guardian_name       TEXT        CHECK (char_length(guardian_name) <= 200),
  signed_on           DATE,       -- data da assinatura no papel
  accepted_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip                  TEXT,
  user_agent          TEXT,
  recorded_by         UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT consent_acceptances_student_version_key UNIQUE (student_id, consent_version_id),
  -- Coerência por método (segunda barreira; as RPCs já validam).
  CONSTRAINT consent_acceptances_method_fields CHECK (
    (method = 'digital' AND language IS NOT NULL AND signed_on IS NULL)
    OR (method = 'paper' AND signed_on IS NOT NULL)
  )
);
COMMENT ON TABLE public.consent_acceptances IS
  'josi-pilates: aceites do termo/consentimento (digital pelo app ou papel registrado pela professora). Imutável pela API; escrita só pelas RPCs accept_consent e register_paper_consent.';

CREATE INDEX IF NOT EXISTS consent_acceptances_version_idx
  ON public.consent_acceptances (consent_version_id);

-- ─── 3. student_health_profiles ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.student_health_profiles (
  student_id               UUID        PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  occupation               TEXT        CHECK (char_length(occupation) <= 2000),
  emergency_contact_name   TEXT        CHECK (char_length(emergency_contact_name) <= 2000),
  emergency_contact_phone  TEXT        CHECK (char_length(emergency_contact_phone) <= 2000),
  main_goal                TEXT        CHECK (char_length(main_goal) <= 2000),
  conditions               TEXT[]      NOT NULL DEFAULT '{}'
                                       CHECK (conditions <@ ARRAY['cardiac_hypertension', 'respiratory', 'digestive',
                                                                  'back_neck_shoulder', 'hip_knee_foot',
                                                                  'frequent_headache']::text[]),
  conditions_details       TEXT        CHECK (char_length(conditions_details) <= 2000),
  medications              TEXT        CHECK (char_length(medications) <= 2000),
  current_treatment        TEXT        CHECK (char_length(current_treatment) <= 2000),
  surgeries                TEXT        CHECK (char_length(surgeries) <= 2000),
  physical_activities      TEXT        CHECK (char_length(physical_activities) <= 2000),
  sleep_quality            TEXT        CHECK (sleep_quality IN ('excellent', 'good', 'fair', 'poor')),
  diet_quality             TEXT        CHECK (diet_quality IN ('excellent', 'good', 'fair', 'poor')),
  pregnant                 BOOLEAN,
  pregnancy_weeks          INTEGER     CHECK (pregnancy_weeks BETWEEN 1 AND 42),
  pregnancy_reported_on    DATE,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by               UUID        -- sem FK (quem mexeu por último; pode ser apagado depois)
);
COMMENT ON TABLE public.student_health_profiles IS
  'josi-pilates: ficha de saúde do aluno (1:1). Aluno grava a própria só com consentimento health_data; professora grava e apaga. Conteúdo nunca vai para o audit_log.';

-- 3a. updated_at / updated_by (e created_at não muda no UPDATE)
CREATE OR REPLACE FUNCTION public.student_health_profiles_set_audit_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := now();
  ELSE
    NEW.created_at := OLD.created_at;
  END IF;
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$;
COMMENT ON FUNCTION public.student_health_profiles_set_audit_fields() IS
  'josi-pilates: grava updated_at/updated_by (auth.uid()) na ficha de saúde.';
REVOKE ALL ON FUNCTION public.student_health_profiles_set_audit_fields() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_student_health_profiles_audit_fields ON public.student_health_profiles;
CREATE TRIGGER trg_student_health_profiles_audit_fields
  BEFORE INSERT OR UPDATE ON public.student_health_profiles
  FOR EACH ROW EXECUTE FUNCTION public.student_health_profiles_set_audit_fields();

-- 3b. audit_log no DELETE (só ids). Sem usuário logado (service_role no
-- "apagar de vez", SQL Editor) não grava: actor_id é NOT NULL no audit_log e
-- a cascata não pode falhar. Não bloqueia nada.
CREATE OR REPLACE FUNCTION public.student_health_profiles_log_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller       uuid := auth.uid();
  v_actor_email  text;
BEGIN
  IF v_caller IS NULL THEN
    RETURN OLD;
  END IF;

  SELECT email::text INTO v_actor_email FROM public.profiles WHERE id = v_caller;
  INSERT INTO public.audit_log (actor_id, actor_email, action, target_id, snapshot_data)
  VALUES (
    v_caller,
    COALESCE(v_actor_email, auth.jwt() ->> 'email', ''),
    'health_profile.delete',
    OLD.student_id,
    jsonb_build_object('student_id', OLD.student_id)
  );
  RETURN OLD;
END;
$$;
COMMENT ON FUNCTION public.student_health_profiles_log_delete() IS
  'josi-pilates: registra no audit_log (só ids) quem apagou uma ficha de saúde.';
REVOKE ALL ON FUNCTION public.student_health_profiles_log_delete() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_student_health_profiles_log_delete ON public.student_health_profiles;
CREATE TRIGGER trg_student_health_profiles_log_delete
  AFTER DELETE ON public.student_health_profiles
  FOR EACH ROW EXECUTE FUNCTION public.student_health_profiles_log_delete();

-- ─── 4. RLS e privilégios das tabelas ───────────────────────────────────────
-- Armadilha: o Supabase dá ALL a anon/authenticated/service_role em tabela
-- nova. Tira tudo e devolve só o necessário.
DO $$
DECLARE
  v_pol record;
BEGIN
  FOR v_pol IN
    SELECT tablename, policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('consent_versions', 'consent_acceptances', 'student_health_profiles')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', v_pol.policyname, v_pol.tablename);
  END LOOP;
END $$;

ALTER TABLE public.consent_versions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_acceptances     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_health_profiles ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.consent_versions        FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.consent_acceptances     FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.student_health_profiles FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.consent_versions        TO authenticated, service_role;
GRANT SELECT ON TABLE public.consent_acceptances     TO authenticated, service_role;
GRANT SELECT ON TABLE public.student_health_profiles TO authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON TABLE public.student_health_profiles TO authenticated;

CREATE POLICY "consent_versions_select_authenticated" ON public.consent_versions
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "consent_acceptances_select_own_or_staff" ON public.consent_acceptances
  FOR SELECT TO authenticated
  USING (student_id = (SELECT auth.uid()) OR (SELECT public.is_staff()));

CREATE POLICY "student_health_profiles_select_own_or_staff" ON public.student_health_profiles
  FOR SELECT TO authenticated
  USING (student_id = (SELECT auth.uid()) OR (SELECT public.is_staff()));

CREATE POLICY "student_health_profiles_insert_staff_or_consented_self" ON public.student_health_profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.is_staff())
    OR (
      student_id = (SELECT auth.uid()) AND EXISTS (
        SELECT 1 FROM public.consent_acceptances a
        JOIN public.consent_versions v ON v.id = a.consent_version_id
        WHERE a.student_id = (SELECT auth.uid()) AND v.kind = 'health_data')
    )
  );

CREATE POLICY "student_health_profiles_update_staff_or_consented_self" ON public.student_health_profiles
  FOR UPDATE TO authenticated
  USING (
    (SELECT public.is_staff())
    OR (
      student_id = (SELECT auth.uid()) AND EXISTS (
        SELECT 1 FROM public.consent_acceptances a
        JOIN public.consent_versions v ON v.id = a.consent_version_id
        WHERE a.student_id = (SELECT auth.uid()) AND v.kind = 'health_data')
    )
  )
  WITH CHECK (
    (SELECT public.is_staff())
    OR (
      student_id = (SELECT auth.uid()) AND EXISTS (
        SELECT 1 FROM public.consent_acceptances a
        JOIN public.consent_versions v ON v.id = a.consent_version_id
        WHERE a.student_id = (SELECT auth.uid()) AND v.kind = 'health_data')
    )
  );

CREATE POLICY "student_health_profiles_delete_staff" ON public.student_health_profiles
  FOR DELETE TO authenticated
  USING ((SELECT public.is_staff()));

-- ─── 5. RPCs ────────────────────────────────────────────────────────────────

-- 5a. Aceite digital pelo próprio aluno
-- Só aluno (role = 'student', não apagado). Só a versão ATUAL do kind (maior
-- version). Nome digitado aparado, 2 a 200 caracteres: obrigatório para
-- class_policies, opcional para health_data. Aceite repetido da mesma versão
-- (duplo clique) devolve o id existente.
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
  ON CONFLICT (student_id, consent_version_id) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM public.consent_acceptances
    WHERE student_id = v_caller AND consent_version_id = p_version_id;
  END IF;

  RETURN v_id;
END;
$$;
COMMENT ON FUNCTION public.accept_consent(uuid, text, text) IS
  'josi-pilates: aluno aceita a versão atual de um termo (digital). Devolve o id do aceite (o existente, se já aceitou).';

-- 5b. Professora registra um termo assinado em papel
-- Qualquer versão existente. signed_on entre 2000-01-01 e hoje (Montréal).
-- Nome de quem assinou: 2 a 200 caracteres (vai em typed_name). Responsável:
-- opcional, até 200. Já existe aceite dessa versão → consent_already_accepted.
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
  ON CONFLICT (student_id, consent_version_id) DO NOTHING
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

-- 5c. Versões atuais (de cada kind) que o chamador ainda não aceitou
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
    )
  ORDER BY cur.kind;
$$;
COMMENT ON FUNCTION public.my_pending_consents() IS
  'josi-pilates: versões atuais de cada termo que o usuário logado ainda não aceitou.';

-- 5d. Visão da professora: status de termo e ficha de cada aluno ativo
-- policies_status: 'current' (aceitou a versão atual de class_policies, ou
-- nenhuma versão publicada), 'outdated' (aceitou só versão antiga), 'none'.
-- health_consent: algum aceite health_data. health_profile: tem ficha.
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
            WHERE a.student_id = p.id AND cv.kind = 'health_data'),
    EXISTS (SELECT 1 FROM public.student_health_profiles h WHERE h.student_id = p.id)
  FROM public.profiles p
  WHERE p.role = 'student' AND p.deleted_at IS NULL
  ORDER BY p.id;
END;
$$;
COMMENT ON FUNCTION public.staff_consent_overview() IS
  'josi-pilates: professora vê, por aluno ativo, o status do termo (current/outdated/none), o consentimento de saúde e se há ficha.';

-- EXECUTE: só authenticated (a checagem de aluno/professora é feita dentro).
REVOKE ALL ON FUNCTION public.accept_consent(uuid, text, text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.register_paper_consent(uuid, uuid, date, text, text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.my_pending_consents()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.staff_consent_overview()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.accept_consent(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_paper_consent(uuid, uuid, date, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_pending_consents() TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_consent_overview() TO authenticated;

COMMIT;

-- ROLLBACK (emergência): docs/testes/consentimento-reversao.sql
--   Recusa se já existir aceite ou ficha de saúde (dados legais/de saúde), a
--   menos que v_forcar = true no topo. Antes, fazer Revert dos PRs de tela
--   (C e D) que usam estas tabelas. Em resumo, ele faz:
--
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.accept_consent(uuid, text, text);
-- DROP FUNCTION IF EXISTS public.register_paper_consent(uuid, uuid, date, text, text);
-- DROP FUNCTION IF EXISTS public.my_pending_consents();
-- DROP FUNCTION IF EXISTS public.staff_consent_overview();
-- DROP TABLE IF EXISTS public.student_health_profiles;
-- DROP TABLE IF EXISTS public.consent_acceptances;
-- DROP TABLE IF EXISTS public.consent_versions;
-- DROP FUNCTION IF EXISTS public.student_health_profiles_set_audit_fields();
-- DROP FUNCTION IF EXISTS public.student_health_profiles_log_delete();
-- COMMIT;
