-- Migration: Dados de seguro do aluno + dados profissionais da professora
-- Story 3.1 — Epic 3 (PRD-002, recibos para seguro saúde)
--
-- Cria:
--   • public.student_insurance        (1:1 com aluno)  — apólice e dados do titular
--   • public.practitioner_credentials (1:1 com professora) — nome profissional,
--                                       licenças e caminho da assinatura no storage
--   • bucket privado storage 'practitioner-signatures' + policies em storage.objects
--
-- Nenhuma tabela ou coluna existente é alterada. Tudo idempotente
-- (IF NOT EXISTS / DROP POLICY IF EXISTS / ON CONFLICT).
--
-- RLS:
--   student_insurance
--     aluno      → SELECT/INSERT/UPDATE só da própria linha (student_id = auth.uid());
--                  WITH CHECK impede trocar student_id para outro aluno no UPDATE
--     professora → SELECT/INSERT/UPDATE de todas as linhas
--     DELETE     → nenhuma policy (bloqueado para authenticated; só ON DELETE CASCADE)
--     anon       → nenhuma policy (bloqueado)
--   practitioner_credentials
--     professora → SELECT/INSERT/UPDATE só da própria linha
--                  (teacher_id = auth.uid() E profiles.role = 'teacher')
--     aluno/anon → nenhuma policy (bloqueado)
--     DELETE     → nenhuma policy (bloqueado para authenticated)
--   storage.objects (bucket practitioner-signatures)
--     professora → SELECT/INSERT/UPDATE/DELETE só em '{auth.uid()}/...'
--                  (DELETE na própria pasta: botão "remover assinatura" da Story 3.2)
--
-- Confiabilidade do check de role: profiles.role não pode ser alterado por
-- requisição REST autenticada (trigger enforce_privilege_escalation_guard /
-- função prevent_privilege_escalation, migrations 20260620000001 e
-- 20260620000003), e handle_new_user sempre cria o perfil com role 'student'.
--
-- ROLLBACK: ver bloco no fim do arquivo.

-- ─── Função de updated_at ────────────────────────────────────────────────────
-- Reusa public.update_updated_at_column() (criada em
-- 20260201040001_create_testimonials_table.sql). Só cria se não existir,
-- para não alterar a função existente usada por testimonials.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'update_updated_at_column'
      AND p.pronargs = 0
  ) THEN
    EXECUTE $fn$
      CREATE FUNCTION public.update_updated_at_column()
      RETURNS TRIGGER
      LANGUAGE plpgsql
      SET search_path = ''
      AS $body$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $body$;
    $fn$;
  END IF;
END $$;

-- ─── student_insurance ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.student_insurance (
  student_id            UUID        PRIMARY KEY
                                    REFERENCES public.profiles(id) ON DELETE CASCADE,
  policy_number         TEXT,
  city_province         TEXT,
  holder_is_self        BOOLEAN     NOT NULL DEFAULT true,
  holder_full_name      TEXT,
  holder_city_province  TEXT,
  holder_employer       TEXT,
  holder_occupation     TEXT,
  holder_phone_work     TEXT,
  holder_phone_home     TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_student_insurance_updated_at ON public.student_insurance;
CREATE TRIGGER trg_student_insurance_updated_at
  BEFORE UPDATE ON public.student_insurance
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.student_insurance ENABLE ROW LEVEL SECURITY;

-- Aluno: só a própria linha
DROP POLICY IF EXISTS "Students can view own insurance" ON public.student_insurance;
CREATE POLICY "Students can view own insurance"
  ON public.student_insurance FOR SELECT
  TO authenticated
  USING (student_id = auth.uid());

DROP POLICY IF EXISTS "Students can insert own insurance" ON public.student_insurance;
CREATE POLICY "Students can insert own insurance"
  ON public.student_insurance FOR INSERT
  TO authenticated
  WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "Students can update own insurance" ON public.student_insurance;
CREATE POLICY "Students can update own insurance"
  ON public.student_insurance FOR UPDATE
  TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

-- Professora: todas as linhas (sem DELETE)
DROP POLICY IF EXISTS "Teachers can view all insurance" ON public.student_insurance;
CREATE POLICY "Teachers can view all insurance"
  ON public.student_insurance FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'teacher'
    )
  );

DROP POLICY IF EXISTS "Teachers can insert insurance" ON public.student_insurance;
CREATE POLICY "Teachers can insert insurance"
  ON public.student_insurance FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'teacher'
    )
  );

