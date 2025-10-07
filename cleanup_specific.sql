-- =====================================================
-- SPECIFIC DATABASE CLEANUP FOR PILATES APP
-- =====================================================
-- This script addresses specific cleanup items identified in the codebase

-- =====================================================
-- 1. REMOVE FIXED_CLASS_DAYS FIELD (ALREADY DONE IN migration.sql)
-- =====================================================

-- This was already handled in migration.sql:
-- ALTER TABLE profiles DROP COLUMN IF EXISTS fixed_class_days;

-- Verify the column is gone:
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'profiles'
    AND table_schema = 'public'
    AND column_name = 'fixed_class_days';

-- =====================================================
-- 2. CHECK FOR OTHER POTENTIALLY UNUSED FIELDS
-- =====================================================

-- Check all columns in profiles table:
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'profiles'
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check all columns in class_schedules table:
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'class_schedules'
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check all columns in classes table:
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'classes'
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- =====================================================
-- 3. IDENTIFY UNUSED TABLES
-- =====================================================

-- Find any tables that exist but are not used by the application:
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename NOT IN (
        'profiles',
        'student_class_link',
        'class_schedules',
        'classes',
        'check_ins',
        'balance_history',
        'email_notifications'
    )
    AND tablename NOT LIKE 'pg_%'
    AND tablename NOT LIKE 'supabase_%'
    AND tablename NOT LIKE 'auth.%'
ORDER BY tablename;

-- =====================================================
-- 4. CLEANUP UNUSED ELEMENTS
-- =====================================================

-- WARNING: Only run these commands after verifying the elements are truly unused!

-- Remove any unused tables found above:
-- DROP TABLE IF EXISTS unused_table_name CASCADE;

-- Example: If you find tables like 'old_students' or 'temp_data', remove them:
-- DROP TABLE IF EXISTS old_students CASCADE;
-- DROP TABLE IF EXISTS temp_data CASCADE;

-- =====================================================
-- 5. VERIFY DATA INTEGRITY
-- =====================================================

-- Check that all required tables exist and have data:
SELECT
    'profiles' as table_name,
    COUNT(*) as record_count,
    (SELECT COUNT(*) FROM information_schema.columns
     WHERE table_name = 'profiles' AND table_schema = 'public') as column_count
FROM profiles

UNION ALL

SELECT
    'student_class_link' as table_name,
    COUNT(*) as record_count,
    (SELECT COUNT(*) FROM information_schema.columns
     WHERE table_name = 'student_class_link' AND table_schema = 'public') as column_count
FROM student_class_link

UNION ALL

SELECT
    'class_schedules' as table_name,
    COUNT(*) as record_count,
    (SELECT COUNT(*) FROM information_schema.columns
     WHERE table_name = 'class_schedules' AND table_schema = 'public') as column_count
FROM class_schedules

UNION ALL

SELECT
    'classes' as table_name,
    COUNT(*) as record_count,
    (SELECT COUNT(*) FROM information_schema.columns
     WHERE table_name = 'classes' AND table_schema = 'public') as column_count
FROM classes

UNION ALL

SELECT
    'check_ins' as table_name,
    COUNT(*) as record_count,
    (SELECT COUNT(*) FROM information_schema.columns
     WHERE table_name = 'check_ins' AND table_schema = 'public') as column_count
FROM check_ins

UNION ALL

SELECT
    'balance_history' as table_name,
    COUNT(*) as record_count,
    (SELECT COUNT(*) FROM information_schema.columns
     WHERE table_name = 'balance_history' AND table_schema = 'public') as column_count
FROM balance_history

UNION ALL

SELECT
    'email_notifications' as table_name,
    COUNT(*) as record_count,
    (SELECT COUNT(*) FROM information_schema.columns
     WHERE table_name = 'email_notifications' AND table_schema = 'public') as column_count
FROM email_notifications;

-- =====================================================
-- 6. PERFORMANCE OPTIMIZATION
-- =====================================================

-- Ensure indexes exist for optimal performance:

-- Profiles table indexes:
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_full_name ON profiles(full_name);

-- Check-ins table indexes:
CREATE INDEX IF NOT EXISTS idx_check_ins_student_id ON check_ins(student_id);
CREATE INDEX IF NOT EXISTS idx_check_ins_schedule_id ON check_ins(schedule_id);
CREATE INDEX IF NOT EXISTS idx_check_ins_check_in_date ON check_ins(check_in_date);
CREATE INDEX IF NOT EXISTS idx_check_ins_student_date ON check_ins(student_id, check_in_date);

-- Balance history indexes:
CREATE INDEX IF NOT EXISTS idx_balance_history_student_id ON balance_history(student_id);
CREATE INDEX IF NOT EXISTS idx_balance_history_created_at ON balance_history(created_at);
CREATE INDEX IF NOT EXISTS idx_balance_history_student_created ON balance_history(student_id, created_at);

-- Email notifications indexes:
CREATE INDEX IF NOT EXISTS idx_email_notifications_student_id ON email_notifications(student_id);
CREATE INDEX IF NOT EXISTS idx_email_notifications_email_type ON email_notifications(email_type);
CREATE INDEX IF NOT EXISTS idx_email_notifications_created_at ON email_notifications(created_at);

-- Student class link indexes:
CREATE INDEX IF NOT EXISTS idx_student_class_link_student_id ON student_class_link(student_id);
CREATE INDEX IF NOT EXISTS idx_student_class_link_schedule_id ON student_class_link(class_schedule_id);

-- Class schedules indexes:
CREATE INDEX IF NOT EXISTS idx_class_schedules_day_of_week ON class_schedules(day_of_week);
CREATE INDEX IF NOT EXISTS idx_class_schedules_class_id ON class_schedules(class_id);

-- =====================================================
-- 7. FINAL VERIFICATION
-- =====================================================

-- Run this after cleanup to ensure everything still works:
-- ANALYZE; -- Update table statistics

-- Check for any orphaned records or constraint violations:
SELECT 'Check for orphaned student_class_link records:' as check_type;
SELECT COUNT(*) as orphaned_count
FROM student_class_link scl
LEFT JOIN profiles p ON scl.student_id = p.id
LEFT JOIN class_schedules cs ON scl.class_schedule_id = cs.id
WHERE p.id IS NULL OR cs.id IS NULL;

SELECT 'Check for orphaned check_ins records:' as check_type;
SELECT COUNT(*) as orphaned_count
FROM check_ins ci
LEFT JOIN profiles p ON ci.student_id = p.id
LEFT JOIN class_schedules cs ON ci.schedule_id = cs.id
WHERE p.id IS NULL OR cs.id IS NULL;

SELECT 'Check for orphaned balance_history records:' as check_type;
SELECT COUNT(*) as orphaned_count
FROM balance_history bh
LEFT JOIN profiles p ON bh.student_id = p.id
WHERE p.id IS NULL;

-- =====================================================
-- END OF SPECIFIC CLEANUP SCRIPT
-- =====================================================