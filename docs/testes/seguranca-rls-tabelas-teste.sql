-- Teste — RLS das tabelas operacionais (aulas, check-in, presença, histórico
-- de créditos, emails, depoimentos, agenda pública)
--
-- Rodar no Supabase SQL Editor DEPOIS das migrations
--   20261112010000_fix_profiles_privilege_escalation_and_rls.sql e
--   20261112020000_fix_rls_operational_tables.sql.
--
-- Não precisa substituir nada: o script escolhe sozinho 2 alunos e a professora.
-- Colar o arquivo inteiro e rodar.
--
-- Tudo roda dentro de uma transação que termina em ROLLBACK: nada fica gravado
-- (nem aulas, nem check-ins, nem histórico, nem créditos, nem depoimentos).
-- Resultado:
--   • Sucesso → "Success. No rows returned" (nenhum erro).
--   • Falha   → erro começando com "FALHOU: ..." dizendo o que falhou.

BEGIN;

-- Escolhe 2 alunos e a professora; guarda os totais vistos pelo dono do banco
-- (sem RLS) para comparar com o que cada papel enxerga.
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

  PERFORM set_config('josi.total_bh',      (SELECT count(*) FROM public.balance_history)::text, true);
  PERFORM set_config('josi.total_ci',      (SELECT count(*) FROM public.check_ins)::text, true);
  PERFORM set_config('josi.total_scl',     (SELECT count(*) FROM public.student_class_link)::text, true);
  PERFORM set_config('josi.total_classes', (SELECT count(*) FROM public.classes)::text, true);
  PERFORM set_config('josi.total_sched',   (SELECT count(*) FROM public.class_schedules)::text, true);
  PERFORM set_config('josi.own_bh',  (SELECT count(*) FROM public.balance_history WHERE student_id = a)::text, true);
  PERFORM set_config('josi.own_ci',  (SELECT count(*) FROM public.check_ins WHERE student_id = a)::text, true);
  PERFORM set_config('josi.own_scl', (SELECT count(*) FROM public.student_class_link WHERE student_id = a)::text, true);
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
  me uuid := current_setting('josi.aluno')::uuid;
  other uuid := current_setting('josi.aluno_b')::uuid;
  v_class uuid;
  v_sched uuid;
