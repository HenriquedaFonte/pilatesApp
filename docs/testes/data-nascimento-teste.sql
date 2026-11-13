-- Teste — aluno preenche a própria data de nascimento uma vez só
--
-- Rodar no Supabase SQL Editor DEPOIS da migration
-- 20261113000000_student_sets_date_of_birth_once.sql.
--
-- Não precisa substituir nada: o script escolhe sozinho 2 alunos e a professora.
-- Colar o arquivo inteiro e rodar.
--
-- Tudo roda dentro de uma transação que termina em ROLLBACK: nada fica gravado
-- (as datas apagadas/mudadas aqui voltam ao que eram).
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

  -- Ponto de partida conhecido (SQL direto, fora do guarda): aluno A sem data,
  -- aluno B com data.
  UPDATE public.profiles SET date_of_birth = NULL WHERE id = a;
  UPDATE public.profiles SET date_of_birth = DATE '1980-05-20' WHERE id = b;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 1. ALUNO A (requisição REST autenticada)
-- ════════════════════════════════════════════════════════════════════════════
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  json_build_object('sub', current_setting('josi.aluno'), 'role', 'authenticated')::text, true);

DO $$
DECLARE
  n int;
BEGIN
  -- Data fora do intervalo (vazia → data no futuro / antes de 1900): recusa
  BEGIN
    UPDATE public.profiles SET date_of_birth = current_date + 1 WHERE id = auth.uid();
    RAISE EXCEPTION 'FALHOU: aluno salvou data de nascimento no futuro';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE public.profiles SET date_of_birth = DATE '1899-12-31' WHERE id = auth.uid();
    RAISE EXCEPTION 'FALHOU: aluno salvou data de nascimento antes de 1900';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- "Meu perfil": preencher a data vazia junto com nome/telefone/idioma
  UPDATE public.profiles
  SET full_name = full_name || ' (teste)', phone = phone,
      preferred_language = preferred_language, date_of_birth = DATE '1985-03-12'
  WHERE id = auth.uid();
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: aluno não conseguiu preencher a data vazia'; END IF;

  -- UPDATE com a linha inteira (useAuth.updateProfile manda a mesma data)
  UPDATE public.profiles
  SET full_name = full_name, email = email, date_of_birth = date_of_birth
  WHERE id = auth.uid();
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: UPDATE com a mesma data não passou'; END IF;

  -- Já preenchida: não muda para outra data
  BEGIN
    UPDATE public.profiles SET date_of_birth = DATE '1990-01-01' WHERE id = auth.uid();
    RAISE EXCEPTION 'FALHOU: aluno mudou a data de nascimento já preenchida';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- Nem apaga (data → NULL)
  BEGIN
    UPDATE public.profiles SET date_of_birth = NULL WHERE id = auth.uid();
    RAISE EXCEPTION 'FALHOU: aluno apagou a data de nascimento';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- Não mexe na data do aluno B (RLS: nenhuma linha)
  UPDATE public.profiles SET date_of_birth = DATE '2001-01-01'
  WHERE id = current_setting('josi.aluno_b')::uuid;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: aluno mudou a data do aluno B'; END IF;

  -- Nome/telefone/idioma continuam salvando sem mandar a data
  UPDATE public.profiles SET full_name = full_name || '.', phone = phone
  WHERE id = auth.uid();
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: aluno não conseguiu editar o próprio nome'; END IF;

  -- As travas antigas continuam (email e créditos)
  BEGIN
    UPDATE public.profiles SET email = 'teste-dn-' || gen_random_uuid() || '@example.com'
    WHERE id = auth.uid();
    RAISE EXCEPTION 'FALHOU: aluno mudou o próprio email';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.profiles SET group_credits = group_credits + 10 WHERE id = auth.uid();
    RAISE EXCEPTION 'FALHOU: aluno mudou os próprios créditos';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

RESET ROLE;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. PROFESSORA (continua mudando e apagando a data pela API)
-- ════════════════════════════════════════════════════════════════════════════
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  json_build_object('sub', current_setting('josi.professora'), 'role', 'authenticated')::text, true);

DO $$
DECLARE
  n int;
BEGIN
  UPDATE public.profiles SET date_of_birth = DATE '1986-04-13'
  WHERE id = current_setting('josi.aluno')::uuid;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: professora não conseguiu corrigir a data do aluno'; END IF;

  UPDATE public.profiles SET date_of_birth = NULL
  WHERE id = current_setting('josi.aluno_b')::uuid;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: professora não conseguiu apagar a data do aluno'; END IF;
END $$;

RESET ROLE;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. SQL direto / Edge Function (fora dos papéis authenticated/anon)
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  n int;
BEGIN
  UPDATE public.profiles SET date_of_birth = DATE '1970-07-07'
  WHERE id = current_setting('josi.aluno')::uuid;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: SQL direto não conseguiu mudar a data'; END IF;
END $$;

ROLLBACK;
