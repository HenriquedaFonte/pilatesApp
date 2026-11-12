-- REVERSÃO da migration 20261112080000_create_email_campaigns.sql (Story 4.4)
--
-- SÓ EM EMERGÊNCIA. Volta log_email_notification ao estado de depois da
-- 20261112040000 (invólucro de 8 parâmetros chamando a original de produção,
-- que volta a se chamar log_email_notification_impl) e apaga
-- finish_email_campaign e email_campaign_refresh_counts.
--
-- ATENÇÃO: o site da Story 4.4 (depois do merge) passa p_campaign_id e chama
-- finish_email_campaign. Se rodar esta reversão com esse site no ar, o
-- registro dos emails no histórico PARA de funcionar (os emails continuam
-- saindo). Rodar só junto com o revert do PR da 4.4 (primeiro o revert/deploy
-- do site, depois esta reversão).
--
-- NÃO apaga dados: a tabela email_campaigns e a coluna
-- email_notifications.campaign_id ficam (a coluna é nullable e o código antigo
-- não a usa). Para apagar também, só com confirmação explícita do usuário,
-- descomentar o bloco no fim (apaga o histórico por envio, sem volta).
--
-- Rodar no Supabase SQL Editor de uma vez. BEGIN/COMMIT: se algo falhar, nada
-- é aplicado. Idempotente.

BEGIN;

DO $$
DECLARE
  v_base    regprocedure;
  v_wrapper regprocedure;
  p         record;
  v_call    text;
  i         int;
BEGIN
  SELECT pr.oid::regprocedure INTO v_base
  FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
  WHERE n.nspname = 'public' AND pr.proname = 'log_email_notification_base';

  IF v_base IS NULL THEN
    RAISE NOTICE 'log_email_notification_base não existe: a reversão já foi feita (ou a migration não rodou). Nada a fazer nas funções.';
  ELSE
    -- 1. Funções da 4.4
    DROP FUNCTION IF EXISTS public.log_email_notification(uuid, text, text, text, text, text, jsonb, text, uuid);
    DROP FUNCTION IF EXISTS public.log_email_notification_impl(uuid, text, text, text, text, text, jsonb, text, uuid);
    DROP FUNCTION IF EXISTS public.finish_email_campaign(uuid);
    DROP FUNCTION IF EXISTS public.email_campaign_refresh_counts(uuid);

    -- 2. A original volta a ser log_email_notification_impl (como depois da 040000)
    EXECUTE format('ALTER FUNCTION %s RENAME TO log_email_notification_impl', v_base);
    SELECT pr.oid, pr.pronargs, pr.provolatile, pr.proisstrict,
           oidvectortypes(pr.proargtypes) AS types,
           pg_get_function_arguments(pr.oid) AS args,
           pg_get_function_result(pr.oid) AS result
      INTO p
    FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
    WHERE n.nspname = 'public' AND pr.proname = 'log_email_notification_impl';
    EXECUTE format('REVOKE ALL ON FUNCTION public.log_email_notification_impl(%s) FROM PUBLIC, anon, authenticated, service_role', p.types);
    EXECUTE format('ALTER FUNCTION public.log_email_notification_impl(%s) SET search_path = public', p.types);
    EXECUTE format('COMMENT ON FUNCTION public.log_email_notification_impl(%s) IS NULL', p.types);

    -- 3. Invólucro de 8 parâmetros igual ao que a 20261112040000 cria
    v_call := '';
    FOR i IN 1 .. p.pronargs LOOP
      v_call := v_call || CASE WHEN i > 1 THEN ', ' ELSE '' END || '$' || i;
    END LOOP;
    EXECUTE format(
      'CREATE OR REPLACE FUNCTION public.log_email_notification(%s) RETURNS %s LANGUAGE sql %s%s SECURITY DEFINER SET search_path = public AS %L',
      p.args, p.result,
      CASE p.provolatile WHEN 'v' THEN 'VOLATILE' ELSE 'STABLE' END,
      CASE WHEN p.proisstrict THEN ' STRICT' ELSE '' END,
      format(E'SELECT public.assert_staff_caller(%L, %s);\n%s', 'log_email_notification', 'NULL::uuid',
             format('SELECT public.log_email_notification_impl(%s);', v_call))
    );
    v_wrapper := to_regprocedure(format('public.log_email_notification(%s)', p.types));
    EXECUTE format('COMMENT ON FUNCTION %s IS %L', v_wrapper,
      'josi-pilates: invólucro: exige professora (assert_staff_caller) e chama public.log_email_notification_impl sem mudar a lógica.');
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', v_wrapper);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', v_wrapper);
  END IF;
END $$;

-- ─── Opcional: apagar os dados da 4.4 (SÓ com confirmação explícita) ───────
-- Apaga o histórico por envio (assuntos, mensagens, filtros, contadores) e o
-- vínculo de cada email com o envio. As linhas de email_notifications ficam.
-- ALTER TABLE public.email_notifications DROP COLUMN IF EXISTS campaign_id;
-- DROP TABLE IF EXISTS public.email_campaigns;

COMMIT;

NOTIFY pgrst, 'reload schema';
