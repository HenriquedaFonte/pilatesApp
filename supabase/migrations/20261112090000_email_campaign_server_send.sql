-- Migration: envio de campanhas pelo servidor — Story 4.5 (Epic 4, PRD-003)
--
-- DEPENDE de:
--   • 20261112010000 (public.is_staff())
--   • 20261112040000 (public.assert_staff_caller)
--   • 20261112080000 (email_campaigns, email_notifications.campaign_id,
--     log_email_notification_impl de 9 argumentos, email_campaign_refresh_counts,
--     finish_email_campaign)
-- Se faltar algo, para logo no início e nada é aplicado.
--
-- Cria:
--   • email_campaigns.send_mode ('browser' | 'server', padrão 'browser': os
--     envios antigos e o site antigo continuam iguais), worker_token e
--     worker_until (a "vez" de quem está enviando: um envio por campanha de
--     cada vez, para não passar do limite do Resend).
--   • public.email_campaign_recipients: a fila de um envio pelo servidor. Uma
--     linha por aluno (chave campaign_id + student_id: o mesmo aluno não entra
--     duas vezes), status pending → sending → sent | failed, tentativas,
--     claim_token (quem pegou a linha), créditos no momento do envio e o id da
--     linha criada em email_notifications. Sem nome nem email (lidos de
--     profiles na hora do envio).
--   • public.queue_email_campaign(campaign_id, student_ids[]): o site chama
--     depois de criar a campanha. Só professora, só quem criou a campanha, só
--     uma vez. Grava na fila SÓ quem é aluno (role = 'student') e não está na
--     lixeira; o resto da lista é ignorado. total = quantos entraram.
--   • Funções da Edge Function send-campaign (só service_role):
--       email_campaign_acquire_worker / email_campaign_release_worker (a vez),
--       email_campaign_claim (pega um lote de linhas de forma atômica, com
--         FOR UPDATE SKIP LOCKED: duas chamadas ao mesmo tempo nunca pegam a
--         mesma linha),
--       email_campaign_record (grava o resultado de uma linha: chama
--         log_email_notification_impl, que cria a linha em email_notifications
--         com campaign_id e atualiza os contadores; só vale para quem tem o
--         claim_token da linha, então gravar duas vezes não duplica nada),
--       email_campaign_finish_if_done (marca done/failed quando a fila acaba).
--   • finish_email_campaign (da 4.4) passa a NÃO encerrar um envio pelo
--     servidor que ainda tem alunos na fila (só recalcula os contadores).
--
-- RLS de email_campaign_recipients: só staff lê (SELECT); ninguém grava pela
-- API (só pelas funções acima). anon e aluno: nada.
--
-- Rodar no Supabase SQL Editor de uma vez. Está dentro de BEGIN/COMMIT: se
-- algo falhar, nada é aplicado. Idempotente: pode rodar de novo. Não apaga
-- dados nem colunas.
--
-- ORDEM: rodar ANTES do deploy da Edge Function send-campaign e ANTES do merge
-- do PR da Story 4.5. Rodar antes não muda nada para o site no ar (as colunas
-- novas têm padrão e as funções novas só são chamadas pelo código novo).
--
-- VERIFICAÇÃO: docs/testes/4.5-envio-servidor-teste.sql
-- REVERSÃO:    docs/testes/4.5-envio-servidor-reversao.sql

BEGIN;

-- ─── 0. Pré-condições ───────────────────────────────────────────────────────
DO $$
DECLARE
  v_col text;
