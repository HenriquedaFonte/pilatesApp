-- Migration: Refina o escopo do trigger de escalada de privilégio
--
-- PROBLEMA: auth.role() retorna 'authenticated' mesmo dentro de funções
-- SECURITY DEFINER (ex: update_class_balance, mark_attendance), pois lê
-- o GUC da sessão HTTP original. O trigger bloqueava essas operações legítimas.
--
-- SOLUÇÃO: trocar a verificação para current_user = 'authenticated'.
-- Em Supabase:
--   • Chamada REST autenticada direta  → current_user = 'authenticated'  ← BLOQUEAR
--   • Função SECURITY DEFINER (postgres) → current_user = 'postgres'     ← PERMITIR
--   • Chamada service_role             → current_user = 'service_role'   ← PERMITIR
--   • Migration / psql direto          → current_user = 'postgres'       ← PERMITIR
--
-- ROLLBACK: substituir current_user por auth.role() na função abaixo.
CREATE OR REPLACE FUNCTION public.prevent_privilege_escalation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Permite: SECURITY DEFINER functions, service_role, migrações diretas.
  -- Bloqueia apenas: requisições HTTP autenticadas diretas (REST API).
  IF current_user IS DISTINCT FROM 'authenticated' THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'permission denied: role cannot be changed via direct update'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.individual_credits IS DISTINCT FROM OLD.individual_credits
     OR NEW.duo_credits IS DISTINCT FROM OLD.duo_credits
     OR NEW.group_credits IS DISTINCT FROM OLD.group_credits THEN
    RAISE EXCEPTION 'permission denied: credits cannot be changed via direct update'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;
