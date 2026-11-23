-- Reversão — modalidade online e pagamentos online
-- (migration 20261123000000_create_online_memberships.sql)
--
-- Só para emergência. ANTES: fazer o Revert dos PRs de tela que usam estas
-- tabelas (ficha do aluno, lista, painel, cadastro, relatório), senão o site
-- passa a dar erro ao ler tabelas que não existem.
--
-- Pagamento online é dado financeiro: este script se RECUSA a rodar se
-- existir qualquer pagamento online (válido ou anulado). Para apagar mesmo
-- assim (por exemplo, só havia lançamentos de teste), trocar v_forcar para
-- true na linha marcada logo abaixo — e, antes, guardar uma cópia
-- (Table Editor → online_payments → Export to CSV, ou o backup do GitHub).
--
-- Remove: as RPCs request_online_plan, set_online_membership,
-- register_online_payment, void_online_payment; as tabelas online_payments e
-- online_memberships (com as policies, índices e triggers delas) e a função de
-- guarda online_payments_guard(). Não mexe em profiles, balance_history,
-- audit_log (as linhas online_* do audit_log ficam), is_staff() nem
-- update_updated_at_column() (usada por outras tabelas).
--
-- Rodar no Supabase SQL Editor de uma vez. Está dentro de BEGIN/COMMIT: se
-- algo falhar, nada é aplicado. Pode rodar de novo (IF EXISTS).

BEGIN;

DO $$
DECLARE
  v_forcar boolean := false;   -- ← trocar para true só para apagar pagamentos existentes
  n bigint;
BEGIN
  IF to_regclass('public.online_payments') IS NOT NULL THEN
    -- Como dono, a RLS não filtra: conta todos os pagamentos.
    EXECUTE 'SELECT count(*) FROM public.online_payments' INTO n;
    IF n > 0 AND NOT v_forcar THEN
      RAISE EXCEPTION 'Existem % pagamentos online. São dados financeiros: a reversão não os apaga (trocar v_forcar para true no topo, depois de guardar uma cópia). Nada foi aplicado.', n;
    END IF;
    IF n > 0 THEN
      RAISE NOTICE 'v_forcar = true: % pagamentos online serão apagados.', n;
    END IF;
  END IF;

  IF to_regclass('public.online_memberships') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.online_memberships' INTO n;
    IF n > 0 THEN
      RAISE NOTICE '% modalidades online (pedidos/ativas/encerradas) serão apagadas.', n;
    END IF;
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.request_online_plan(text);
DROP FUNCTION IF EXISTS public.set_online_membership(uuid, text, text);
DROP FUNCTION IF EXISTS public.register_online_payment(uuid, text, text, date, date, date, numeric, text, date);
DROP FUNCTION IF EXISTS public.void_online_payment(uuid, text);

-- DROP TABLE leva junto policies, índices e triggers (e não dispara a guarda).
DROP TABLE IF EXISTS public.online_payments;
DROP TABLE IF EXISTS public.online_memberships;
DROP FUNCTION IF EXISTS public.online_payments_guard();

COMMIT;

-- Conferência (deve devolver só nulos):
--   SELECT to_regclass('public.online_payments'), to_regclass('public.online_memberships'),
--          to_regprocedure('public.request_online_plan(text)'),
--          to_regprocedure('public.set_online_membership(uuid,text,text)'),
--          to_regprocedure('public.register_online_payment(uuid,text,text,date,date,date,numeric,text,date)'),
--          to_regprocedure('public.void_online_payment(uuid,text)'),
--          to_regprocedure('public.online_payments_guard()');
