-- Fix RLS policies to allow teachers to view and manage student profiles
-- Run this in Supabase Dashboard > SQL Editor

-- Enable RLS (in case it was disabled)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies that might conflict
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Teachers can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Teachers can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Teachers can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Service role can do everything" ON profiles;

-- Create policies for users to access their own profiles
CREATE POLICY "Users can view their own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Create policies for teachers to manage all profiles
-- Use a simpler approach to avoid recursion
CREATE POLICY "Teachers can view all profiles" ON profiles
    FOR SELECT USING (
        auth.uid() IN (
            SELECT id FROM profiles WHERE role = 'teacher'
        )
    );

CREATE POLICY "Teachers can update all profiles" ON profiles
    FOR UPDATE USING (
        auth.uid() IN (
            SELECT id FROM profiles WHERE role = 'teacher'
        )
    );

CREATE POLICY "Teachers can insert profiles" ON profiles
    FOR INSERT WITH CHECK (
        auth.uid() IN (
            SELECT id FROM profiles WHERE role = 'teacher'
        )
    );