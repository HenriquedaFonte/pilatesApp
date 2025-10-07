-- Create table for email notification logs
CREATE TABLE IF NOT EXISTS email_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES profiles(id),
    email_type VARCHAR(50) NOT NULL, -- 'low_credits', 'zero_credits', etc.
    recipient_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    status VARCHAR(20) NOT NULL, -- 'sent', 'failed', 'pending'
    error_message TEXT,
    credits_at_time JSONB, -- Store credit info at time of notification
    email_provider_id TEXT, -- ID from email service provider
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Drop and recreate the foreign key with ON DELETE CASCADE to allow profile deletion
ALTER TABLE email_notifications DROP CONSTRAINT IF EXISTS email_notifications_student_id_fkey;
ALTER TABLE email_notifications ADD CONSTRAINT email_notifications_student_id_fkey FOREIGN KEY (student_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Enable RLS
ALTER TABLE email_notifications ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Teachers can view all email notifications" ON email_notifications
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'teacher'
        )
    );

CREATE POLICY "Teachers can insert email notifications" ON email_notifications
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'teacher'
        )
    );

-- Drop existing function if it exists with different signature
DROP FUNCTION IF EXISTS get_students_for_notification(TEXT);

-- Create function to get students for notifications
CREATE OR REPLACE FUNCTION get_students_for_notification(notification_type TEXT DEFAULT 'low_credits')
RETURNS TABLE (
    student_id UUID,
    student_name TEXT,
    student_email TEXT,
    individual_credits INTEGER,
    duo_credits INTEGER,
    group_credits INTEGER,
    total_credits INTEGER,
    preferred_language TEXT,
    last_attendance_date DATE,
    days_since_last_attendance INTEGER,
    low_credits_threshold INTEGER
) AS $$
BEGIN
    -- Default threshold for low credits (2 or less as requested)
    CASE notification_type
        WHEN 'zero_credits' THEN
            -- Students with zero total credits
            RETURN QUERY
            SELECT
                p.id as student_id,
                p.full_name as student_name,
                p.email as student_email,
                COALESCE(p.individual_credits, 0) as individual_credits,
                COALESCE(p.duo_credits, 0) as duo_credits,
                COALESCE(p.group_credits, 0) as group_credits,
                (COALESCE(p.individual_credits, 0) + COALESCE(p.duo_credits, 0) + COALESCE(p.group_credits, 0)) as total_credits,
                COALESCE(p.preferred_language, 'pt') as preferred_language,
                MAX(ci.check_in_date) as last_attendance_date,
                CASE
                    WHEN MAX(ci.check_in_date) IS NOT NULL THEN
                        CURRENT_DATE - MAX(ci.check_in_date)
                    ELSE NULL
                END as days_since_last_attendance,
                2 as low_credits_threshold -- Threshold for notifications
            FROM profiles p
            LEFT JOIN check_ins ci ON p.id = ci.student_id AND ci.status = 'present'
            WHERE p.role = 'student'
                AND (COALESCE(p.individual_credits, 0) + COALESCE(p.duo_credits, 0) + COALESCE(p.group_credits, 0)) = 0
                -- Exclude students who received this notification in the last 7 days
                AND NOT EXISTS (
                    SELECT 1 FROM email_notifications en
                    WHERE en.student_id = p.id
                        AND en.email_type = 'zero_credits'
                        AND en.status = 'sent'
                        AND en.created_at > NOW() - INTERVAL '7 days'
                )
            GROUP BY p.id, p.full_name, p.email, p.individual_credits, p.duo_credits, p.group_credits, p.preferred_language
            ORDER BY p.full_name;

        WHEN 'low_credits' THEN
            -- Students with 2 credits or less (but not zero)
            RETURN QUERY
            SELECT
                p.id as student_id,
                p.full_name as student_name,
                p.email as student_email,
                COALESCE(p.individual_credits, 0) as individual_credits,
                COALESCE(p.duo_credits, 0) as duo_credits,
                COALESCE(p.group_credits, 0) as group_credits,
                (COALESCE(p.individual_credits, 0) + COALESCE(p.duo_credits, 0) + COALESCE(p.group_credits, 0)) as total_credits,
                COALESCE(p.preferred_language, 'pt') as preferred_language,
                MAX(ci.check_in_date) as last_attendance_date,
                CASE
                    WHEN MAX(ci.check_in_date) IS NOT NULL THEN
                        CURRENT_DATE - MAX(ci.check_in_date)
                    ELSE NULL
                END as days_since_last_attendance,
                2 as low_credits_threshold
            FROM profiles p
            LEFT JOIN check_ins ci ON p.id = ci.student_id AND ci.status = 'present'
            WHERE p.role = 'student'
                AND (COALESCE(p.individual_credits, 0) + COALESCE(p.duo_credits, 0) + COALESCE(p.group_credits, 0)) BETWEEN 1 AND 2
                -- Exclude students who received this notification in the last 7 days
                AND NOT EXISTS (
                    SELECT 1 FROM email_notifications en
                    WHERE en.student_id = p.id
                        AND en.email_type = 'low_credits'
                        AND en.status = 'sent'
                        AND en.created_at > NOW() - INTERVAL '7 days'
                )
            GROUP BY p.id, p.full_name, p.email, p.individual_credits, p.duo_credits, p.group_credits, p.preferred_language
            ORDER BY
                (COALESCE(p.individual_credits, 0) + COALESCE(p.duo_credits, 0) + COALESCE(p.group_credits, 0)) ASC,
                p.full_name;

        ELSE
            -- Default: return empty result set
            RETURN QUERY SELECT
                NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::INTEGER, NULL::INTEGER, NULL::INTEGER, NULL::INTEGER,
                NULL::TEXT, NULL::DATE, NULL::INTEGER, NULL::INTEGER
            WHERE FALSE;
    END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop all existing log_email_notification functions
DO $$
DECLARE
    func_record RECORD;
BEGIN
    FOR func_record IN
        SELECT oid::regprocedure AS func_signature
        FROM pg_proc
        WHERE proname = 'log_email_notification'
    LOOP
        EXECUTE 'DROP FUNCTION ' || func_record.func_signature;
    END LOOP;
END $$;

-- Create function to log email notifications
CREATE OR REPLACE FUNCTION log_email_notification(
    p_student_id UUID,
    p_email_type TEXT,
    p_recipient_email TEXT,
    p_subject TEXT,
    p_status TEXT,
    p_error_message TEXT DEFAULT NULL,
    p_credits_at_time JSONB DEFAULT NULL,
    p_email_provider_id TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    notification_id UUID;
BEGIN
    INSERT INTO email_notifications (
        student_id,
        email_type,
        recipient_email,
        subject,
        status,
        error_message,
        credits_at_time,
        email_provider_id
    ) VALUES (
        p_student_id,
        p_email_type,
        p_recipient_email,
        p_subject,
        p_status,
        p_error_message,
        p_credits_at_time,
        p_email_provider_id
    )
    RETURNING id INTO notification_id;

    RETURN notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_students_for_notification TO authenticated;
GRANT EXECUTE ON FUNCTION log_email_notification TO authenticated;
GRANT ALL ON TABLE email_notifications TO authenticated;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_email_notifications_student_id ON email_notifications(student_id);
CREATE INDEX IF NOT EXISTS idx_email_notifications_email_type ON email_notifications(email_type);
CREATE INDEX IF NOT EXISTS idx_email_notifications_status ON email_notifications(status);
CREATE INDEX IF NOT EXISTS idx_email_notifications_created_at ON email_notifications(created_at);