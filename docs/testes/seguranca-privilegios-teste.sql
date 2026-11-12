-- Teste — segurança de profiles e das RPCs de crédito
--
-- Rodar no Supabase SQL Editor DEPOIS da migration
-- 20261112010000_fix_profiles_privilege_escalation_and_rls.sql.
--
-- Não precisa substituir nada: o script escolhe sozinho 2 alunos e a professora.
-- Colar o arquivo inteiro e rodar.
--
-- Tudo roda dentro de uma transação que termina em ROLLBACK: nada fica gravado
-- (nem créditos, nem histórico, nem check-in, nem nome).
-- Resultado:
--   • Sucesso → "Success. No rows returned" (nenhum erro).
--   • Falha   → erro começando com "FALHOU: ..." dizendo o que falhou.

BEGIN;

-- Escolhe sozinho dois alunos e a professora (nada a substituir à mão).
DO $$
DECLARE
  a uuid; b uuid; t uuid;
BEGIN
  SELECT id INTO a FROM public.profiles WHERE role = 'student' ORDER BY id LIMIT 1;
  SELECT id INTO b FROM public.profiles WHERE role = 'student' AND id <> a ORDER BY id LIMIT 1;
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
  -- Leitura: só a própria linha
  SELECT count(*) INTO n FROM public.profiles;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: aluno vê % perfis (esperado 1)', n; END IF;
  SELECT count(*) INTO n FROM public.profiles WHERE id = current_setting('josi.aluno_b')::uuid;
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: aluno leu o perfil do aluno B'; END IF;

  -- Não edita nem apaga o aluno B
  UPDATE public.profiles SET full_name = 'HACK' WHERE id = current_setting('josi.aluno_b')::uuid;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: aluno editou o perfil do aluno B'; END IF;
  DELETE FROM public.profiles WHERE id = current_setting('josi.aluno_b')::uuid;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: aluno apagou o perfil do aluno B'; END IF;

  -- Não apaga o próprio perfil
  DELETE FROM public.profiles WHERE id = auth.uid();
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: aluno apagou o próprio perfil'; END IF;

  -- Não muda role, créditos nem campos da professora na própria linha
  BEGIN
    UPDATE public.profiles SET role = 'teacher' WHERE id = auth.uid();
    RAISE EXCEPTION 'FALHOU: aluno mudou o próprio role';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.profiles SET individual_credits = individual_credits + 99 WHERE id = auth.uid();
    RAISE EXCEPTION 'FALHOU: aluno mudou individual_credits';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.profiles SET duo_credits = duo_credits + 99 WHERE id = auth.uid();
    RAISE EXCEPTION 'FALHOU: aluno mudou duo_credits';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.profiles SET group_credits = group_credits + 99 WHERE id = auth.uid();
    RAISE EXCEPTION 'FALHOU: aluno mudou group_credits';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.profiles SET observations = coalesce(observations, '') || ' HACK' WHERE id = auth.uid();
    RAISE EXCEPTION 'FALHOU: aluno mudou observations';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.profiles SET is_active = NOT coalesce(is_active, true) WHERE id = auth.uid();
    RAISE EXCEPTION 'FALHOU: aluno mudou is_active';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.profiles SET deleted_at = now() WHERE id = auth.uid();
    RAISE EXCEPTION 'FALHOU: aluno mudou deleted_at';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- Campos permitidos continuam editáveis (telas "Meu perfil" e idioma)
  UPDATE public.profiles
  SET full_name = full_name || ' (teste)', phone = phone, email = email,
      preferred_language = preferred_language
  WHERE id = auth.uid();
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: aluno não conseguiu editar o próprio nome'; END IF;

  -- Não chama as RPCs de crédito
  BEGIN
    PERFORM public.update_class_balance(current_setting('josi.aluno')::uuid, 10, 'HACK', 'group', NULL, NULL);
    RAISE EXCEPTION 'FALHOU: aluno chamou update_class_balance';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.mark_attendance(current_setting('josi.aluno')::uuid, gen_random_uuid(), gen_random_uuid(),
                                   current_date, 'present', 'group');
    RAISE EXCEPTION 'FALHOU: aluno chamou mark_attendance';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.update_class_balance_impl(current_setting('josi.aluno')::uuid, 10, 'HACK', 'group', NULL, NULL);
    RAISE EXCEPTION 'FALHOU: aluno chamou update_class_balance_impl';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

-- Usuário novo sem perfil: não se cria como professora nem com créditos
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-4000-8000-00000000abcd","role":"authenticated"}';
DO $$
BEGIN
  BEGIN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (auth.uid(), 'teste-seguranca@example.com', 'Teste', 'teacher');
    RAISE EXCEPTION 'FALHOU: usuário criou o próprio perfil como teacher';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.profiles (id, email, full_name, role, group_credits)
    VALUES (auth.uid(), 'teste-seguranca@example.com', 'Teste', 'student', 50);
    RAISE EXCEPTION 'FALHOU: usuário criou o próprio perfil com créditos';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

RESET ROLE;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. ANÔNIMO (sem login)
-- ════════════════════════════════════════════════════════════════════════════
SET LOCAL ROLE anon;
SET LOCAL request.jwt.claims = '{"role":"anon"}';

