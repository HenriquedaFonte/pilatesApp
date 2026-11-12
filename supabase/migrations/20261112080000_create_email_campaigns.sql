-- Migration: registro de envios de email (campanhas) — Story 4.4 (Epic 4, PRD-003)
--
-- DEPENDE de:
--   • 20261112010000 (public.is_staff())
--   • 20261112040000 (public.assert_staff_caller e o invólucro de
--     log_email_notification, com a original renomeada para
--     log_email_notification_impl)
-- Se faltar algo, para logo no início e nada é aplicado.
--
-- Cria:
--   • public.email_campaigns: um envio feito pela tela Notificações por email
--     (quem, quando, tipo, assunto e mensagem em pt/en/fr, nome de quem
--     assina, filtro usado em JSON, total, enviados, falhas, status
--     sending|done|failed).
--   • public.email_notifications.campaign_id (uuid, nullable, FK com ON DELETE
--     SET NULL). Registros antigos ficam com campaign_id nulo.
--   • public.finish_email_campaign(p_campaign_id): o site chama no fim do
--     envio; recalcula enviados/falhas a partir de email_notifications e marca
--     o status (failed se nenhum foi enviado; senão done).
--   • public.email_campaign_refresh_counts(uuid): interna (sem EXECUTE para a
--     API); recalcula sent/failed a partir de email_notifications.
--
-- log_email_notification ganha o parâmetro opcional p_campaign_id (uuid,
-- DEFAULT NULL), sem mudar a lógica de produção (cujo corpo não está no
-- repositório):
--   • a original de produção (hoje log_email_notification_impl, 8 argumentos)
--     é renomeada para log_email_notification_base, fica com search_path =
--     public e sem EXECUTE para a API. O corpo NÃO muda;
--   • nova log_email_notification_impl (9 argumentos, SECURITY DEFINER,
--     search_path = public, sem EXECUTE para a API): chama a _base com os 8
--     argumentos de antes, grava campaign_id na linha criada (pelo id que a
--     _base devolve) e atualiza os contadores da campanha;
--   • o invólucro de 8 argumentos é apagado e entra o de 9 (mesmo padrão da
--     20261112040000: SECURITY DEFINER, search_path = public, chama
--     assert_staff_caller e depois a _impl; mesmo comentário-marcador; EXECUTE
--     só para authenticated e service_role).
--   Quem chama com a assinatura antiga continua funcionando (o 9º parâmetro
--   tem DEFAULT NULL): o site de produção antes do merge (7 parâmetros por
--   nome) e a Edge Function antiga send-low-credits-notifications (8 por
--   nome). Não fica sobrecarga (overload) de log_email_notification: o
--   PostgREST não conseguiria escolher entre duas versões.
--   Por que _base e não deixar a original como _impl: se alguém rodar a
--   20261112040000 de novo, ela recriaria um invólucro de 8 argumentos para
--   cada <nome>_impl, e duas versões de log_email_notification quebrariam a
--   chamada do site. Com o nome _base ela não acha a original.
--
-- RLS de email_campaigns: só staff (is_staff()) lê (SELECT) e cria (INSERT,
-- com created_by = auth.uid()). Sem UPDATE/DELETE pela API: contadores e
-- status só mudam pelas funções acima. Privilégios: anon nenhum;
-- authenticated SELECT e INSERT só nas colunas de conteúdo (não consegue
-- gravar sent/failed/status/created_by/created_at); service_role tudo (backup
-- e a futura Story 4.5).
--
-- Rodar no Supabase SQL Editor de uma vez. Está dentro de BEGIN/COMMIT: se
-- algo falhar, nada é aplicado. Idempotente: pode rodar de novo. Não apaga
-- dados nem colunas.
--
-- ORDEM: rodar ANTES do merge do PR da Story 4.4 (o site novo grava em
-- email_campaigns e passa p_campaign_id).
--
-- VERIFICAÇÃO: docs/testes/4.4-campanhas-teste.sql
-- REVERSÃO:    docs/testes/4.4-campanhas-reversao.sql

BEGIN;

