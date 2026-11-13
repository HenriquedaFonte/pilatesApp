-- Reversão — Story 4.5 (migration 20261112090000_email_campaign_server_send.sql)
--
-- SÓ EM EMERGÊNCIA, e junto com o revert do PR da Story 4.5 (o site novo
-- chama queue_email_campaign e a Edge Function send-campaign usa as funções
-- abaixo). Antes, se possível, apagar (ou não usar) a Edge Function
-- send-campaign no painel do Supabase.
--
-- O que faz:
--   • apaga as funções novas (queue_email_campaign, email_campaign_*);
--   • volta finish_email_campaign ao corpo da 4.4.
-- O que NÃO faz (não apaga dados nem colunas): a tabela
-- email_campaign_recipients e as colunas send_mode/worker_token/worker_until
-- de email_campaigns ficam. O histórico (email_notifications) não muda.
-- Bloco opcional no fim, comentado: só rodar com confirmação explícita.
--
-- Envios pelo servidor que estiverem pela metade ficam com status 'sending'
-- (aparecem como "Não concluído" no histórico da 4.4). Para encerrar um deles:
--   SELECT public.finish_email_campaign('<id>');   -- no SQL Editor
--
-- Rodar no Supabase SQL Editor de uma vez (BEGIN/COMMIT).

BEGIN;

DROP FUNCTION IF EXISTS public.queue_email_campaign(uuid, uuid[]);
DROP FUNCTION IF EXISTS public.email_campaign_acquire_worker(uuid, integer);
DROP FUNCTION IF EXISTS public.email_campaign_release_worker(uuid, uuid);
DROP FUNCTION IF EXISTS public.email_campaign_claim(uuid, uuid, integer, integer);
DROP FUNCTION IF EXISTS public.email_campaign_record(uuid, uuid, uuid, text, text, text, text, text);
DROP FUNCTION IF EXISTS public.email_campaign_finish_if_done(uuid);
DROP FUNCTION IF EXISTS public.email_campaign_finalize(uuid);

-- finish_email_campaign igual à 20261112080000 (Story 4.4).
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

-- Ninguém da API lê a fila depois da reversão.
DO $$
BEGIN
  IF to_regclass('public.email_campaign_recipients') IS NOT NULL THEN
    REVOKE ALL ON TABLE public.email_campaign_recipients FROM PUBLIC, anon, authenticated;
  END IF;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ─── OPCIONAL (só com confirmação explícita do usuário) ─────────────────────
-- Apaga a fila (quem estava pendente, tentativas) e as colunas novas. O
-- histórico de quem recebeu continua em email_notifications.
-- BEGIN;
-- DROP TABLE IF EXISTS public.email_campaign_recipients;
-- ALTER TABLE public.email_campaigns DROP CONSTRAINT IF EXISTS email_campaigns_send_mode_check;
-- ALTER TABLE public.email_campaigns DROP COLUMN IF EXISTS send_mode;
-- ALTER TABLE public.email_campaigns DROP COLUMN IF EXISTS worker_token;
-- ALTER TABLE public.email_campaigns DROP COLUMN IF EXISTS worker_until;
-- COMMIT;
