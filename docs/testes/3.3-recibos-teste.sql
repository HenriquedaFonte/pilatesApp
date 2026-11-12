-- Teste AC-8 — Story 3.3 (recibos de seguro: tabela, numeração, anulação, storage)
--
-- Rodar no Supabase SQL Editor DEPOIS da migration
-- 20261112070000_create_insurance_receipts.sql.
--
-- Antes de rodar, substituir (Ctrl+H) os três marcadores por ids reais de profiles:
--   <UUID_ALUNO>      → um aluno (role = 'student')
--   <UUID_ALUNO_B>    → outro aluno (role = 'student')
--   <UUID_PROFESSORA> → a professora (role = 'teacher')
-- Para achar os ids:
--   SELECT id, full_name, role FROM public.profiles ORDER BY role, full_name;
--
-- Tudo roda dentro de uma transação que termina em ROLLBACK: nada fica gravado
-- (nem recibo, nem número usado, nem audit_log, nem arquivo de teste). Como o
-- contador está na mesma transação, o ROLLBACK também desfaz os números: o
-- primeiro recibo de verdade continua sendo o 0001.
-- Resultado:
--   • Sucesso → nenhum erro (o editor mostra só o último resultado; é normal).
--   • Falha   → erro começando com "FALHOU: ..." dizendo o que falhou.
--
-- Não testável aqui (uma sessão só): duas emissões AO MESMO TEMPO. Isso foi
-- testado em Postgres local (vários processos emitindo juntos: nenhum número
-- repetido, nenhum buraco). Aqui o script confere que o UNIQUE existe e que
-- duas emissões seguidas recebem números consecutivos.

BEGIN;

SELECT set_config('josi.aluno',      '<UUID_ALUNO>',      true),
       set_config('josi.aluno_b',    '<UUID_ALUNO_B>',    true),
       set_config('josi.professora', '<UUID_PROFESSORA>', true);

-- ════════════════════════════════════════════════════════════════════════════
-- 0. Estrutura (como postgres)
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  a uuid := current_setting('josi.aluno')::uuid;
  b uuid := current_setting('josi.aluno_b')::uuid;
  t uuid := current_setting('josi.professora')::uuid;
  n int;
  v_bucket record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = a AND role = 'student') THEN
    RAISE EXCEPTION 'FALHOU: <UUID_ALUNO> não é um aluno (role = student)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = b AND role = 'student') OR a = b THEN
    RAISE EXCEPTION 'FALHOU: <UUID_ALUNO_B> não é outro aluno (role = student, diferente do primeiro)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = t AND role = 'teacher') THEN
    RAISE EXCEPTION 'FALHOU: <UUID_PROFESSORA> não é a professora (role = teacher)';
  END IF;

  IF to_regclass('public.insurance_receipts') IS NULL OR to_regclass('public.receipt_counters') IS NULL THEN
    RAISE EXCEPTION 'FALHOU: migration 20261112070000 não rodou (tabelas não existem)';
  END IF;

  -- Privilégios: a API só lê; anon nada; contador fechado.
  IF has_table_privilege('authenticated', 'public.insurance_receipts', 'INSERT')
     OR has_table_privilege('authenticated', 'public.insurance_receipts', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.insurance_receipts', 'DELETE')
     OR has_table_privilege('authenticated', 'public.insurance_receipts', 'TRUNCATE') THEN
    RAISE EXCEPTION 'FALHOU: authenticated tem INSERT/UPDATE/DELETE/TRUNCATE em insurance_receipts';
  END IF;
  IF has_table_privilege('anon', 'public.insurance_receipts', 'SELECT')
     OR has_table_privilege('anon', 'public.receipt_counters', 'SELECT')
     OR has_table_privilege('authenticated', 'public.receipt_counters', 'SELECT') THEN
    RAISE EXCEPTION 'FALHOU: anon/authenticated lê insurance_receipts/receipt_counters além do previsto';
  END IF;
  IF has_function_privilege('anon', 'public.issue_insurance_receipt(uuid,text,jsonb,jsonb,jsonb)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.attach_receipt_pdf(uuid,text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.void_insurance_receipt(uuid,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FALHOU: anon pode chamar as RPCs de recibo';
  END IF;

  -- Só as 2 policies de SELECT em insurance_receipts.
  SELECT count(*) INTO n FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'insurance_receipts';
  IF n <> 2 OR EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
                       AND tablename = 'insurance_receipts' AND cmd <> 'SELECT') THEN
    RAISE EXCEPTION 'FALHOU: insurance_receipts tem % policies (esperado 2, só SELECT)', n;
  END IF;

  -- UNIQUE do número.
  IF NOT EXISTS (
    SELECT 1 FROM pg_index i
    JOIN pg_attribute att ON att.attrelid = i.indrelid AND att.attnum = ANY (i.indkey)
    WHERE i.indrelid = 'public.insurance_receipts'::regclass AND i.indisunique
      AND i.indnkeyatts = 1 AND att.attname = 'receipt_number'
  ) THEN
    RAISE EXCEPTION 'FALHOU: receipt_number não é UNIQUE';
  END IF;

  -- Bucket.
  SELECT public, file_size_limit, allowed_mime_types INTO v_bucket
  FROM storage.buckets WHERE id = 'insurance-receipts';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FALHOU: bucket insurance-receipts não existe';
  END IF;
  IF v_bucket.public IS DISTINCT FROM false
     OR v_bucket.file_size_limit IS DISTINCT FROM 2097152
     OR v_bucket.allowed_mime_types IS DISTINCT FROM ARRAY['application/pdf'] THEN
    RAISE EXCEPTION 'FALHOU: bucket insurance-receipts com configuração errada (public=%, limite=%, tipos=%)',
      v_bucket.public, v_bucket.file_size_limit, v_bucket.allowed_mime_types;
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 1. PROFESSORA: emite, anexa PDF, anula
-- ════════════════════════════════════════════════════════════════════════════
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  json_build_object('sub', current_setting('josi.professora'), 'role', 'authenticated')::text, true);