DO $$
DECLARE
  n int;
BEGIN
  SELECT count(*) INTO n FROM public.profiles;
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: anônimo vê % perfis', n; END IF;
  BEGIN
    PERFORM public.update_class_balance(current_setting('josi.aluno')::uuid, 10, 'HACK', 'group', NULL, NULL);
    RAISE EXCEPTION 'FALHOU: anônimo chamou update_class_balance';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.mark_attendance(current_setting('josi.aluno')::uuid, gen_random_uuid(), gen_random_uuid(),
                                   current_date, 'present', 'group');
    RAISE EXCEPTION 'FALHOU: anônimo chamou mark_attendance';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

RESET ROLE;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. PROFESSORA
-- ════════════════════════════════════════════════════════════════════════════
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  json_build_object('sub', current_setting('josi.professora'), 'role', 'authenticated')::text, true);

DO $$
DECLARE
  n int;
  antes int;
  depois int;
  hist_antes int;
  hist_depois int;
  v_sched uuid;
  v_class uuid;
BEGIN
  -- Lê todos os perfis
  SELECT count(*) INTO n FROM public.profiles WHERE id IN (current_setting('josi.aluno')::uuid, current_setting('josi.aluno_b')::uuid);
  IF n <> 2 THEN RAISE EXCEPTION 'FALHOU: professora não vê os dois alunos (viu %)', n; END IF;

  -- Edita observações e status do aluno (tela Alunos)
  UPDATE public.profiles
  SET observations = coalesce(observations, '') || ' (teste)', is_active = is_active
  WHERE id = current_setting('josi.aluno')::uuid;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: professora não editou observations do aluno'; END IF;

  -- Não muda crédito nem role por UPDATE direto (só pela RPC, com histórico)
  BEGIN
    UPDATE public.profiles SET group_credits = group_credits + 5 WHERE id = current_setting('josi.aluno')::uuid;
    RAISE EXCEPTION 'FALHOU: professora mudou crédito por UPDATE direto (sem histórico)';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.profiles SET role = 'teacher' WHERE id = current_setting('josi.aluno')::uuid;
    RAISE EXCEPTION 'FALHOU: professora mudou role por UPDATE direto';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- update_class_balance: +2 e -1 em group, com histórico
  SELECT group_credits INTO antes FROM public.profiles WHERE id = current_setting('josi.aluno')::uuid;
  SELECT count(*) INTO hist_antes FROM public.balance_history WHERE student_id = current_setting('josi.aluno')::uuid;

  PERFORM public.update_class_balance(
    student_uuid         => current_setting('josi.aluno')::uuid,
    change_amount        => 2,
    description_text     => 'TESTE seguranca (rollback)',
    credit_type_param    => 'group',
    payment_method_param => NULL,
    amount_paid_param    => NULL
  );
  PERFORM public.update_class_balance(current_setting('josi.aluno')::uuid, -1, 'TESTE seguranca (rollback)', 'group');

  SELECT group_credits INTO depois FROM public.profiles WHERE id = current_setting('josi.aluno')::uuid;
  SELECT count(*) INTO hist_depois FROM public.balance_history WHERE student_id = current_setting('josi.aluno')::uuid;
  IF depois IS DISTINCT FROM coalesce(antes, 0) + 1 THEN
    RAISE EXCEPTION 'FALHOU: update_class_balance não ajustou o saldo (antes=%, depois=%)', antes, depois;
  END IF;
  IF hist_depois <> hist_antes + 2 THEN
    RAISE EXCEPTION 'FALHOU: update_class_balance não gravou no balance_history';
  END IF;

  -- mark_attendance: presença debita 1 crédito group e grava histórico + check-in
  SELECT id, class_id INTO v_sched, v_class FROM public.class_schedules LIMIT 1;
  IF v_sched IS NULL THEN
    RAISE NOTICE 'Sem class_schedules: teste de mark_attendance pulado';
  ELSE
    antes := depois;
    hist_antes := hist_depois;
    PERFORM public.mark_attendance(current_setting('josi.aluno')::uuid, v_class, v_sched,
                                   DATE '2000-01-03', 'present', 'group');
    SELECT group_credits INTO depois FROM public.profiles WHERE id = current_setting('josi.aluno')::uuid;
    SELECT count(*) INTO hist_depois FROM public.balance_history WHERE student_id = current_setting('josi.aluno')::uuid;
    IF depois IS DISTINCT FROM antes - 1 THEN
      RAISE EXCEPTION 'FALHOU: mark_attendance não debitou o crédito (antes=%, depois=%)', antes, depois;
    END IF;
    IF hist_depois <> hist_antes + 1 THEN
      RAISE EXCEPTION 'FALHOU: mark_attendance não gravou no balance_history';
    END IF;
    SELECT count(*) INTO n FROM public.check_ins
    WHERE student_id = current_setting('josi.aluno')::uuid AND schedule_id = v_sched AND check_in_date = DATE '2000-01-03';
    IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: mark_attendance não gravou o check-in'; END IF;
  END IF;
END $$;

RESET ROLE;

ROLLBACK;
