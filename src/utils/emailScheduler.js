import { supabase } from '../lib/supabase'
import emailService from '../lib/emailService'

class EmailScheduler {
  constructor() {
    this.isRunning = false
    this.timeoutId = null
    this.defaultThreshold = 2
  }

  start(threshold = this.defaultThreshold) {
    // Automatic email scheduler is disabled - only manual emails remain active
    console.log('Email scheduler is disabled - automatic emails are not sent')
    return
  }

  stop() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
      this.timeoutId = null
    }
    this.isRunning = false
    console.log('Email scheduler stopped')
  }

  scheduleNextRun() {
    const now = new Date()
    const nextMonday = new Date(now)

    const daysUntilMonday = (1 - now.getDay() + 7) % 7
    if (daysUntilMonday === 0 && now.getHours() >= 10) {
      nextMonday.setDate(now.getDate() + 7)
    } else if (daysUntilMonday === 0) {
      nextMonday.setDate(now.getDate())
    } else {
      nextMonday.setDate(now.getDate() + daysUntilMonday)
    }

    nextMonday.setHours(10, 0, 0, 0)

    const timeUntilNextRun = nextMonday.getTime() - now.getTime()

    console.log(
      `Next email check scheduled for: ${nextMonday.toLocaleString()}`
    )

    this.timeoutId = setTimeout(() => {
      this.checkAndSendNotifications(this.threshold)

      this.scheduleNextRun()
    }, timeUntilNextRun)
  }

  async checkAndSendNotifications(threshold = this.defaultThreshold) {
    try {
      console.log(`Checking for students with <= ${threshold} credits...`)

      const { data: students, error } = await supabase
        .from('profiles')
        .select(
          `
          id, 
          full_name, 
          email, 
          individual_credits, 
          duo_credits, 
          group_credits,
          last_low_credit_notification
        `
        )
        .eq('role', 'student')

      if (error) {
        console.error('Error fetching students:', error)
        return
      }

      const lowCreditsStudents = students
        .map(student => ({
          ...student,
          totalCredits:
            (student.individual_credits || 0) +
            (student.duo_credits || 0) +
            (student.group_credits || 0)
        }))
        .filter(student => student.totalCredits <= threshold)

      if (lowCreditsStudents.length === 0) {
        console.log('No students with low credits found')
        return
      }

      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

      const studentsToNotify = lowCreditsStudents.filter(student => {
        if (!student.last_low_credit_notification) {
          return true
        }

        const lastNotification = new Date(student.last_low_credit_notification)
        return lastNotification < sevenDaysAgo
      })

      if (studentsToNotify.length === 0) {
        console.log('All low credit students have been notified recently')
        return
      }

      console.log(
        `Sending notifications to ${studentsToNotify.length} students...`
      )

      const results = await this.sendNotificationsToStudents(studentsToNotify)

      await this.updateNotificationTimestamps(results.filter(r => r.success))

      console.log(
        `Notification results: ${results.filter(r => r.success).length} sent, ${
          results.filter(r => !r.success).length
        } failed`
      )

      return results
    } catch (error) {
      console.error('Error in automatic notification check:', error)
    }
  }

  async sendNotificationsToStudents(students) {
    const results = []

    for (const student of students) {
      try {
        await emailService.sendLowCreditsNotification(
          student,
          student.totalCredits
        )

        results.push({
          student_id: student.id,
          student_name: student.full_name,
          email: student.email,
          success: true,
          timestamp: new Date().toISOString()
        })

        await new Promise(resolve => setTimeout(resolve, 300))
      } catch (error) {
        console.error(
          `Failed to send notification to ${student.full_name}:`,
          error
        )

        results.push({
          student_id: student.id,
          student_name: student.full_name,
          email: student.email,
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        })
      }
    }

    return results
  }

  async updateNotificationTimestamps(successfulResults) {
    for (const result of successfulResults) {
      try {
        await supabase
          .from('profiles')
          .update({ last_low_credit_notification: result.timestamp })
          .eq('id', result.student_id)
      } catch (error) {
        console.error(
          `Error updating notification timestamp for student ${result.student_id}:`,
          error
        )
      }
    }
  }

  async triggerImmediateCheck(threshold = this.defaultThreshold) {
    console.log('Triggering immediate notification check...')
    return await this.checkAndSendNotifications(threshold)
  }

  getStatus() {
    if (!this.isRunning) {
      return {
        isRunning: false,
        schedule: 'Every Monday at 10:00 AM',
        nextCheck: null
      }
    }

    const now = new Date()
    const nextMonday = new Date(now)
    const daysUntilMonday = (1 - now.getDay() + 7) % 7 // 1 = Monday

    if (daysUntilMonday === 0 && now.getHours() >= 10) {
      nextMonday.setDate(now.getDate() + 7)
    } else if (daysUntilMonday === 0) {
      nextMonday.setDate(now.getDate())
    } else {
      nextMonday.setDate(now.getDate() + daysUntilMonday)
    }

    nextMonday.setHours(10, 0, 0, 0)

    return {
      isRunning: true,
      schedule: 'Every Monday at 10:00 AM',
      nextCheck: nextMonday
    }
  }

  async sendTestNotification(studentEmail, studentName = 'Teste') {
    try {
      const testStudent = {
        email: studentEmail,
        full_name: studentName,
        totalCredits: 2
      }

      await emailService.sendLowCreditsNotification(testStudent, 2)
      console.log(`Test notification sent to ${studentEmail}`)
      return { success: true }
    } catch (error) {
      console.error(
        `Failed to send test notification to ${studentEmail}:`,
        error
      )
      return { success: false, error: error.message }
    }
  }
}

const emailScheduler = new EmailScheduler()

export default emailScheduler

export const startEmailScheduler = (threshold, intervalHours) => {
  return emailScheduler.start(threshold, intervalHours)
}

export const stopEmailScheduler = () => {
  return emailScheduler.stop()
}

export const triggerImmediateNotificationCheck = threshold => {
  return emailScheduler.triggerImmediateCheck(threshold)
}

export const getSchedulerStatus = () => {
  return emailScheduler.getStatus()
}

export const sendTestNotification = (email, name) => {
  return emailScheduler.sendTestNotification(email, name)
}