-- ─── 0. Pré-condições ───────────────────────────────────────────────────────
DO $$
DECLARE
  v_base  regprocedure;
  v_impl8 regprocedure;
  r record;
  d record;
BEGIN
  IF to_regprocedure('public.is_staff()') IS NULL THEN
    RAISE EXCEPTION 'public.is_staff() não existe (migration 20261112010000). Nada foi aplicado.';
  END IF;
  IF to_regprocedure('public.assert_staff_caller(text,uuid)') IS NULL THEN
    RAISE EXCEPTION 'public.assert_staff_caller não existe (migration 20261112040000). Nada foi aplicado.';
  END IF;
  IF to_regclass('public.email_notifications') IS NULL THEN
    RAISE EXCEPTION 'public.email_notifications não existe. Nada foi aplicado.';
  END IF;
  IF to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'public.profiles não existe. Nada foi aplicado.';
  END IF;

  -- Versões de log_email_notification: só o invólucro de 8 (1ª vez) e/ou o
  -- de 9 (2ª vez). Qualquer outra coisa é um estado que não conhecemos.
  FOR r IN
    SELECT p.oid::regprocedure AS fn, p.pronargs,
           coalesce(obj_description(p.oid, 'pg_proc'), '') AS comentario
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'log_email_notification'
  LOOP
    IF r.comentario NOT LIKE 'josi-pilates: invólucro%' OR r.pronargs NOT IN (8, 9) THEN
      RAISE EXCEPTION '% não é o invólucro esperado da 20261112040000. Nada foi aplicado.', r.fn;
    END IF;
  END LOOP;

  -- A original de produção: ou já é _base (2ª vez), ou é a _impl de 8.
  SELECT p.oid::regprocedure INTO v_base
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'log_email_notification_base';

  FOR r IN
    SELECT p.oid, p.oid::regprocedure AS fn, p.pronargs, p.prorettype, p.prokind,
           p.proargnames
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'log_email_notification_impl'
  LOOP
    IF r.pronargs = 9 THEN
      CONTINUE; -- a nossa, de uma execução anterior
    END IF;
    IF v_impl8 IS NOT NULL OR v_base IS NOT NULL THEN
      RAISE EXCEPTION 'Mais de uma versão original de log_email_notification (%). Nada foi aplicado.', r.fn;
    END IF;
    IF r.prokind <> 'f' OR r.prorettype <> 'uuid'::regtype OR r.pronargs <> 8
       OR r.proargnames IS NULL
       OR r.proargnames[1:8] IS DISTINCT FROM ARRAY['p_student_id', 'p_email_type', 'p_recipient_email',
            'p_subject', 'p_status', 'p_error_message', 'p_credits_at_time', 'p_email_provider_id'] THEN
      RAISE EXCEPTION '% não tem a assinatura esperada (8 parâmetros p_student_id ... p_email_provider_id, devolvendo uuid). Nada foi aplicado.', r.fn;
    END IF;
    FOR d IN
      SELECT pg_describe_object(dp.classid, dp.objid, dp.objsubid) AS obj
      FROM pg_depend dp
      WHERE dp.refclassid = 'pg_proc'::regclass AND dp.refobjid = r.oid
    LOOP
      RAISE EXCEPTION '% depende da original de log_email_notification. Renomear quebraria esse objeto. Nada foi aplicado.', d.obj;
    END LOOP;
    v_impl8 := r.fn;
  END LOOP;

  IF v_impl8 IS NULL AND v_base IS NULL THEN
    RAISE EXCEPTION 'Não achei a original de log_email_notification (log_email_notification_impl de 8 parâmetros). A 20261112040000 rodou? Nada foi aplicado.';
  END IF;

  IF v_impl8 IS NOT NULL THEN
    EXECUTE format('ALTER FUNCTION %s RENAME TO log_email_notification_base', v_impl8);
  END IF;
END $$;

-- A original (corpo de produção, sem mudança): sem EXECUTE para a API.
DO $$
DECLARE
  v_base regprocedure;
