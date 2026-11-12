-- Migration: RLS das tabelas operacionais (aulas, check-in, presença, histórico
-- de créditos, emails, depoimentos, agenda pública)
--
-- DEPENDE de 20261112010000_fix_profiles_privilege_escalation_and_rls.sql
-- (usa public.is_staff()). Se ela não tiver rodado, esta para logo no início
-- e nada é aplicado.
--
-- Estado de PRODUÇÃO antes desta migration (levantado em 2026-11-12):
--   • attendance: policies de INSERT e UPDATE para {public} com `true`
--     → anônimo grava e altera presença.
--   • classes: "Allow anon insert for classes" → anônimo cria aulas.
--   • balance_history: "Students can insert their own balance history"
--     → aluno forja linhas no próprio histórico de créditos/pagamentos.
--   • Policies duplicadas em várias tabelas (não dá para saber qual vale; como
--     policies PERMISSIVE se somam com OR, vale sempre a mais aberta) e
--     policies que usam o papel 'admin'.
--   • Os privilégios padrão do Supabase dão ALL ao papel anon em toda tabela
--     de public; só a RLS segura o anônimo.
--
-- O que o site faz nessas tabelas (levantado em src/ e supabase/functions/):
--   • Aluno (portal): só LÊ o que é dele em balance_history, check_ins e
--     student_class_link; lê class_schedules e classes (nome da aula).
--     Nenhuma escrita direta.
--   • Professora: lê tudo; escreve direto em classes, class_schedules,
--     student_class_link (insert/delete), check_ins (insert do aluno avulso e
--     update de `attendance`), testimonials, schedule_slots. Créditos e
--     presença com débito só pelas RPCs update_class_balance / mark_attendance
--     (SECURITY DEFINER, não passam pela RLS).
--   • Anônimo (landing): só LÊ testimonials ativos e schedule_slots publicados.
--   • Edge Functions usam service_role (ignora RLS).
--   • attendance, email_logs, enrollments e *_backup: o código não usa.
--
-- O que esta migration faz:
--   1. Para cada tabela abaixo: liga a RLS, APAGA TODAS as policies que
--      existirem (seja qual for o nome — resolve duplicadas e as de 'admin') e
--      cria só as necessárias. Tudo para o papel authenticated, com
--      professora/admin via public.is_staff(); anon só lê depoimentos ativos e
--      horários publicados.
--        balance_history    SELECT própria ou staff | INSERT staff
--                           (sem UPDATE/DELETE: histórico só cresce pela API)
--        check_ins          SELECT própria ou staff | INSERT/UPDATE staff
--        student_class_link SELECT própria ou staff | INSERT/UPDATE/DELETE staff
--        classes            SELECT authenticated    | INSERT/UPDATE/DELETE staff
--        class_schedules    SELECT authenticated    | INSERT/UPDATE/DELETE staff
--        attendance         SELECT própria ou staff | INSERT/UPDATE/DELETE staff
--        email_notifications SELECT staff | INSERT staff
--        testimonials       SELECT anon: ativos; authenticated: ativos ou staff
--                           | INSERT/UPDATE/DELETE staff
--        schedule_slots     SELECT anon: publicados; authenticated: publicados
--                           ou staff | INSERT/UPDATE/DELETE staff
--        email_logs, enrollments, attendance_backup, email_logs_backup
--                           (sem uso no código) SELECT staff, nada mais
--   2. Privilégios de tabela: anon perde tudo (fica só SELECT em testimonials
--      e schedule_slots); authenticated fica com SELECT/INSERT/UPDATE/DELETE
--      (a RLS decide) e perde TRUNCATE/TRIGGER/REFERENCES (TRUNCATE ignora RLS).
--   3. RPCs de leitura SECURITY DEFINER que devolvem dados de todos os alunos
--      (get_attendance_report, get_students_for_notification) e
--      log_email_notification: anon e PUBLIC perdem EXECUTE (a professora
--      continua chamando, ela é authenticated). Ver "Riscos" no PENDENCIAS: um
--      aluno logado ainda consegue chamá-las.
--
-- Não altera nem apaga dados nem colunas. Não mexe em profiles, audit_log,
-- student_insurance nem practitioner_credentials.
--
-- Rodar no Supabase SQL Editor de uma vez. Está dentro de BEGIN/COMMIT: se
-- algo falhar, nada é aplicado. Idempotente: pode rodar de novo.
--
-- REVERSÃO: docs/testes/seguranca-rls-tabelas-reversao.sql.

