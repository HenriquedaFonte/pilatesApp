-- Teste — arquivo de alunos
-- (migration 20261128020000_archive_students.sql; plano
--  docs/planos/2026-11-28-arquivo-de-alunos.md, passo 1)
--
-- Rodar no Supabase SQL Editor DEPOIS da migration 20261128020000.
--
-- Não precisa editar nada: o script escolhe sozinho a professora (role =
-- 'teacher', não arquivada) e os dois primeiros alunos não arquivados (ordem
-- do id).
--
-- Confere:
--   0. staff_consent_overview(): SECURITY DEFINER, search_path = public,
--      comentário novo, EXECUTE só para authenticated (anon não).
--   1. Bloqueio (dados reais, sem mudar nada): todo aluno arquivado que tem
--      usuário de login está com banned_until no futuro; nenhum aluno ativo
--      está bloqueado.
--   2. A professora recebe UMA linha por aluno, arquivado ou não (o script
--      arquiva um aluno de mentira dentro da transação para ter um caso).
--   3. Um aluno chamando a função recebe erro (não vê os outros).
--
-- Tudo roda dentro de uma transação que termina em ROLLBACK: nada fica gravado
-- (nem o arquivamento de teste).
-- Resultado:
--   • Sucesso → nenhum erro (o editor mostra só o último resultado; é normal).
--     Na aba de mensagens aparecem os NOTICE com as contagens.
--   • Falha   → erro começando com "FALHOU: ..." dizendo o que falhou.

BEGIN;

-- Escolha dos participantes e contagem de alunos (como postgres).
DO $$
BEGIN
  PERFORM set_config('josi.aluno',
    coalesce((SELECT id::text FROM public.profiles
              WHERE role = 'student' AND deleted_at IS NULL
              ORDER BY id OFFSET 0 LIMIT 1), ''), true);
  PERFORM set_config('josi.aluno_b',
    coalesce((SELECT id::text FROM public.profiles
              WHERE role = 'student' AND deleted_at IS NULL
              ORDER BY id OFFSET 1 LIMIT 1), ''), true);
  PERFORM set_config('josi.professora',
    coalesce((SELECT id::text FROM public.profiles
              WHERE role = 'teacher' AND deleted_at IS NULL
              ORDER BY id LIMIT 1), ''), true);
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 0. Estrutura (como postgres)
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_fn regprocedure := to_regprocedure('public.staff_consent_overview()');
  v_def boolean;
  v_cfg text[];
BEGIN
  IF nullif(current_setting('josi.aluno'), '') IS NULL
     OR nullif(current_setting('josi.aluno_b'), '') IS NULL THEN
    RAISE EXCEPTION 'FALHOU: não há dois alunos não arquivados para o teste';
  END IF;
  IF nullif(current_setting('josi.professora'), '') IS NULL THEN
    RAISE EXCEPTION 'FALHOU: não há professora (role = teacher) não arquivada para o teste';
  END IF;

  IF v_fn IS NULL THEN
    RAISE EXCEPTION 'FALHOU: public.staff_consent_overview() não existe';
  END IF;
  SELECT prosecdef, proconfig INTO v_def, v_cfg FROM pg_proc WHERE oid = v_fn;
  IF NOT v_def THEN
    RAISE EXCEPTION 'FALHOU: staff_consent_overview() deveria ser SECURITY DEFINER';
  END IF;
  IF NOT ('search_path=public' = ANY (coalesce(v_cfg, '{}'))) THEN
    RAISE EXCEPTION 'FALHOU: staff_consent_overview() sem search_path = public (veio %)', v_cfg;
  END IF;
  IF coalesce(obj_description(v_fn, 'pg_proc'), '') NOT LIKE 'josi-pilates:%inclusive arquivado%' THEN
    RAISE EXCEPTION 'FALHOU: comentário de staff_consent_overview() não é o da migration 20261128020000';
  END IF;
  IF has_function_privilege('anon', v_fn, 'EXECUTE') THEN
    RAISE EXCEPTION 'FALHOU: anon não deveria executar staff_consent_overview()';
  END IF;
  IF NOT has_function_privilege('authenticated', v_fn, 'EXECUTE') THEN
    RAISE EXCEPTION 'FALHOU: authenticated deveria executar staff_consent_overview()';
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 1. Bloqueio de login (dados reais, como postgres; nada é alterado aqui)
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  n_arquivados int;
  n_arquivados_sem_bloqueio int;
  n_ativos_bloqueados int;
