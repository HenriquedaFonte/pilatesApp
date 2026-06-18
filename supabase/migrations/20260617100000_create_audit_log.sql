-- Migration: Create audit_log table (append-only)
-- PRD-001 FR-01 — Log de Auditoria
-- ROLLBACK: DROP TABLE IF EXISTS public.audit_log;

CREATE TABLE IF NOT EXISTS public.audit_log (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id      UUID        NOT NULL,
  actor_email   TEXT        NOT NULL,
  action        TEXT        NOT NULL,
  target_id     UUID,
  target_name   TEXT,
  target_email  TEXT,
  snapshot_data JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS audit_log_target_id_idx   ON public.audit_log (target_id);
CREATE INDEX IF NOT EXISTS audit_log_created_at_idx  ON public.audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_actor_id_idx    ON public.audit_log (actor_id);

-- Append-only via RLS: INSERT service_role only, SELECT teacher only, DELETE/UPDATE blocked for all
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_insert_service_role"
  ON public.audit_log
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "audit_log_select_teacher"
  ON public.audit_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'teacher'
    )
  );
