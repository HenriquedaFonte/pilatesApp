-- Migration: recibos para seguro saúde — tabela, numeração, anulação, storage
-- Story 3.3 — Epic 3 (PRD-002)
--
-- DEPENDE de:
--   • 20261112010000_fix_profiles_privilege_escalation_and_rls.sql (public.is_staff())
--   • 20260617100000_create_audit_log.sql (public.audit_log)
-- Se faltar alguma, esta migration para logo no início e nada é aplicado.
-- (A story sugeria o nome 20261112000100_...; o timestamp foi movido para
-- depois das migrations de segurança porque usa is_staff(), criada na 010000.)
--
-- Cria:
--   • public.receipt_counters   — último número usado por tipo e ano
--   • public.insurance_receipts — um recibo emitido (documento fiscal):
--       snapshot de tudo o que foi impresso, tratamentos, produtos, totais
--       calculados no servidor, caminho do PDF, status issued/void
--   • RPCs (SECURITY DEFINER, só professora/admin via is_staff(), com JWT):
--       issue_insurance_receipt(p_student_id, p_type, p_snapshot, p_treatments, p_products)
--         → valida, calcula totais, gera o número (K-2026-0001 / N-2026-0001),
--           grava o recibo e o audit_log ('receipt.issue'); devolve
--           {"id": uuid, "receipt_number": text}
--       attach_receipt_pdf(p_receipt_id, p_pdf_path)
--         → grava o caminho do PDF uma única vez; o caminho tem de ser
--           '{student_id}/{receipt_id}.pdf'
--       void_insurance_receipt(p_receipt_id, p_reason)
--         → issued → void, motivo obrigatório; audit_log ('receipt.void')
--   • Guarda de imutabilidade (trigger, vale para TODOS os papéis, inclusive
--     service_role e SQL Editor): DELETE e TRUNCATE recusados; UPDATE só pode
--     (a) preencher pdf_path quando está vazio e (b) passar issued → void.
--     Qualquer outra coluna é imutável depois da emissão.
--   • Bucket privado 'insurance-receipts' (só application/pdf, até 2 MB) e
--     policies em storage.objects:
--       professora/admin → SELECT de tudo; INSERT só em
--                          '{student_id}/{receipt_id}.pdf' de um recibo existente
--       aluno            → SELECT só na pasta '{auth.uid()}/'
--       ninguém          → UPDATE/DELETE (sem policy); anon → nada
--
-- Numeração (sem buraco e sem número repetido):
--   O contador (tipo, ano) é incrementado com
--   INSERT ... ON CONFLICT DO UPDATE ... RETURNING, na MESMA transação do
--   INSERT do recibo. Isso trava a linha do contador como um SELECT ... FOR
--   UPDATE (emissões simultâneas do mesmo tipo/ano esperam a anterior
--   terminar) e também resolve a corrida do 1º recibo do ano (quando a linha
--   ainda não existe, um SELECT ... FOR UPDATE não trava nada). Se a emissão
--   falhar em qualquer ponto, o incremento é desfeito junto (sem buraco). Não
--   usa SEQUENCE (sequências deixam buraco em rollback). receipt_number é
--   UNIQUE como segunda barreira. O ano é o de Montréal (America/Montreal) na
--   hora da emissão.
--
-- RLS de insurance_receipts: SELECT para professora/admin (todos) e para o
-- aluno (student_id = auth.uid()). Sem policy de INSERT/UPDATE/DELETE, e os
-- papéis da API só têm o privilégio SELECT: tudo passa pelas RPCs.
-- receipt_counters: RLS ligada, sem policy; ninguém da API lê nem escreve
-- (service_role só lê, para backup).
--
-- Os FKs para profiles não têm CASCADE (recibo é documento fiscal): um perfil
-- com recibo não pode ser apagado de vez. Soft delete (deleted_at) não afeta.
--
-- Rodar no Supabase SQL Editor de uma vez. Está dentro de BEGIN/COMMIT: se
-- algo falhar, nada é aplicado. Idempotente: pode rodar de novo. Não altera
-- nem apaga dados nem colunas existentes.
--
-- TESTE:    docs/testes/3.3-recibos-teste.sql
-- REVERSÃO: docs/testes/3.3-recibos-reversao.sql (só funciona enquanto não
--           houver nenhum recibo nem PDF; recibo emitido não se apaga).

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

  IF to_regclass('public.audit_log') IS NULL
     OR (SELECT count(*) FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'audit_log'
           AND column_name IN ('actor_id', 'actor_email', 'action', 'target_id', 'snapshot_data')) <> 5 THEN
    RAISE EXCEPTION 'public.audit_log não encontrada (ou sem as colunas esperadas). Rode antes 20260617100000_create_audit_log.sql. Nada foi aplicado.';
  END IF;

  IF to_regclass('storage.buckets') IS NULL
     OR to_regclass('storage.objects') IS NULL
     OR to_regprocedure('storage.foldername(text)') IS NULL THEN
    RAISE EXCEPTION 'Schema storage do Supabase não encontrado. Nada foi aplicado.';
  END IF;

  -- Não assumir tabelas com esses nomes criadas por outra coisa.
  FOREACH v_tbl IN ARRAY ARRAY['receipt_counters', 'insurance_receipts'] LOOP
    IF to_regclass('public.' || v_tbl) IS NOT NULL
       AND coalesce(obj_description(to_regclass('public.' || v_tbl), 'pg_class'), '') NOT LIKE 'josi-pilates:%' THEN
      RAISE EXCEPTION 'public.% já existe e não foi criada por esta migration. Nada foi aplicado.', v_tbl;
    END IF;
  END LOOP;
