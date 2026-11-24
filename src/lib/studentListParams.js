// Busca e filtro da lista de Alunos guardados na URL (?search=..&status=..&student=..).
export const STUDENT_STATUS_FILTERS = ['active', 'inactive', 'all', 'online']

export const readStudentListParams = (searchParams) => {
  const status = searchParams.get('status')
  return {
    search: searchParams.get('search') ?? '',
    status: STUDENT_STATUS_FILTERS.includes(status) ? status : 'active',
    student: searchParams.get('student') || null
  }
}

// Monta os params do zero, só com o que não é padrão.
export const buildStudentListParams = ({ search, status, student } = {}) => {
  const params = new URLSearchParams()
  if (search) params.set('search', search)
  if (status && status !== 'active') params.set('status', status)
  if (student) params.set('student', student)
  return params
}
