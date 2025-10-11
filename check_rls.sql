-- Check current RLS status and policies for profiles table
-- Run this in Supabase Dashboard > SQL Editor

-- Check if RLS is enabled
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'profiles' AND schemaname = 'public';

-- Check existing policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'profiles' AND schemaname = 'public';