BEGIN
  IF to_regprocedure('public.is_staff()') IS NULL THEN
    RAISE EXCEPTION 'public.is_staff() não existe (migration 20261112010000). Nada foi aplicado.';
  END IF;
  IF to_regprocedure('public.assert_staff_caller(text,uuid)') IS NULL THEN
    RAISE EXCEPTION 'public.assert_staff_caller não existe (migration 20261112040000). Nada foi aplicado.';
  END IF;
  IF to_regclass('public.email_campaigns') IS NULL
     OR to_regprocedure('public.email_campaign_refresh_counts(uuid)') IS NULL
     OR to_regprocedure('public.finish_email_campaign(uuid)') IS NULL
     OR to_regprocedure('public.log_email_notification_impl(uuid,text,text,text,text,text,jsonb,text,uuid)') IS NULL THEN
    RAISE EXCEPTION 'Falta o que a migration 20261112080000 (Story 4.4) cria. Rode ela antes. Nada foi aplicado.';
  END IF;
  FOREACH v_col IN ARRAY ARRAY['id', 'role', 'email', 'full_name', 'preferred_language', 'deleted_at',
                               'individual_credits', 'duo_credits', 'group_credits'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_attribute
      WHERE attrelid = 'public.profiles'::regclass AND attname = v_col AND NOT attisdropped AND attnum > 0
    ) THEN
      RAISE EXCEPTION 'public.profiles não tem a coluna %. Nada foi aplicado.', v_col;
    END IF;
  END LOOP;
END $$;

-- ─── 1. Colunas novas em email_campaigns ────────────────────────────────────
ALTER TABLE public.email_campaigns
  ADD COLUMN IF NOT EXISTS send_mode    text NOT NULL DEFAULT 'browser',
  ADD COLUMN IF NOT EXISTS worker_token uuid,
  ADD COLUMN IF NOT EXISTS worker_until timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.email_campaigns'::regclass AND conname = 'email_campaigns_send_mode_check'
  ) THEN
    ALTER TABLE public.email_campaigns
      ADD CONSTRAINT email_campaigns_send_mode_check CHECK (send_mode IN ('browser', 'server'));
  END IF;
END $$;

COMMENT ON COLUMN public.email_campaigns.send_mode IS
  'josi-pilates: browser = enviado pelo navegador (4.4); server = fila em email_campaign_recipients, enviada pela Edge Function send-campaign (4.5).';
COMMENT ON COLUMN public.email_campaigns.worker_until IS
  'josi-pilates: até quando a send-campaign que está enviando tem a vez (um envio por campanha de cada vez).';

-- ─── 2. Fila: email_campaign_recipients ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.email_campaign_recipients (
  campaign_id     uuid NOT NULL REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  student_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
  attempts        integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  claim_token     uuid,
  claimed_at      timestamptz,
  credits_at_time jsonb,
  notification_id uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (campaign_id, student_id)
);
COMMENT ON TABLE public.email_campaign_recipients IS
  'josi-pilates: fila de um envio pelo servidor (Story 4.5). Uma linha por aluno; só as funções email_campaign_* gravam.';

CREATE INDEX IF NOT EXISTS idx_email_campaign_recipients_open
  ON public.email_campaign_recipients (campaign_id, created_at)
  WHERE status IN ('pending', 'sending');
CREATE INDEX IF NOT EXISTS idx_email_campaign_recipients_student
  ON public.email_campaign_recipients (student_id);

ALTER TABLE public.email_campaign_recipients ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  v_pol record;
BEGIN
  FOR v_pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'email_campaign_recipients'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.email_campaign_recipients', v_pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "email_campaign_recipients_select_staff" ON public.email_campaign_recipients
  FOR SELECT TO authenticated
  USING ((SELECT public.is_staff()));

REVOKE ALL ON TABLE public.email_campaign_recipients FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.email_campaign_recipients TO authenticated;
GRANT ALL ON TABLE public.email_campaign_recipients TO service_role;