BEGIN
  -- ── Leitura: só o que é dele ──
  SELECT count(*) INTO n FROM public.balance_history WHERE student_id IS DISTINCT FROM me;
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: aluno vê % linhas de balance_history de outros', n; END IF;
  SELECT count(*) INTO n FROM public.balance_history;
  IF n <> current_setting('josi.own_bh')::int THEN
    RAISE EXCEPTION 'FALHOU: aluno vê % linhas do próprio balance_history (esperado %)', n, current_setting('josi.own_bh');
  END IF;

  SELECT count(*) INTO n FROM public.check_ins WHERE student_id IS DISTINCT FROM me;
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: aluno vê % check-ins de outros', n; END IF;
  SELECT count(*) INTO n FROM public.check_ins;
  IF n <> current_setting('josi.own_ci')::int THEN
    RAISE EXCEPTION 'FALHOU: aluno vê % check-ins próprios (esperado %)', n, current_setting('josi.own_ci');
  END IF;

  SELECT count(*) INTO n FROM public.student_class_link WHERE student_id IS DISTINCT FROM me;
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: aluno vê % matrículas de outros', n; END IF;
  SELECT count(*) INTO n FROM public.student_class_link;
  IF n <> current_setting('josi.own_scl')::int THEN
    RAISE EXCEPTION 'FALHOU: aluno vê % matrículas próprias (esperado %)', n, current_setting('josi.own_scl');
  END IF;

  -- Catálogo de aulas e horários: lê tudo (painel e histórico do aluno)
  SELECT count(*) INTO n FROM public.classes;
  IF n <> current_setting('josi.total_classes')::int THEN RAISE EXCEPTION 'FALHOU: aluno não lê classes'; END IF;
  SELECT count(*) INTO n FROM public.class_schedules;
  IF n <> current_setting('josi.total_sched')::int THEN RAISE EXCEPTION 'FALHOU: aluno não lê class_schedules'; END IF;

  -- ── Escrita: nada ──
  BEGIN
    INSERT INTO public.balance_history (student_id, change_amount, description)
    VALUES (me, 50, 'HACK');
    RAISE EXCEPTION 'FALHOU: aluno inseriu no próprio balance_history';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  UPDATE public.balance_history SET description = 'HACK' WHERE student_id = me;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: aluno alterou o próprio balance_history'; END IF;
  DELETE FROM public.balance_history WHERE student_id = me;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: aluno apagou o próprio balance_history'; END IF;

  BEGIN
    INSERT INTO public.check_ins (student_id, check_in_date, status)
    VALUES (me, DATE '2000-01-03', 'present');
    RAISE EXCEPTION 'FALHOU: aluno inseriu check-in';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  UPDATE public.check_ins SET status = 'present' WHERE student_id = me;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: aluno alterou o próprio check-in'; END IF;
  DELETE FROM public.check_ins WHERE student_id = me;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: aluno apagou o próprio check-in'; END IF;

  SELECT id INTO v_sched FROM public.class_schedules LIMIT 1;
  IF v_sched IS NOT NULL THEN
    BEGIN
      INSERT INTO public.student_class_link (student_id, class_schedule_id) VALUES (me, v_sched);
      RAISE EXCEPTION 'FALHOU: aluno se matriculou sozinho';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
  END IF;
  DELETE FROM public.student_class_link WHERE student_id = me;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: aluno apagou a própria matrícula'; END IF;

  BEGIN
    INSERT INTO public.classes (name, description, type) VALUES ('HACK', 'HACK', 'group');
    RAISE EXCEPTION 'FALHOU: aluno criou aula';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  UPDATE public.classes SET name = name;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: aluno alterou aula'; END IF;
  DELETE FROM public.classes;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: aluno apagou aula'; END IF;

  SELECT id INTO v_class FROM public.classes LIMIT 1;
  IF v_class IS NOT NULL THEN
    BEGIN
      INSERT INTO public.class_schedules (class_id, day_of_week, start_time, end_time)
      VALUES (v_class, 1, TIME '06:00', TIME '07:00');
      RAISE EXCEPTION 'FALHOU: aluno criou horário';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
  END IF;
  UPDATE public.class_schedules SET class_id = class_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: aluno alterou horário'; END IF;
  DELETE FROM public.class_schedules;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: aluno apagou horário'; END IF;

  -- attendance (tabela antiga): não grava nem altera
  IF to_regclass('public.attendance') IS NOT NULL THEN
    BEGIN
      INSERT INTO public.attendance DEFAULT VALUES;
      RAISE EXCEPTION 'FALHOU: aluno inseriu em attendance';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    EXECUTE 'UPDATE public.attendance SET id = id';
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: aluno alterou attendance'; END IF;
  END IF;

  -- email_notifications: aluno não lê nem grava
  IF to_regclass('public.email_notifications') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.email_notifications' INTO n;
    IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: aluno lê email_notifications'; END IF;
  END IF;

  -- Depoimentos e agenda: só ativos/publicados; não grava
  IF to_regclass('public.testimonials') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.testimonials WHERE is_active IS NOT TRUE' INTO n;
    IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: aluno vê depoimentos inativos'; END IF;
    BEGIN
      EXECUTE $q$INSERT INTO public.testimonials (text, author_name) VALUES ('HACK', 'HACK')$q$;
      RAISE EXCEPTION 'FALHOU: aluno criou depoimento';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
  END IF;
  IF to_regclass('public.schedule_slots') IS NOT NULL THEN
    EXECUTE $q$SELECT count(*) FROM public.schedule_slots WHERE visibility <> 'publicada'$q$ INTO n;
    IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: aluno vê horários em rascunho'; END IF;
    EXECUTE 'UPDATE public.schedule_slots SET note = note';
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: aluno alterou a agenda pública'; END IF;
  END IF;
END $$;

RESET ROLE;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. ANÔNIMO (sem login, chave anon do site)
-- ════════════════════════════════════════════════════════════════════════════
SET LOCAL ROLE anon;
SET LOCAL request.jwt.claims = '{"role":"anon"}';

DO $$
DECLARE
  n int;
  v_tbl text;