BEGIN
  SELECT p.oid::regprocedure INTO STRICT v_base
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'log_email_notification_base';
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', v_base);
  EXECUTE format('ALTER FUNCTION %s SET search_path = public', v_base);
  EXECUTE format('COMMENT ON FUNCTION %s IS %L', v_base,
    'josi-pilates: original de produção de log_email_notification (corpo sem mudança). Só log_email_notification_impl chama.');
END $$;

-- ─── 1. Tabela email_campaigns ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.email_campaigns (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by       uuid DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  email_type       text NOT NULL CHECK (char_length(email_type) BETWEEN 1 AND 50),
  subject_pt       text,
  subject_en       text,
  subject_fr       text,
  message_pt       text,
  message_en       text,
  message_fr       text,
  sender_name      text,
  recipient_filter jsonb NOT NULL DEFAULT '{}'::jsonb,
  total            integer NOT NULL DEFAULT 0 CHECK (total >= 0),
  sent             integer NOT NULL DEFAULT 0 CHECK (sent >= 0),
  failed           integer NOT NULL DEFAULT 0 CHECK (failed >= 0),
  status           text NOT NULL DEFAULT 'sending' CHECK (status IN ('sending', 'done', 'failed'))
);
COMMENT ON TABLE public.email_campaigns IS
  'josi-pilates: um envio da tela Notificações por email (Story 4.4). Destinatários em email_notifications.campaign_id.';

CREATE INDEX IF NOT EXISTS idx_email_campaigns_created_at ON public.email_campaigns (created_at DESC);

-- ─── 2. email_notifications.campaign_id ─────────────────────────────────────
ALTER TABLE public.email_notifications
  ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.email_campaigns(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_email_notifications_campaign_id
  ON public.email_notifications (campaign_id) WHERE campaign_id IS NOT NULL;

-- ─── 3. RLS e privilégios de email_campaigns ────────────────────────────────
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  v_pol record;
BEGIN
  -- Apaga qualquer policy que exista nesta tabela (nome velho ou novo).
  FOR v_pol IN
    SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'email_campaigns'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.email_campaigns', v_pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "email_campaigns_select_staff" ON public.email_campaigns
  FOR SELECT TO authenticated
  USING ((SELECT public.is_staff()));

CREATE POLICY "email_campaigns_insert_staff" ON public.email_campaigns
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_staff()) AND created_by = (SELECT auth.uid()));

REVOKE ALL ON TABLE public.email_campaigns FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.email_campaigns TO authenticated;
GRANT INSERT (email_type, subject_pt, subject_en, subject_fr, message_pt, message_en, message_fr,
              sender_name, recipient_filter, total)
  ON TABLE public.email_campaigns TO authenticated;
GRANT ALL ON TABLE public.email_campaigns TO service_role;

-- ─── 4. Contadores e fim do envio ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.email_campaign_refresh_counts(p_campaign_id uuid)
RETURNS void
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.email_campaigns c
     SET sent = s.sent,
         failed = s.failed,
         updated_at = now()
    FROM (
      SELECT count(*) FILTER (WHERE en.status = 'sent')::int   AS sent,
             count(*) FILTER (WHERE en.status = 'failed')::int AS failed
      FROM public.email_notifications en
      WHERE en.campaign_id = p_campaign_id
    ) s
   WHERE c.id = p_campaign_id;
$$;
COMMENT ON FUNCTION public.email_campaign_refresh_counts(uuid) IS
  'josi-pilates: recalcula sent/failed de email_campaigns a partir de email_notifications. Interna (sem EXECUTE para a API).';
REVOKE ALL ON FUNCTION public.email_campaign_refresh_counts(uuid) FROM PUBLIC, anon, authenticated, service_role;

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
  UPDATE public.email_campaigns
     SET status = CASE WHEN sent = 0 AND total > 0 THEN 'failed' ELSE 'done' END,
         updated_at = now()
   WHERE id = p_campaign_id;
END;
$$;
COMMENT ON FUNCTION public.finish_email_campaign(uuid) IS
  'josi-pilates: fim de um envio (Story 4.4). Recalcula enviados/falhas e marca done/failed. Só professora (assert_staff_caller).';