BEGIN;

-- ─── 0. Pré-condições ───────────────────────────────────────────────────────
DO $$
DECLARE
  v_is_staff regprocedure := to_regprocedure('public.is_staff()');
  v_tbl text;
BEGIN
  IF v_is_staff IS NULL
     OR coalesce(obj_description(v_is_staff, 'pg_proc'), '') NOT LIKE 'josi-pilates:%' THEN
    RAISE EXCEPTION 'public.is_staff() não encontrada. Rode antes a migration 20261112010000_fix_profiles_privilege_escalation_and_rls.sql. Nada foi aplicado.';
  END IF;

  FOREACH v_tbl IN ARRAY ARRAY['balance_history', 'check_ins', 'student_class_link',
                               'classes', 'class_schedules'] LOOP
    IF to_regclass('public.' || v_tbl) IS NULL THEN
      RAISE EXCEPTION 'Tabela public.% não encontrada. Nada foi aplicado.', v_tbl;
    END IF;
  END LOOP;

  FOREACH v_tbl IN ARRAY ARRAY['balance_history', 'check_ins', 'student_class_link'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = v_tbl AND column_name = 'student_id'
    ) THEN
      RAISE EXCEPTION 'public.% não tem a coluna student_id. Nada foi aplicado.', v_tbl;
    END IF;
  END LOOP;
END $$;

-- ─── 1. Apaga TODAS as policies dessas tabelas, liga a RLS, ajusta GRANTs ───
-- (tabelas opcionais são puladas se não existirem)
DO $$
DECLARE
  v_tbl text;
  v_pol record;
BEGIN
  FOREACH v_tbl IN ARRAY ARRAY[
    'balance_history', 'check_ins', 'student_class_link', 'classes', 'class_schedules',
    'attendance', 'email_notifications', 'testimonials', 'schedule_slots',
    'email_logs', 'enrollments', 'attendance_backup', 'email_logs_backup'
  ] LOOP
    CONTINUE WHEN to_regclass('public.' || v_tbl) IS NULL;

    FOR v_pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = v_tbl
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', v_pol.policyname, v_tbl);
    END LOOP;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_tbl);

    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', v_tbl);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', v_tbl);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', v_tbl);
  END LOOP;

  -- A landing (sem login) lê depoimentos e horários publicados.
  IF to_regclass('public.testimonials') IS NOT NULL THEN
    GRANT SELECT ON TABLE public.testimonials TO anon;
  END IF;
  IF to_regclass('public.schedule_slots') IS NOT NULL THEN
    GRANT SELECT ON TABLE public.schedule_slots TO anon;
  END IF;
END $$;

-- ─── 2. Policies das tabelas obrigatórias ───────────────────────────────────

-- balance_history: histórico de créditos e pagamentos.
-- Aluno só lê o dele. Escrita normal é pelas RPCs (SECURITY DEFINER); INSERT
-- de staff fica para triggers/telas da professora. Ninguém altera nem apaga
-- pela API (manage-student apaga com service_role ao excluir aluno).
CREATE POLICY "balance_history_select_own_or_staff" ON public.balance_history
  FOR SELECT TO authenticated
  USING (student_id = (SELECT auth.uid()) OR (SELECT public.is_staff()));

CREATE POLICY "balance_history_insert_staff" ON public.balance_history
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_staff()));

-- check_ins: professora insere o aluno avulso (status 'pending') e marca
-- `attendance = 'dismissed'` direto (TeacherCheckIn.jsx). Débito de crédito
-- só pela RPC mark_attendance. Sem DELETE pela API.
CREATE POLICY "check_ins_select_own_or_staff" ON public.check_ins
  FOR SELECT TO authenticated
  USING (student_id = (SELECT auth.uid()) OR (SELECT public.is_staff()));

CREATE POLICY "check_ins_insert_staff" ON public.check_ins
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_staff()));

CREATE POLICY "check_ins_update_staff" ON public.check_ins
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_staff()))
  WITH CHECK ((SELECT public.is_staff()));

