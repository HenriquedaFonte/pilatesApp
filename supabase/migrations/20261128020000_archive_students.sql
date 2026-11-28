-- Migration: arquivo de alunos (aluno que saiu, com registros guardados)
-- Plano: docs/planos/2026-11-28-arquivo-de-alunos.md (passo 1)
--
-- DEPENDE de: 20261128010000_consent_withdrawal_and_locks.sql (PR B1).
-- Se ela não rodou, esta migration para logo no início e nada é aplicado.
--
-- ORDEM: publicar ANTES a Edge Function manage-student nova
--   (supabase functions deploy manage-student --project-ref kezfpyhsejhjcvlbmejq).
--   Esta migration bloqueia o login de quem já está arquivado, e só a função
--   nova desbloqueia ao restaurar.
--
-- "Arquivado" = profiles.deleted_at preenchido (o antigo "Lixeira"; sem
-- coluna nova).
--
-- Faz:
--   a) staff_consent_overview(): mesma função da 20261128010000 (mesma
--      assinatura, SECURITY DEFINER, search_path, checagem is_staff()), só
--      que agora devolve TODOS os alunos (role = 'student'), inclusive
--      arquivados. Assim o card "Termo e ficha de saúde" da ficha só leitura
--      do arquivado sabe se há ficha guardada. Quem usa a lista de alunos
--      (badge "Termo pendente") só consulta ids da lista, que não tem
--      arquivados: nada muda lá. Mesmo REVOKE/GRANT.
--   b) Bloqueia o login (auth.users.banned_until) dos alunos que JÁ estão
--      arquivados. Os arquivados daqui para a frente são bloqueados pela
--      Edge Function. 876000 horas = o mesmo valor da Edge Function
--      (ban_duration '876000h'); não usar 'infinity' (o GoTrue pode não ler).
--      Só toca quem não está bloqueado agora: rodar de novo não muda nada.
--      Nenhum aluno ativo (deleted_at IS NULL) é tocado.
--
-- Não apaga dados nem colunas. Créditos, histórico, recibos, termo e ficha
-- de saúde não são tocados.
--
-- TESTE:    docs/testes/arquivo-alunos-teste.sql
-- REVERSÃO: docs/testes/arquivo-alunos-reversao.sql

BEGIN;

-- ─── 0. Pré-condições ───────────────────────────────────────────────────────
DO $$
DECLARE
  v_is_staff regprocedure := to_regprocedure('public.is_staff()');
BEGIN
  IF v_is_staff IS NULL
     OR coalesce(obj_description(v_is_staff, 'pg_proc'), '') NOT LIKE 'josi-pilates:%' THEN
    RAISE EXCEPTION 'public.is_staff() não encontrada. Rode antes a migration 20261112010000_fix_profiles_privilege_escalation_and_rls.sql. Nada foi aplicado.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'consent_acceptances'
                   AND column_name = 'withdrawn_at') THEN
    RAISE EXCEPTION 'consent_acceptances.withdrawn_at não encontrada. Rode antes a migration 20261128010000_consent_withdrawal_and_locks.sql. Nada foi aplicado.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'profiles'
                   AND column_name = 'deleted_at') THEN
    RAISE EXCEPTION 'profiles.deleted_at não encontrada. Nada foi aplicado.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'auth' AND table_name = 'users'
                   AND column_name = 'banned_until') THEN
    RAISE EXCEPTION 'auth.users.banned_until não encontrada. Nada foi aplicado.';
  END IF;
END $$;

-- ─── a) Visão da professora: inclui arquivados ──────────────────────────────
-- Corpo idêntico ao da 20261128010000; só o WHERE muda (sem deleted_at).
CREATE OR REPLACE FUNCTION public.staff_consent_overview()
RETURNS TABLE (student_id uuid, policies_status text, health_consent boolean, health_profile boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_current uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_staff() THEN
    RAISE EXCEPTION 'consent_not_allowed' USING ERRCODE = '42501';
  END IF;

  SELECT cv.id INTO v_current
  FROM public.consent_versions cv
  WHERE cv.kind = 'class_policies'
  ORDER BY cv.version DESC
  LIMIT 1;

  RETURN QUERY
  SELECT
    p.id,
    CASE
      WHEN v_current IS NULL THEN 'current'
      WHEN EXISTS (SELECT 1 FROM public.consent_acceptances a
                   WHERE a.student_id = p.id AND a.consent_version_id = v_current) THEN 'current'
      WHEN EXISTS (SELECT 1 FROM public.consent_acceptances a
                   JOIN public.consent_versions cv ON cv.id = a.consent_version_id
                   WHERE a.student_id = p.id AND cv.kind = 'class_policies') THEN 'outdated'
      ELSE 'none'
    END,
    EXISTS (SELECT 1 FROM public.consent_acceptances a
            JOIN public.consent_versions cv ON cv.id = a.consent_version_id
            WHERE a.student_id = p.id AND cv.kind = 'health_data' AND a.withdrawn_at IS NULL),
    EXISTS (SELECT 1 FROM public.student_health_profiles h WHERE h.student_id = p.id)
  FROM public.profiles p
  WHERE p.role = 'student'
  ORDER BY p.id;
END;
$$;
COMMENT ON FUNCTION public.staff_consent_overview() IS
  'josi-pilates: professora vê, por aluno, inclusive arquivado, o status do termo (current/outdated/none), o consentimento de saúde ativo e se há ficha (ativa ou congelada).';

REVOKE ALL ON FUNCTION public.staff_consent_overview()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.staff_consent_overview() TO authenticated;

-- ─── b) Bloqueia o login de quem já está arquivado ──────────────────────────
UPDATE auth.users u SET banned_until = now() + interval '876000 hours'
FROM public.profiles p
WHERE p.id = u.id AND p.role = 'student' AND p.deleted_at IS NOT NULL
  AND (u.banned_until IS NULL OR u.banned_until < now());

COMMIT;
