import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const Spinner = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
  </div>
)

// requireConsent: aluno com o termo das aulas (class_policies) pendente vai
// para o assistente /student/consent. Professora nunca é bloqueada. Erro de
// rede na checagem não bloqueia (useAuth devolve lista vazia).
const ProtectedRoute = ({
  children,
  requireRole = null,
  requireCompleteProfile = false,
  requireConsent = false
}) => {
  const { user, profile, loading, isProfileComplete, pendingConsents, consentsLoading } = useAuth()

  if (loading) {
    return <Spinner />
  }

  if (!user) {
    return <Navigate to="/" replace />
  }

  if (requireCompleteProfile && !isProfileComplete) {
    return <Navigate to="/complete-profile" replace />
  }

  if (requireRole && profile?.role !== requireRole) {
    if (profile?.role === 'teacher') {
      return <Navigate to="/teacher/dashboard" replace />
    } else if (profile?.role === 'student') {
      return <Navigate to="/student/dashboard" replace />
    } else {
      return <Navigate to="/" replace />
    }
  }

  if (requireConsent && profile?.role === 'student') {
    if (consentsLoading) {
      return <Spinner />
    }
    if ((pendingConsents || []).some(c => c.kind === 'class_policies')) {
      return <Navigate to="/student/consent" replace />
    }
  }

  return children
}

export default ProtectedRoute