DO $$
DECLARE
  a uuid := current_setting('josi.aluno')::uuid;
  b uuid := current_setting('josi.aluno_b')::uuid;
  v_today text := to_char((now() AT TIME ZONE 'America/Montreal')::date, 'YYYY-MM-DD');
  v_year  text := to_char((now() AT TIME ZONE 'America/Montreal')::date, 'YYYY');
  v_tomorrow text := to_char((now() AT TIME ZONE 'America/Montreal')::date + 1, 'YYYY-MM-DD');
  r1 jsonb; r2 jsonb; r3 jsonb;
  n1 int; n2 int;
  v_rec record;
  n int;
BEGIN
  -- Emissão: 2 kinésithérapie para o aluno A, 1 naturopathie (com produtos) para o B.
  r1 := public.issue_insurance_receipt(a, 'kinesitherapy', '{"teste": true}'::jsonb,
          jsonb_build_array(jsonb_build_object('date', v_today, 'amount', 85),
                            jsonb_build_object('date', '2026-01-05', 'amount', 90.5)));
  r2 := public.issue_insurance_receipt(a, 'kinesitherapy', '{"teste": true}'::jsonb,
          jsonb_build_array(jsonb_build_object('date', v_today, 'amount', 85)));
  r3 := public.issue_insurance_receipt(b, 'naturopathy', '{"teste": true}'::jsonb,
          jsonb_build_array(jsonb_build_object('date', v_today, 'amount', 100)),
          jsonb_build_array(jsonb_build_object('name', '  Tisane  ', 'price', 12.5),
                            jsonb_build_object('name', 'Gouttes', 'price', 20)));

  IF r1 ->> 'id' IS NULL OR r1 ->> 'receipt_number' IS NULL THEN
    RAISE EXCEPTION 'FALHOU: issue_insurance_receipt não devolveu id e receipt_number (%)', r1;
  END IF;
  IF r1 ->> 'receipt_number' !~ ('^K-' || v_year || '-[0-9]{4,}$')
     OR r3 ->> 'receipt_number' !~ ('^N-' || v_year || '-[0-9]{4,}$') THEN
    RAISE EXCEPTION 'FALHOU: formato do número errado (% / %)', r1 ->> 'receipt_number', r3 ->> 'receipt_number';
  END IF;
  n1 := split_part(r1 ->> 'receipt_number', '-', 3)::int;
  n2 := split_part(r2 ->> 'receipt_number', '-', 3)::int;
  IF n2 <> n1 + 1 THEN
    RAISE EXCEPTION 'FALHOU: números não consecutivos (% e %)', r1 ->> 'receipt_number', r2 ->> 'receipt_number';
  END IF;

  -- Totais calculados no servidor.
  SELECT * INTO v_rec FROM public.insurance_receipts WHERE id = (r1 ->> 'id')::uuid;
  IF v_rec.consultations_count <> 2 OR v_rec.total_fees <> 175.50 OR v_rec.total_products <> 0
     OR v_rec.status <> 'issued' OR v_rec.issued_by <> auth.uid() OR v_rec.pdf_path IS NOT NULL THEN
    RAISE EXCEPTION 'FALHOU: recibo 1 gravado errado (consultas=%, total=%, produtos=%, status=%)',
      v_rec.consultations_count, v_rec.total_fees, v_rec.total_products, v_rec.status;
  END IF;
  SELECT * INTO v_rec FROM public.insurance_receipts WHERE id = (r3 ->> 'id')::uuid;
  IF v_rec.consultations_count <> 1 OR v_rec.total_fees <> 100 OR v_rec.total_products <> 32.50
     OR v_rec.products -> 0 ->> 'name' <> 'Tisane' THEN
    RAISE EXCEPTION 'FALHOU: recibo 3 (naturopathie) gravado errado (total=%, produtos=%)',
      v_rec.total_fees, v_rec.total_products;
  END IF;

  PERFORM set_config('josi.r1', r1 ->> 'id', true);
  PERFORM set_config('josi.r2', r2 ->> 'id', true);
  PERFORM set_config('josi.r3', r3 ->> 'id', true);

  -- Validações (cada uma tem de ser recusada).
  BEGIN
    PERFORM public.issue_insurance_receipt(a, 'kinesitherapy', '{}'::jsonb,
      (SELECT jsonb_agg(jsonb_build_object('date', v_today, 'amount', 10)) FROM generate_series(1, 11)));
    RAISE EXCEPTION 'FALHOU: aceitou 11 tratamentos';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
    PERFORM public.issue_insurance_receipt(a, 'kinesitherapy', '{}'::jsonb, '[]'::jsonb);
    RAISE EXCEPTION 'FALHOU: aceitou recibo sem tratamento';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
    PERFORM public.issue_insurance_receipt(a, 'kinesitherapy', '{}'::jsonb,
      jsonb_build_array(jsonb_build_object('date', v_today, 'amount', 10)),
      jsonb_build_array(jsonb_build_object('name', 'X', 'price', 5)));
    RAISE EXCEPTION 'FALHOU: aceitou produto em recibo de kinésithérapie';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
    PERFORM public.issue_insurance_receipt(a, 'naturopathy', '{}'::jsonb,
      jsonb_build_array(jsonb_build_object('date', v_today, 'amount', 10)),
      (SELECT jsonb_agg(jsonb_build_object('name', 'X', 'price', 5)) FROM generate_series(1, 5)));
    RAISE EXCEPTION 'FALHOU: aceitou 5 produtos';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
    PERFORM public.issue_insurance_receipt(a, 'kinesitherapy', '{}'::jsonb,
      jsonb_build_array(jsonb_build_object('date', v_today, 'amount', 0)));
    RAISE EXCEPTION 'FALHOU: aceitou valor 0';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
    PERFORM public.issue_insurance_receipt(a, 'kinesitherapy', '{}'::jsonb,
      jsonb_build_array(jsonb_build_object('date', v_today, 'amount', 10.005)));
    RAISE EXCEPTION 'FALHOU: aceitou valor com 3 casas decimais';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
    PERFORM public.issue_insurance_receipt(a, 'kinesitherapy', '{}'::jsonb,
      jsonb_build_array(jsonb_build_object('date', v_tomorrow, 'amount', 10)));
    RAISE EXCEPTION 'FALHOU: aceitou data de tratamento no futuro';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
    PERFORM public.issue_insurance_receipt(a, 'kinesitherapy', '{}'::jsonb,
      jsonb_build_array(jsonb_build_object('date', '2026-02-30', 'amount', 10)));
    RAISE EXCEPTION 'FALHOU: aceitou a data 2026-02-30';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
    PERFORM public.issue_insurance_receipt(a, 'massage', '{}'::jsonb,
      jsonb_build_array(jsonb_build_object('date', v_today, 'amount', 10)));
    RAISE EXCEPTION 'FALHOU: aceitou tipo de recibo inválido';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
    PERFORM public.issue_insurance_receipt(auth.uid(), 'kinesitherapy', '{}'::jsonb,
      jsonb_build_array(jsonb_build_object('date', v_today, 'amount', 10)));
    RAISE EXCEPTION 'FALHOU: aceitou recibo para quem não é aluno (a própria professora)';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
    PERFORM public.issue_insurance_receipt(a, 'kinesitherapy', '[]'::jsonb,
      jsonb_build_array(jsonb_build_object('date', v_today, 'amount', 10)));
    RAISE EXCEPTION 'FALHOU: aceitou snapshot que não é objeto';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;

  -- Escrita direta na tabela: negada também para a professora.
  BEGIN
    UPDATE public.insurance_receipts SET total_fees = 1 WHERE id = (r1 ->> 'id')::uuid;
    RAISE EXCEPTION 'FALHOU: professora fez UPDATE direto em insurance_receipts';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    DELETE FROM public.insurance_receipts WHERE id = (r1 ->> 'id')::uuid;
    RAISE EXCEPTION 'FALHOU: professora fez DELETE direto em insurance_receipts';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.insurance_receipts (receipt_number, receipt_type, student_id, issued_by,
      snapshot, treatments, consultations_count, total_fees)
    VALUES ('K-2000-9999', 'kinesitherapy', a, auth.uid(), '{}', '[{"date":"2026-01-01","amount":1}]', 1, 1);
    RAISE EXCEPTION 'FALHOU: professora fez INSERT direto em insurance_receipts (sem passar pela RPC)';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM count(*) FROM public.receipt_counters;
    RAISE EXCEPTION 'FALHOU: professora lê receipt_counters pela API';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- Anexar PDF: caminho errado recusado; certo aceito; repetir o mesmo é aceito
  -- sem mudar nada.
  BEGIN
    PERFORM public.attach_receipt_pdf((r1 ->> 'id')::uuid, b::text || '/' || (r1 ->> 'id') || '.pdf');
    RAISE EXCEPTION 'FALHOU: attach_receipt_pdf aceitou pasta de outro aluno';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  PERFORM public.attach_receipt_pdf((r1 ->> 'id')::uuid, a::text || '/' || (r1 ->> 'id') || '.pdf');
  PERFORM public.attach_receipt_pdf((r1 ->> 'id')::uuid, a::text || '/' || (r1 ->> 'id') || '.pdf');
  SELECT pdf_path INTO v_rec FROM public.insurance_receipts WHERE id = (r1 ->> 'id')::uuid;
  IF v_rec.pdf_path IS DISTINCT FROM a::text || '/' || (r1 ->> 'id') || '.pdf' THEN
    RAISE EXCEPTION 'FALHOU: pdf_path não foi gravado';
  END IF;

  -- Anulação: motivo obrigatório; issued → void uma vez só.
  BEGIN
    PERFORM public.void_insurance_receipt((r2 ->> 'id')::uuid, '   ');
    RAISE EXCEPTION 'FALHOU: anulou sem motivo';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  PERFORM public.void_insurance_receipt((r2 ->> 'id')::uuid, 'Teste: valor errado');
  BEGIN
    PERFORM public.void_insurance_receipt((r2 ->> 'id')::uuid, 'de novo');
    RAISE EXCEPTION 'FALHOU: anulou duas vezes o mesmo recibo';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  SELECT * INTO v_rec FROM public.insurance_receipts WHERE id = (r2 ->> 'id')::uuid;
  IF NOT FOUND OR v_rec.status <> 'void' OR v_rec.voided_by <> auth.uid()
     OR v_rec.void_reason <> 'Teste: valor errado' OR v_rec.voided_at IS NULL THEN
    RAISE EXCEPTION 'FALHOU: recibo anulado não ficou no histórico como void';
  END IF;

  -- Storage: professora envia o PDF no caminho de um recibo existente; fora
  -- disso é recusado. (INSERT direto em storage.objects passa pelas mesmas
  -- policies que o upload do site.)
  BEGIN
    INSERT INTO storage.objects (bucket_id, name)
    VALUES ('insurance-receipts', a::text || '/' || (r1 ->> 'id') || '.pdf'),
           ('insurance-receipts', b::text || '/' || (r3 ->> 'id') || '.pdf');
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'FALHOU: professora não conseguiu gravar o PDF de teste no bucket (%: %). Se não for erro de policy, mandar a mensagem para o dev-critico.', SQLSTATE, SQLERRM;
  END;
  BEGIN
    INSERT INTO storage.objects (bucket_id, name)
    VALUES ('insurance-receipts', a::text || '/' || gen_random_uuid() || '.pdf');
    RAISE EXCEPTION 'FALHOU: professora gravou no bucket um PDF que não é de nenhum recibo';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  UPDATE storage.objects SET name = name || '.x' WHERE bucket_id = 'insurance-receipts';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: professora alterou arquivo do bucket insurance-receipts'; END IF;
  DELETE FROM storage.objects WHERE bucket_id = 'insurance-receipts';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: professora apagou arquivo do bucket insurance-receipts'; END IF;
  SELECT count(*) INTO n FROM storage.objects
  WHERE bucket_id = 'insurance-receipts'
    AND name IN (a::text || '/' || (r1 ->> 'id') || '.pdf', b::text || '/' || (r3 ->> 'id') || '.pdf');
  IF n <> 2 THEN RAISE EXCEPTION 'FALHOU: professora não vê os PDFs do bucket (% de 2)', n; END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. ALUNO A
