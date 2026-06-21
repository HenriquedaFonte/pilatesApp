-- Migration: Add RLS to financial and operational tables
-- Protects balance_history, check_ins, student_class_link, classes, class_schedules
-- from unauthorized cross-user data access via REST API.
--
-- Design:
--   • Students: SELECT only their own rows
--   • Teachers: SELECT all rows; INSERT/UPDATE/DELETE where needed
--   • RPC functions (SECURITY DEFINER): bypass RLS — no policy needed for writes
--   • service_role: bypasses RLS entirely
--
-- Production-safe: ALTER TABLE ... ENABLE ROW LEVEL SECURITY is idempotent.
--   Policy creation is guarded by IF NOT EXISTS checks to avoid conflicts
--   with any policies already deployed outside of migrations.
--
-- ROLLBACK per table:
--   ALTER TABLE public.<table> DISABLE ROW LEVEL SECURITY;
--   DROP POLICY IF EXISTS "<policy name>" ON public.<table>;

-- ─── Enable RLS (idempotent in PostgreSQL 14+) ────────────────────────────────
ALTER TABLE IF EXISTS public.balance_history      ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.check_ins            ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.student_class_link   ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.class_schedules      ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.classes              ENABLE ROW LEVEL SECURITY;

-- ─── balance_history ─────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'balance_history'
      AND policyname = 'Students can view own balance history'
  ) THEN
    CREATE POLICY "Students can view own balance history"
      ON public.balance_history FOR SELECT
      USING (auth.uid() = student_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'balance_history'
      AND policyname = 'Teachers can view all balance history'
  ) THEN
    CREATE POLICY "Teachers can view all balance history"
      ON public.balance_history FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid() AND role = 'teacher'
        )
      );
  END IF;
END $$;

-- ─── check_ins ───────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'check_ins'
      AND policyname = 'Students can view own check-ins'
  ) THEN
    CREATE POLICY "Students can view own check-ins"
      ON public.check_ins FOR SELECT
      USING (auth.uid() = student_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'check_ins'
      AND policyname = 'Teachers can view all check-ins'
  ) THEN
    CREATE POLICY "Teachers can view all check-ins"
      ON public.check_ins FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid() AND role = 'teacher'
        )
      );
  END IF;
END $$;

-- Teachers update attendance status (e.g. dismissed) directly via REST API
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'check_ins'
      AND policyname = 'Teachers can update check-ins'
  ) THEN
    CREATE POLICY "Teachers can update check-ins"
      ON public.check_ins FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid() AND role = 'teacher'
        )
      );
  END IF;
END $$;

-- ─── student_class_link ──────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'student_class_link'
      AND policyname = 'Students can view own class links'
  ) THEN
    CREATE POLICY "Students can view own class links"
      ON public.student_class_link FOR SELECT
      USING (auth.uid() = student_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'student_class_link'
      AND policyname = 'Teachers can manage all class links'
  ) THEN
    CREATE POLICY "Teachers can manage all class links"
      ON public.student_class_link FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid() AND role = 'teacher'
        )
      );
  END IF;
END $$;

-- ─── class_schedules ─────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'class_schedules'
      AND policyname = 'Authenticated users can view class schedules'
  ) THEN
    CREATE POLICY "Authenticated users can view class schedules"
      ON public.class_schedules FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'class_schedules'
      AND policyname = 'Teachers can manage class schedules'
  ) THEN
    CREATE POLICY "Teachers can manage class schedules"
      ON public.class_schedules FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid() AND role = 'teacher'
        )
      );
  END IF;
END $$;

-- ─── classes ─────────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'classes'
      AND policyname = 'Authenticated users can view classes'
  ) THEN
    CREATE POLICY "Authenticated users can view classes"
      ON public.classes FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'classes'
      AND policyname = 'Teachers can manage classes'
  ) THEN
    CREATE POLICY "Teachers can manage classes"
      ON public.classes FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid() AND role = 'teacher'
        )
      );
  END IF;
END $$;
