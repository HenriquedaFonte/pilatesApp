-- Teste — primeira abertura do recibo pelo aluno
-- (migration 20261121000000_receipt_first_opened_by_student.sql)
--
-- Rodar no Supabase SQL Editor DEPOIS da migration. Não precisa editar nada:
-- usa a professora (role = 'teacher') e os dois primeiros alunos (ordem do id),
-- como o 3.3-recibos-teste.sql.
-- Termina em ROLLBACK: nada fica gravado (nem recibo, nem número usado, nem
-- data de abertura). O primeiro recibo de verdade continua com o número certo.
-- Resultado: sucesso → nenhum erro; falha → erro começando com "FALHOU: ...".

BEGIN;

SELECT set_config('josi.aluno',
         (SELECT id::text FROM public.profiles WHERE role = 'student' ORDER BY id LIMIT 1), true),
       set_config('josi.aluno_b',
         (SELECT id::text FROM public.profiles WHERE role = 'student' ORDER BY id OFFSET 1 LIMIT 1), true),
       set_config('josi.professora',
         (SELECT id::text FROM public.profiles WHERE role = 'teacher' ORDER BY id LIMIT 1), true);

-- ═══ 0. Estrutura (postgres) ═══════════════════════════════════════════════
DO $$
DECLARE
  n int;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'insurance_receipts'
      AND column_name = 'student_first_opened_at'
      AND data_type = 'timestamp with time zone' AND is_nullable = 'YES'
  ) THEN
    RAISE EXCEPTION 'FALHOU: coluna insurance_receipts.student_first_opened_at não existe (a migration rodou?)';
  END IF;

  IF to_regprocedure('public.mark_receipt_opened_by_student(uuid)') IS NULL THEN
    RAISE EXCEPTION 'FALHOU: função mark_receipt_opened_by_student(uuid) não existe';
  END IF;
  IF NOT (SELECT prosecdef FROM pg_proc WHERE oid = 'public.mark_receipt_opened_by_student(uuid)'::regprocedure) THEN
    RAISE EXCEPTION 'FALHOU: mark_receipt_opened_by_student não é SECURITY DEFINER';
  END IF;
  IF has_function_privilege('anon', 'public.mark_receipt_opened_by_student(uuid)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.mark_receipt_opened_by_student(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FALHOU: anon/service_role podem chamar mark_receipt_opened_by_student';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.mark_receipt_opened_by_student(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FALHOU: authenticated não pode chamar mark_receipt_opened_by_student';
  END IF;

  -- A API continua sem escrita direta na tabela (nem na coluna nova).
  IF has_table_privilege('authenticated', 'public.insurance_receipts', 'UPDATE')
     OR has_column_privilege('authenticated', 'public.insurance_receipts', 'student_first_opened_at', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.insurance_receipts', 'INSERT') THEN
    RAISE EXCEPTION 'FALHOU: authenticated tem INSERT/UPDATE em insurance_receipts';
  END IF;

  SELECT count(*) INTO n FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'insurance_receipts';
  IF n <> 2 OR EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
                       AND tablename = 'insurance_receipts' AND cmd <> 'SELECT') THEN
    RAISE EXCEPTION 'FALHOU: insurance_receipts tem % policies (esperado 2, só SELECT)', n;
  END IF;
END $$;

-- ═══ 1. PROFESSORA: emite r1 (sem PDF ainda) e r2 (anulado), tenta registrar ═
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  json_build_object('sub', current_setting('josi.professora'), 'role', 'authenticated')::text, true);

DO $$
DECLARE
  a uuid := current_setting('josi.aluno')::uuid;
  v_today text := to_char((now() AT TIME ZONE 'America/Montreal')::date, 'YYYY-MM-DD');
  r1 jsonb; r2 jsonb;
BEGIN
  r1 := public.issue_insurance_receipt(a, 'kinesitherapy', '{"teste": true}'::jsonb,
          jsonb_build_array(jsonb_build_object('date', v_today, 'amount', 85)));
  r2 := public.issue_insurance_receipt(a, 'kinesitherapy', '{"teste": true}'::jsonb,
          jsonb_build_array(jsonb_build_object('date', v_today, 'amount', 85)));
  PERFORM set_config('josi.r1', r1 ->> 'id', true);
  PERFORM set_config('josi.r2', r2 ->> 'id', true);

  PERFORM public.attach_receipt_pdf((r2 ->> 'id')::uuid, a::text || '/' || (r2 ->> 'id') || '.pdf');
  PERFORM public.void_insurance_receipt((r2 ->> 'id')::uuid, 'teste primeira abertura');

  -- A professora não registra abertura (nem do recibo do aluno).
  BEGIN
    PERFORM public.mark_receipt_opened_by_student((r1 ->> 'id')::uuid);
    RAISE EXCEPTION 'FALHOU: a professora registrou abertura do recibo do aluno';
  EXCEPTION WHEN no_data_found THEN NULL;
  END;
END $$;

-- ═══ 2. ALUNO A: recibo sem PDF e recibo anulado não registram ════════════
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  json_build_object('sub', current_setting('josi.aluno'), 'role', 'authenticated')::text, true);

DO $$
DECLARE
  r1 uuid := current_setting('josi.r1')::uuid;
  r2 uuid := current_setting('josi.r2')::uuid;
  v timestamptz;
BEGIN
  v := public.mark_receipt_opened_by_student(r1);
  IF v IS NOT NULL OR (SELECT student_first_opened_at FROM public.insurance_receipts WHERE id = r1) IS NOT NULL THEN
    RAISE EXCEPTION 'FALHOU: recibo sem PDF ficou com data de abertura';
  END IF;
  v := public.mark_receipt_opened_by_student(r2);
  IF v IS NOT NULL OR (SELECT student_first_opened_at FROM public.insurance_receipts WHERE id = r2) IS NOT NULL THEN
    RAISE EXCEPTION 'FALHOU: recibo anulado ficou com data de abertura';
  END IF;
