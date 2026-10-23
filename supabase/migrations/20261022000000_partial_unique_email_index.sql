-- Substitui a constraint de email único global por um partial unique index
-- que só aplica para perfis NÃO deletados (deleted_at IS NULL).
--
-- Isso resolve o bug em que perfis na lixeira (soft-deleted) bloqueavam
-- a atualização de email de outros perfis via profiles_email_key.

-- Remove a constraint existente (criada implicitamente como unique index)
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_email_key;

-- Cria partial unique index: email único apenas entre perfis ativos
CREATE UNIQUE INDEX profiles_email_active_unique
  ON profiles (email)
  WHERE deleted_at IS NULL;
