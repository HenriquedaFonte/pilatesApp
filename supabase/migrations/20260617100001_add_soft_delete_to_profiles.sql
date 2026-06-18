-- Migration: Add soft delete columns to profiles
-- PRD-001 FR-02 — Soft Delete com Janela de Recuperação
-- ADD COLUMN IF NOT EXISTS = safe to re-run, no table rewrite (NULL default)
-- ROLLBACK: ALTER TABLE public.profiles DROP COLUMN IF EXISTS deleted_at, DROP COLUMN IF EXISTS deleted_by;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Partial index: only rows that are soft-deleted (keeps index small)
CREATE INDEX IF NOT EXISTS profiles_deleted_at_idx
  ON public.profiles (deleted_at)
  WHERE deleted_at IS NOT NULL;
