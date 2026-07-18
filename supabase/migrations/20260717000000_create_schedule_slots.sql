-- Migration: Cria tabela schedule_slots para agenda pública da professora
--
-- Propósito: horários informativos controlados manualmente pela professora.
-- NÃO ligado ao sistema de check-in/crédito (tabelas separadas).
--
-- RLS:
--   anon       → SELECT apenas linhas visibility='publicada'
--   teacher    → INSERT/UPDATE/DELETE/SELECT todas as linhas
--
-- ROLLBACK: DROP TABLE IF EXISTS public.schedule_slots;

CREATE TABLE IF NOT EXISTS public.schedule_slots (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  weekday        SMALLINT    NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time     TIME        NOT NULL,
  duration_min   SMALLINT    NOT NULL CHECK (duration_min > 0),
  modality       TEXT        NOT NULL CHECK (modality IN ('privado', 'duo', 'grupo')),
  capacity       SMALLINT,
  enrolled_count SMALLINT    DEFAULT 0,
  status         TEXT        NOT NULL DEFAULT 'aberta'
                             CHECK (status IN ('aberta', 'ultima_vaga', 'lotada')),
  visibility     TEXT        NOT NULL DEFAULT 'rascunho'
                             CHECK (visibility IN ('publicada', 'rascunho')),
  note           TEXT,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_schedule_slots_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_schedule_slots_updated_at ON public.schedule_slots;
CREATE TRIGGER trg_schedule_slots_updated_at
  BEFORE UPDATE ON public.schedule_slots
  FOR EACH ROW EXECUTE FUNCTION public.set_schedule_slots_updated_at();

-- Performance index para a query pública (weekday + visibility)
CREATE INDEX IF NOT EXISTS schedule_slots_public_idx
  ON public.schedule_slots (weekday, visibility)
  WHERE visibility = 'publicada';

ALTER TABLE public.schedule_slots ENABLE ROW LEVEL SECURITY;

-- Visitantes (anon) lêem apenas horários publicados
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'schedule_slots'
      AND policyname = 'Public can read published slots'
  ) THEN
    CREATE POLICY "Public can read published slots"
      ON public.schedule_slots FOR SELECT
      TO anon
      USING (visibility = 'publicada');
  END IF;
END $$;

-- Professora autenticada gerencia todos os slots
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'schedule_slots'
      AND policyname = 'Teacher can manage schedule slots'
  ) THEN
    CREATE POLICY "Teacher can manage schedule slots"
      ON public.schedule_slots FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid() AND role = 'teacher'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid() AND role = 'teacher'
        )
      );
  END IF;
END $$;