REVOKE ALL ON FUNCTION public.finish_email_campaign(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finish_email_campaign(uuid) TO authenticated, service_role;

-- ─── 5. log_email_notification com p_campaign_id ────────────────────────────
CREATE OR REPLACE FUNCTION public.log_email_notification_impl(
  p_student_id        uuid,
  p_email_type        text,
  p_recipient_email   text,
  p_subject           text,
  p_status            text,
  p_error_message     text  DEFAULT NULL,
  p_credits_at_time   jsonb DEFAULT NULL,
  p_email_provider_id text  DEFAULT NULL,
  p_campaign_id       uuid  DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  -- Lógica de produção, sem mudança.
  v_id := public.log_email_notification_base(
    p_student_id        => p_student_id,
    p_email_type        => p_email_type,
    p_recipient_email   => p_recipient_email,
    p_subject           => p_subject,
    p_status            => p_status,
    p_error_message     => p_error_message,
    p_credits_at_time   => p_credits_at_time,
    p_email_provider_id => p_email_provider_id
  );

  IF p_campaign_id IS NOT NULL THEN
    UPDATE public.email_notifications SET campaign_id = p_campaign_id WHERE id = v_id;
    PERFORM public.email_campaign_refresh_counts(p_campaign_id);
  END IF;

  RETURN v_id;
END;
$$;
COMMENT ON FUNCTION public.log_email_notification_impl(uuid, text, text, text, text, text, jsonb, text, uuid) IS
  'josi-pilates: chama log_email_notification_base (lógica de produção) e grava campaign_id (Story 4.4).';
REVOKE ALL ON FUNCTION public.log_email_notification_impl(uuid, text, text, text, text, text, jsonb, text, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

-- Invólucro antigo (8 argumentos) sai; o novo tem um 9º com DEFAULT NULL.
DROP FUNCTION IF EXISTS public.log_email_notification(uuid, text, text, text, text, text, jsonb, text);

CREATE OR REPLACE FUNCTION public.log_email_notification(
  p_student_id        uuid,
  p_email_type        text,
  p_recipient_email   text,
  p_subject           text,
  p_status            text,
  p_error_message     text  DEFAULT NULL,
  p_credits_at_time   jsonb DEFAULT NULL,
  p_email_provider_id text  DEFAULT NULL,
  p_campaign_id       uuid  DEFAULT NULL
)
RETURNS uuid
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
SELECT public.assert_staff_caller('log_email_notification', NULL::uuid);
SELECT public.log_email_notification_impl($1, $2, $3, $4, $5, $6, $7, $8, $9);
$$;
COMMENT ON FUNCTION public.log_email_notification(uuid, text, text, text, text, text, jsonb, text, uuid) IS
  'josi-pilates: invólucro: exige professora (assert_staff_caller) e chama public.log_email_notification_impl sem mudar a lógica.';
REVOKE ALL ON FUNCTION public.log_email_notification(uuid, text, text, text, text, text, jsonb, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_email_notification(uuid, text, text, text, text, text, jsonb, text, uuid)
  TO authenticated, service_role;

-- ─── 6. Conferência final ───────────────────────────────────────────────────
DO $$
DECLARE
  n int;
BEGIN
  SELECT count(*) INTO n
  FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
  WHERE ns.nspname = 'public' AND p.proname = 'log_email_notification';
  IF n <> 1 THEN
    RAISE EXCEPTION 'Ficaram % versões de log_email_notification (esperado 1). Nada foi aplicado.', n;
  END IF;
  IF has_table_privilege('anon', 'public.email_campaigns', 'SELECT')
     OR has_table_privilege('anon', 'public.email_campaigns', 'INSERT')
     OR has_table_privilege('authenticated', 'public.email_campaigns', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.email_campaigns', 'DELETE')
     OR has_column_privilege('authenticated', 'public.email_campaigns', 'sent', 'INSERT')
     OR has_column_privilege('authenticated', 'public.email_campaigns', 'status', 'INSERT') THEN
    RAISE EXCEPTION 'Privilégios de email_campaigns não ficaram como esperado. Nada foi aplicado.';
  END IF;
END $$;

COMMIT;

-- O PostgREST (API do Supabase) recarrega o cache sozinho; isto só garante.
NOTIFY pgrst, 'reload schema';
