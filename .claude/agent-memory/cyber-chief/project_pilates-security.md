---
name: pilates-security
description: Security posture and known authz gaps of the Josi Pilates Supabase+React app (audit 2026-06-20)
metadata:
  type: project
---

Josi Pilates is a React+Vite + Supabase studio-management app (teachers manage students, check-ins, credits, payment history with Interac/e-transfer; students see own dashboard). Cyber Chief ran a full security audit on 2026-06-20.

**Why:** Owner requested a global security review before/around production use; sensitive PII + payment data at stake.

**How to apply:** When re-auditing or reviewing security fixes here, verify whether these specific gaps were closed (grep/read current state — do not assume from this snapshot):

Critical findings at audit time:
- Privilege escalation: `profiles` UPDATE policy (`supabase/migrations/20241011044500_add_essential_rls_policies.sql`) does not restrict columns, so a student can self-set `role='teacher'` or grant own credits. Trigger `handle_new_user` copies `role` from client-controlled `raw_user_meta_data`.
- RLS for data tables (`check_ins`, `balance_history`, `student_class_link`, `email_notifications`, `class_schedules`) is NOT in version control — frontend relies on client-side `.eq('student_id', profile.id)` which is not a boundary. Base schema is not versioned (lives only in Supabase dashboard).
- Edge Function `supabase/functions/send-email/index.ts` has zero auth = open email relay from @josipilates.com.

High: `create-user` sets fixed password `000000`; `manage-student` has service-role bypass via `authHeader.includes(serviceRoleKey)`; CORS `*` on all Edge Functions; `.github/workflows/backup.yml` sets `NODE_TLS_REJECT_UNAUTHORIZED='0'`.

Good practices already present: audit_log is append-only with correct RLS; soft-delete; no hardcoded secrets in `src/`; `scratch/` (maintenance scripts using service role key from .env) and `.env` are gitignored; `email_stats` view already fixed to SECURITY INVOKER.

Score given: 4.5/10. See [[pilates-stack]] if created later.