END $$;

-- ═══ 3. PROFESSORA: anexa o PDF do r1 ═════════════════════════════════════
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  json_build_object('sub', current_setting('josi.professora'), 'role', 'authenticated')::text, true);

SELECT public.attach_receipt_pdf(current_setting('josi.r1')::uuid,
  current_setting('josi.aluno') || '/' || current_setting('josi.r1') || '.pdf');

-- ═══ 4. ALUNO A: primeira abertura grava; a segunda não muda ══════════════
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  json_build_object('sub', current_setting('josi.aluno'), 'role', 'authenticated')::text, true);

DO $$
DECLARE
  r1 uuid := current_setting('josi.r1')::uuid;
  v1 timestamptz; v2 timestamptz; v_col timestamptz;
BEGIN
  v1 := public.mark_receipt_opened_by_student(r1);
  IF v1 IS NULL THEN RAISE EXCEPTION 'FALHOU: primeira abertura não gravou a data'; END IF;
  SELECT student_first_opened_at INTO v_col FROM public.insurance_receipts WHERE id = r1;
  IF v_col IS DISTINCT FROM v1 THEN RAISE EXCEPTION 'FALHOU: data gravada diferente da devolvida'; END IF;

  PERFORM pg_sleep(0.05);  -- garante que um novo clock_timestamp() seria diferente
  v2 := public.mark_receipt_opened_by_student(r1);
  SELECT student_first_opened_at INTO v_col FROM public.insurance_receipts WHERE id = r1;
  IF v2 IS DISTINCT FROM v1 OR v_col IS DISTINCT FROM v1 THEN
    RAISE EXCEPTION 'FALHOU: segunda abertura mudou a data (antes %, depois %)', v1, v_col;
  END IF;
  PERFORM set_config('josi.v1', v1::text, true);

  -- O aluno não escreve direto na tabela.
  BEGIN
    UPDATE public.insurance_receipts SET student_first_opened_at = NULL WHERE id = r1;
    RAISE EXCEPTION 'FALHOU: aluno fez UPDATE direto em insurance_receipts';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.insurance_receipts SET total_fees = 1 WHERE id = r1;
    RAISE EXCEPTION 'FALHOU: aluno mudou outro campo do recibo';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- Recibo que não existe: mesmo erro de recibo de outro aluno.
  BEGIN
    PERFORM public.mark_receipt_opened_by_student(gen_random_uuid());
    RAISE EXCEPTION 'FALHOU: recibo inexistente não deu erro';
  EXCEPTION WHEN no_data_found THEN NULL;
  END;
END $$;

-- ═══ 5. ALUNO B: não registra abertura de recibo do aluno A ═══════════════
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  json_build_object('sub', current_setting('josi.aluno_b'), 'role', 'authenticated')::text, true);

DO $$
BEGIN
  BEGIN
    PERFORM public.mark_receipt_opened_by_student(current_setting('josi.r1')::uuid);
    RAISE EXCEPTION 'FALHOU: aluno B registrou abertura de recibo do aluno A';
  EXCEPTION WHEN no_data_found THEN NULL;
  END;
END $$;

-- ═══ 6. PROFESSORA: anular depois de aberto continua funcionando ══════════
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  json_build_object('sub', current_setting('josi.professora'), 'role', 'authenticated')::text, true);

DO $$
DECLARE
  r1 uuid := current_setting('josi.r1')::uuid;
  v_rec record;
BEGIN
  PERFORM public.void_insurance_receipt(r1, 'teste primeira abertura');
  SELECT status, student_first_opened_at INTO v_rec FROM public.insurance_receipts WHERE id = r1;
  IF v_rec.status <> 'void' THEN RAISE EXCEPTION 'FALHOU: anular recibo aberto não funcionou'; END IF;
  IF v_rec.student_first_opened_at IS DISTINCT FROM current_setting('josi.v1')::timestamptz THEN
    RAISE EXCEPTION 'FALHOU: anular mudou a data de abertura';
  END IF;
END $$;

-- ═══ 7. Visitante (anon) e service_role: não chamam a RPC ═════════════════
RESET ROLE;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
DO $$
BEGIN
  BEGIN
    PERFORM public.mark_receipt_opened_by_student(current_setting('josi.r1')::uuid);
    RAISE EXCEPTION 'FALHOU: anon chamou mark_receipt_opened_by_student';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

RESET ROLE;
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
DO $$
BEGIN
  BEGIN
    PERFORM public.mark_receipt_opened_by_student(current_setting('josi.r1')::uuid);
    RAISE EXCEPTION 'FALHOU: service_role chamou mark_receipt_opened_by_student';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

-- ═══ 8. postgres (SQL Editor): a guarda vale para todo mundo ══════════════
RESET ROLE;
SELECT set_config('request.jwt.claims', '', true);

DO $$
DECLARE
  r1 uuid := current_setting('josi.r1')::uuid;
BEGIN
  BEGIN
    UPDATE public.insurance_receipts SET student_first_opened_at = now() - interval '1 day' WHERE id = r1;
    RAISE EXCEPTION 'FALHOU: data de abertura já gravada foi trocada';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.insurance_receipts SET student_first_opened_at = NULL WHERE id = r1;
    RAISE EXCEPTION 'FALHOU: data de abertura já gravada foi apagada';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.insurance_receipts SET snapshot = '{"alterado": true}' WHERE id = r1;
    RAISE EXCEPTION 'FALHOU: UPDATE do snapshot passou (guarda de imutabilidade)';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

ROLLBACK;