DROP POLICY IF EXISTS "Teachers can update insurance" ON public.student_insurance;
CREATE POLICY "Teachers can update insurance"
  ON public.student_insurance FOR UPDATE
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

-- ─── practitioner_credentials ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.practitioner_credentials (
  teacher_id             UUID        PRIMARY KEY REFERENCES public.profiles(id),
  professional_name      TEXT,
  kinesitherapy_license  TEXT,
  naturopathy_license    TEXT,
  signature_path         TEXT,       -- caminho no bucket practitioner-signatures
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_practitioner_credentials_updated_at ON public.practitioner_credentials;
CREATE TRIGGER trg_practitioner_credentials_updated_at
  BEFORE UPDATE ON public.practitioner_credentials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.practitioner_credentials ENABLE ROW LEVEL SECURITY;

-- Só a própria professora (teacher_id = auth.uid() E role teacher)
DROP POLICY IF EXISTS "Teacher can view own credentials" ON public.practitioner_credentials;
CREATE POLICY "Teacher can view own credentials"
  ON public.practitioner_credentials FOR SELECT
  TO authenticated
  USING (
    teacher_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'teacher'
    )
  );

DROP POLICY IF EXISTS "Teacher can insert own credentials" ON public.practitioner_credentials;
CREATE POLICY "Teacher can insert own credentials"
  ON public.practitioner_credentials FOR INSERT
  TO authenticated
  WITH CHECK (
    teacher_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'teacher'
    )
  );

DROP POLICY IF EXISTS "Teacher can update own credentials" ON public.practitioner_credentials;
CREATE POLICY "Teacher can update own credentials"
  ON public.practitioner_credentials FOR UPDATE
  TO authenticated
  USING (
    teacher_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'teacher'
    )
  )
  WITH CHECK (
    teacher_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'teacher'
    )
  );

-- ─── Storage: bucket privado practitioner-signatures ─────────────────────────
-- public = false: sem URL pública; acesso só via signed URL da própria professora.
-- ON CONFLICT reaplica as restrições caso o bucket já exista (só este bucket).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'practitioner-signatures',
  'practitioner-signatures',
  false,
  512000,                                   -- 500 KB
  ARRAY['image/png', 'image/jpeg']
)
ON CONFLICT (id) DO UPDATE
  SET public             = false,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Professora lê/escreve só na própria pasta '{auth.uid()}/'
DROP POLICY IF EXISTS "Teacher can read own signature" ON storage.objects;
CREATE POLICY "Teacher can read own signature"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'practitioner-signatures'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'teacher'
    )
  );

DROP POLICY IF EXISTS "Teacher can upload own signature" ON storage.objects;
CREATE POLICY "Teacher can upload own signature"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'practitioner-signatures'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'teacher'
    )
  );

DROP POLICY IF EXISTS "Teacher can update own signature" ON storage.objects;
CREATE POLICY "Teacher can update own signature"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'practitioner-signatures'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'teacher'
    )
  )
  WITH CHECK (
    bucket_id = 'practitioner-signatures'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'teacher'
    )
  );

DROP POLICY IF EXISTS "Teacher can delete own signature" ON storage.objects;
CREATE POLICY "Teacher can delete own signature"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'practitioner-signatures'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'teacher'
    )
  );

-- ─── ROLLBACK ────────────────────────────────────────────────────────────────
-- ATENÇÃO: apaga os dados de seguro dos alunos e os dados profissionais.
-- Exportar antes se já houver dados. Os arquivos do bucket precisam ser
-- apagados pelo painel (Storage) ou pela API antes de remover o bucket.
--
-- DROP POLICY IF EXISTS "Teacher can read own signature"   ON storage.objects;
-- DROP POLICY IF EXISTS "Teacher can upload own signature" ON storage.objects;
-- DROP POLICY IF EXISTS "Teacher can update own signature" ON storage.objects;
-- DROP POLICY IF EXISTS "Teacher can delete own signature" ON storage.objects;
-- DELETE FROM storage.buckets WHERE id = 'practitioner-signatures';  -- só com o bucket vazio
-- DROP TABLE IF EXISTS public.practitioner_credentials;
-- DROP TABLE IF EXISTS public.student_insurance;
-- (Não remover public.update_updated_at_column(): é usada por testimonials.)

-- ─── Roteiro de teste AC-7 (rodar no SQL Editor, à parte desta migration) ────
-- Ver docs/testes/3.1-rls-seguro-e-credenciais.sql
