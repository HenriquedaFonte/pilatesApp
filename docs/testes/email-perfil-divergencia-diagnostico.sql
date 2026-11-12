-- Diagnóstico — email do perfil diferente do email de login
--
-- Só leitura. Rodar no Supabase SQL Editor (antes ou depois da migration
-- 20261112060000_lock_student_profile_email.sql).
--
-- Lista quem tem public.profiles.email diferente de auth.users.email (o email
-- com que a pessoa entra no site). Antes da correção, "Meu perfil" mudava só o
-- email de profiles, então um aluno que trocou o email por lá aparece aqui.
--
-- Como corrigir cada linha de ALUNO: perguntar ao aluno qual é o email certo e,
-- na tela do aluno (professora) → Editar perfil, salvar esse email. Isso muda o
-- login e o perfil juntos (Edge Function manage-student).
-- Se o email certo for justamente o que já está no perfil (email_perfil), a tela
-- não vê mudança e não chama a Edge Function. Nesse caso: salvar primeiro um
-- email provisório qualquer (ex.: provisorio-<nome>@example.com) e depois
-- salvar de novo com o email certo.
--
-- Linhas de PROFESSORA (role = 'teacher'): ver a pendência de "Perfil da
-- professora" em docs/PENDENCIAS.md; não mexer por aqui.
--
-- Nenhuma linha = nada a corrigir.

SELECT
  p.id,
  p.role,
  p.full_name,
  p.email   AS email_perfil,
  u.email   AS email_login,
  p.deleted_at IS NOT NULL AS na_lixeira
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE lower(p.email) IS DISTINCT FROM lower(u.email)
ORDER BY p.role, p.full_name;
