-- Migration to remove fixed_class_days and add observations to profiles table

-- Add observations column
ALTER TABLE profiles ADD COLUMN observations TEXT;

-- Remove fixed_class_days column
ALTER TABLE profiles DROP COLUMN fixed_class_days;