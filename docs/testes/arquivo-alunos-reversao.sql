-- Reversão — arquivo de alunos
-- (migration 20261128020000_archive_students.sql)
--
-- Só para emergência. Faz:
--   a) staff_consent_overview() volta a ser a da 20261128010000 (só alunos
--      NÃO arquivados). O card "Termo e ficha de saúde" da ficha de um
--      arquivado volta a não saber se há ficha guardada (como antes).
--   b) DESBLOQUEIA o login de todos os alunos arquivados (banned_until = NULL).
--      Eles voltam a conseguir entrar no site, mesmo continuando no Arquivo.
--
-- ANTES: se a ideia é voltar tudo, fazer também o Revert do PR e publicar a
-- versão anterior da Edge Function manage-student
--   (git checkout <commit anterior> -- supabase/functions/manage-student
--    e supabase functions deploy manage-student --project-ref kezfpyhsejhjcvlbmejq).
-- Se a função nova continuar no ar, quem for arquivado depois deste script
-- continua sendo bloqueado (e desbloqueado ao restaurar).
--
-- Nenhum dado é apagado. Créditos, histórico, recibos, termo e ficha de saúde
-- não são tocados.
--
-- Rodar no Supabase SQL Editor de uma vez. Está dentro de BEGIN/COMMIT: se
-- algo falhar, nada é aplicado. Pode rodar de novo.

BEGIN;

-- ─── a) Visão da professora: só alunos não arquivados (como na 20261128010000)
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
  WHERE p.role = 'student' AND p.deleted_at IS NULL
  ORDER BY p.id;
END;
$$;
COMMENT ON FUNCTION public.staff_consent_overview() IS
  'josi-pilates: professora vê, por aluno ativo, o status do termo (current/outdated/none), o consentimento de saúde ativo e se há ficha (ativa ou congelada).';

REVOKE ALL ON FUNCTION public.staff_consent_overview()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.staff_consent_overview() TO authenticated;

-- ─── b) Desbloqueia o login dos alunos arquivados ───────────────────────────
UPDATE auth.users u SET banned_until = NULL
FROM public.profiles p
WHERE p.id = u.id AND p.role = 'student' AND p.deleted_at IS NOT NULL
  AND u.banned_until IS NOT NULL;

COMMIT;