BEGIN
  -- Não lê nem grava nada nas tabelas internas
  FOREACH v_tbl IN ARRAY ARRAY['balance_history', 'check_ins', 'student_class_link', 'classes',
                               'class_schedules', 'attendance', 'email_notifications'] LOOP
    CONTINUE WHEN to_regclass('public.' || v_tbl) IS NULL;
    BEGIN
      EXECUTE format('SELECT count(*) FROM public.%I', v_tbl) INTO n;
      RAISE EXCEPTION 'FALHOU: anônimo leu %', v_tbl;
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    BEGIN
      EXECUTE format('INSERT INTO public.%I DEFAULT VALUES', v_tbl);
      RAISE EXCEPTION 'FALHOU: anônimo inseriu em %', v_tbl;
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    BEGIN
      EXECUTE format('UPDATE public.%I SET id = id', v_tbl);
      RAISE EXCEPTION 'FALHOU: anônimo alterou %', v_tbl;
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
  END LOOP;

  -- Landing: depoimentos ativos e horários publicados continuam visíveis
  IF to_regclass('public.testimonials') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.testimonials WHERE is_active IS NOT TRUE' INTO n;
    IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: anônimo vê depoimentos inativos'; END IF;
    BEGIN
      EXECUTE $q$INSERT INTO public.testimonials (text, author_name) VALUES ('HACK', 'HACK')$q$;
      RAISE EXCEPTION 'FALHOU: anônimo criou depoimento';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
  END IF;
  IF to_regclass('public.schedule_slots') IS NOT NULL THEN
    EXECUTE $q$SELECT count(*) FROM public.schedule_slots WHERE visibility <> 'publicada'$q$ INTO n;
    IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: anônimo vê horários em rascunho'; END IF;
    BEGIN
      EXECUTE 'UPDATE public.schedule_slots SET note = note';
      RAISE EXCEPTION 'FALHOU: anônimo alterou a agenda pública';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
  END IF;

  -- RPCs que devolvem dados de todos os alunos
  IF to_regprocedure('public.get_attendance_report(date,date,uuid)') IS NOT NULL THEN
    BEGIN
      PERFORM * FROM public.get_attendance_report(DATE '2000-01-01', DATE '2100-01-01', NULL);
      RAISE EXCEPTION 'FALHOU: anônimo chamou get_attendance_report';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
  END IF;
  IF to_regprocedure('public.get_students_for_notification(text)') IS NOT NULL THEN
    BEGIN
      PERFORM * FROM public.get_students_for_notification('low_credits');
      RAISE EXCEPTION 'FALHOU: anônimo chamou get_students_for_notification';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
  END IF;
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
  a uuid := current_setting('josi.aluno')::uuid;
  v_class uuid;
  v_sched uuid;
  antes int;
  depois int;
  hist_antes int;
  hist_depois int;