BEGIN
  SELECT count(*) INTO n_arquivados
  FROM public.profiles p JOIN auth.users u ON u.id = p.id
  WHERE p.role = 'student' AND p.deleted_at IS NOT NULL;

  SELECT count(*) INTO n_arquivados_sem_bloqueio
  FROM public.profiles p JOIN auth.users u ON u.id = p.id
  WHERE p.role = 'student' AND p.deleted_at IS NOT NULL
    AND (u.banned_until IS NULL OR u.banned_until <= now());

  SELECT count(*) INTO n_ativos_bloqueados
  FROM public.profiles p JOIN auth.users u ON u.id = p.id
  WHERE p.role = 'student' AND p.deleted_at IS NULL
    AND u.banned_until > now();

  RAISE NOTICE 'Alunos arquivados com login: %; sem bloqueio: %; alunos ativos bloqueados: %',
    n_arquivados, n_arquivados_sem_bloqueio, n_ativos_bloqueados;

  IF n_arquivados_sem_bloqueio > 0 THEN
    RAISE EXCEPTION 'FALHOU: % aluno(s) arquivado(s) ainda conseguem entrar (banned_until vazio ou no passado). Rode a migration 20261128020000 de novo.', n_arquivados_sem_bloqueio;
  END IF;
  IF n_ativos_bloqueados > 0 THEN
    RAISE EXCEPTION 'FALHOU: % aluno(s) ativo(s) com login bloqueado (banned_until no futuro). Confira em auth.users se alguém foi bloqueado à mão no painel do Supabase.', n_ativos_bloqueados;
  END IF;
END $$;

-- Arquivamento de TESTE do aluno B (desfeito pelo ROLLBACK no fim).
UPDATE public.profiles SET deleted_at = now()
WHERE id = current_setting('josi.aluno_b')::uuid;

SELECT set_config('josi.n_alunos',
  (SELECT count(*)::text FROM public.profiles WHERE role = 'student'), true);

-- ════════════════════════════════════════════════════════════════════════════
-- 2. PROFESSORA: uma linha por aluno, inclusive arquivado
-- ════════════════════════════════════════════════════════════════════════════
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  json_build_object('sub', current_setting('josi.professora'), 'role', 'authenticated')::text, true);

DO $$
DECLARE
  a uuid := current_setting('josi.aluno')::uuid;
  b uuid := current_setting('josi.aluno_b')::uuid;
  t uuid := current_setting('josi.professora')::uuid;
  n_esperado int := current_setting('josi.n_alunos')::int;
  n_linhas int;
  n_distintos int;
BEGIN
  SELECT count(*), count(DISTINCT student_id) INTO n_linhas, n_distintos
  FROM public.staff_consent_overview();

  RAISE NOTICE 'Overview: % linha(s); alunos (role = student, inclusive arquivados): %', n_linhas, n_esperado;

  IF n_linhas <> n_distintos THEN
    RAISE EXCEPTION 'FALHOU: overview tem aluno repetido (% linhas, % alunos distintos)', n_linhas, n_distintos;
  END IF;
  IF n_linhas <> n_esperado THEN
    RAISE EXCEPTION 'FALHOU: overview devolveu % linha(s), esperado % (todos os alunos, arquivados inclusive)', n_linhas, n_esperado;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.staff_consent_overview() WHERE student_id = a) THEN
    RAISE EXCEPTION 'FALHOU: overview não trouxe o aluno ativo A';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.staff_consent_overview() WHERE student_id = b) THEN
    RAISE EXCEPTION 'FALHOU: overview não trouxe o aluno arquivado B';
  END IF;
  IF EXISTS (SELECT 1 FROM public.staff_consent_overview() WHERE student_id = t) THEN
    RAISE EXCEPTION 'FALHOU: overview trouxe a professora (só alunos deveriam vir)';
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. ALUNO: não pode chamar a visão da professora
-- ════════════════════════════════════════════════════════════════════════════
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  json_build_object('sub', current_setting('josi.aluno'), 'role', 'authenticated')::text, true);

DO $$
BEGIN
  BEGIN
    PERFORM * FROM public.staff_consent_overview();
    RAISE EXCEPTION 'FALHOU: aluno conseguiu chamar staff_consent_overview()';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL; -- esperado (consent_not_allowed, 42501)
  END;
END $$;

RESET ROLE;
SELECT set_config('request.jwt.claims', '', true);

ROLLBACK;