-- ════════════════════════════════════════════════════════════════════════════
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  json_build_object('sub', current_setting('josi.aluno'), 'role', 'authenticated')::text, true);

DO $$
DECLARE
  a uuid := current_setting('josi.aluno')::uuid;
  b uuid := current_setting('josi.aluno_b')::uuid;
  r1 uuid := current_setting('josi.r1')::uuid;
  r2 uuid := current_setting('josi.r2')::uuid;
  r3 uuid := current_setting('josi.r3')::uuid;
  n int;
BEGIN
  -- Vê os próprios (inclusive o anulado), não vê o do aluno B.
  SELECT count(*) INTO n FROM public.insurance_receipts WHERE id IN (r1, r2);
  IF n <> 2 THEN RAISE EXCEPTION 'FALHOU: aluno A não vê os próprios recibos (% de 2)', n; END IF;
  SELECT count(*) INTO n FROM public.insurance_receipts WHERE id = r2 AND status = 'void';
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: aluno A não vê o recibo anulado como void'; END IF;
  SELECT count(*) INTO n FROM public.insurance_receipts WHERE id = r3 OR student_id = b;
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: aluno A vê recibo do aluno B'; END IF;
  SELECT count(*) INTO n FROM public.insurance_receipts WHERE student_id <> a;
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: aluno A vê % recibos de outras pessoas', n; END IF;

  -- Não chama as RPCs.
  BEGIN
    PERFORM public.issue_insurance_receipt(a, 'kinesitherapy', '{}'::jsonb,
      '[{"date":"2026-01-05","amount":10}]'::jsonb);
    RAISE EXCEPTION 'FALHOU: aluno chamou issue_insurance_receipt';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.attach_receipt_pdf(r2, a::text || '/' || r2::text || '.pdf');
    RAISE EXCEPTION 'FALHOU: aluno chamou attach_receipt_pdf';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.void_insurance_receipt(r1, 'aluno');
    RAISE EXCEPTION 'FALHOU: aluno anulou recibo';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- Escrita direta negada.
  BEGIN
    UPDATE public.insurance_receipts SET total_fees = 9999 WHERE id = r1;
    RAISE EXCEPTION 'FALHOU: aluno fez UPDATE direto no próprio recibo';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    DELETE FROM public.insurance_receipts WHERE id = r1;
    RAISE EXCEPTION 'FALHOU: aluno fez DELETE direto no próprio recibo';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM count(*) FROM public.receipt_counters;
    RAISE EXCEPTION 'FALHOU: aluno lê receipt_counters';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- Storage: vê só o próprio PDF; não envia, não altera, não apaga.
  SELECT count(*) INTO n FROM storage.objects
  WHERE bucket_id = 'insurance-receipts' AND name = a::text || '/' || r1::text || '.pdf';
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: aluno A não vê o próprio PDF'; END IF;
  SELECT count(*) INTO n FROM storage.objects
  WHERE bucket_id = 'insurance-receipts' AND (storage.foldername(name))[1] <> a::text;
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: aluno A vê % PDFs de outros alunos', n; END IF;
  BEGIN
    INSERT INTO storage.objects (bucket_id, name)
    VALUES ('insurance-receipts', a::text || '/' || r2::text || '.pdf');
    RAISE EXCEPTION 'FALHOU: aluno A enviou PDF para o bucket';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  UPDATE storage.objects SET name = name || '.x' WHERE bucket_id = 'insurance-receipts';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: aluno A alterou arquivo do bucket'; END IF;
  DELETE FROM storage.objects WHERE bucket_id = 'insurance-receipts';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: aluno A apagou arquivo do bucket'; END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. ALUNO B