END $$;

-- ─── 1. receipt_counters ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.receipt_counters (
  receipt_type  TEXT        NOT NULL
                            CHECK (receipt_type IN ('kinesitherapy', 'naturopathy')),
  receipt_year  INTEGER     NOT NULL CHECK (receipt_year BETWEEN 2000 AND 9999),
  last_number   INTEGER     NOT NULL DEFAULT 0 CHECK (last_number >= 0),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (receipt_type, receipt_year)
);
COMMENT ON TABLE public.receipt_counters IS
  'josi-pilates: último número de recibo usado por tipo e ano (Story 3.3). Só issue_insurance_receipt escreve.';

-- ─── 2. insurance_receipts ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.insurance_receipts (
  id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number       TEXT          NOT NULL UNIQUE,
  receipt_type         TEXT          NOT NULL
                                     CHECK (receipt_type IN ('kinesitherapy', 'naturopathy')),
  student_id           UUID          NOT NULL REFERENCES public.profiles(id),  -- sem CASCADE
  issued_by            UUID          NOT NULL REFERENCES public.profiles(id),
  issued_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  snapshot             JSONB         NOT NULL,
  treatments           JSONB         NOT NULL,
  products             JSONB         NOT NULL DEFAULT '[]'::jsonb,
  consultations_count  INTEGER       NOT NULL,
  total_fees           NUMERIC(10,2) NOT NULL,
  total_products       NUMERIC(10,2) NOT NULL DEFAULT 0,
  pdf_path             TEXT,
  status               TEXT          NOT NULL DEFAULT 'issued'
                                     CHECK (status IN ('issued', 'void')),
  voided_at            TIMESTAMPTZ,
  voided_by            UUID          REFERENCES public.profiles(id),
  void_reason          TEXT,

  CONSTRAINT insurance_receipts_number_format
    CHECK (receipt_number ~ '^[KN]-[0-9]{4}-[0-9]{4,}$'),
  CONSTRAINT insurance_receipts_number_matches_type
    CHECK (left(receipt_number, 1) = CASE receipt_type WHEN 'kinesitherapy' THEN 'K' ELSE 'N' END),
  CONSTRAINT insurance_receipts_snapshot_is_object
    CHECK (jsonb_typeof(snapshot) = 'object'),
  CONSTRAINT insurance_receipts_treatments_1_to_10
    CHECK (CASE WHEN jsonb_typeof(treatments) = 'array'
                THEN jsonb_array_length(treatments) BETWEEN 1 AND 10
                ELSE false END),
  CONSTRAINT insurance_receipts_products_0_to_4
    CHECK (CASE WHEN jsonb_typeof(products) = 'array'
                THEN jsonb_array_length(products) BETWEEN 0 AND 4
                ELSE false END),
  CONSTRAINT insurance_receipts_products_only_naturopathy
    CHECK (receipt_type = 'naturopathy' OR products = '[]'::jsonb),
  CONSTRAINT insurance_receipts_consultations_count
    CHECK (CASE WHEN jsonb_typeof(treatments) = 'array'
                THEN consultations_count = jsonb_array_length(treatments)
                ELSE false END),
  CONSTRAINT insurance_receipts_totals
    CHECK (total_fees > 0 AND total_products >= 0
           AND (receipt_type = 'naturopathy' OR total_products = 0)),
  CONSTRAINT insurance_receipts_pdf_path
    CHECK (pdf_path IS NULL OR pdf_path = student_id::text || '/' || id::text || '.pdf'),
  CONSTRAINT insurance_receipts_void_fields
    CHECK (
      (status = 'issued' AND voided_at IS NULL AND voided_by IS NULL AND void_reason IS NULL)
      OR
      (status = 'void' AND voided_at IS NOT NULL AND voided_by IS NOT NULL
       AND void_reason IS NOT NULL AND length(btrim(void_reason)) > 0)
    )
);
COMMENT ON TABLE public.insurance_receipts IS
  'josi-pilates: recibos de seguro saúde emitidos (Story 3.3). Imutável: só pdf_path (uma vez) e anulação mudam. Escrita só pelas RPCs.';