-- student_class_link: matrícula do aluno nos horários (TeacherStudents.jsx
-- apaga e reinsere).
CREATE POLICY "student_class_link_select_own_or_staff" ON public.student_class_link
  FOR SELECT TO authenticated
  USING (student_id = (SELECT auth.uid()) OR (SELECT public.is_staff()));

CREATE POLICY "student_class_link_insert_staff" ON public.student_class_link
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_staff()));

CREATE POLICY "student_class_link_update_staff" ON public.student_class_link
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_staff()))
  WITH CHECK ((SELECT public.is_staff()));

CREATE POLICY "student_class_link_delete_staff" ON public.student_class_link
  FOR DELETE TO authenticated
  USING ((SELECT public.is_staff()));

-- classes e class_schedules: catálogo de aulas e horários. Qualquer usuário
-- logado lê (o aluno vê o nome da aula no painel e no histórico); só a
-- professora cria, edita e apaga. Anônimo não lê (nenhuma página pública usa).
CREATE POLICY "classes_select_authenticated" ON public.classes
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "classes_insert_staff" ON public.classes
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_staff()));

CREATE POLICY "classes_update_staff" ON public.classes
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_staff()))
  WITH CHECK ((SELECT public.is_staff()));

CREATE POLICY "classes_delete_staff" ON public.classes
  FOR DELETE TO authenticated
  USING ((SELECT public.is_staff()));

CREATE POLICY "class_schedules_select_authenticated" ON public.class_schedules
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "class_schedules_insert_staff" ON public.class_schedules
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_staff()));

CREATE POLICY "class_schedules_update_staff" ON public.class_schedules
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_staff()))
  WITH CHECK ((SELECT public.is_staff()));

CREATE POLICY "class_schedules_delete_staff" ON public.class_schedules
  FOR DELETE TO authenticated
  USING ((SELECT public.is_staff()));