-- ════════════════════════════════════════════════════════════════════════════
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  json_build_object('sub', current_setting('josi.aluno_b'), 'role', 'authenticated')::text, true);

DO $$
DECLARE
  b uuid := current_setting('josi.aluno_b')::uuid;
  r1 uuid := current_setting('josi.r1')::uuid;
  r3 uuid := current_setting('josi.r3')::uuid;
  n int;
BEGIN
  SELECT count(*) INTO n FROM public.insurance_receipts WHERE id = r3;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: aluno B não vê o próprio recibo'; END IF;
  SELECT count(*) INTO n FROM public.insurance_receipts WHERE student_id <> b OR id = r1;
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: aluno B vê recibo do aluno A'; END IF;

  SELECT count(*) INTO n FROM storage.objects
  WHERE bucket_id = 'insurance-receipts' AND name = b::text || '/' || r3::text || '.pdf';
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: aluno B não vê o próprio PDF'; END IF;
  SELECT count(*) INTO n FROM storage.objects
  WHERE bucket_id = 'insurance-receipts' AND (storage.foldername(name))[1] <> b::text;
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: aluno B vê PDF do aluno A'; END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 4. Visitante (anon)
-- ════════════════════════════════════════════════════════════════════════════
RESET ROLE;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);

DO $$
DECLARE
  n int;
