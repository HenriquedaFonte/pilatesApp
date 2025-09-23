import { supabase } from '../lib/supabase';
import emailService from '../lib/emailService';

class EmailScheduler {
  constructor() {
    this.isRunning = false;
    this.timeoutId = null;
    this.defaultThreshold = 2; // Changed to 2 credits as requested
  }

  // Start the automatic email scheduler - runs every Monday at 10 AM
  start(threshold = this.defaultThreshold) {
    if (this.isRunning) {
      console.log('Email scheduler is already running');
      return;
    }

    this.isRunning = true;
    this.threshold = threshold;

    console.log(`Starting email scheduler - will check every Monday at 10 AM for students with <= ${threshold} credits`);

    // Schedule the first run
    this.scheduleNextRun();
  }

  // Stop the automatic email scheduler
  stop() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    this.isRunning = false;
    console.log('Email scheduler stopped');
  }

  // Schedule the next run for Monday at 10 AM
  scheduleNextRun() {
    const now = new Date();
    const nextMonday = new Date(now);

    // Find next Monday
    const daysUntilMonday = (1 - now.getDay() + 7) % 7; // 1 = Monday
    if (daysUntilMonday === 0 && now.getHours() >= 10) {
      // If it's Monday and past 10 AM, schedule for next Monday
      nextMonday.setDate(now.getDate() + 7);
    } else if (daysUntilMonday === 0) {
      // It's Monday but before 10 AM, schedule for today
      nextMonday.setDate(now.getDate());
    } else {
      // Schedule for upcoming Monday
      nextMonday.setDate(now.getDate() + daysUntilMonday);
    }

    // Set time to 10:00 AM
    nextMonday.setHours(10, 0, 0, 0);

    const timeUntilNextRun = nextMonday.getTime() - now.getTime();

    console.log(`Next email check scheduled for: ${nextMonday.toLocaleString()}`);

    this.timeoutId = setTimeout(() => {
      this.checkAndSendNotifications(this.threshold);
      // Schedule the next run after completion
      this.scheduleNextRun();
    }, timeUntilNextRun);
  }

  // Check for students with low credits and send notifications
  async checkAndSendNotifications(threshold = this.defaultThreshold) {
    try {
      console.log(`Checking for students with <= ${threshold} credits...`);
      
      // Get students with low credits
      const { data: students, error } = await supabase
        .from('profiles')
        .select(`
          id, 
          full_name, 
          email, 
          individual_credits, 
          duo_credits, 
          group_credits,
          last_low_credit_notification
        `)
        .eq('role', 'student');

      if (error) {
        console.error('Error fetching students:', error);
        return;
      }

      // Calculate total credits and filter low credit students
      const lowCreditsStudents = students
        .map(student => ({
          ...student,
          totalCredits: (student.individual_credits || 0) + (student.duo_credits || 0) + (student.group_credits || 0)
        }))
        .filter(student => student.totalCredits <= threshold);

      if (lowCreditsStudents.length === 0) {
        console.log('No students with low credits found');
        return;
      }

      // Filter students who haven't received notification recently (within last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const studentsToNotify = lowCreditsStudents.filter(student => {
        if (!student.last_low_credit_notification) {
          return true; // Never received notification
        }
        
        const lastNotification = new Date(student.last_low_credit_notification);
        return lastNotification < sevenDaysAgo;
      });

      if (studentsToNotify.length === 0) {
        console.log('All low credit students have been notified recently');
        return;
      }

      console.log(`Sending notifications to ${studentsToNotify.length} students...`);

      // Send notifications
      const results = await this.sendNotificationsToStudents(studentsToNotify);
      
      // Update last notification timestamp for successful sends
      await this.updateNotificationTimestamps(results.filter(r => r.success));

      console.log(`Notification results: ${results.filter(r => r.success).length} sent, ${results.filter(r => !r.success).length} failed`);

      return results;
    } catch (error) {
      console.error('Error in automatic notification check:', error);
    }
  }

  // Send notifications to a list of students
  async sendNotificationsToStudents(students) {
    const results = [];

    for (const student of students) {
      try {
        await emailService.sendLowCreditsNotification(student, student.totalCredits);
        
        results.push({
          student_id: student.id,
          student_name: student.full_name,
          email: student.email,
          success: true,
          timestamp: new Date().toISOString()
        });

        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        console.error(`Failed to send notification to ${student.full_name}:`, error);
        
        results.push({
          student_id: student.id,
          student_name: student.full_name,
          email: student.email,
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }

    return results;
  }

  // Update last notification timestamp for students
  async updateNotificationTimestamps(successfulResults) {
    for (const result of successfulResults) {
      try {
        await supabase
          .from('profiles')
          .update({ last_low_credit_notification: result.timestamp })
          .eq('id', result.student_id);
      } catch (error) {
        console.error(`Error updating notification timestamp for student ${result.student_id}:`, error);
      }
    }
  }

  // Manual trigger for immediate check
  async triggerImmediateCheck(threshold = this.defaultThreshold) {
    console.log('Triggering immediate notification check...');
    return await this.checkAndSendNotifications(threshold);
  }

  // Get scheduler status
  getStatus() {
    if (!this.isRunning) {
      return {
        isRunning: false,
        schedule: 'Every Monday at 10:00 AM',
        nextCheck: null
      };
    }

    // Calculate next Monday at 10 AM
    const now = new Date();
    const nextMonday = new Date(now);
    const daysUntilMonday = (1 - now.getDay() + 7) % 7; // 1 = Monday

    if (daysUntilMonday === 0 && now.getHours() >= 10) {
      nextMonday.setDate(now.getDate() + 7);
    } else if (daysUntilMonday === 0) {
      nextMonday.setDate(now.getDate());
    } else {
      nextMonday.setDate(now.getDate() + daysUntilMonday);
    }

    nextMonday.setHours(10, 0, 0, 0);

    return {
      isRunning: true,
      schedule: 'Every Monday at 10:00 AM',
      nextCheck: nextMonday
    };
  }

  // Send test notification
  async sendTestNotification(studentEmail, studentName = 'Teste') {
    try {
      const testStudent = {
        email: studentEmail,
        full_name: studentName,
        totalCredits: 2
      };

      await emailService.sendLowCreditsNotification(testStudent, 2);
      console.log(`Test notification sent to ${studentEmail}`);
      return { success: true };
    } catch (error) {
      console.error(`Failed to send test notification to ${studentEmail}:`, error);
      return { success: false, error: error.message };
    }
  }
}

// Create singleton instance
const emailScheduler = new EmailScheduler();

export default emailScheduler;

// Export utility functions
export const startEmailScheduler = (threshold, intervalHours) => {
  return emailScheduler.start(threshold, intervalHours);
};

export const stopEmailScheduler = () => {
  return emailScheduler.stop();
};

export const triggerImmediateNotificationCheck = (threshold) => {
  return emailScheduler.triggerImmediateCheck(threshold);
};

export const getSchedulerStatus = () => {
  return emailScheduler.getStatus();
};

export const sendTestNotification = (email, name) => {
  return emailScheduler.sendTestNotification(email, name);
};

