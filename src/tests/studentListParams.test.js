import { describe, it, expect, vi, afterEach } from 'vitest'
import { readStudentListParams, buildStudentListParams } from '../lib/studentListParams'
import { goBack } from '../lib/navigation'

describe('readStudentListParams', () => {
  it('sem params usa os padrões', () => {
    expect(readStudentListParams(new URLSearchParams(''))).toEqual({
      search: '',
      status: 'active',
      student: null
    })
  })
  it('status inválido vira active', () => {
    expect(readStudentListParams(new URLSearchParams('status=xyz')).status).toBe('active')
  })
  it('lê todos os params', () => {
    expect(readStudentListParams(new URLSearchParams('search=ma&status=online&student=abc'))).toEqual({
      search: 'ma',
      status: 'online',
      student: 'abc'
    })
  })
})

describe('buildStudentListParams', () => {
  it('só padrões = vazio', () => {
    expect(buildStudentListParams({ search: '', status: 'active' }).toString()).toBe('')
  })
  it('status active não entra', () => {
    expect(buildStudentListParams({ search: 'a', status: 'active' }).toString()).toBe('search=a')
  })
  it('monta tudo e ida e volta com acento e espaço', () => {
    const qs = buildStudentListParams({ search: 'João Sá', status: 'online', student: 'id1' })
    expect(qs.toString()).toBe('search=Jo%C3%A3o+S%C3%A1&status=online&student=id1')
    expect(readStudentListParams(new URLSearchParams(qs.toString()))).toEqual({
      search: 'João Sá',
      status: 'online',
      student: 'id1'
    })
  })
})

describe('goBack', () => {
  afterEach(() => window.history.replaceState(null, ''))
  it('com histórico volta uma entrada', () => {
    window.history.replaceState({ idx: 2 }, '')
    const navigate = vi.fn()
    goBack(navigate, '/x')
    expect(navigate).toHaveBeenCalledWith(-1)
  })
  it('sem histórico vai para o fallback', () => {
    const navigate = vi.fn()
    window.history.replaceState({ idx: 0 }, '')
    goBack(navigate, '/x')
    window.history.replaceState(null, '')
    goBack(navigate, '/y')
    expect(navigate).toHaveBeenNthCalledWith(1, '/x')
    expect(navigate).toHaveBeenNthCalledWith(2, '/y')
  })
})
