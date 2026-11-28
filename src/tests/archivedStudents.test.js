import { describe, it, expect, vi } from 'vitest'

vi.mock('../lib/supabase', () => ({ supabase: { from: vi.fn() } }))

import { isArchived, withoutArchived, fetchArchivedStudentIds } from '../lib/archivedStudents'
import { supabase } from '../lib/supabase'

describe('isArchived', () => {
  it('é true só com deleted_at preenchido', () => {
    expect(isArchived({ deleted_at: '2026-11-28T10:00:00Z' })).toBe(true)
    expect(isArchived({ deleted_at: null })).toBe(false)
    expect(isArchived({})).toBe(false)
    expect(isArchived(null)).toBe(false)
  })
})

describe('withoutArchived', () => {
  const ids = new Set(['a'])
  it('lista vazia ou ausente devolve lista vazia', () => {
    expect(withoutArchived([], ids)).toEqual([])
    expect(withoutArchived(undefined, ids)).toEqual([])
  })
  it('set vazio devolve as linhas como vieram', () => {
    const rows = [{ student_id: 'a' }]
    expect(withoutArchived(rows, new Set())).toBe(rows)
  })
  it('tira os arquivados pela chave padrão e por chave customizada', () => {
    expect(withoutArchived([{ student_id: 'a' }, { student_id: 'b' }], ids)).toEqual([{ student_id: 'b' }])
    expect(withoutArchived([{ id: 'a' }, { id: 'b' }], ids, 'id')).toEqual([{ id: 'b' }])
  })
  it('linha sem a chave é mantida', () => {
    expect(withoutArchived([{ other: 1 }], ids)).toEqual([{ other: 1 }])
  })
})

describe('fetchArchivedStudentIds', () => {
  const mockQuery = result => {
    supabase.from.mockReturnValue({
      select: () => ({ eq: () => ({ not: () => Promise.resolve(result) }) })
    })
  }
  it('devolve um Set com os ids', async () => {
    mockQuery({ data: [{ id: 'a' }, { id: 'b' }], error: null })
    expect(await fetchArchivedStudentIds()).toEqual(new Set(['a', 'b']))
  })
  it('lança em erro', async () => {
    mockQuery({ data: null, error: new Error('x') })
    await expect(fetchArchivedStudentIds()).rejects.toThrow('x')
  })
})