CREATE INDEX IF NOT EXISTS insurance_receipts_student_issued_idx
  ON public.insurance_receipts (student_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS insurance_receipts_issued_at_idx
  ON public.insurance_receipts (issued_at DESC);

-- ─── 3. Guarda de imutabilidade ─────────────────────────────────────────────
-- Vale para todos os papéis (inclusive service_role, postgres e SQL Editor).
-- Para uma correção de emergência é preciso desligar o trigger de propósito.
CREATE OR REPLACE FUNCTION public.insurance_receipts_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  c_mutable CONSTANT text[] := ARRAY['pdf_path', 'status', 'voided_at', 'voided_by', 'void_reason'];
BEGIN
  IF TG_OP IN ('DELETE', 'TRUNCATE') THEN
    RAISE EXCEPTION 'insurance receipts cannot be deleted (void them instead)'
      USING ERRCODE = '42501';
  END IF;

  -- TG_OP = 'UPDATE'
  IF (to_jsonb(NEW) - c_mutable) IS DISTINCT FROM (to_jsonb(OLD) - c_mutable) THEN
    RAISE EXCEPTION 'insurance receipts are immutable (only attaching the PDF once or voiding is allowed)'
      USING ERRCODE = '42501';
  END IF;

  IF OLD.pdf_path IS NOT NULL AND NEW.pdf_path IS DISTINCT FROM OLD.pdf_path THEN
    RAISE EXCEPTION 'insurance receipt PDF is already attached and cannot be changed'
      USING ERRCODE = '42501';
  END IF;

  IF OLD.status = 'void'
     AND (NEW.status, NEW.voided_at, NEW.voided_by, NEW.void_reason)
         IS DISTINCT FROM (OLD.status, OLD.voided_at, OLD.voided_by, OLD.void_reason) THEN
    RAISE EXCEPTION 'a voided insurance receipt cannot be changed'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;
COMMENT ON FUNCTION public.insurance_receipts_guard() IS
  'josi-pilates: impede DELETE/TRUNCATE e qualquer UPDATE em insurance_receipts além de anexar o PDF uma vez e anular.';
REVOKE ALL ON FUNCTION public.insurance_receipts_guard() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_insurance_receipts_guard_row ON public.insurance_receipts;
CREATE TRIGGER trg_insurance_receipts_guard_row
  BEFORE UPDATE OR DELETE ON public.insurance_receipts
  FOR EACH ROW EXECUTE FUNCTION public.insurance_receipts_guard();

DROP TRIGGER IF EXISTS trg_insurance_receipts_guard_truncate ON public.insurance_receipts;
CREATE TRIGGER trg_insurance_receipts_guard_truncate
  BEFORE TRUNCATE ON public.insurance_receipts
  FOR EACH STATEMENT EXECUTE FUNCTION public.insurance_receipts_guard();

-- ─── 4. RLS e privilégios das tabelas ───────────────────────────────────────
-- Apaga TODAS as policies dessas duas tabelas (seja qual for o nome) e cria
-- só as necessárias.
DO $$
DECLARE
  v_pol record;
BEGIN
  FOR v_pol IN
    SELECT tablename, policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN ('receipt_counters', 'insurance_receipts')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', v_pol.policyname, v_pol.tablename);
  END LOOP;
END $$;

ALTER TABLE public.receipt_counters   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_receipts ENABLE ROW LEVEL SECURITY;

-- receipt_counters: nenhuma policy (ninguém da API lê nem escreve).
REVOKE ALL ON TABLE public.receipt_counters FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.receipt_counters TO service_role;

-- insurance_receipts: só leitura pela API; escrita só pelas RPCs.
REVOKE ALL ON TABLE public.insurance_receipts FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.insurance_receipts TO authenticated, service_role;

CREATE POLICY "insurance_receipts_select_staff" ON public.insurance_receipts
  FOR SELECT TO authenticated
  USING ((SELECT public.is_staff()));

CREATE POLICY "insurance_receipts_select_own" ON public.insurance_receipts
  FOR SELECT TO authenticated
  USING (student_id = (SELECT auth.uid()));

-- ─── 5. RPCs ────────────────────────────────────────────────────────────────

-- 5a. Emissão
-- p_treatments: array de 1 a 10 objetos {"date": "AAAA-MM-DD", "amount": número}
--   data válida e não futura (dia de Montréal); valor > 0, até 2 casas, < 100000.
-- p_products: array de 0 a 4 objetos {"name": texto, "price": número}, só em
--   naturopathy; nome não vazio (até 200 caracteres); preço como o valor acima.
-- Tratamentos e produtos são gravados normalizados (só essas chaves, na ordem
-- recebida). p_snapshot: objeto JSON (até 64 KB) com tudo o que é impresso; é
-- gravado como veio (o PDF é regenerado a partir dele).
CREATE OR REPLACE FUNCTION public.issue_insurance_receipt(
  p_student_id  uuid,
  p_type        text,
  p_snapshot    jsonb,
  p_treatments  jsonb,
  p_products    jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller          uuid := auth.uid();
  v_now             timestamptz := now();
  v_today           date := (now() AT TIME ZONE 'America/Montreal')::date;
  v_year            integer := extract(year FROM (now() AT TIME ZONE 'America/Montreal'))::integer;
  v_products_in     jsonb := COALESCE(p_products, '[]'::jsonb);
  v_treatments      jsonb := '[]'::jsonb;
  v_products        jsonb := '[]'::jsonb;
  v_item            jsonb;
  v_date            date;
  v_amount          numeric;
  v_name            text;
  v_total_fees      numeric := 0;
  v_total_products  numeric := 0;
  v_seq             integer;
  v_receipt_number  text;
  v_id              uuid;
  v_actor_email     text;
BEGIN
  -- Só professora/admin logada (precisa de auth.uid() para issued_by).
  IF v_caller IS NULL OR NOT public.is_staff() THEN
    RAISE EXCEPTION 'permission denied: only the teacher can issue insurance receipts'
      USING ERRCODE = '42501';
  END IF;

  IF p_type IS NULL OR p_type NOT IN ('kinesitherapy', 'naturopathy') THEN
    RAISE EXCEPTION 'invalid receipt type (expected kinesitherapy or naturopathy)'
      USING ERRCODE = '22023';
  END IF;

  IF p_student_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = p_student_id AND role = 'student'
  ) THEN
    RAISE EXCEPTION 'student not found'
      USING ERRCODE = '22023';
  END IF;

  IF p_snapshot IS NULL OR jsonb_typeof(p_snapshot) <> 'object' THEN
    RAISE EXCEPTION 'snapshot must be a JSON object'
      USING ERRCODE = '22023';
  END IF;
  IF octet_length(p_snapshot::text) > 65536 THEN
    RAISE EXCEPTION 'snapshot is too large'
      USING ERRCODE = '22023';
  END IF;

  -- Tratamentos
  IF p_treatments IS NULL OR jsonb_typeof(p_treatments) <> 'array' THEN
    RAISE EXCEPTION 'treatments must be a JSON array'
      USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_treatments) NOT BETWEEN 1 AND 10 THEN
    RAISE EXCEPTION 'a receipt must have between 1 and 10 treatments'
      USING ERRCODE = '22023';
  END IF;

  FOR v_item IN
    SELECT e.value FROM jsonb_array_elements(p_treatments) WITH ORDINALITY AS e(value, ord)
    ORDER BY e.ord
  LOOP
    IF jsonb_typeof(v_item) IS DISTINCT FROM 'object'
       OR jsonb_typeof(v_item -> 'date') IS DISTINCT FROM 'string'
       OR jsonb_typeof(v_item -> 'amount') IS DISTINCT FROM 'number' THEN
      RAISE EXCEPTION 'each treatment must be {"date": "YYYY-MM-DD", "amount": number}'
        USING ERRCODE = '22023';
    END IF;

    IF (v_item ->> 'date') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
      RAISE EXCEPTION 'invalid treatment date (expected YYYY-MM-DD)'
        USING ERRCODE = '22023';
    END IF;
    BEGIN
      v_date := to_date(v_item ->> 'date', 'YYYY-MM-DD');
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'invalid treatment date (expected YYYY-MM-DD)'
        USING ERRCODE = '22023';
    END;
    IF to_char(v_date, 'YYYY-MM-DD') <> (v_item ->> 'date') THEN
      RAISE EXCEPTION 'invalid treatment date (expected YYYY-MM-DD)'
        USING ERRCODE = '22023';
    END IF;
    IF v_date > v_today THEN
      RAISE EXCEPTION 'treatment date cannot be in the future'
        USING ERRCODE = '22023';
    END IF;

    v_amount := (v_item ->> 'amount')::numeric;
    IF v_amount <= 0 OR v_amount >= 100000 OR v_amount <> round(v_amount, 2) THEN
      RAISE EXCEPTION 'invalid treatment amount (must be > 0, at most 2 decimals)'
        USING ERRCODE = '22023';
    END IF;

    v_treatments := v_treatments || jsonb_build_array(
      jsonb_build_object('date', to_char(v_date, 'YYYY-MM-DD'), 'amount', round(v_amount, 2))
    );
    v_total_fees := v_total_fees + round(v_amount, 2);
  END LOOP;

  -- Produtos (só naturopathy)
  IF jsonb_typeof(v_products_in) <> 'array' THEN
    RAISE EXCEPTION 'products must be a JSON array'
      USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(v_products_in) > 4 THEN
    RAISE EXCEPTION 'a receipt can have at most 4 products'
      USING ERRCODE = '22023';
  END IF;
  IF p_type <> 'naturopathy' AND jsonb_array_length(v_products_in) > 0 THEN
    RAISE EXCEPTION 'products are only allowed on naturopathy receipts'
      USING ERRCODE = '22023';
  END IF;

  FOR v_item IN
    SELECT e.value FROM jsonb_array_elements(v_products_in) WITH ORDINALITY AS e(value, ord)
    ORDER BY e.ord
  LOOP
    IF jsonb_typeof(v_item) IS DISTINCT FROM 'object'
       OR jsonb_typeof(v_item -> 'name') IS DISTINCT FROM 'string'
       OR jsonb_typeof(v_item -> 'price') IS DISTINCT FROM 'number' THEN
      RAISE EXCEPTION 'each product must be {"name": text, "price": number}'
        USING ERRCODE = '22023';
    END IF;

    v_name := btrim(v_item ->> 'name');
    IF v_name = '' OR char_length(v_name) > 200 THEN
      RAISE EXCEPTION 'invalid product name (1 to 200 characters)'
        USING ERRCODE = '22023';
    END IF;

    v_amount := (v_item ->> 'price')::numeric;
    IF v_amount <= 0 OR v_amount >= 100000 OR v_amount <> round(v_amount, 2) THEN
      RAISE EXCEPTION 'invalid product price (must be > 0, at most 2 decimals)'
        USING ERRCODE = '22023';
    END IF;

    v_products := v_products || jsonb_build_array(
      jsonb_build_object('name', v_name, 'price', round(v_amount, 2))
    );
    v_total_products := v_total_products + round(v_amount, 2);
  END LOOP;

  -- Número: incrementa o contador (tipo, ano) travando a linha até o fim da
  -- transação. Emissões simultâneas esperam; rollback desfaz o incremento.
  INSERT INTO public.receipt_counters AS c (receipt_type, receipt_year, last_number, updated_at)
  VALUES (p_type, v_year, 1, v_now)
  ON CONFLICT (receipt_type, receipt_year)
  DO UPDATE SET last_number = c.last_number + 1, updated_at = EXCLUDED.updated_at
  RETURNING c.last_number INTO v_seq;

  v_receipt_number :=
    CASE p_type WHEN 'kinesitherapy' THEN 'K' ELSE 'N' END
    || '-' || v_year::text || '-'
    || CASE WHEN v_seq < 10000 THEN lpad(v_seq::text, 4, '0') ELSE v_seq::text END;

  INSERT INTO public.insurance_receipts (
    receipt_number, receipt_type, student_id, issued_by, issued_at,
    snapshot, treatments, products,
    consultations_count, total_fees, total_products
  ) VALUES (
    v_receipt_number, p_type, p_student_id, v_caller, v_now,
    p_snapshot, v_treatments, v_products,
    jsonb_array_length(v_treatments), v_total_fees, v_total_products
  )
  RETURNING id INTO v_id;

  -- Auditoria: só ids, tipo e número (nada do snapshot).
  SELECT email INTO v_actor_email FROM public.profiles WHERE id = v_caller;
  INSERT INTO public.audit_log (actor_id, actor_email, action, target_id, snapshot_data)
  VALUES (
    v_caller,
    COALESCE(v_actor_email, auth.jwt() ->> 'email', ''),
    'receipt.issue',
    p_student_id,
    jsonb_build_object(
      'receipt_id', v_id,
      'receipt_number', v_receipt_number,
      'receipt_type', p_type,
      'student_id', p_student_id
    )
  );

  RETURN jsonb_build_object('id', v_id, 'receipt_number', v_receipt_number);
