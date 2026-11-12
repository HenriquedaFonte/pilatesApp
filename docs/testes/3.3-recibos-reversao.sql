-- Reversão — Story 3.3 (migration 20261112070000_create_insurance_receipts.sql)
--
-- Só para emergência, e só ENQUANTO NÃO HOUVER NENHUM RECIBO EMITIDO nem PDF
-- no bucket. Recibo é documento fiscal: este script se recusa a apagar
-- qualquer recibo ou arquivo (para no início e nada é aplicado).
--
-- Remove: policies do bucket insurance-receipts, o bucket (vazio), as RPCs
-- issue_insurance_receipt / attach_receipt_pdf / void_insurance_receipt, as
-- tabelas insurance_receipts e receipt_counters e a função de guarda.
-- Não mexe em profiles, audit_log, is_staff() nem no bucket
-- practitioner-signatures.
--
-- Rodar no Supabase SQL Editor de uma vez. Está dentro de BEGIN/COMMIT.

BEGIN;

DO $$
DECLARE
  n bigint;
BEGIN
  IF to_regclass('public.insurance_receipts') IS NOT NULL THEN
    -- Como dono, a RLS não filtra: conta todos os recibos.
    EXECUTE 'SELECT count(*) FROM public.insurance_receipts' INTO n;
    IF n > 0 THEN
      RAISE EXCEPTION 'Existem % recibos emitidos. Recibo é documento fiscal: a reversão não apaga recibos. Nada foi aplicado.', n;
    END IF;
  END IF;

  SELECT count(*) INTO n FROM storage.objects WHERE bucket_id = 'insurance-receipts';
  IF n > 0 THEN
    RAISE EXCEPTION 'Existem % arquivos no bucket insurance-receipts. A reversão não apaga PDFs de recibo. Nada foi aplicado.', n;
  END IF;
END $$;

DROP POLICY IF EXISTS "Insurance receipts: staff can read"       ON storage.objects;
DROP POLICY IF EXISTS "Insurance receipts: staff can upload"     ON storage.objects;
DROP POLICY IF EXISTS "Insurance receipts: student can read own" ON storage.objects;

-- Bucket vazio. Se o Supabase não deixar apagar direto na tabela, o resto da
-- reversão continua e o bucket deve ser apagado no painel (Storage).
DO $$
BEGIN
  BEGIN
    DELETE FROM storage.buckets WHERE id = 'insurance-receipts';
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'Não foi possível apagar o bucket insurance-receipts por SQL (%). Apagar pelo painel: Storage → insurance-receipts → Delete bucket.', SQLERRM;
  END;
END $$;

DROP FUNCTION IF EXISTS public.issue_insurance_receipt(uuid, text, jsonb, jsonb, jsonb);
DROP FUNCTION IF EXISTS public.attach_receipt_pdf(uuid, text);
DROP FUNCTION IF EXISTS public.void_insurance_receipt(uuid, text);

-- DROP TABLE não dispara os triggers de DELETE/TRUNCATE (e a tabela está vazia).
DROP TABLE IF EXISTS public.insurance_receipts;
DROP TABLE IF EXISTS public.receipt_counters;
DROP FUNCTION IF EXISTS public.insurance_receipts_guard();

COMMIT;

-- Conferência (deve devolver só nulos e 0):
--   SELECT to_regclass('public.insurance_receipts'), to_regclass('public.receipt_counters'),
--          to_regprocedure('public.issue_insurance_receipt(uuid,text,jsonb,jsonb,jsonb)'),
--          (SELECT count(*) FROM storage.buckets WHERE id = 'insurance-receipts');
