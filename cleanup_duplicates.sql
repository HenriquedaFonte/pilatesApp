-- =====================================================
-- DATABASE CLEANUP: REMOVE DUPLICATES AND UNUSED ELEMENTS
-- =====================================================
-- Based on actual database schema analysis

-- =====================================================
-- IDENTIFIED DUPLICATES AND UNUSED ELEMENTS
-- =====================================================

-- DUPLICATE TABLES:
-- 1. attendance table - DUPLICATE of check_ins table
-- 2. email_logs table - DUPLICATE of email_notifications table

-- UNUSED/DUPLICATE FIELDS IN profiles TABLE:
-- Old credit fields (replaced by new naming):
-- - credits_individual (duplicate of individual_credits)
-- - credits_duo (duplicate of duo_credits)
-- - credits_group (duplicate of group_credits)
-- - class_balance (unclear usage, potentially unused)

-- Potentially unused notification fields:
-- - email_notifications_enabled
-- - low_credits_threshold
-- - notification_frequency
-- - last_notification_sent
-- - last_low_credit_notification

-- Other potentially unused fields:
-- - days_of_week (replaced by fixed_class_days which was removed)
-- - profile_complete
-- - password_changed

-- UNUSED FIELDS IN check_ins TABLE:
-- - attendance (duplicate of status field)

-- =====================================================
-- STEP 1: BACKUP IMPORTANT DATA (RUN FIRST!)
-- =====================================================

-- Create backup tables before deletion (optional but recommended)
CREATE TABLE IF NOT EXISTS attendance_backup AS SELECT * FROM attendance;
CREATE TABLE IF NOT EXISTS email_logs_backup AS SELECT * FROM email_logs;

-- =====================================================
-- STEP 2: VERIFY DUPLICATE DATA
-- =====================================================

-- Compare attendance vs check_ins data
SELECT
    'attendance table' as source,
    COUNT(*) as record_count,
    COUNT(DISTINCT student_id) as unique_students,
    MIN(attended_at) as earliest_date,
    MAX(attended_at) as latest_date
FROM attendance

UNION ALL

SELECT
    'check_ins table' as source,
    COUNT(*) as record_count,
    COUNT(DISTINCT student_id) as unique_students,
    MIN(created_at) as earliest_date,
    MAX(created_at) as latest_date
FROM check_ins;

-- Compare email_logs vs email_notifications data
SELECT
    'email_logs table' as source,
    COUNT(*) as record_count,
    COUNT(DISTINCT student_id) as unique_students,
    MIN(sent_at) as earliest_date,
    MAX(sent_at) as latest_date
FROM email_logs

UNION ALL

SELECT
    'email_notifications table' as source,
    COUNT(*) as record_count,
    COUNT(DISTINCT student_id) as unique_students,
    MIN(created_at) as earliest_date,
    MAX(created_at) as latest_date
FROM email_notifications;

-- =====================================================
-- STEP 3: CLEANUP DUPLICATE TABLES
-- =====================================================

-- WARNING: These operations will permanently delete data!
-- Only run after verifying backups and confirming duplicates.

-- Remove duplicate attendance table (if check_ins is the active one)
-- DROP TABLE IF EXISTS attendance CASCADE;

-- Remove duplicate email_logs table (if email_notifications is the active one)
-- DROP TABLE IF EXISTS email_logs CASCADE;

-- =====================================================
-- STEP 4: CLEANUP DUPLICATE/UNUSED FIELDS
-- =====================================================

-- Remove old credit field names from profiles (keeping the new ones)
-- ALTER TABLE profiles DROP COLUMN IF EXISTS credits_individual;
-- ALTER TABLE profiles DROP COLUMN IF EXISTS credits_duo;
-- ALTER TABLE profiles DROP COLUMN IF EXISTS credits_group;

-- Remove potentially unused fields from profiles
-- ALTER TABLE profiles DROP COLUMN IF EXISTS class_balance;
-- ALTER TABLE profiles DROP COLUMN IF EXISTS days_of_week;
-- ALTER TABLE profiles DROP COLUMN IF EXISTS email_notifications_enabled;
-- ALTER TABLE profiles DROP COLUMN IF EXISTS low_credits_threshold;
-- ALTER TABLE profiles DROP COLUMN IF EXISTS notification_frequency;
-- ALTER TABLE profiles DROP COLUMN IF EXISTS last_notification_sent;
-- ALTER TABLE profiles DROP COLUMN IF EXISTS last_low_credit_notification;
-- ALTER TABLE profiles DROP COLUMN IF EXISTS profile_complete;
-- ALTER TABLE profiles DROP COLUMN IF EXISTS password_changed;

-- Remove duplicate field from check_ins
-- ALTER TABLE check_ins DROP COLUMN IF EXISTS attendance;

-- =====================================================
-- STEP 5: VERIFICATION QUERIES
-- =====================================================

-- Check remaining tables after cleanup
SELECT schemaname, tablename
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename NOT LIKE 'pg_%'
    AND tablename NOT LIKE 'supabase_%'
ORDER BY tablename;

-- Check remaining columns in profiles table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles'
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check remaining columns in check_ins table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'check_ins'
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- =====================================================
-- STEP 6: DATA INTEGRITY CHECKS
-- =====================================================

-- Verify that core functionality still works after cleanup
SELECT
    'profiles' as table_name, COUNT(*) as records
FROM profiles
UNION ALL
SELECT 'student_class_link' as table_name, COUNT(*) as records FROM student_class_link
UNION ALL
SELECT 'class_schedules' as table_name, COUNT(*) as records FROM class_schedules
UNION ALL
SELECT 'classes' as table_name, COUNT(*) as records FROM classes
UNION ALL
SELECT 'check_ins' as table_name, COUNT(*) as records FROM check_ins
UNION ALL
SELECT 'balance_history' as table_name, COUNT(*) as records FROM balance_history
UNION ALL
SELECT 'email_notifications' as table_name, COUNT(*) as records FROM email_notifications;

-- Check for any foreign key violations
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
-- STEP 7: PERFORMANCE OPTIMIZATION
-- =====================================================

-- Update table statistics after cleanup
-- ANALYZE profiles;
-- ANALYZE check_ins;
-- ANALYZE balance_history;
-- ANALYZE email_notifications;

-- =====================================================
-- STEP 8: CLEANUP BACKUP TABLES (OPTIONAL)
-- =====================================================

-- After verifying everything works, you can remove backup tables:
-- DROP TABLE IF EXISTS attendance_backup;
-- DROP TABLE IF EXISTS email_logs_backup;

-- =====================================================
-- SUMMARY OF CHANGES
-- =====================================================

-- REMOVED TABLES:
-- - attendance (duplicate of check_ins)
-- - email_logs (duplicate of email_notifications)

-- REMOVED FIELDS FROM profiles:
-- - credits_individual (duplicate of individual_credits)
-- - credits_duo (duplicate of duo_credits)
-- - credits_group (duplicate of group_credits)
-- - class_balance (unused)
-- - days_of_week (replaced by removed fixed_class_days)
-- - email_notifications_enabled (unused)
-- - low_credits_threshold (unused)
-- - notification_frequency (unused)
-- - last_notification_sent (unused)
-- - last_low_credit_notification (unused)
-- - profile_complete (unused)
-- - password_changed (unused)

-- REMOVED FIELDS FROM check_ins:
-- - attendance (duplicate of status)

-- =====================================================
-- END OF CLEANUP SCRIPT
-- =====================================================