BEGIN
  BEGIN
    PERFORM count(*) FROM public.insurance_receipts;
    RAISE EXCEPTION 'FALHOU: anon lê insurance_receipts';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.issue_insurance_receipt(gen_random_uuid(), 'kinesitherapy', '{}'::jsonb,
      '[{"date":"2026-01-05","amount":10}]'::jsonb);
    RAISE EXCEPTION 'FALHOU: anon chamou issue_insurance_receipt';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.void_insurance_receipt(current_setting('josi.r1')::uuid, 'anon');
    RAISE EXCEPTION 'FALHOU: anon chamou void_insurance_receipt';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    SELECT count(*) INTO n FROM storage.objects WHERE bucket_id = 'insurance-receipts';
    IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: anon vê % PDFs do bucket', n; END IF;
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 5. service_role (Edge Functions, backup): só lê
-- ════════════════════════════════════════════════════════════════════════════
RESET ROLE;
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);

DO $$
DECLARE
  n int;
BEGIN
  SELECT count(*) INTO n FROM public.insurance_receipts
  WHERE id IN (current_setting('josi.r1')::uuid, current_setting('josi.r3')::uuid);
  IF n <> 2 THEN RAISE EXCEPTION 'FALHOU: service_role não lê insurance_receipts'; END IF;
  BEGIN
    UPDATE public.insurance_receipts SET total_fees = 1 WHERE id = current_setting('josi.r1')::uuid;
    RAISE EXCEPTION 'FALHOU: service_role fez UPDATE em insurance_receipts';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.issue_insurance_receipt(current_setting('josi.aluno')::uuid, 'kinesitherapy',
      '{}'::jsonb, '[{"date":"2026-01-05","amount":10}]'::jsonb);
    RAISE EXCEPTION 'FALHOU: service_role emitiu recibo';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 6. postgres (SQL Editor): a guarda de imutabilidade vale até aqui
