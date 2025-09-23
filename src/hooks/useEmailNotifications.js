import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import emailService from '../lib/emailService';

export const useEmailNotifications = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadStudents = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select(`
          id, 
          full_name, 
          email, 
          individual_credits, 
          duo_credits, 
          group_credits, 
          created_at,
          phone
        `)
        .eq('role', 'student')
        .order('full_name');

      if (fetchError) throw fetchError;

      const studentsWithTotalCredits = (data || []).map(student => ({
        ...student,
        totalCredits: (student.individual_credits || 0) + (student.duo_credits || 0) + (student.group_credits || 0)
      }));

      setStudents(studentsWithTotalCredits);
      return studentsWithTotalCredits;
    } catch (err) {
      setError(err.message);
      console.error('Error loading students:', err);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const getStudentsWithLowCredits = (threshold = 5) => {
    return students.filter(student => student.totalCredits <= threshold);
  };

  const getStudentsWithZeroCredits = () => {
    return students.filter(student => student.totalCredits === 0);
  };

  const sendLowCreditsNotification = async (student) => {
    try {
      const result = await emailService.sendLowCreditsNotification(student, student.totalCredits);
      
      await logEmailSent({
        student_id: student.id,
        email_type: 'low_credits',
        subject: 'Aviso: Saldo Baixo de Créditos',
        status: 'sent'
      });

      return { success: true, result };
    } catch (error) {
      console.error(`Error sending low credits notification to ${student.full_name}:`, error);
      
      await logEmailSent({
        student_id: student.id,
        email_type: 'low_credits',
        subject: 'Aviso: Saldo Baixo de Créditos',
        status: 'failed',
        error_message: error.message
      });

      return { success: false, error: error.message };
    }
  };

  const sendBulkLowCreditsNotifications = async (studentsToNotify) => {
    const results = [];
    
    for (const student of studentsToNotify) {
      const result = await sendLowCreditsNotification(student);
      results.push({
        student: student.full_name,
        email: student.email,
        ...result
      });
      
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    return results;
  };

  const sendCustomEmail = async (students, subject, message, senderName = 'Professora') => {
    try {
      const results = await emailService.sendCustomNotification(students, subject, message, senderName);
      
      for (const student of students) {
        await logEmailSent({
          student_id: student.id,
          email_type: 'custom',
          subject: subject,
          status: 'sent'
        });
      }

      return results;
    } catch (error) {
      console.error('Error sending custom emails:', error);
      throw error;
    }
  };

  const logEmailSent = async (emailData) => {
    try {
      const { error } = await supabase
        .from('email_logs')
        .insert([{
          ...emailData,
          sent_at: new Date().toISOString()
        }]);

      if (error) {
        console.error('Error logging email:', error);
      }
    } catch (error) {
      console.error('Error logging email:', error);
    }
  };

  const checkAndSendAutomaticNotifications = async (threshold = 5) => {
    try {
      const lowCreditsStudents = getStudentsWithLowCredits(threshold);
      
      if (lowCreditsStudents.length === 0) {
        return { message: 'No students with low credits found', count: 0 };
      }

      
      const results = await sendBulkLowCreditsNotifications(lowCreditsStudents);
      const successCount = results.filter(r => r.success).length;
      
      return {
        message: `Sent notifications to ${successCount} students`,
        count: successCount,
        results
      };
    } catch (error) {
      console.error('Error in automatic notifications:', error);
      throw error;
    }
  };

  const filterStudentsByRegistrationDay = (dayOfWeek) => {
    return students.filter(student => {
      const registrationDay = new Date(student.created_at).getDay();
      return registrationDay === parseInt(dayOfWeek);
    });
  };

  const filterStudentsByClass = async (classId) => {
    try {
      const { data, error } = await supabase
        .from('enrollments')
        .select('student_id')
        .eq('class_id', classId);

      if (error) {
        console.error('Error filtering by class:', error);
        return students; 
      }

      const enrolledStudentIds = data.map(enrollment => enrollment.student_id);
      return students.filter(student => enrolledStudentIds.includes(student.id));
    } catch (error) {
      console.error('Error filtering students by class:', error);
      return students;
    }
  };

  useEffect(() => {
    loadStudents();
  }, []);

  return {
    students,
    loading,
    error,
    loadStudents,
    getStudentsWithLowCredits,
    getStudentsWithZeroCredits,
    sendLowCreditsNotification,
    sendBulkLowCreditsNotifications,
    sendCustomEmail,
    checkAndSendAutomaticNotifications,
    filterStudentsByRegistrationDay,
    filterStudentsByClass,
    logEmailSent
  };
};

