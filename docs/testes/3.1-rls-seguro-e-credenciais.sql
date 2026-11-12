-- Teste AC-7 — Story 3.1 (student_insurance, practitioner_credentials, storage)
--
-- Rodar no Supabase SQL Editor DEPOIS da migration
-- 20261112000000_create_student_insurance_and_practitioner.sql.
--
-- Antes de rodar, substituir (Ctrl+H) os três marcadores por ids reais de profiles:
--   <UUID_ALUNO_A>    → um aluno (role = 'student')
--   <UUID_ALUNO_B>    → outro aluno (role = 'student')
--   <UUID_PROFESSORA> → a professora (role = 'teacher')
-- Para achar os ids:
--   SELECT id, full_name, role FROM public.profiles ORDER BY role, full_name;
--
-- Tudo roda dentro de uma transação que termina em ROLLBACK: nada fica gravado.
-- Resultado:
--   • Sucesso → "Success. No rows returned" (nenhum erro).
--   • Falha   → erro começando com "AC-7 FALHOU: ..." dizendo qual verificação falhou.
--             (A transação é abortada; nada fica gravado.)

BEGIN;

-- ── Dados de teste (como postgres, ignora RLS) ──────────────────────────────
INSERT INTO public.student_insurance (student_id, policy_number)
VALUES ('<UUID_ALUNO_A>', 'TESTE-A'), ('<UUID_ALUNO_B>', 'TESTE-B')
ON CONFLICT (student_id) DO NOTHING;

INSERT INTO public.practitioner_credentials (teacher_id, professional_name)
VALUES ('<UUID_PROFESSORA>', 'TESTE')
ON CONFLICT (teacher_id) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- 1. Como ALUNO A
-- ════════════════════════════════════════════════════════════════════════════
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"<UUID_ALUNO_A>","role":"authenticated"}';

-- Pré-requisito: o aluno não consegue virar professora. Todas as policies de
-- professora dependem de profiles.role ser confiável.
DO $$
BEGIN
  BEGIN
    UPDATE public.profiles SET role = 'teacher' WHERE id = auth.uid();
    RAISE EXCEPTION 'AC-7 FALHOU: aluno A conseguiu mudar o próprio role para teacher (trigger prevent_privilege_escalation não está bloqueando)';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;  -- esperado
  END;
END $$;

DO $$
DECLARE
  n int;
BEGIN
  -- Não lê a linha do aluno B
  SELECT count(*) INTO n FROM public.student_insurance
  WHERE student_id = '<UUID_ALUNO_B>';
  IF n <> 0 THEN RAISE EXCEPTION 'AC-7 FALHOU: aluno A leu student_insurance do aluno B'; END IF;

  -- Só enxerga a própria linha
  SELECT count(*) INTO n FROM public.student_insurance;
  IF n <> 1 THEN RAISE EXCEPTION 'AC-7 FALHOU: aluno A vê % linhas em student_insurance (esperado 1)', n; END IF;

  -- Não altera a linha do aluno B
  UPDATE public.student_insurance SET policy_number = 'HACK'
  WHERE student_id = '<UUID_ALUNO_B>';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'AC-7 FALHOU: aluno A alterou student_insurance do aluno B'; END IF;

  -- Não troca o student_id da própria linha para outro id
  BEGIN
    UPDATE public.student_insurance SET student_id = gen_random_uuid()
    WHERE student_id = '<UUID_ALUNO_A>';
    RAISE EXCEPTION 'AC-7 FALHOU: aluno A trocou student_id da própria linha';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;  -- esperado (bloqueado pelo WITH CHECK)
  END;

  -- Não cria linha para outro aluno
  BEGIN
    INSERT INTO public.student_insurance (student_id) VALUES (gen_random_uuid());
    RAISE EXCEPTION 'AC-7 FALHOU: aluno A inseriu student_insurance de outra pessoa';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;  -- esperado (bloqueado pelo WITH CHECK)
  END;

  -- Não apaga (nem a própria linha)
  DELETE FROM public.student_insurance WHERE student_id = '<UUID_ALUNO_A>';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'AC-7 FALHOU: aluno A apagou student_insurance'; END IF;

  -- Não lê practitioner_credentials
  SELECT count(*) INTO n FROM public.practitioner_credentials;
  IF n <> 0 THEN RAISE EXCEPTION 'AC-7 FALHOU: aluno A leu practitioner_credentials'; END IF;

  -- Não cria practitioner_credentials para si
  BEGIN
    INSERT INTO public.practitioner_credentials (teacher_id) VALUES ('<UUID_ALUNO_A>');
    RAISE EXCEPTION 'AC-7 FALHOU: aluno A inseriu practitioner_credentials';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;  -- esperado
  END;

  -- Não lista arquivos do bucket de assinaturas
  SELECT count(*) INTO n FROM storage.objects WHERE bucket_id = 'practitioner-signatures';
  IF n <> 0 THEN RAISE EXCEPTION 'AC-7 FALHOU: aluno A vê arquivos de practitioner-signatures'; END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. Como PROFESSORA