-- ─── 3. Policies das tabelas opcionais (só se existirem) ────────────────────
DO $$
BEGIN
  -- attendance: tabela antiga (duplicata de check_ins), o código não usa.
  -- Staff tem tudo (caso alguma função/trigger de produção ainda grave nela
  -- como professora); aluno só lê as dele, se a coluna student_id existir.
  IF to_regclass('public.attendance') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'attendance' AND column_name = 'student_id'
    ) THEN
      EXECUTE $p$CREATE POLICY "attendance_select_own_or_staff" ON public.attendance
        FOR SELECT TO authenticated
        USING (student_id = (SELECT auth.uid()) OR (SELECT public.is_staff()))$p$;
    ELSE
      EXECUTE $p$CREATE POLICY "attendance_select_staff" ON public.attendance
        FOR SELECT TO authenticated
        USING ((SELECT public.is_staff()))$p$;
    END IF;
    EXECUTE $p$CREATE POLICY "attendance_insert_staff" ON public.attendance
      FOR INSERT TO authenticated
      WITH CHECK ((SELECT public.is_staff()))$p$;
    EXECUTE $p$CREATE POLICY "attendance_update_staff" ON public.attendance
      FOR UPDATE TO authenticated
      USING ((SELECT public.is_staff()))
      WITH CHECK ((SELECT public.is_staff()))$p$;
    EXECUTE $p$CREATE POLICY "attendance_delete_staff" ON public.attendance
      FOR DELETE TO authenticated
      USING ((SELECT public.is_staff()))$p$;
  END IF;

  -- email_notifications: log de emails (EmailNotifications.jsx lê; a RPC
  -- log_email_notification grava como SECURITY DEFINER).
  IF to_regclass('public.email_notifications') IS NOT NULL THEN
    EXECUTE $p$CREATE POLICY "email_notifications_select_staff" ON public.email_notifications
      FOR SELECT TO authenticated
      USING ((SELECT public.is_staff()))$p$;
    EXECUTE $p$CREATE POLICY "email_notifications_insert_staff" ON public.email_notifications
      FOR INSERT TO authenticated
      WITH CHECK ((SELECT public.is_staff()))$p$;
  END IF;

  -- testimonials: a landing (anon ou logado) mostra só os ativos; a professora
  -- vê e gerencia todos (TeacherTestimonials.jsx).
  IF to_regclass('public.testimonials') IS NOT NULL THEN
    EXECUTE $p$CREATE POLICY "testimonials_select_active_anon" ON public.testimonials
      FOR SELECT TO anon
      USING (is_active IS TRUE)$p$;
    EXECUTE $p$CREATE POLICY "testimonials_select_active_or_staff" ON public.testimonials
      FOR SELECT TO authenticated
      USING (is_active IS TRUE OR (SELECT public.is_staff()))$p$;
    EXECUTE $p$CREATE POLICY "testimonials_insert_staff" ON public.testimonials
      FOR INSERT TO authenticated
      WITH CHECK ((SELECT public.is_staff()))$p$;
    EXECUTE $p$CREATE POLICY "testimonials_update_staff" ON public.testimonials
      FOR UPDATE TO authenticated
      USING ((SELECT public.is_staff()))
      WITH CHECK ((SELECT public.is_staff()))$p$;
    EXECUTE $p$CREATE POLICY "testimonials_delete_staff" ON public.testimonials
      FOR DELETE TO authenticated
      USING ((SELECT public.is_staff()))$p$;
  END IF;

  -- schedule_slots: agenda pública da landing (ScheduleSection.jsx) e tela
  -- Agenda da professora (TeacherSchedule.jsx). Usuário logado também vê os
  -- publicados (antes a policy era só TO anon: aluno logado via a agenda
  -- vazia na landing).
  IF to_regclass('public.schedule_slots') IS NOT NULL THEN
    EXECUTE $p$CREATE POLICY "schedule_slots_select_published_anon" ON public.schedule_slots
      FOR SELECT TO anon
      USING (visibility = 'publicada')$p$;
    EXECUTE $p$CREATE POLICY "schedule_slots_select_published_or_staff" ON public.schedule_slots
      FOR SELECT TO authenticated
      USING (visibility = 'publicada' OR (SELECT public.is_staff()))$p$;
    EXECUTE $p$CREATE POLICY "schedule_slots_insert_staff" ON public.schedule_slots
      FOR INSERT TO authenticated
      WITH CHECK ((SELECT public.is_staff()))$p$;
    EXECUTE $p$CREATE POLICY "schedule_slots_update_staff" ON public.schedule_slots
      FOR UPDATE TO authenticated
      USING ((SELECT public.is_staff()))
      WITH CHECK ((SELECT public.is_staff()))$p$;
    EXECUTE $p$CREATE POLICY "schedule_slots_delete_staff" ON public.schedule_slots
      FOR DELETE TO authenticated
      USING ((SELECT public.is_staff()))$p$;
  END IF;

  -- Tabelas antigas, sem uso no código: só a professora lê pela API.
  IF to_regclass('public.email_logs') IS NOT NULL THEN
    EXECUTE $p$CREATE POLICY "email_logs_select_staff" ON public.email_logs
      FOR SELECT TO authenticated USING ((SELECT public.is_staff()))$p$;
  END IF;
  IF to_regclass('public.enrollments') IS NOT NULL THEN
    EXECUTE $p$CREATE POLICY "enrollments_select_staff" ON public.enrollments
      FOR SELECT TO authenticated USING ((SELECT public.is_staff()))$p$;
  END IF;
  IF to_regclass('public.attendance_backup') IS NOT NULL THEN
    EXECUTE $p$CREATE POLICY "attendance_backup_select_staff" ON public.attendance_backup
      FOR SELECT TO authenticated USING ((SELECT public.is_staff()))$p$;
  END IF;
  IF to_regclass('public.email_logs_backup') IS NOT NULL THEN
    EXECUTE $p$CREATE POLICY "email_logs_backup_select_staff" ON public.email_logs_backup
      FOR SELECT TO authenticated USING ((SELECT public.is_staff()))$p$;
  END IF;
END $$;

-- ─── 4. RPCs que expõem dados de todos os alunos: anônimo perde EXECUTE ─────
-- (todas as versões/assinaturas que existirem; a professora continua chamando)
DO $$
DECLARE
  v_fn regprocedure;
BEGIN
  FOR v_fn IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('get_attendance_report', 'get_students_for_notification',
                        'log_email_notification')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', v_fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', v_fn);
  END LOOP;
END $$;

COMMIT;
