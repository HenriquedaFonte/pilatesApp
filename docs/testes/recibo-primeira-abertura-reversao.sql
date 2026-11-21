-- REVERSÃO da migration 20261121000000_receipt_first_opened_by_student.sql
--
-- Só para emergência. ORDEM: primeiro o Revert do PR no GitHub (e esperar o
-- deploy da Vercel), DEPOIS este SQL. Ao contrário, as listas de recibos do
-- site (portal do aluno, ficha do aluno, Relatórios) param de carregar,
-- porque o código novo lê a coluna student_first_opened_at.
--
-- Apaga a função mark_receipt_opened_by_student, volta a guarda de
-- imutabilidade exatamente à da 20261112070000 e APAGA a coluna
-- student_first_opened_at (as datas de primeira abertura gravadas se perdem;
-- os recibos não mudam). Para guardar as datas antes, rodar e exportar (CSV):
--   SELECT receipt_number, student_first_opened_at FROM public.insurance_receipts
--   WHERE student_first_opened_at IS NOT NULL ORDER BY receipt_number;
--
-- Rodar no Supabase SQL Editor de uma vez. BEGIN/COMMIT. Idempotente.

BEGIN;

DROP FUNCTION IF EXISTS public.mark_receipt_opened_by_student(uuid);

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

ALTER TABLE public.insurance_receipts DROP COLUMN IF EXISTS student_first_opened_at;

NOTIFY pgrst, 'reload schema';

COMMIT;