-- ════════════════════════════════════════════════════════════════════════════
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"<UUID_PROFESSORA>","role":"authenticated"}';

DO $$
DECLARE
  n int;
BEGIN
  -- Lê as linhas dos dois alunos
  SELECT count(*) INTO n FROM public.student_insurance
  WHERE student_id IN ('<UUID_ALUNO_A>', '<UUID_ALUNO_B>');
  IF n <> 2 THEN RAISE EXCEPTION 'AC-7 FALHOU: professora vê % de 2 linhas dos alunos', n; END IF;

  -- Altera a linha de um aluno
  UPDATE public.student_insurance SET policy_number = 'TESTE-B2'
  WHERE student_id = '<UUID_ALUNO_B>';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'AC-7 FALHOU: professora não conseguiu alterar student_insurance'; END IF;

  -- Não apaga
  DELETE FROM public.student_insurance WHERE student_id = '<UUID_ALUNO_B>';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'AC-7 FALHOU: professora apagou student_insurance'; END IF;

  -- Lê as próprias credenciais
  SELECT count(*) INTO n FROM public.practitioner_credentials
  WHERE teacher_id = '<UUID_PROFESSORA>';
  IF n <> 1 THEN RAISE EXCEPTION 'AC-7 FALHOU: professora não lê as próprias credenciais'; END IF;

  -- Não cria credenciais em nome de outra pessoa
  BEGIN
    INSERT INTO public.practitioner_credentials (teacher_id) VALUES ('<UUID_ALUNO_A>');
    RAISE EXCEPTION 'AC-7 FALHOU: professora inseriu practitioner_credentials de outra pessoa';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;  -- esperado
  END;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. Como visitante (anon)
-- ════════════════════════════════════════════════════════════════════════════
RESET ROLE;
SET LOCAL ROLE anon;
SET LOCAL request.jwt.claims = '{"role":"anon"}';

DO $$
DECLARE
  n int;
BEGIN
  SELECT count(*) INTO n FROM public.student_insurance;
  IF n <> 0 THEN RAISE EXCEPTION 'AC-7 FALHOU: anon leu student_insurance'; END IF;

  SELECT count(*) INTO n FROM public.practitioner_credentials;
  IF n <> 0 THEN RAISE EXCEPTION 'AC-7 FALHOU: anon leu practitioner_credentials'; END IF;
END $$;

RESET ROLE;
ROLLBACK;

-- Conferência do bucket (opcional, fora da transação; só leitura):
--   SELECT id, public, file_size_limit, allowed_mime_types
--   FROM storage.buckets WHERE id = 'practitioner-signatures';
--   Esperado: public = false, 512000, {image/png,image/jpeg}
