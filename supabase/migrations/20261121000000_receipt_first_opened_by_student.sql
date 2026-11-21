-- Migration: recibos — registrar a primeira abertura pelo aluno
-- (pedido da Josi, 2026-11-21; item "Recibos: registrar a primeira abertura
-- pelo aluno" de docs/PENDENCIAS.md). Plano: docs/planos/2026-11-21-recibo-primeira-abertura.md
--
-- DEPENDE de: 20261112070000_create_insurance_receipts.sql (tabela, guarda).
-- Se faltar, para logo no início e nada é aplicado.
--
-- Faz:
--   • insurance_receipts.student_first_opened_at (timestamptz, NULL = ainda
--     não aberto): data/hora da PRIMEIRA vez que o aluno abriu, baixou ou
--     compartilhou o PDF em "Meus recibos".
--   • insurance_receipts_guard(): igual à da 20261112070000, mais a coluna
--     nova na lista do que pode mudar, com a regra "só vazio → data, uma vez"
--     (depois de gravada não muda nem volta a vazio, para todos os papéis,
--     inclusive service_role e SQL Editor). Todas as outras colunas continuam
--     imutáveis.
--   • RPC mark_receipt_opened_by_student(p_receipt_id) (SECURITY DEFINER,
--     EXECUTE só para authenticated): grava a data só se o recibo é DO
--     PRÓPRIO aluno logado (student_id = auth.uid()), está emitido (não
--     anulado), tem PDF e a data ainda está vazia. Devolve a data gravada
--     (a de antes, se já existia) ou NULL (anulado/sem PDF). Recibo de outro
--     aluno, inexistente ou chamada da professora → erro 'receipt not found'
--     (P0002), sem dizer se o recibo existe.
-- A API continua sem UPDATE em insurance_receipts: o aluno não muda nenhum
-- outro campo (nem este, a não ser pela RPC).
--
-- Rodar no Supabase SQL Editor de uma vez. BEGIN/COMMIT: se algo falhar, nada
-- é aplicado. Idempotente. Não altera nem apaga dados.
--
-- TESTE:    docs/testes/recibo-primeira-abertura-teste.sql (e de novo o
--           docs/testes/3.3-recibos-teste.sql)
-- REVERSÃO: docs/testes/recibo-primeira-abertura-reversao.sql

BEGIN;

-- ─── 0. Pré-condições ───────────────────────────────────────────────────────
DO $$
DECLARE
  v_type text;
BEGIN
  IF to_regclass('public.insurance_receipts') IS NULL
     OR coalesce(obj_description(to_regclass('public.insurance_receipts'), 'pg_class'), '') NOT LIKE 'josi-pilates:%' THEN
    RAISE EXCEPTION 'public.insurance_receipts não encontrada. Rode antes a 20261112070000_create_insurance_receipts.sql. Nada foi aplicado.';
  END IF;

  IF to_regprocedure('public.insurance_receipts_guard()') IS NULL
     OR coalesce(obj_description(to_regprocedure('public.insurance_receipts_guard()'), 'pg_proc'), '') NOT LIKE 'josi-pilates:%'
     OR NOT EXISTS (
       SELECT 1 FROM pg_trigger
       WHERE tgrelid = to_regclass('public.insurance_receipts')
         AND tgname = 'trg_insurance_receipts_guard_row' AND NOT tgisinternal
     ) THEN
    RAISE EXCEPTION 'Guarda de imutabilidade dos recibos não encontrada. Rode antes a 20261112070000. Nada foi aplicado.';
  END IF;

  SELECT data_type INTO v_type FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'insurance_receipts'
    AND column_name = 'student_first_opened_at';
  IF v_type IS NOT NULL AND v_type <> 'timestamp with time zone' THEN
    RAISE EXCEPTION 'insurance_receipts.student_first_opened_at já existe com outro tipo (%). Nada foi aplicado.', v_type;
  END IF;
END $$;

-- ─── 1. Coluna ──────────────────────────────────────────────────────────────
ALTER TABLE public.insurance_receipts
  ADD COLUMN IF NOT EXISTS student_first_opened_at TIMESTAMPTZ;
COMMENT ON COLUMN public.insurance_receipts.student_first_opened_at IS
  'josi-pilates: primeira vez que o aluno abriu/baixou/compartilhou o PDF em "Meus recibos". Só mark_receipt_opened_by_student grava, uma vez.';

-- ─── 2. Guarda de imutabilidade (recriada com a coluna nova) ───────────────
CREATE OR REPLACE FUNCTION public.insurance_receipts_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  c_mutable CONSTANT text[] := ARRAY['pdf_path', 'status', 'voided_at', 'voided_by', 'void_reason',
                                     'student_first_opened_at'];
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

  -- Primeira abertura pelo aluno: só vazio → data, uma vez.
  IF OLD.student_first_opened_at IS NOT NULL
     AND NEW.student_first_opened_at IS DISTINCT FROM OLD.student_first_opened_at THEN
    RAISE EXCEPTION 'the first opening by the student is already recorded and cannot be changed'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;
COMMENT ON FUNCTION public.insurance_receipts_guard() IS
  'josi-pilates: impede DELETE/TRUNCATE e qualquer UPDATE em insurance_receipts além de anexar o PDF uma vez, anular e gravar a primeira abertura pelo aluno uma vez.';
REVOKE ALL ON FUNCTION public.insurance_receipts_guard() FROM PUBLIC, anon, authenticated, service_role;

-- ─── 3. RPC: o próprio aluno registra a primeira abertura ──────────────────
CREATE OR REPLACE FUNCTION public.mark_receipt_opened_by_student(p_receipt_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller   uuid := auth.uid();
  v_receipt  record;
  v_opened   timestamptz;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'permission denied: login required'
      USING ERRCODE = '42501';
  END IF;

  -- Só o recibo do próprio aluno logado. Trava a linha: duas chamadas ao
  -- mesmo tempo gravam uma vez só (a segunda vê a data da primeira).
  SELECT id, status, pdf_path, student_first_opened_at INTO v_receipt
  FROM public.insurance_receipts
  WHERE id = p_receipt_id AND student_id = v_caller
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'receipt not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_receipt.student_first_opened_at IS NOT NULL THEN
    RETURN v_receipt.student_first_opened_at;  -- aberturas seguintes não mudam nada
  END IF;

  -- Anulado ou sem PDF: o aluno não tem como abrir; nada é gravado.
  IF v_receipt.status <> 'issued' OR v_receipt.pdf_path IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.insurance_receipts
  SET student_first_opened_at = clock_timestamp()
  WHERE id = p_receipt_id
  RETURNING student_first_opened_at INTO v_opened;

  RETURN v_opened;
END;
$$;
COMMENT ON FUNCTION public.mark_receipt_opened_by_student(uuid) IS
  'josi-pilates: o aluno logado registra a primeira abertura do próprio recibo (só grava se vazio). Devolve a data ou NULL.';

REVOKE ALL ON FUNCTION public.mark_receipt_opened_by_student(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mark_receipt_opened_by_student(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
