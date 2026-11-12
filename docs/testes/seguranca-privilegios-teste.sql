-- Teste — aluno não consegue mudar role/créditos; RPC da professora continua funcionando
--
-- Rodar no Supabase SQL Editor DEPOIS da migration
-- 20261112010000_fix_privilege_escalation_security_invoker.sql.
--
-- Antes de rodar, substituir (Ctrl+H) os dois marcadores por ids reais de profiles:
--   <UUID_ALUNO>      → um aluno (role = 'student')
--   <UUID_PROFESSORA> → a professora (role = 'teacher')
-- Para achar os ids:
--   SELECT id, full_name, role FROM public.profiles ORDER BY role, full_name;
--
-- Tudo roda dentro de uma transação que termina em ROLLBACK: nada fica gravado
-- (nem créditos, nem histórico, nem nome).
-- Resultado:
--   • Sucesso → "Success. No rows returned" (nenhum erro).
--   • Falha   → erro começando com "FALHOU: ..." dizendo o que falhou.

BEGIN;

-- ════════════════════════════════════════════════════════════════════════════
-- 1. Como ALUNO (requisição REST autenticada)
-- ════════════════════════════════════════════════════════════════════════════
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"<UUID_ALUNO>","role":"authenticated"}';

DO $$
DECLARE
  n int;
BEGIN
  BEGIN
    UPDATE public.profiles SET role = 'teacher' WHERE id = auth.uid();
    RAISE EXCEPTION 'FALHOU: aluno conseguiu mudar o próprio role';
  EXCEPTION WHEN insufficient_privilege THEN NULL;  -- esperado
  END;

  BEGIN
    UPDATE public.profiles SET individual_credits = individual_credits + 99 WHERE id = auth.uid();
    RAISE EXCEPTION 'FALHOU: aluno conseguiu mudar individual_credits';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    UPDATE public.profiles SET duo_credits = duo_credits + 99 WHERE id = auth.uid();
    RAISE EXCEPTION 'FALHOU: aluno conseguiu mudar duo_credits';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    UPDATE public.profiles SET group_credits = group_credits + 99 WHERE id = auth.uid();
    RAISE EXCEPTION 'FALHOU: aluno conseguiu mudar group_credits';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- Campos permitidos continuam editáveis (tela "Meu perfil")
  UPDATE public.profiles SET full_name = full_name || ' (teste)', phone = phone
  WHERE id = auth.uid();
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: aluno não conseguiu editar o próprio nome'; END IF;
END $$;

RESET ROLE;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. Como PROFESSORA: RPC update_class_balance continua mexendo em créditos
--    e registrando no histórico
-- ════════════════════════════════════════════════════════════════════════════
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"<UUID_PROFESSORA>","role":"authenticated"}';

DO $$
DECLARE
  antes int;
  depois int;
  hist_antes int;
  hist_depois int;
BEGIN
  SELECT group_credits INTO antes FROM public.profiles WHERE id = '<UUID_ALUNO>';
  SELECT count(*) INTO hist_antes FROM public.balance_history WHERE student_id = '<UUID_ALUNO>';

  PERFORM public.update_class_balance(
    student_uuid         => '<UUID_ALUNO>'::uuid,
    change_amount        => 1,
    description_text     => 'TESTE seguranca (rollback)',
    credit_type_param    => 'group',
    payment_method_param => '',
    amount_paid_param    => NULL
  );

  SELECT group_credits INTO depois FROM public.profiles WHERE id = '<UUID_ALUNO>';
  SELECT count(*) INTO hist_depois FROM public.balance_history WHERE student_id = '<UUID_ALUNO>';

  IF depois IS DISTINCT FROM antes + 1 THEN
    RAISE EXCEPTION 'FALHOU: update_class_balance não somou o crédito (antes=%, depois=%)', antes, depois;
  END IF;
  IF hist_depois <> hist_antes + 1 THEN
    RAISE EXCEPTION 'FALHOU: update_class_balance não gravou no balance_history';
  END IF;

  -- Professora também não muda crédito por UPDATE direto (só pela RPC).
  -- Bloqueio = erro de permissão ou 0 linhas afetadas (depende das policies).
  BEGIN
    UPDATE public.profiles SET group_credits = group_credits + 5 WHERE id = '<UUID_ALUNO>';
    GET DIAGNOSTICS depois = ROW_COUNT;
    IF depois > 0 THEN
      RAISE EXCEPTION 'FALHOU: professora mudou crédito por UPDATE direto (sem histórico)';
    END IF;
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

RESET ROLE;

ROLLBACK;