-- ════════════════════════════════════════════════════════════════════════════
RESET ROLE;
SELECT set_config('request.jwt.claims', '', true);

DO $$
DECLARE
  r1 uuid := current_setting('josi.r1')::uuid;
  r2 uuid := current_setting('josi.r2')::uuid;
  n int;
BEGIN
  BEGIN
    UPDATE public.insurance_receipts SET snapshot = '{"alterado": true}' WHERE id = r1;
    RAISE EXCEPTION 'FALHOU: UPDATE do snapshot passou (guarda de imutabilidade)';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.insurance_receipts SET pdf_path = NULL WHERE id = r1;
    RAISE EXCEPTION 'FALHOU: pdf_path já gravado foi apagado';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.insurance_receipts
    SET status = 'issued', voided_at = NULL, voided_by = NULL, void_reason = NULL WHERE id = r2;
    RAISE EXCEPTION 'FALHOU: recibo anulado voltou para issued';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    DELETE FROM public.insurance_receipts WHERE id = r2;
    RAISE EXCEPTION 'FALHOU: DELETE de recibo passou';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    TRUNCATE public.insurance_receipts;
    RAISE EXCEPTION 'FALHOU: TRUNCATE de insurance_receipts passou';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- audit_log: 3 emissões e 1 anulação, só com ids/tipo/número.
  SELECT count(*) INTO n FROM public.audit_log
  WHERE action = 'receipt.issue'
    AND snapshot_data ->> 'receipt_id' IN (current_setting('josi.r1'), current_setting('josi.r2'), current_setting('josi.r3'));
  IF n <> 3 THEN RAISE EXCEPTION 'FALHOU: audit_log tem % de 3 linhas receipt.issue', n; END IF;
  SELECT count(*) INTO n FROM public.audit_log
  WHERE action = 'receipt.void' AND snapshot_data ->> 'receipt_id' = current_setting('josi.r2');
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: audit_log sem a linha receipt.void'; END IF;
  SELECT count(*) INTO n FROM public.audit_log
  WHERE action IN ('receipt.issue', 'receipt.void')
    AND snapshot_data ->> 'receipt_id' IN (current_setting('josi.r1'), current_setting('josi.r2'), current_setting('josi.r3'))
    AND (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(snapshot_data) k)
        IS DISTINCT FROM ARRAY['receipt_id', 'receipt_number', 'receipt_type', 'student_id'];
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: audit_log de recibo guarda mais do que ids/tipo/número'; END IF;
END $$;

ROLLBACK;
