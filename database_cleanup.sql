-- =====================================================
-- DATABASE CLEANUP SCRIPT FOR PILATES APP
-- =====================================================
-- This script identifies and removes duplicate/unused database elements
-- Run this carefully after backing up your database!

-- =====================================================
-- STEP 1: IDENTIFY CURRENT TABLES AND FIELDS
-- =====================================================

-- Check all tables in the database
SELECT schemaname, tablename
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Check all columns in all tables
SELECT
    t.table_name,
    c.column_name,
    c.data_type,
    c.is_nullable,
    c.column_default
FROM information_schema.columns c
JOIN information_schema.tables t ON c.table_name = t.table_name
WHERE t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
ORDER BY t.table_name, c.ordinal_position;

-- =====================================================
-- STEP 2: TABLES AND FIELDS CONFIRMED IN USE
-- =====================================================

-- ACTIVE TABLES (confirmed used in application):
-- 1. profiles - User profiles and credits
-- 2. student_class_link - Student-class enrollments
-- 3. class_schedules - Class schedule definitions
-- 4. classes - Class definitions
-- 5. check_ins - Attendance records
-- 6. balance_history - Credit transaction history
-- 7. email_notifications - Email notification logs

-- ACTIVE FIELDS BY TABLE:

-- profiles table (USED fields):
-- ✓ id, email, full_name, role
-- ✓ individual_credits, duo_credits, group_credits
-- ✓ created_at, observations, preferred_language, phone

-- student_class_link table (USED fields):
-- ✓ student_id, class_schedule_id

-- class_schedules table (USED fields):
-- ✓ id, day_of_week, start_time, end_time, class_id

-- classes table (USED fields):
-- ✓ id, name, type

-- check_ins table (USED fields):
-- ✓ id, student_id, schedule_id, status, check_in_date, credit_type

-- balance_history table (USED fields):
-- ✓ id, student_id, type, change_amount, created_at
-- ✓ description, payment_method, amount_paid, new_balance

-- email_notifications table (USED fields):
-- ✓ id, student_id, email_type, recipient_email, subject
-- ✓ status, error_message, credits_at_time, email_provider_id
-- ✓ created_at, updated_at

-- =====================================================
-- STEP 3: IDENTIFY POTENTIALLY UNUSED ELEMENTS
-- =====================================================

-- Find tables that exist but are not in our active list
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
    AND tablename NOT LIKE 'pg_%'  -- Exclude PostgreSQL system tables
    AND tablename NOT LIKE 'supabase_%'  -- Exclude Supabase system tables
ORDER BY tablename;

-- Find columns in active tables that might be unused
-- (This is a manual check - review each table's columns)

-- =====================================================
-- STEP 4: SAFE CLEANUP COMMANDS
-- =====================================================

-- WARNING: Only run these after confirming the elements are truly unused!
-- Always backup your database first!

-- Example cleanup commands (uncomment and modify as needed):

-- Remove unused tables (replace 'unused_table_name' with actual table names):
-- DROP TABLE IF EXISTS unused_table_name CASCADE;

-- Remove unused columns from active tables (replace with actual column names):
-- ALTER TABLE profiles DROP COLUMN IF EXISTS unused_column_name;
-- ALTER TABLE class_schedules DROP COLUMN IF EXISTS unused_column_name;

-- =====================================================
-- STEP 5: VERIFICATION QUERIES
-- =====================================================

-- Verify data integrity after cleanup:

-- Check row counts for all active tables:
SELECT
    'profiles' as table_name, COUNT(*) as row_count FROM profiles
UNION ALL
SELECT
    'student_class_link' as table_name, COUNT(*) as row_count FROM student_class_link
UNION ALL
SELECT
    'class_schedules' as table_name, COUNT(*) as row_count FROM class_schedules
UNION ALL
SELECT
    'classes' as table_name, COUNT(*) as row_count FROM classes
UNION ALL
SELECT
    'check_ins' as table_name, COUNT(*) as row_count FROM check_ins
UNION ALL
SELECT
    'balance_history' as table_name, COUNT(*) as row_count FROM balance_history
UNION ALL
SELECT
    'email_notifications' as table_name, COUNT(*) as row_count FROM email_notifications
ORDER BY table_name;

-- Check for any foreign key constraint issues:
SELECT
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS referenced_table,
    ccu.column_name AS referenced_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
LEFT JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name;

-- =====================================================
-- STEP 6: OPTIMIZATION RECOMMENDATIONS
-- =====================================================

-- After cleanup, consider these optimizations:

-- 1. Rebuild indexes if needed:
-- REINDEX TABLE profiles;
-- REINDEX TABLE check_ins;
-- REINDEX TABLE balance_history;

-- 2. Update table statistics:
-- ANALYZE profiles;
-- ANALYZE check_ins;
-- ANALYZE balance_history;
-- ANALYZE email_notifications;

-- 3. Consider adding indexes for performance (if not already present):
-- CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
-- CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
-- CREATE INDEX IF NOT EXISTS idx_check_ins_student_date ON check_ins(student_id, check_in_date);
-- CREATE INDEX IF NOT EXISTS idx_check_ins_schedule_date ON check_ins(schedule_id, check_in_date);
-- CREATE INDEX IF NOT EXISTS idx_balance_history_student_created ON balance_history(student_id, created_at);
-- CREATE INDEX IF NOT EXISTS idx_email_notifications_student_type ON email_notifications(student_id, email_type);

-- =====================================================
-- END OF CLEANUP SCRIPT
-- =====================================================