END;
$$;
COMMENT ON FUNCTION public.issue_insurance_receipt(uuid, text, jsonb, jsonb, jsonb) IS
  'josi-pilates: emite recibo de seguro (Story 3.3). Só professora/admin. Devolve {id, receipt_number}.';

-- 5b. Anexar o PDF (uma vez)
-- Repetir com o mesmo caminho é aceito sem mudar nada (retentativa segura);
-- outro caminho, ou um caminho fora do padrão, é recusado.
CREATE OR REPLACE FUNCTION public.attach_receipt_pdf(
  p_receipt_id  uuid,
  p_pdf_path    text
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller   uuid := auth.uid();
  v_receipt  record;
BEGIN
  IF v_caller IS NULL OR NOT public.is_staff() THEN
    RAISE EXCEPTION 'permission denied: only the teacher can attach receipt PDFs'
      USING ERRCODE = '42501';
  END IF;

  SELECT id, student_id, pdf_path INTO v_receipt
  FROM public.insurance_receipts
  WHERE id = p_receipt_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'receipt not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF p_pdf_path IS DISTINCT FROM (v_receipt.student_id::text || '/' || v_receipt.id::text || '.pdf') THEN
    RAISE EXCEPTION 'invalid PDF path (expected {student_id}/{receipt_id}.pdf)'
      USING ERRCODE = '22023';
  END IF;

  IF v_receipt.pdf_path IS NOT NULL THEN
    RETURN;  -- já anexado com este mesmo caminho
  END IF;

  UPDATE public.insurance_receipts
  SET pdf_path = p_pdf_path
  WHERE id = p_receipt_id;
END;
$$;
COMMENT ON FUNCTION public.attach_receipt_pdf(uuid, text) IS
  'josi-pilates: grava o caminho do PDF do recibo uma única vez (Story 3.3). Só professora/admin.';

-- 5c. Anulação
CREATE OR REPLACE FUNCTION public.void_insurance_receipt(
  p_receipt_id  uuid,
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
  v_receipt      record;
  v_actor_email  text;
BEGIN
  IF v_caller IS NULL OR NOT public.is_staff() THEN
    RAISE EXCEPTION 'permission denied: only the teacher can void insurance receipts'
      USING ERRCODE = '42501';
  END IF;

  IF v_reason IS NULL OR v_reason = '' THEN
    RAISE EXCEPTION 'a reason is required to void a receipt'
      USING ERRCODE = '22023';
  END IF;
  IF char_length(v_reason) > 500 THEN
    RAISE EXCEPTION 'void reason is too long (max 500 characters)'
      USING ERRCODE = '22023';
  END IF;

  SELECT id, receipt_number, receipt_type, student_id, status INTO v_receipt
  FROM public.insurance_receipts
  WHERE id = p_receipt_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'receipt not found'
      USING ERRCODE = 'P0002';
  END IF;
  IF v_receipt.status <> 'issued' THEN
    RAISE EXCEPTION 'receipt is already void'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.insurance_receipts
  SET status = 'void',
      voided_at = now(),
      voided_by = v_caller,
      void_reason = v_reason
  WHERE id = p_receipt_id;

  -- Auditoria: só ids, tipo e número (o motivo fica no próprio recibo).
  SELECT email INTO v_actor_email FROM public.profiles WHERE id = v_caller;
  INSERT INTO public.audit_log (actor_id, actor_email, action, target_id, snapshot_data)
  VALUES (
    v_caller,
    COALESCE(v_actor_email, auth.jwt() ->> 'email', ''),
    'receipt.void',
    v_receipt.student_id,
    jsonb_build_object(
      'receipt_id', v_receipt.id,
      'receipt_number', v_receipt.receipt_number,
      'receipt_type', v_receipt.receipt_type,
      'student_id', v_receipt.student_id
    )
  );
END;
$$;
COMMENT ON FUNCTION public.void_insurance_receipt(uuid, text) IS
  'josi-pilates: anula um recibo emitido, com motivo (Story 3.3). Só professora/admin.';

-- EXECUTE: só authenticated (a checagem de professora é feita dentro).
REVOKE ALL ON FUNCTION public.issue_insurance_receipt(uuid, text, jsonb, jsonb, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.attach_receipt_pdf(uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.void_insurance_receipt(uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.issue_insurance_receipt(uuid, text, jsonb, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.attach_receipt_pdf(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.void_insurance_receipt(uuid, text) TO authenticated;

-- ─── 6. Storage: bucket privado insurance-receipts ──────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'insurance-receipts',
  'insurance-receipts',
  false,
  2097152,                                  -- 2 MB
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE
  SET public             = false,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Insurance receipts: staff can read"       ON storage.objects;
DROP POLICY IF EXISTS "Insurance receipts: staff can upload"     ON storage.objects;
DROP POLICY IF EXISTS "Insurance receipts: student can read own" ON storage.objects;

-- Professora/admin: lê todos os PDFs do bucket.
CREATE POLICY "Insurance receipts: staff can read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'insurance-receipts'
    AND (SELECT public.is_staff())
  );

-- Professora/admin: envia só '{student_id}/{receipt_id}.pdf' de um recibo que
-- existe. Sem UPDATE/DELETE: o PDF enviado não é trocado nem apagado.
CREATE POLICY "Insurance receipts: staff can upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'insurance-receipts'
    AND (SELECT public.is_staff())
    AND EXISTS (
      SELECT 1 FROM public.insurance_receipts r
      WHERE r.student_id::text || '/' || r.id::text || '.pdf' = objects.name
    )
  );

-- Aluno: lê só a própria pasta '{auth.uid()}/'.
CREATE POLICY "Insurance receipts: student can read own"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'insurance-receipts'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

COMMIT;
