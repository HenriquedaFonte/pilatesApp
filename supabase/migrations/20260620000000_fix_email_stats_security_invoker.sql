-- Fix: remove SECURITY DEFINER da view email_stats
--
-- Views com SECURITY DEFINER executam com as permissões do criador da view,
-- ignorando as políticas RLS do usuário que faz a consulta.
-- Com SECURITY INVOKER (padrão correto), a view respeita o contexto do usuário.
ALTER VIEW public.email_stats SET (security_invoker = true);