-- ─── 3. Fim do envio (interna) ──────────────────────────────────────────────
-- Encerra um envio pelo servidor quando não há mais ninguém pendente/enviando.
-- Quem chama já tem o lock da linha da campanha. Devolve o status final.
CREATE OR REPLACE FUNCTION public.email_campaign_finalize(p_campaign_id uuid)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.email_campaign_recipients
    WHERE campaign_id = p_campaign_id AND status IN ('pending', 'sending')
  ) THEN
    SELECT status INTO v_status FROM public.email_campaigns WHERE id = p_campaign_id;
    RETURN v_status;
  END IF;

  PERFORM public.email_campaign_refresh_counts(p_campaign_id);
  UPDATE public.email_campaigns
     SET status = CASE WHEN sent = 0 AND total > 0 THEN 'failed' ELSE 'done' END,
         worker_token = NULL,
         worker_until = NULL,
         updated_at = now()
   WHERE id = p_campaign_id AND status = 'sending' AND send_mode = 'server';

  SELECT status INTO v_status FROM public.email_campaigns WHERE id = p_campaign_id;
  RETURN v_status;
END;
$$;
COMMENT ON FUNCTION public.email_campaign_finalize(uuid) IS
  'josi-pilates: encerra (done/failed) um envio pelo servidor sem ninguém na fila. Interna (sem EXECUTE para a API).';
