import { describe, it, expect } from 'vitest'
import { sortSchedules, studentsBySchedule, countScheduleStudents } from '../lib/emailRecipients'

describe('turmas por horário', () => {
  it('ordena de segunda a domingo e pelo horário', () => {
    const sorted = sortSchedules([
      { id: 'dom', day_of_week: 0, start_time: '09:00:00' },
      { id: 'seg-1815', day_of_week: 1, start_time: '18:15:00' },
      { id: 'seg-0900', day_of_week: 1, start_time: '09:00:00' },
      { id: 'qua', day_of_week: 3, start_time: '07:30:00' }
    ])
    expect(sorted.map(s => s.id)).toEqual(['seg-0900', 'seg-1815', 'qua', 'dom'])
  })

  it('agrupa alunos por turma sem repetir', () => {
    expect(
      studentsBySchedule([
        { class_schedule_id: 's1', student_id: 'a' },
        { class_schedule_id: 's1', student_id: 'a' },
        { class_schedule_id: 's1', student_id: 'b' },
        { class_schedule_id: 's2', student_id: 'a' },
        { class_schedule_id: null, student_id: 'c' }
      ])
    ).toEqual({ s1: ['a', 'b'], s2: ['a'] })
  })

  it('conta só ativos, salvo includeInactive', () => {
    const students = [{ id: 'a' }, { id: 'b', is_active: false }, { id: 'c' }]
    expect(countScheduleStudents(students, ['a', 'b'])).toBe(1)
    expect(countScheduleStudents(students, ['a', 'b'], true)).toBe(2)
    expect(countScheduleStudents(students, undefined)).toBe(0)
  })
})
