-- Teste — aluno não muda o próprio email em profiles
--
-- Rodar no Supabase SQL Editor DEPOIS da migration
-- 20261112060000_lock_student_profile_email.sql.
--
-- Não precisa substituir nada: o script escolhe sozinho 2 alunos e a professora.
-- Colar o arquivo inteiro e rodar.
--
-- Tudo roda dentro de uma transação que termina em ROLLBACK: nada fica gravado.
-- Resultado:
--   • Sucesso → nenhum erro (o editor mostra só o último resultado; é normal).
--   • Falha   → erro começando com "FALHOU: ..." dizendo o que falhou.

BEGIN;

DO $$
DECLARE
  a uuid; b uuid; t uuid;
BEGIN
  SELECT id INTO a FROM public.profiles WHERE role = 'student' AND deleted_at IS NULL ORDER BY id LIMIT 1;
  SELECT id INTO b FROM public.profiles WHERE role = 'student' AND deleted_at IS NULL AND id <> a ORDER BY id LIMIT 1;
  SELECT id INTO t FROM public.profiles WHERE role = 'teacher' ORDER BY id LIMIT 1;
  IF a IS NULL OR b IS NULL OR t IS NULL THEN
    RAISE EXCEPTION 'Precisa de pelo menos 2 alunos e 1 professora em profiles.';
  END IF;
  PERFORM set_config('josi.aluno', a::text, true);
  PERFORM set_config('josi.aluno_b', b::text, true);
  PERFORM set_config('josi.professora', t::text, true);
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 1. ALUNO (requisição REST autenticada)
-- ════════════════════════════════════════════════════════════════════════════
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  json_build_object('sub', current_setting('josi.aluno'), 'role', 'authenticated')::text, true);

DO $$
DECLARE
  n int;
BEGIN
  -- Não muda o próprio email
  BEGIN
    UPDATE public.profiles
    SET email = 'teste-email-' || gen_random_uuid() || '@example.com'
    WHERE id = auth.uid();
    RAISE EXCEPTION 'FALHOU: aluno mudou o próprio email em profiles';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- Nem para NULL
  BEGIN
    UPDATE public.profiles SET email = NULL WHERE id = auth.uid();
    RAISE EXCEPTION 'FALHOU: aluno apagou o próprio email em profiles';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- Não muda o email do aluno B (RLS: nenhuma linha)
  UPDATE public.profiles SET email = 'teste-email-b@example.com'
  WHERE id = current_setting('josi.aluno_b')::uuid;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: aluno mudou o email do aluno B'; END IF;

  -- "Meu perfil" continua salvando nome, telefone e idioma, e o UPDATE com a
  -- linha inteira (useAuth.updateProfile manda o mesmo email) continua passando
  UPDATE public.profiles
  SET full_name = full_name || ' (teste)', phone = phone, email = email,
      preferred_language = preferred_language
  WHERE id = auth.uid();
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: aluno não conseguiu editar o próprio nome'; END IF;
END $$;

RESET ROLE;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. PROFESSORA (continua podendo mudar o email pela API)
-- ════════════════════════════════════════════════════════════════════════════
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  json_build_object('sub', current_setting('josi.professora'), 'role', 'authenticated')::text, true);

DO $$
DECLARE
  n int;
BEGIN
  UPDATE public.profiles
  SET email = 'teste-email-' || gen_random_uuid() || '@example.com'
  WHERE id = current_setting('josi.aluno')::uuid;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: professora não conseguiu mudar o email do aluno'; END IF;
END $$;

RESET ROLE;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. SQL direto / Edge Function (fora dos papéis authenticated/anon)
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  n int;
BEGIN
  UPDATE public.profiles
  SET email = 'teste-email-' || gen_random_uuid() || '@example.com'
  WHERE id = current_setting('josi.aluno_b')::uuid;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: SQL direto não conseguiu mudar o email'; END IF;
END $$;

ROLLBACK;