BEGIN
  -- ── Lê tudo (relatórios, ficha do aluno) ──
  SELECT count(*) INTO n FROM public.balance_history;
  IF n <> current_setting('josi.total_bh')::int THEN RAISE EXCEPTION 'FALHOU: professora vê % de % linhas de balance_history', n, current_setting('josi.total_bh'); END IF;
  SELECT count(*) INTO n FROM public.check_ins;
  IF n <> current_setting('josi.total_ci')::int THEN RAISE EXCEPTION 'FALHOU: professora vê % de % check-ins', n, current_setting('josi.total_ci'); END IF;
  SELECT count(*) INTO n FROM public.student_class_link;
  IF n <> current_setting('josi.total_scl')::int THEN RAISE EXCEPTION 'FALHOU: professora vê % de % matrículas', n, current_setting('josi.total_scl'); END IF;

  -- ── Aulas (TeacherClasses.jsx) ──
  INSERT INTO public.classes (name, description, type)
  VALUES ('TESTE rls (rollback)', 'TESTE', 'group') RETURNING id INTO v_class;
  UPDATE public.classes SET name = 'TESTE rls 2 (rollback)' WHERE id = v_class;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: professora não editou aula'; END IF;
  INSERT INTO public.class_schedules (class_id, day_of_week, start_time, end_time)
  VALUES (v_class, 1, TIME '06:00', TIME '07:00') RETURNING id INTO v_sched;

  -- ── Matrícula (TeacherStudents.jsx: apaga e reinsere) ──
  INSERT INTO public.student_class_link (student_id, class_schedule_id) VALUES (a, v_sched);
  DELETE FROM public.student_class_link WHERE student_id = a AND class_schedule_id = v_sched;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: professora não apagou matrícula'; END IF;
  INSERT INTO public.student_class_link (student_id, class_schedule_id) VALUES (a, v_sched);

  -- ── Check-in avulso + dispensa (TeacherCheckIn.jsx) ──
  INSERT INTO public.check_ins (student_id, schedule_id, class_id, check_in_date, status, credit_type, attendance)
  VALUES (a, v_sched, v_class, DATE '2000-01-03', 'pending', NULL, 'pending');
  UPDATE public.check_ins SET attendance = 'dismissed'
  WHERE student_id = a AND schedule_id = v_sched AND check_in_date = DATE '2000-01-03';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: professora não atualizou o check-in'; END IF;

  -- ── Créditos e presença pelas RPCs (continuam funcionando) ──
  SELECT group_credits INTO antes FROM public.profiles WHERE id = a;
  SELECT count(*) INTO hist_antes FROM public.balance_history WHERE student_id = a;
  PERFORM public.update_class_balance(a, 2, 'TESTE rls (rollback)', 'group');
  PERFORM public.mark_attendance(a, v_class, v_sched, DATE '2000-01-04', 'present', 'group');
  SELECT group_credits INTO depois FROM public.profiles WHERE id = a;
  SELECT count(*) INTO hist_depois FROM public.balance_history WHERE student_id = a;
  IF depois IS DISTINCT FROM coalesce(antes, 0) + 1 THEN
    RAISE EXCEPTION 'FALHOU: RPCs não ajustaram o saldo (antes=%, depois=%)', antes, depois;
  END IF;
  IF hist_depois <> hist_antes + 2 THEN
    RAISE EXCEPTION 'FALHOU: RPCs não gravaram no balance_history (antes=%, depois=%)', hist_antes, hist_depois;
  END IF;
  SELECT count(*) INTO n FROM public.check_ins
  WHERE student_id = a AND schedule_id = v_sched AND check_in_date = DATE '2000-01-04';
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: mark_attendance não gravou o check-in'; END IF;

  -- ── Histórico só cresce: professora não altera nem apaga pela API ──
  UPDATE public.balance_history SET description = 'HACK' WHERE student_id = a;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: professora alterou balance_history direto'; END IF;
  DELETE FROM public.balance_history WHERE student_id = a;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: professora apagou balance_history direto'; END IF;

  -- ── Check-in não se apaga pela API (sem policy de DELETE) ──
  DELETE FROM public.student_class_link WHERE class_schedule_id = v_sched;
  DELETE FROM public.check_ins WHERE schedule_id = v_sched;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: professora apagou check-in pela API'; END IF;

  -- ── Depoimentos e agenda (TeacherTestimonials.jsx / TeacherSchedule.jsx) ──
  IF to_regclass('public.testimonials') IS NOT NULL THEN
    EXECUTE $q$INSERT INTO public.testimonials (text, author_name, is_active)
               VALUES ('TESTE rls (rollback)', 'TESTE', false)$q$;
    EXECUTE $q$SELECT count(*) FROM public.testimonials WHERE text = 'TESTE rls (rollback)'$q$ INTO n;
    IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: professora não vê depoimento inativo'; END IF;
    EXECUTE $q$UPDATE public.testimonials SET is_active = true WHERE text = 'TESTE rls (rollback)'$q$;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: professora não editou depoimento'; END IF;
    EXECUTE $q$DELETE FROM public.testimonials WHERE text = 'TESTE rls (rollback)'$q$;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: professora não apagou depoimento'; END IF;
  END IF;
  IF to_regclass('public.schedule_slots') IS NOT NULL THEN
    EXECUTE $q$INSERT INTO public.schedule_slots (weekday, start_time, duration_min, modality, visibility, note)
               VALUES (1, TIME '05:00', 60, 'grupo', 'rascunho', 'TESTE rls (rollback)')$q$;
    EXECUTE $q$SELECT count(*) FROM public.schedule_slots WHERE note = 'TESTE rls (rollback)'$q$ INTO n;
    IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: professora não vê horário em rascunho'; END IF;
    EXECUTE $q$UPDATE public.schedule_slots SET visibility = 'publicada' WHERE note = 'TESTE rls (rollback)'$q$;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: professora não editou horário da agenda'; END IF;
    EXECUTE $q$DELETE FROM public.schedule_slots WHERE note = 'TESTE rls (rollback)'$q$;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: professora não apagou horário da agenda'; END IF;
  END IF;

  -- ── Emails (EmailNotifications.jsx) e relatório de frequência ──
  IF to_regclass('public.email_notifications') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.email_notifications' INTO n;  -- não pode dar erro
  END IF;
  IF to_regprocedure('public.get_attendance_report(date,date,uuid)') IS NOT NULL THEN
    SELECT count(*) INTO n FROM public.get_attendance_report(DATE '2000-01-01', DATE '2100-01-01', NULL);
  END IF;

  -- ── Apaga horário e aula de teste (TeacherClasses.jsx) ──
  -- Uma FK (ex.: check_ins → horário) pode impedir; isso não é falha de RLS.
  BEGIN
    DELETE FROM public.class_schedules WHERE id = v_sched;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: professora não apagou horário'; END IF;
    DELETE FROM public.classes WHERE id = v_class;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: professora não apagou aula'; END IF;
  EXCEPTION WHEN foreign_key_violation THEN
    RAISE NOTICE 'Horário/aula de teste não apagados por FK do banco (não é RLS).';
  END;
END $$;

RESET ROLE;

ROLLBACK;
