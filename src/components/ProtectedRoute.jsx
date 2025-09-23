import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const ProtectedRoute = ({ children, requireRole = null, requireCompleteProfile = false }) => {
  const { user, profile, loading, isProfileComplete } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Check if profile completion is required and profile is incomplete
  if (requireCompleteProfile && !isProfileComplete) {
    return <Navigate to="/complete-profile" replace />
  }

  if (requireRole && profile?.role !== requireRole) {
    // Redirect to appropriate dashboard based on user role
    if (profile?.role === 'teacher') {
      return <Navigate to="/teacher/dashboard" replace />
    } else if (profile?.role === 'student') {
      return <Navigate to="/student/dashboard" replace />
    } else {
      return <Navigate to="/login" replace />
    }
  }

  return children
}

export default ProtectedRoute

