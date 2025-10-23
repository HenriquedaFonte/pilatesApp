-- Database performance optimization indexes
-- Run these in your Supabase SQL editor

-- Profiles table indexes
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON profiles(created_at);

-- Class history indexes
CREATE INDEX IF NOT EXISTS idx_class_history_student_id ON class_history(student_id);
CREATE INDEX IF NOT EXISTS idx_class_history_date ON class_history(date);
CREATE INDEX IF NOT EXISTS idx_class_history_class_type ON class_history(class_type);

-- Classes table indexes
CREATE INDEX IF NOT EXISTS idx_classes_date ON classes(date);
CREATE INDEX IF NOT EXISTS idx_classes_teacher_id ON classes(teacher_id);

-- Notifications indexes
CREATE INDEX IF NOT EXISTS idx_notifications_student_id ON notifications(student_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

-- Credit transactions indexes
CREATE INDEX IF NOT EXISTS idx_credit_transactions_student_id ON credit_transactions(student_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_date ON credit_transactions(date);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_type ON credit_transactions(type);