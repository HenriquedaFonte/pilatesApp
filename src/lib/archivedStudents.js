import { supabase } from './supabase'

// Aluno arquivado = perfil com deleted_at preenchido.
export const isArchived = profile => !!profile?.deleted_at

// Ids dos alunos arquivados. Em erro, lança (quem chama decide o que mostrar).
export async function fetchArchivedStudentIds() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'student')
    .not('deleted_at', 'is', null)
  if (error) throw error
  return new Set((data || []).map(p => p.id))
}

// Tira das linhas as que pertencem a aluno arquivado (função pura).
export function withoutArchived(rows, ids, key = 'student_id') {
  if (!rows) return []
  if (!ids || ids.size === 0) return rows
  return rows.filter(row => !ids.has(row?.[key]))
}
