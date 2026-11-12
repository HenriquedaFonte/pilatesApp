-- Migration: corrige o guarda de escalada de privilégio em profiles
--
-- PROBLEMA (falha de segurança):
--   public.prevent_privilege_escalation() foi criada como SECURITY DEFINER
--   (migrations 20260620000001 e 20260620000003). Numa função SECURITY DEFINER
--   o current_user é sempre o dono da função (postgres), então o teste
--     IF current_user IS DISTINCT FROM 'authenticated' THEN RETURN NEW;
--   sempre libera. Resultado: um aluno logado consegue, pela REST API,
--     UPDATE profiles SET role = 'teacher', individual_credits = 99
--   na própria linha (a policy "Users can update their own profile" permite).
--
-- CORREÇÃO:
--   Mesma lógica, mas SECURITY INVOKER: o current_user passa a ser o papel
--   que fez o UPDATE.
--     • REST autenticada direta (aluno ou professora) → 'authenticated' → BLOQUEIA role/créditos
--     • REST anônima                                   → 'anon'          → BLOQUEIA role/créditos
--     • RPC SECURITY DEFINER (update_class_balance,
--       mark_attendance, ... com dono postgres)        → 'postgres'      → LIBERA
--     • Edge Function com service_role                 → 'service_role'  → LIBERA
--     • SQL Editor / migrations / psql                 → 'postgres'      → LIBERA
--   A função só lê NEW, OLD e current_user (não consulta tabela nem auth.*),
--   então rodar como o chamador não depende de RLS nem de permissões extras.
--   'anon' foi incluído por defesa em profundidade (hoje a RLS já impede o
--   anon de atualizar profiles, porque auth.uid() é NULL).
--   search_path fixo para a função não depender do search_path do chamador.
--
-- O trigger é recriado para garantir que exista e esteja ativo.
--
-- Idempotente: CREATE OR REPLACE FUNCTION + DROP TRIGGER IF EXISTS / CREATE TRIGGER.
-- Não altera nem apaga dados.
--
-- ROLLBACK (reabre a falha; só use se a correção quebrar algo crítico e
-- corrija em seguida): rodar de novo o conteúdo de
-- supabase/migrations/20260620000003_fix_security_trigger_scope.sql
-- (volta a função para SECURITY DEFINER com a lógica antiga).

CREATE OR REPLACE FUNCTION public.prevent_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  -- Libera: RPCs SECURITY DEFINER, service_role, migrations e SQL direto.
  -- Bloqueia: requisições REST diretas (papéis authenticated e anon).
  IF current_user NOT IN ('authenticated', 'anon') THEN
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

DROP TRIGGER IF EXISTS enforce_privilege_escalation_guard ON public.profiles;
CREATE TRIGGER enforce_privilege_escalation_guard
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_privilege_escalation();
