-- Reversão — limpeza dos emails automáticos
-- (migration 20261112050000_cleanup_email_automation.sql)
--
-- Só para emergência. Recria, a partir da cópia exata que a migration guardou
-- em josi_backup.email_cleanup_20261112:
--   • os jobs do pg_cron removidos (low-credits-report-daily,
--     send-low-credits-notifications-daily), com a mesma agenda e comando;
--   • as funções de disparo apagadas, com o mesmo corpo e os mesmos GRANTs.
-- O que já existir é pulado (pode rodar de novo).
--
-- NÃO desfaz a correção de get_students_for_notification (desfazer só a
-- quebraria de novo). Se mesmo assim precisar, o bloco 3 no fim está
-- comentado.
--
-- Rodar no Supabase SQL Editor (como postgres), colando o arquivo inteiro.
-- Está dentro de BEGIN/COMMIT: se algo falhar, nada é aplicado.

BEGIN;

DO $$
BEGIN
  IF to_regclass('josi_backup.email_cleanup_20261112') IS NULL THEN
    RAISE EXCEPTION 'josi_backup.email_cleanup_20261112 não existe: a migration 20261112050000 não rodou. Nada a reverter.';
  END IF;
END $$;

-- 1. Funções apagadas
DO $$
DECLARE
  b record;
BEGIN
  FOR b IN SELECT * FROM josi_backup.email_cleanup_20261112 WHERE kind = 'funcao_apagada' ORDER BY name LOOP
    IF to_regprocedure('public.' || b.name) IS NOT NULL THEN
      RAISE NOTICE 'Função % já existe: pulada.', b.name;
      CONTINUE;
    END IF;
    EXECUTE b.definition;
    IF b.grants IS NOT NULL THEN
      EXECUTE b.grants;
    END IF;
    RAISE NOTICE 'Função % recriada.', b.name;
  END LOOP;
END $$;

-- 2. Jobs do pg_cron removidos
DO $$
DECLARE
  b record;
  v_jobid bigint;
BEGIN
  IF to_regclass('cron.job') IS NULL THEN
    RAISE NOTICE 'pg_cron não existe: nenhum job a recriar.';
    RETURN;
  END IF;
  FOR b IN SELECT * FROM josi_backup.email_cleanup_20261112 WHERE kind = 'cron' ORDER BY name LOOP
    EXECUTE 'SELECT jobid FROM cron.job WHERE jobname = $1' INTO v_jobid USING b.name;
    IF v_jobid IS NOT NULL THEN
      RAISE NOTICE 'Job % já existe: pulado.', b.name;
      CONTINUE;
    END IF;
    EXECUTE b.definition;
    -- estava inativo? (grants guarda "username=... active=...")
    IF b.grants LIKE '%active=f%' OR b.grants LIKE '%active=false%' THEN
      EXECUTE 'SELECT jobid FROM cron.job WHERE jobname = $1' INTO v_jobid USING b.name;
      EXECUTE 'SELECT cron.alter_job($1, active := false)' USING v_jobid;
    END IF;
    RAISE NOTICE 'Job % recriado.', b.name;
  END LOOP;
END $$;

-- 3. (OPCIONAL, normalmente NÃO) volta o corpo antigo, quebrado, de
--    get_students_for_notification. Para usar, tirar os "--" das linhas abaixo.
-- DO $$
-- DECLARE b record;
-- BEGIN
--   FOR b IN SELECT * FROM josi_backup.email_cleanup_20261112 WHERE kind = 'funcao_corrigida' LOOP
--     EXECUTE b.definition;
--     RAISE NOTICE 'Função % voltou ao corpo antigo.', b.name;
--   END LOOP;
-- END $$;

COMMIT;
