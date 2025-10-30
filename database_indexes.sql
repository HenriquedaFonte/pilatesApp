-- Database indexes for better performance
-- Add event date to attendance report function

-- Create or replace the get_attendance_report function with event date
CREATE OR REPLACE FUNCTION get_attendance_report(
    start_date DATE,
    end_date DATE,
    student_id_filter UUID DEFAULT NULL
)
RETURNS TABLE (
    student_id UUID,
    student_name TEXT,
    student_email TEXT,
    individual_credits INTEGER,
    duo_credits INTEGER,
    group_credits INTEGER,
    total_credits INTEGER,
    days_present INTEGER,
    days_absent_unjustified INTEGER,
    days_absent_justified INTEGER,
    total_classes INTEGER,
    attendance_percentage NUMERIC,
    credits_lost INTEGER,
    event_date DATE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id as student_id,
        p.full_name as student_name,
        p.email as student_email,
        COALESCE(p.individual_credits, 0) as individual_credits,
        COALESCE(p.duo_credits, 0) as duo_credits,
        COALESCE(p.group_credits, 0) as group_credits,
        (COALESCE(p.individual_credits, 0) + COALESCE(p.duo_credits, 0) + COALESCE(p.group_credits, 0)) as total_credits,

        -- Attendance calculations
        COUNT(CASE WHEN ci.status = 'present' THEN 1 END) as days_present,
        COUNT(CASE WHEN ci.status = 'absent_unjustified' THEN 1 END) as days_absent_unjustified,
        COUNT(CASE WHEN ci.status = 'absent_justified' THEN 1 END) as days_absent_justified,
        COUNT(ci.id) as total_classes,

        -- Attendance percentage
        CASE
            WHEN COUNT(ci.id) > 0 THEN
                ROUND((COUNT(CASE WHEN ci.status = 'present' THEN 1 END)::NUMERIC / COUNT(ci.id)::NUMERIC) * 100, 1)
            ELSE 0
        END as attendance_percentage,

        -- Credits lost (unjustified absences)
        COUNT(CASE WHEN ci.status = 'absent_unjustified' THEN 1 END) as credits_lost,

        -- Event date (most recent class date in the period, or NULL if no classes)
        CASE
            WHEN COUNT(ci.id) > 0 THEN MAX(ci.check_in_date)
            ELSE NULL
        END as event_date

    FROM profiles p
    LEFT JOIN check_ins ci ON p.id = ci.student_id
        AND ci.check_in_date >= start_date
        AND ci.check_in_date <= end_date
    WHERE p.role = 'student'
        AND (student_id_filter IS NULL OR p.id = student_id_filter)
    GROUP BY p.id, p.full_name, p.email, p.individual_credits, p.duo_credits, p.group_credits
    ORDER BY p.full_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_attendance_report TO authenticated;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_check_ins_student_id ON check_ins(student_id);
CREATE INDEX IF NOT EXISTS idx_check_ins_date ON check_ins(check_in_date);
CREATE INDEX IF NOT EXISTS idx_check_ins_status ON check_ins(status);
CREATE INDEX IF NOT EXISTS idx_class_history_student_id ON class_history(student_id);
CREATE INDEX IF NOT EXISTS idx_class_history_date ON class_history(date);