REVOKE ALL ON FUNCTION public.email_campaign_finalize(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- ─── 4. Site: pôr a campanha na fila ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.queue_email_campaign(p_campaign_id uuid, p_student_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_c record;
  n   integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_staff() THEN
    RAISE EXCEPTION 'permission denied: only the teacher can call queue_email_campaign'
      USING ERRCODE = '42501';
  END IF;
  IF p_student_ids IS NULL OR cardinality(p_student_ids) = 0 OR cardinality(p_student_ids) > 2000 THEN
    RAISE EXCEPTION 'invalid recipient list' USING ERRCODE = '22023';
  END IF;

  SELECT id, created_by, status, send_mode INTO v_c
  FROM public.email_campaigns WHERE id = p_campaign_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'campaign not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_c.created_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'permission denied: campaign created by someone else' USING ERRCODE = '42501';
  END IF;
  IF v_c.status <> 'sending' OR v_c.send_mode <> 'browser'
     OR EXISTS (SELECT 1 FROM public.email_campaign_recipients WHERE campaign_id = p_campaign_id)
     OR EXISTS (SELECT 1 FROM public.email_notifications WHERE campaign_id = p_campaign_id) THEN
    RAISE EXCEPTION 'campaign already started' USING ERRCODE = '55000';
  END IF;

  -- Só alunos de verdade (fora da lixeira). Ids repetidos ou de outro papel ficam de fora.
  INSERT INTO public.email_campaign_recipients (campaign_id, student_id)
  SELECT DISTINCT p_campaign_id, p.id
  FROM public.profiles p
  WHERE p.id = ANY (p_student_ids)
    AND p.role::text = 'student'
    AND p.deleted_at IS NULL
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;

  IF n = 0 THEN
    RAISE EXCEPTION 'no valid recipients' USING ERRCODE = '22023';
  END IF;

  UPDATE public.email_campaigns
     SET send_mode = 'server', total = n, updated_at = now()
   WHERE id = p_campaign_id;
  RETURN n;
END;
$$;
COMMENT ON FUNCTION public.queue_email_campaign(uuid, uuid[]) IS
  'josi-pilates: põe na fila do servidor os alunos de uma campanha nova (Story 4.5). Só a professora que criou a campanha, uma vez.';
REVOKE ALL ON FUNCTION public.queue_email_campaign(uuid, uuid[]) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.queue_email_campaign(uuid, uuid[]) TO authenticated;

-- ─── 5. Edge Function: a vez de enviar ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.email_campaign_acquire_worker(p_campaign_id uuid, p_lease_seconds integer)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token uuid;
BEGIN
  UPDATE public.email_campaigns
     SET worker_token = gen_random_uuid(),
         worker_until = now() + make_interval(secs => greatest(30, least(coalesce(p_lease_seconds, 180), 900)))
   WHERE id = p_campaign_id
     AND status = 'sending'
     AND send_mode = 'server'
     AND (worker_until IS NULL OR worker_until < now())
  RETURNING worker_token INTO v_token;
  RETURN v_token; -- NULL: outra chamada já está enviando (ou não há o que enviar)
END;
$$;
COMMENT ON FUNCTION public.email_campaign_acquire_worker(uuid, integer) IS
  'josi-pilates: send-campaign pega a vez de enviar uma campanha (Story 4.5). Só service_role.';

CREATE OR REPLACE FUNCTION public.email_campaign_release_worker(p_campaign_id uuid, p_token uuid)
RETURNS void
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.email_campaigns
     SET worker_token = NULL, worker_until = NULL
   WHERE id = p_campaign_id AND worker_token = p_token;
$$;
COMMENT ON FUNCTION public.email_campaign_release_worker(uuid, uuid) IS
  'josi-pilates: send-campaign devolve a vez de enviar (Story 4.5). Só service_role.';

-- ─── 6. Edge Function: pegar um lote ────────────────────────────────────────
-- Só com a vez válida. Pega linhas pendentes, ou "enviando" paradas há mais de
-- p_stale_seconds (a chamada que pegou morreu). SKIP LOCKED: duas chamadas ao
-- mesmo tempo nunca pegam a mesma linha. Os créditos ficam guardados na
-- primeira vez (o email de uma nova tentativa sai igual).
CREATE OR REPLACE FUNCTION public.email_campaign_claim(
  p_campaign_id   uuid,
  p_token         uuid,
  p_limit         integer,
  p_stale_seconds integer DEFAULT 600
)
RETURNS TABLE (
  student_id         uuid,
  claim_token        uuid,
  attempts           integer,
  email              text,
  full_name          text,
  preferred_language text,
  role               text,
  deleted            boolean,
  credits            jsonb
)
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH lease AS (
    SELECT c.id
    FROM public.email_campaigns c
    WHERE c.id = p_campaign_id
      AND c.status = 'sending'
      AND c.send_mode = 'server'
      AND p_token IS NOT NULL
      AND c.worker_token = p_token
      AND c.worker_until > now()
  ), picked AS (
    SELECT r.campaign_id, r.student_id
    FROM public.email_campaign_recipients r
    JOIN lease l ON l.id = r.campaign_id
    WHERE r.status = 'pending'
       OR (r.status = 'sending'
           AND r.claimed_at < now() - make_interval(secs => greatest(coalesce(p_stale_seconds, 600), 60)))
    ORDER BY r.created_at, r.student_id
    LIMIT greatest(1, least(coalesce(p_limit, 10), 50))
    FOR UPDATE OF r SKIP LOCKED
  ), claimed AS (
    UPDATE public.email_campaign_recipients r
       SET status = 'sending',
           claim_token = gen_random_uuid(),
           claimed_at = now(),
           attempts = r.attempts + 1,
           updated_at = now(),
           credits_at_time = coalesce(r.credits_at_time, (
             SELECT jsonb_build_object(
                      'individual', coalesce(p.individual_credits, 0),
                      'duo',        coalesce(p.duo_credits, 0),
                      'group',      coalesce(p.group_credits, 0),
                      'total',      coalesce(p.individual_credits, 0) + coalesce(p.duo_credits, 0)
                                    + coalesce(p.group_credits, 0))
             FROM public.profiles p WHERE p.id = r.student_id))
      FROM picked
     WHERE r.campaign_id = picked.campaign_id AND r.student_id = picked.student_id
    RETURNING r.student_id, r.claim_token, r.attempts, r.credits_at_time
  )
  SELECT c.student_id, c.claim_token, c.attempts,
         p.email::text, p.full_name::text, p.preferred_language::text, p.role::text,
         (p.id IS NULL OR p.deleted_at IS NOT NULL),
         c.credits_at_time
  FROM claimed c
  LEFT JOIN public.profiles p ON p.id = c.student_id;
$$;
COMMENT ON FUNCTION public.email_campaign_claim(uuid, uuid, integer, integer) IS
  'josi-pilates: send-campaign pega um lote da fila de forma atômica (Story 4.5). Só service_role.';

-- ─── 7. Edge Function: gravar o resultado de uma linha ──────────────────────
-- p_outcome: 'sent' | 'failed' (grava em email_notifications pela
-- log_email_notification_impl, com campaign_id, e atualiza os contadores) ou
-- 'retry' (volta para pendente, sem gravar nada no histórico).
-- Só vale para a linha "enviando" com o mesmo claim_token: uma segunda
-- gravação (ou uma chamada que perdeu a linha) devolve 'ignored'.
CREATE OR REPLACE FUNCTION public.email_campaign_record(
  p_campaign_id     uuid,
  p_student_id      uuid,
  p_claim_token     uuid,
  p_outcome         text,
  p_error           text DEFAULT NULL,
  p_provider_id     text DEFAULT NULL,
  p_recipient_email text DEFAULT NULL,
  p_subject         text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type text;
  v_r    record;
  v_id   uuid;
BEGIN
  IF p_outcome IS NULL OR p_outcome NOT IN ('sent', 'failed', 'retry') THEN
    RAISE EXCEPTION 'invalid outcome' USING ERRCODE = '22023';
  END IF;

  -- Lock da campanha primeiro: gravações e o fim do envio ficam em fila.
  SELECT email_type INTO v_type FROM public.email_campaigns WHERE id = p_campaign_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN 'ignored';
  END IF;

  SELECT r.status, r.claim_token, r.credits_at_time INTO v_r
  FROM public.email_campaign_recipients r
  WHERE r.campaign_id = p_campaign_id AND r.student_id = p_student_id
  FOR UPDATE;
  IF NOT FOUND OR v_r.status <> 'sending' OR p_claim_token IS NULL
     OR v_r.claim_token IS DISTINCT FROM p_claim_token THEN
    RETURN 'ignored';
  END IF;

  IF p_outcome = 'retry' THEN
    UPDATE public.email_campaign_recipients
       SET status = 'pending', claim_token = NULL, claimed_at = NULL, updated_at = now()
     WHERE campaign_id = p_campaign_id AND student_id = p_student_id;
    RETURN 'released';
  END IF;

  v_id := public.log_email_notification_impl(
    p_student_id,
    v_type,
    coalesce(p_recipient_email, ''),
    coalesce(p_subject, ''),
    p_outcome,
    CASE WHEN p_outcome = 'failed' THEN left(coalesce(p_error, 'error'), 300) ELSE NULL END,
    v_r.credits_at_time,
    left(p_provider_id, 200),
    p_campaign_id
  );

  UPDATE public.email_campaign_recipients
     SET status = p_outcome, notification_id = v_id, claim_token = NULL, updated_at = now()
   WHERE campaign_id = p_campaign_id AND student_id = p_student_id;

  PERFORM public.email_campaign_finalize(p_campaign_id);
  RETURN 'recorded';
END;
$$;
COMMENT ON FUNCTION public.email_campaign_record(uuid, uuid, uuid, text, text, text, text, text) IS
  'josi-pilates: send-campaign grava o resultado de um aluno (Story 4.5). Só service_role.';

-- ─── 8. Edge Function: encerrar quando a fila acaba ─────────────────────────
CREATE OR REPLACE FUNCTION public.email_campaign_finish_if_done(p_campaign_id uuid)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM 1 FROM public.email_campaigns WHERE id = p_campaign_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  RETURN public.email_campaign_finalize(p_campaign_id);
END;
$$;
COMMENT ON FUNCTION public.email_campaign_finish_if_done(uuid) IS
  'josi-pilates: send-campaign encerra o envio se a fila acabou (Story 4.5). Só service_role.';

-- Privilégios: as funções da Edge Function só para service_role.
REVOKE ALL ON FUNCTION public.email_campaign_acquire_worker(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.email_campaign_release_worker(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.email_campaign_claim(uuid, uuid, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.email_campaign_record(uuid, uuid, uuid, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.email_campaign_finish_if_done(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.email_campaign_acquire_worker(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.email_campaign_release_worker(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.email_campaign_claim(uuid, uuid, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.email_campaign_record(uuid, uuid, uuid, text, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.email_campaign_finish_if_done(uuid) TO service_role;

-- ─── 9. finish_email_campaign (4.4): não encerra fila do servidor no meio ───
CREATE OR REPLACE FUNCTION public.finish_email_campaign(p_campaign_id uuid)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_staff_caller('finish_email_campaign', NULL::uuid);
  PERFORM public.email_campaign_refresh_counts(p_campaign_id);
  -- Envio pelo servidor com alunos ainda na fila: quem encerra é a send-campaign.
  IF EXISTS (
    SELECT 1 FROM public.email_campaign_recipients
    WHERE campaign_id = p_campaign_id AND status IN ('pending', 'sending')
  ) THEN
    RETURN;
  END IF;
  UPDATE public.email_campaigns
     SET status = CASE WHEN sent = 0 AND total > 0 THEN 'failed' ELSE 'done' END,
         updated_at = now()
   WHERE id = p_campaign_id;
END;
$$;
COMMENT ON FUNCTION public.finish_email_campaign(uuid) IS
  'josi-pilates: fim de um envio (Story 4.4). Recalcula enviados/falhas e marca done/failed. Só professora (assert_staff_caller). Não encerra envio pelo servidor com fila (4.5).';
REVOKE ALL ON FUNCTION public.finish_email_campaign(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finish_email_campaign(uuid) TO authenticated, service_role;

-- ─── 10. Conferência final ──────────────────────────────────────────────────
DO $$
DECLARE
  v_fn text;
BEGIN
  FOREACH v_fn IN ARRAY ARRAY[
    'public.email_campaign_acquire_worker(uuid,integer)',
    'public.email_campaign_release_worker(uuid,uuid)',
    'public.email_campaign_claim(uuid,uuid,integer,integer)',
    'public.email_campaign_record(uuid,uuid,uuid,text,text,text,text,text)',
    'public.email_campaign_finish_if_done(uuid)'
  ] LOOP
    IF has_function_privilege('anon', v_fn, 'EXECUTE')
       OR has_function_privilege('authenticated', v_fn, 'EXECUTE')
       OR NOT has_function_privilege('service_role', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'EXECUTE de % não ficou só para service_role. Nada foi aplicado.', v_fn;
    END IF;
  END LOOP;
  IF has_function_privilege('anon', 'public.email_campaign_finalize(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.email_campaign_finalize(uuid)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.email_campaign_finalize(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'email_campaign_finalize ficou com EXECUTE para a API. Nada foi aplicado.';
  END IF;
  IF has_function_privilege('anon', 'public.queue_email_campaign(uuid,uuid[])', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.queue_email_campaign(uuid,uuid[])', 'EXECUTE') THEN
    RAISE EXCEPTION 'EXECUTE de queue_email_campaign errado. Nada foi aplicado.';
  END IF;
  IF has_table_privilege('anon', 'public.email_campaign_recipients', 'SELECT, INSERT, UPDATE, DELETE')
     OR has_table_privilege('authenticated', 'public.email_campaign_recipients', 'INSERT, UPDATE, DELETE, TRUNCATE')
     OR has_column_privilege('authenticated', 'public.email_campaigns', 'send_mode', 'INSERT')
     OR has_column_privilege('authenticated', 'public.email_campaigns', 'send_mode', 'UPDATE') THEN
    RAISE EXCEPTION 'Privilégios da fila não ficaram como esperado. Nada foi aplicado.';
  END IF;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
