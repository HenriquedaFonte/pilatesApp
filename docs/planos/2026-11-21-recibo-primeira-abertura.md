# Plano: Recibos — registrar a primeira abertura pelo aluno
Data: 2026-11-21 · Branch: `ccr-9151bbbf-ce2huo` (já criada a partir do `main` com o PR #74)

## Objetivo
Quando o aluno toca pela **primeira vez** em "Abrir PDF", "Baixar PDF" ou "Compartilhar" de um recibo em "Meus recibos" (`/student/receipts`), o sistema grava a data e a hora. A professora passa a ver, no status de cada recibo, **"Aberto pelo aluno em AAAA-MM-DD"** ou **"Ainda não aberto"**: na tabela "Recibos de seguro" da ficha do aluno e na lista geral (Relatórios → Recibos de seguro). Aberturas seguintes não mudam o registro. Sem email (nível 2 fica para depois).

Item de origem: `docs/PENDENCIAS.md` → "A fazer" → **"Recibos: registrar a primeira abertura pelo aluno"** (veio no PR #74).

## Fora do escopo
- Email para a Josi na primeira abertura (nível 2).
- Registrar quando a **Josi** abre ou compartilha o PDF (o "Compartilhar"/"Abrir PDF" da tela dela não registra nada; combinado com o usuário).
- Histórico de todas as aberturas (só a primeira).
- Mostrar qualquer coisa nova para o aluno (a tela "Meus recibos" fica igual).
- Relatório fiscal (item seguinte do PENDENCIAS: **não mexer**).
- Política de Privacidade (ver "Dúvidas para o dono").
- `src/pages/TeacherReceipts.jsx`: **não muda**; a lista geral usa o mesmo `ReceiptsList`, então a coluna nova aparece lá sozinha.

## Contexto lido
- `supabase/migrations/20261112070000_create_insurance_receipts.sql` — tabela `insurance_receipts`; RLS só SELECT (professora tudo, aluno só os dele); a API não tem UPDATE; trigger `insurance_receipts_guard()` deixa mudar **só** `pdf_path` (uma vez) e os campos de anulação — **qualquer coluna nova fica imutável se a guarda não for atualizada**; RPCs SECURITY DEFINER com `REVOKE ... FROM PUBLIC, anon, authenticated, service_role` + `GRANT EXECUTE ... TO authenticated`.
- `docs/testes/3.3-recibos-teste.sql` / `3.3-recibos-reversao.sql` — padrão dos testes (BEGIN … ROLLBACK, `SET LOCAL ROLE`, `request.jwt.claims`, "FALHOU: ...").
- `src/pages/StudentReceipts.jsx` — portal do aluno; `handleOpen` (iPhone/iPad: `openReceiptPdf`; outros: `downloadReceipt`) e `handleShare` (`shareReceipt` → `'shared' | 'cancelled' | 'retry' | 'unsupported'`).
- `src/lib/receiptFiles.js` — abrir/baixar/compartilhar (sem pdf-lib, usado pelo portal e pela professora).
- `src/lib/receipts.js` — funções puras (formatação, `todayMontreal`), testáveis.
- `src/components/ReceiptsList.jsx` — tabela da professora (ficha do aluno em `StudentSummary.jsx` e lista geral em `TeacherReceipts.jsx`); coluna "Status" com badges.
- `src/tests/receiptFiles.test.js`, `src/tests/studentReceipts.test.js` — padrão de mock do `@/lib/supabase` e testes em ambiente node.
- `scripts/backup.js` — faz backup da tabela inteira (`insurance_receipts`): a coluna nova entra sozinha, nada a mudar.
- `src/locales/{pt,en,fr}.json` → `receipts.list.*`.

## Decisões já tomadas neste plano (o dono pode mudar antes de começar)
1. **O que conta como "abriu":** "Abrir PDF"/"Baixar PDF" contam **depois que deu certo** (o link do PDF foi gerado). "Compartilhar" conta quando a folha de compartilhar do celular abriu (`'shared'` **ou** `'cancelled'`: o aluno teve o PDF na mão). Erro, `'unsupported'` e `'retry'` não contam (o próximo toque registra).
2. **Data mostrada:** só a data (AAAA-MM-DD, dia de Montréal), igual à coluna "Emissão". A hora fica gravada no banco.
3. **Recibo anulado ou ainda sem PDF:** o aluno não tem botão; a RPC não grava nada para eles. A tela da professora mostra "Ainda não aberto" (ou a data, se o aluno abriu antes da anulação).
4. **Recibos já existentes:** começam como "Ainda não aberto" (não existe registro de aberturas antigas).
5. Nada vai para o `audit_log` (a coluna já é o registro; evita linhas a cada recibo).

## Passos

### 1. [OPUS] Migration nova: coluna, guarda atualizada e RPC ✅
- Arquivo: `supabase/migrations/20261121000000_receipt_first_opened_by_student.sql` (novo)
- Fazer: criar o arquivo exatamente com o conteúdo abaixo. Depois, se der, rodar localmente no Postgres 16 (`/usr/lib/postgresql/16`) com o estado simulado (stubs de `auth.uid()`, `is_staff()`, `storage.*` e a migration `20261112070000` antes), 2 vezes seguidas (idempotência), e o teste do passo 2 e o `3.3-recibos-teste.sql` em cima.
- Código:
  ```sql
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
  ```
- Pronto quando: o arquivo existe com esse conteúdo; (se rodado localmente) aplica 2 vezes sem erro e os testes dos passos 2 e o `3.3-recibos-teste.sql` passam sem "FALHOU".

### 2. [OPUS] Teste SQL (ROLLBACK, nada fica gravado) ✅
- Arquivo: `docs/testes/recibo-primeira-abertura-teste.sql` (novo)
- Fazer: criar com o conteúdo abaixo.
- Código:
  ```sql
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
  ```
- Pronto quando: o arquivo existe; (se testado localmente) roda sem "FALHOU" depois da migration e falha com "FALHOU: coluna ... não existe" sem ela.

### 3. [OPUS] SQL de reversão ✅
- Arquivo: `docs/testes/recibo-primeira-abertura-reversao.sql` (novo)
- Fazer: criar com o conteúdo abaixo (a guarda volta **exatamente** à da `20261112070000`).
- Código:
  ```sql
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
  ```
- Pronto quando: o arquivo existe; (se testado localmente) depois dele o `3.3-recibos-teste.sql` continua passando e a coluna/função não existem mais.

### 4. ✅ [SONNET] Função que registra a abertura (cliente)
- Arquivo: `src/lib/receiptFiles.js`
- Fazer: acrescentar **no fim do arquivo** (depois de `shareReceipt`) exatamente:
  ```js

  // Primeira abertura pelo aluno ("Meus recibos"): grava a data/hora da primeira
  // vez que o aluno abre, baixa ou compartilha o PDF. A RPC só aceita o recibo do
  // próprio aluno logado e só grava se estiver vazio (aberturas seguintes não
  // mudam nada). Nunca atrapalha a ação do aluno: qualquer erro é ignorado e o
  // próximo toque tenta de novo. `seen` (Set de ids) evita chamar de novo na
  // mesma página. Devolve a data gravada (ISO) ou null.
  export async function recordReceiptOpen(receipt, seen = new Set()) {
    if (!receipt?.id || receipt.student_first_opened_at || seen.has(receipt.id)) return null
    seen.add(receipt.id)
    try {
      const { data, error } = await supabase.rpc('mark_receipt_opened_by_student', {
        p_receipt_id: receipt.id,
      })
      if (error) throw error
      return data ?? null
    } catch {
      seen.delete(receipt.id)
      return null
    }
  }
  ```
- Pronto quando: `npm run lint` sem erro nesse arquivo.

### 5. ✅ [SONNET] Ligar o registro nos botões de "Meus recibos"
- Arquivo: `src/pages/StudentReceipts.jsx`
- Fazer (só isto; nada de texto ou visual novo para o aluno):
  1. Linha 14: trocar o import por
     ```js
     import { downloadReceipt, openReceiptPdf, recordReceiptOpen, shareReceipt } from '../lib/receiptFiles'
     ```
  2. `COLUMNS` (linhas 29-30): acrescentar `, student_first_opened_at` no fim da string:
     ```js
     const COLUMNS =
       'id, receipt_number, receipt_type, issued_at, treatments, total_fees, total_products, pdf_path, status, student_first_opened_at'
     ```
  3. Logo depois de `const files = useRef({}) // PDFs já baixados para compartilhar (por id)` (linha 39), acrescentar:
     ```js
     const opened = useRef(new Set()) // recibos cuja primeira abertura já foi registrada (por id)
     ```
  4. Em `handleOpen`, dentro do `try`, **depois** das duas linhas `if (apple) await openReceiptPdf(receipt)` / `else await downloadReceipt(receipt)`, acrescentar:
     ```js
         // Sem await: registrar a primeira abertura não pode atrasar nem quebrar a ação.
         recordReceiptOpen(receipt, opened.current)
     ```
     Não mexer na ordem de `openReceiptPdf` (a aba tem de abrir no próprio toque; nada de `await` antes dele).
  5. Em `handleShare`, logo depois de `const result = await shareReceipt(receipt, files.current)`, acrescentar:
     ```js
         // A folha de compartilhar abriu (compartilhou ou fechou): o aluno teve o PDF.
         if (result === 'shared' || result === 'cancelled') recordReceiptOpen(receipt, opened.current)
     ```
     As linhas seguintes (`unsupported` / `retry`) ficam iguais.
- Pronto quando: o diff do arquivo tem só essas 5 mudanças; lint ok.

### 6. ✅ [SONNET] Função pura para o texto da professora
- Arquivo: `src/lib/receipts.js`
- Fazer: acrescentar logo **depois** de `summarizeTreatmentDates` (antes de `moneyFormatter`):
  ```js
  // Primeira abertura pelo aluno, para a tela da professora: chave i18n e a data
  // (AAAA-MM-DD, dia de Montréal, como a "Emissão"). Vazia ou inválida → "Ainda não aberto".
  export function studentOpenInfo(receipt) {
    const iso = receipt?.student_first_opened_at
    const d = iso ? new Date(iso) : null
    if (!d || Number.isNaN(d.getTime())) return { key: 'receipts.list.notOpenedByStudent', date: null }
    return { key: 'receipts.list.openedByStudent', date: todayMontreal(d) }
  }
  ```
- Pronto quando: lint ok.

### 7. ✅ [SONNET] Mostrar na tabela da professora (ficha do aluno e Relatórios)
- Arquivo: `src/components/ReceiptsList.jsx` (o `TeacherReceipts.jsx` não muda)
- Fazer:
  1. No import de `'../lib/receipts'` (linhas 5-13), acrescentar `studentOpenInfo,` em ordem alfabética, depois de `receiptErrorKey,` e antes de `summarizeTreatmentDates,`.
  2. `COLUMNS` (linhas 45-46): acrescentar `, student_first_opened_at` no fim:
     ```js
     const COLUMNS =
       'id, receipt_number, receipt_type, student_id, issued_at, treatments, consultations_count, total_fees, total_products, pdf_path, status, voided_at, void_reason, student_first_opened_at'
     ```
  3. Dentro do `receipts.map(r => {`, logo depois de `const total = Number(r.total_fees) + Number(r.total_products || 0)`, acrescentar:
     ```js
                   const openInfo = studentOpenInfo(r)
     ```
  4. Na célula de status (o `<div className="flex flex-col items-start gap-1">`), **depois** do bloco `{!r.pdf_path && ( ... pdfPending ... )}` e **antes** do bloco `{isVoid && r.void_reason && ( ... )}`, acrescentar:
     ```jsx
                         <span
                           className={`text-xs ${openInfo.date ? 'text-foreground' : 'text-muted-foreground'}`}
                         >
                           {t(openInfo.key, { date: openInfo.date })}
                         </span>
     ```
- Pronto quando: lint ok; na ficha do aluno e em Relatórios → Recibos de seguro, cada linha mostra "Ainda não aberto" ou "Aberto pelo aluno em AAAA-MM-DD" embaixo do badge de status.

### 8. ✅ [SONNET] Textos pt / en / fr
- Arquivos: `src/locales/pt.json`, `src/locales/en.json`, `src/locales/fr.json`
- Fazer: em `receipts.list`, depois de `shareReady` (o que tem 6 espaços de recuo e **sem vírgula** no fim; o outro `shareReady`, de `studentReceipts`, não muda), pôr vírgula e as duas chaves novas. Trecho a trocar em cada arquivo (é único):
  - pt — trocar
    ```
          "shareReady": "PDF pronto. Toque em \"Compartilhar\" de novo."
        },
        "void": {
    ```
    por
    ```
          "shareReady": "PDF pronto. Toque em \"Compartilhar\" de novo.",
          "openedByStudent": "Aberto pelo aluno em {{date}}",
          "notOpenedByStudent": "Ainda não aberto"
        },
        "void": {
    ```
  - en — trocar `      "shareReady": "PDF ready. Tap \"Share\" again."\n    },\n    "void": {` por a mesma linha com vírgula + `"openedByStudent": "Opened by the student on {{date}}",` + `"notOpenedByStudent": "Not opened yet"`.
  - fr — trocar `      "shareReady": "PDF prêt. Touchez « Partager » de nouveau."\n    },\n    "void": {` por a mesma linha com vírgula + `"openedByStudent": "Ouvert par l'élève le {{date}}",` + `"notOpenedByStudent": "Pas encore ouvert"`.
- Pronto quando: os 3 JSON são válidos (o build/test lê) e o teste do passo 9 passa.

### 9. ✅ [SONNET] Testes unitários
- Arquivo novo: `src/tests/receiptOpen.test.js` — conteúdo exato:
  ```js
  // @vitest-environment node
  import { describe, it, expect, vi, beforeEach } from 'vitest'

  const rpc = vi.fn()
  vi.mock('@/lib/supabase', () => ({
    supabase: { rpc, storage: { from: () => ({}) } },
  }))

  const { recordReceiptOpen } = await import('@/lib/receiptFiles')

  const receipt = { id: 'r1', receipt_number: 'K-2026-0001', pdf_path: 's/r1.pdf', student_first_opened_at: null }

  describe('recordReceiptOpen', () => {
    beforeEach(() => {
      rpc.mockReset()
      rpc.mockResolvedValue({ data: '2026-11-21T15:00:00+00:00', error: null })
    })

    it('chama a RPC do próprio aluno com o id do recibo e devolve a data', async () => {
      expect(await recordReceiptOpen(receipt, new Set())).toBe('2026-11-21T15:00:00+00:00')
      expect(rpc).toHaveBeenCalledWith('mark_receipt_opened_by_student', { p_receipt_id: 'r1' })
    })

    it('recibo já aberto: não chama a RPC', async () => {
      const opened = { ...receipt, student_first_opened_at: '2026-11-20T10:00:00+00:00' }
      expect(await recordReceiptOpen(opened, new Set())).toBeNull()
      expect(rpc).not.toHaveBeenCalled()
    })

    it('mesma página: o segundo toque não chama de novo', async () => {
      const seen = new Set()
      await recordReceiptOpen(receipt, seen)
      await recordReceiptOpen(receipt, seen)
      expect(rpc).toHaveBeenCalledTimes(1)
    })

    it('erro da RPC: não sobe, devolve null e o próximo toque tenta de novo', async () => {
      rpc.mockResolvedValueOnce({ data: null, error: new Error('network') })
      const seen = new Set()
      expect(await recordReceiptOpen(receipt, seen)).toBeNull()
      expect(await recordReceiptOpen(receipt, seen)).toBe('2026-11-21T15:00:00+00:00')
      expect(rpc).toHaveBeenCalledTimes(2)
    })

    it('RPC rejeita (exceção): não sobe', async () => {
      rpc.mockRejectedValueOnce(new Error('boom'))
      await expect(recordReceiptOpen(receipt, new Set())).resolves.toBeNull()
    })

    it('sem recibo ou sem id: não chama', async () => {
      expect(await recordReceiptOpen(null)).toBeNull()
      expect(await recordReceiptOpen({})).toBeNull()
      expect(rpc).not.toHaveBeenCalled()
    })
  })
  ```
- Arquivo existente: `src/tests/studentReceipts.test.js`
  1. Trocar a linha 3 por:
     ```js
     import { isAppleMobileDevice, isMobileDevice, receiptFileName, studentOpenInfo } from '@/lib/receipts'
     import pt from '@/locales/pt.json'
     import en from '@/locales/en.json'
     import fr from '@/locales/fr.json'
     ```
  2. Acrescentar no fim do arquivo:
     ```js

     describe('studentOpenInfo', () => {
       it('sem data: "Ainda não aberto"', () => {
         expect(studentOpenInfo({ student_first_opened_at: null })).toEqual({ key: 'receipts.list.notOpenedByStudent', date: null })
         expect(studentOpenInfo({})).toEqual({ key: 'receipts.list.notOpenedByStudent', date: null })
         expect(studentOpenInfo({ student_first_opened_at: 'xx' })).toEqual({ key: 'receipts.list.notOpenedByStudent', date: null })
       })
       it('com data: dia de Montréal (como a "Emissão")', () => {
         expect(studentOpenInfo({ student_first_opened_at: '2026-11-21T15:00:00+00:00' }))
           .toEqual({ key: 'receipts.list.openedByStudent', date: '2026-11-21' })
         // 03:30 UTC do dia 21 ainda é dia 20 em Montréal (UTC-5 em novembro)
         expect(studentOpenInfo({ student_first_opened_at: '2026-11-21T03:30:00Z' }).date).toBe('2026-11-20')
       })
     })

     describe('textos da primeira abertura (pt/en/fr)', () => {
       it('as duas chaves existem nas três línguas, com {{date}}', () => {
         for (const lang of [pt, en, fr]) {
           expect(lang.receipts.list.openedByStudent).toContain('{{date}}')
           expect(lang.receipts.list.notOpenedByStudent).toBeTruthy()
         }
       })
     })
     ```
- Pronto quando: `npm test` passa (todos os testes, inclusive os antigos).

### 10. ✅ [SONNET] Atualizar `docs/PENDENCIAS.md`
- Arquivo: `docs/PENDENCIAS.md`
- Fazer:
  1. Linha `_Última atualização: ..._` → `_Última atualização: 2026-11-21 (recibos: registrar a primeira abertura pelo aluno)_`.
  2. Em **"A fazer"**, no item **existente** que começa com `- [ ] **Recibos: registrar a primeira abertura pelo aluno (pedido da Josi, 2026-11-21; nível 1 = só registro na tela, sem email).**`: trocar só o começo `- [ ] **Recibos: registrar a primeira abertura pelo aluno (pedido da Josi, 2026-11-21; nível 1 = só registro na tela, sem email).**` por
     `- [x] **Recibos: registrar a primeira abertura pelo aluno (pedido da Josi, 2026-11-21; nível 1 = só registro na tela, sem email) — feito no código (2026-11-21), plano `docs/planos/2026-11-21-recibo-primeira-abertura.md`. Falta: rodar a migration `20261121000000` (ver "SQL / deploys pendentes"), o merge e o teste no site (ver "Testes em aberto").**`
     e acrescentar, no fim desse mesmo item (mesma linha, depois de "...ficou de fora por enquanto."), a frase:
     ` Como ficou: coluna `insurance_receipts.student_first_opened_at` + RPC `mark_receipt_opened_by_student` (só o próprio aluno; só grava se vazia; recibo anulado ou sem PDF não grava; a guarda de imutabilidade deixa gravar uma vez e nunca mais mudar). "Abrir PDF"/"Baixar PDF" contam quando deram certo; "Compartilhar" conta quando a folha de compartilhar abriu (compartilhou ou fechou). Na tela da professora, embaixo do status: "Aberto pelo aluno em AAAA-MM-DD" ou "Ainda não aberto". Recibos abertos antes desta mudança aparecem como "Ainda não aberto".`
     **Não mexer** no item seguinte ("Recibos: relatório dos recibos emitidos para efeito fiscal").
  3. Em **"Testes em aberto (usuário)"**, como **primeiro** item da lista:
     ```markdown
     - [ ] **Teste depois da migration `20261121000000` e do merge (primeira abertura do recibo pelo aluno):** precisa de um recibo **emitido com PDF** para um **aluno de teste** (e de preferência um 2º aluno de teste). Conferir os textos em pt, en e fr.
       1. **SQL:** no SQL Editor, rodar `docs/testes/recibo-primeira-abertura-teste.sql` e de novo `docs/testes/3.3-recibos-teste.sql` (os dois terminam em ROLLBACK, nada fica gravado): deu certo se não aparecer erro "FALHOU".
       2. **Professora, antes:** ficha do aluno de teste ("Ver" → "Recibos de seguro") e Relatórios → "Recibos de seguro": embaixo do status do recibo aparece "Ainda não aberto" (en "Not opened yet", fr « Pas encore ouvert »).
       3. **Professora abre/compartilha:** a Josi toca em "Baixar"/"Abrir PDF" (e "Compartilhar" no celular) na tela dela → recarregar a página: continua "Ainda não aberto".
       4. **Aluno abre:** entrar como o aluno de teste → "Meus recibos" → "Baixar PDF" (computador) ou "Abrir PDF" (iPhone): o PDF abre/baixa como antes. Na tela da professora (recarregar): "Aberto pelo aluno em AAAA-MM-DD" (data de hoje; en "Opened by the student on ...", fr « Ouvert par l'élève le ... »).
       5. **Aberturas seguintes:** no dia seguinte (ou depois), o aluno abre de novo: a data na tela da professora **não** muda.
       6. **Compartilhar:** com outro recibo de teste ainda não aberto, no celular do aluno tocar só em "Compartilhar" e fechar a folha: na tela da professora passa a "Aberto pelo aluno em ...".
       7. **Anulado:** um recibo anulado nunca aberto continua "Ainda não aberto" (o aluno não tem botão para ele).
     ```
  4. Em **"SQL / deploys pendentes"**, como **primeiro** item da lista:
     ```markdown
     - [ ] **Migration `supabase/migrations/20261121000000_receipt_first_opened_by_student.sql`** (primeira abertura do recibo pelo aluno: coluna `student_first_opened_at`, guarda atualizada, RPC `mark_receipt_opened_by_student`). **Ordem: SQL antes do merge** (o código novo lê a coluna nova; sem ela, as listas de recibos do portal, da ficha do aluno e de Relatórios param de carregar). O SQL sozinho não quebra o site que está no ar (só acrescenta coluna e função).
       1. Colar e rodar o conteúdo da migration (BEGIN/COMMIT, idempotente; se der erro, nada é aplicado).
       2. Rodar `docs/testes/recibo-primeira-abertura-teste.sql` e `docs/testes/3.3-recibos-teste.sql` (ver "Testes em aberto").
       - Reversão (só emergência; **primeiro** o Revert do PR, **depois** o SQL): `docs/testes/recibo-primeira-abertura-reversao.sql` (apaga a função e a coluna, e as datas de abertura gravadas; volta a guarda da `20261112070000`; não mexe nos recibos).
     ```
- Pronto quando: só essas 4 mudanças no arquivo; o item do relatório fiscal está igual ao do `main`.

### 11. [SONNET] Verificação e revisão
- Rodar `npm run lint`, `npm test`, `npm run build` e anotar o resultado real.
- Conferir o diff: só estes arquivos — `supabase/migrations/20261121000000_receipt_first_opened_by_student.sql`, `docs/testes/recibo-primeira-abertura-teste.sql`, `docs/testes/recibo-primeira-abertura-reversao.sql`, `src/lib/receiptFiles.js`, `src/lib/receipts.js`, `src/pages/StudentReceipts.jsx`, `src/components/ReceiptsList.jsx`, `src/locales/{pt,en,fr}.json`, `src/tests/receiptOpen.test.js`, `src/tests/studentReceipts.test.js`, `docs/PENDENCIAS.md`, e este plano (com os ✅).
- Chamar o `revisor` com este plano e a branch; só depois push e PR para `main`.
- Pronto quando: os 3 comandos ok e o `revisor` aprovou.

## Textos (pt / en / fr)
| chave | pt | en | fr |
|---|---|---|---|
| `receipts.list.openedByStudent` | Aberto pelo aluno em {{date}} | Opened by the student on {{date}} | Ouvert par l'élève le {{date}} |
| `receipts.list.notOpenedByStudent` | Ainda não aberto | Not opened yet | Pas encore ouvert |

## Banco de dados
- SQL: **sim** — `supabase/migrations/20261121000000_receipt_first_opened_by_student.sql`; teste `docs/testes/recibo-primeira-abertura-teste.sql` (+ rodar de novo `docs/testes/3.3-recibos-teste.sql`); reversão `docs/testes/recibo-primeira-abertura-reversao.sql`.
- Ordem: **SQL antes do merge** — o código novo pede a coluna `student_first_opened_at` no SELECT das três listas de recibos; sem a coluna o PostgREST devolve erro e as listas mostram "Não foi possível carregar os recibos". O SQL com o site antigo no ar é seguro: só acrescenta uma coluna (ninguém do site antigo a lê), uma função nova e afrouxa a guarda só para essa coluna (uma vez).
- Edge Function a publicar: **nenhuma**.

## Testes
- Automáticos: `npm run lint`, `npm test`, `npm run build` + novos: `src/tests/receiptOpen.test.js` (registro: chama a RPC certa, não chama se já aberto/mesma página, erro não sobe e tenta de novo) e em `src/tests/studentReceipts.test.js` (`studentOpenInfo` com fuso de Montréal; chaves nas 3 línguas).
- SQL (dono, no SQL Editor, antes do merge): `recibo-primeira-abertura-teste.sql` e `3.3-recibos-teste.sql`, sem "FALHOU".
- Manual depois do deploy: o roteiro do item novo em "Testes em aberto" (passo 10.3).

## Bloco "Próxima sessão" (o que a sessão principal escreve no fim)
1. Merge do PR (link) — **só depois do passo 2**.
2. SQL **antes do merge**: rodar no SQL Editor `supabase/migrations/20261121000000_receipt_first_opened_by_student.sql`, depois `docs/testes/recibo-primeira-abertura-teste.sql` e `docs/testes/3.3-recibos-teste.sql` (sem "FALHOU"). Motivo: o código novo lê a coluna nova; o SQL sozinho não quebra o site atual. Edge Function: nenhuma.
3. Testar depois do deploy: roteiro "Teste depois da migration `20261121000000` e do merge" em `docs/PENDENCIAS.md`.
4. **Se quebrar:** GitHub → PR mergeado → **Revert** → mergear o PR de reversão (ou Vercel → Deployments → deploy anterior → **Promote to Production**). O SQL **não precisa** ser revertido para o site voltar (o site antigo ignora a coluna e a função). Só se o problema for o próprio banco: **depois** do revert, `docs/testes/recibo-primeira-abertura-reversao.sql` (apaga as datas de abertura gravadas).
5. Encerrar a sessão (só depois do teste do passo 3).
6. Sessão nova no Claude Code, repositório `HenriquedaFonte/pilatesApp`, modelo **Sonnet** (esforço medium).
7. Primeira mensagem, em bloco de código: `Comece do main atualizado. Leia docs/PENDENCIAS.md. Quero fazer: [tarefa].` (sugestão de tarefa: o próximo item de "A fazer", por exemplo o relatório fiscal dos recibos, que começa perguntando à Josi o que o contador precisa).
- Linha da revisão: "Revisão do Opus: <APROVADO/…> (<n> volta(s))".

## Riscos e como voltar atrás
- **Merge antes do SQL** quebra as listas de recibos (portal, ficha, Relatórios). Mitigação: ordem explícita no bloco e no PENDENCIAS. Se acontecer: rodar a migration (resolve na hora) ou Revert do PR.
- **Guarda de imutabilidade recriada:** um erro nela poderia liberar mudança em recibo. Mitigação: o corpo é o da `20261112070000` + 1 coluna na lista + 1 regra; o teste novo e o `3.3-recibos-teste.sql` conferem que snapshot/valores/PDF/anulação continuam travados.
- **Abrir PDF no iPhone:** o registro é chamado **depois** de `openReceiptPdf` e sem `await`; a aba continua abrindo no toque. Se o registro falhar (rede), o aluno não percebe e o próximo toque tenta de novo.
- **Privacidade:** a data de abertura é um dado novo sobre o aluno (só a professora vê). Ver dúvida 1.
- Voltar atrás: Revert do PR basta para o site; o SQL de reversão é opcional e apaga as datas (exportar antes, comando no próprio arquivo).

## Dúvidas para o dono (nenhuma bloqueia; o plano segue as respostas padrão)
1. **Política de Privacidade (texto legal):** passamos a guardar a data em que o aluno abriu cada recibo (só a Josi vê). Quer acrescentar uma frase na seção 8 (pt/en/fr)? Padrão: **não neste PR**; se quiser, vira um item em "A fazer" para uma sessão com o `dev-critico`.
2. **"Compartilhar" e fechar sem compartilhar** conta como aberto? Padrão: **sim** (o aluno já teve o PDF no celular; a folha do iPhone mostra o arquivo e permite "Salvar em Arquivos").
3. **Só a data ou data e hora** na tela da professora? Padrão: **só a data** (igual à "Emissão"); a hora fica gravada no banco.
