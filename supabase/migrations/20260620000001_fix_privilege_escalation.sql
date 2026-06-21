-- Migration: Fix privilege escalation vectors in profiles
-- ROLLBACK: See inline comments per statement
-- Production-safe: CREATE OR REPLACE + DROP/CREATE TRIGGER (idempotent)

-- ─── Fix 1: handle_new_user never trusts client-supplied role ─────────────────
-- Before: COALESCE(raw_user_meta_data->>'role', 'student') — caller could pass role='teacher'
-- After: hardcoded 'student' — role assignment is server-side only
-- ROLLBACK: Restore previous version from git history
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id, email, full_name, role,
    individual_credits, duo_credits, group_credits,
    phone, preferred_language, date_of_birth, created_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'student',
    0, 0, 0,
    NEW.raw_user_meta_data->>'phone',
    COALESCE(NEW.raw_user_meta_data->>'preferred_language', 'pt'),
    (NEW.raw_user_meta_data->>'date_of_birth')::DATE,
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── Fix 2: BEFORE UPDATE trigger blocks role/credit escalation ───────────────
-- Any authenticated HTTP request that tries to change role or credits via
-- PATCH /rest/v1/profiles will be rejected with a permission error.
-- Service_role, direct DB connections (migrations, psql) are unaffected.
-- ROLLBACK: DROP TRIGGER enforce_privilege_escalation_guard ON public.profiles;
--           DROP FUNCTION public.prevent_privilege_escalation();
CREATE OR REPLACE FUNCTION public.prevent_privilege_escalation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- auth.role() returns NULL for direct DB access (migrations, psql) and
  -- 'service_role' for service-role key callers — both bypass this guard.
  IF auth.role() IS DISTINCT FROM 'authenticated' THEN
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
