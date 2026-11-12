-- REVERSÃO da migration 20261112020000_fix_rls_operational_tables.sql
--
-- ATENÇÃO: REABRE as falhas (anônimo grava em attendance e cria aulas, aluno
-- forja linhas no próprio histórico de créditos, anônimo chama as RPCs de
-- relatório). Só usar em emergência, se a correção quebrar algo crítico, e
-- corrigir em seguida.
--
-- Rodar no Supabase SQL Editor de uma vez. Idempotente. Não altera dados.
--
-- Duas formas de recriar as policies (parte 3):
--   A) EXATA (preferível): se você guardou o resultado do diagnóstico
--      (docs/testes/seguranca-rls-tabelas-diagnostico.sql) rodado ANTES da
--      migration, apague a parte 3B abaixo e cole no lugar a coluna "detalhe"
--      das linhas tipo "recriar" das tabelas listadas na parte 1 (não as de
--      profiles). Isso volta exatamente ao que havia.
--   B) APROXIMADA (padrão deste arquivo): recria as policies das migrations do
--      repositório e as 3 policies abertas conhecidas de produção. Policies
--      duplicadas/de 'admin' que só existiam em produção não voltam.

BEGIN;

-- ─── 1. Apaga as policies da migration e volta os privilégios padrão ───────
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
    -- Privilégios padrão do Supabase para tabelas de public
    EXECUTE format('GRANT ALL ON TABLE public.%I TO anon, authenticated, service_role', v_tbl);
  END LOOP;
END $$;

-- ─── 2. RPCs de relatório/log: anônimo volta a ter EXECUTE ──────────────────
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
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO PUBLIC, anon, authenticated, service_role', v_fn);
  END LOOP;
END $$;

-- ─── 3B. Policies (forma APROXIMADA; para a EXATA, ver o topo) ──────────────

-- Migration 20260620000002 (RLS das tabelas financeiras)
CREATE POLICY "Students can view own balance history" ON public.balance_history
  FOR SELECT USING (auth.uid() = student_id);
CREATE POLICY "Teachers can view all balance history" ON public.balance_history
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'teacher'));
CREATE POLICY "Students can view own check-ins" ON public.check_ins
  FOR SELECT USING (auth.uid() = student_id);
CREATE POLICY "Teachers can view all check-ins" ON public.check_ins
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'teacher'));
CREATE POLICY "Teachers can update check-ins" ON public.check_ins
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'teacher'));
CREATE POLICY "Students can view own class links" ON public.student_class_link
  FOR SELECT USING (auth.uid() = student_id);
CREATE POLICY "Teachers can manage all class links" ON public.student_class_link
  FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'teacher'));
CREATE POLICY "Authenticated users can view class schedules" ON public.class_schedules
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Teachers can manage class schedules" ON public.class_schedules
  FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'teacher'));
CREATE POLICY "Authenticated users can view classes" ON public.classes
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Teachers can manage classes" ON public.classes
  FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'teacher'));

-- Migration 20260625000000 (check-in avulso)
CREATE POLICY "Teachers can insert check-ins" ON public.check_ins
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'teacher'));

-- Policies abertas que existiam em produção (REABREM as falhas)
CREATE POLICY "Allow anon insert for classes" ON public.classes
  FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Students can insert their own balance history" ON public.balance_history
  FOR INSERT WITH CHECK (auth.uid() = student_id);

DO $$
BEGIN
  IF to_regclass('public.attendance') IS NOT NULL THEN
    EXECUTE 'CREATE POLICY "Enable insert for all users" ON public.attendance FOR INSERT TO public WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "Enable update for all users" ON public.attendance FOR UPDATE TO public USING (true)';
  END IF;

  -- notification_functions.sql
  IF to_regclass('public.email_notifications') IS NOT NULL THEN
    EXECUTE $p$CREATE POLICY "Teachers can view all email notifications" ON public.email_notifications
      FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'teacher'))$p$;
    EXECUTE $p$CREATE POLICY "Teachers can insert email notifications" ON public.email_notifications
      FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'teacher'))$p$;
  END IF;

  -- Migration 20260201040001 (depoimentos)
  IF to_regclass('public.testimonials') IS NOT NULL THEN
    EXECUTE $p$CREATE POLICY "Testimonials are viewable by everyone" ON public.testimonials
      FOR SELECT USING (true)$p$;
    EXECUTE $p$CREATE POLICY "Only teachers can insert testimonials" ON public.testimonials
      FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'teacher'))$p$;
    EXECUTE $p$CREATE POLICY "Only teachers can update testimonials" ON public.testimonials
      FOR UPDATE USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'teacher'))$p$;
    EXECUTE $p$CREATE POLICY "Only teachers can delete testimonials" ON public.testimonials
      FOR DELETE USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'teacher'))$p$;
  END IF;

  -- Migration 20260717000000 (agenda pública)
  IF to_regclass('public.schedule_slots') IS NOT NULL THEN
    EXECUTE $p$CREATE POLICY "Public can read published slots" ON public.schedule_slots
      FOR SELECT TO anon USING (visibility = 'publicada')$p$;
    EXECUTE $p$CREATE POLICY "Teacher can manage schedule slots" ON public.schedule_slots
      FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'teacher'))
      WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'teacher'))$p$;
  END IF;
END $$;

COMMIT;
