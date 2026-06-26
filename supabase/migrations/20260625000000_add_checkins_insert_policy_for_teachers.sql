-- Migration: permite que professores insiram check-ins diretamente
-- Necessário para registrar alunos avulsos na tela de check-in sem passar
-- pela RPC mark_attendance (que pressupõe status definitivo com dedução de crédito).
-- ROLLBACK: DROP POLICY IF EXISTS "Teachers can insert check-ins" ON public.check_ins;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'check_ins'
      AND policyname = 'Teachers can insert check-ins'
  ) THEN
    CREATE POLICY "Teachers can insert check-ins"
      ON public.check_ins FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid() AND role = 'teacher'
        )
      );
  END IF;
END $$;
