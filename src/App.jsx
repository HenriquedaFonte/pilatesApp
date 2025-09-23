import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Signup from './pages/Signup'
import ProfileCompletion from './pages/ProfileCompletion'
import TeacherDashboard from './pages/TeacherDashboard'
import TeacherClasses from './pages/TeacherClasses'
import TeacherStudents from './pages/TeacherStudents'
import TeacherCheckIn from './pages/TeacherCheckIn'
import StudentDashboard from './pages/StudentDashboard'
import StudentHistory from './pages/StudentHistory'
import AttendanceReport from './pages/AttendanceReport'
import LowCreditsReport from './pages/lowCreditsReport'
import CreditHistoryReport from './pages/CreditHistoryReport'
import EmailNotifications from './pages/EmailNotifications'
import AuthCallback from './components/AuthCallback'
import './App.css'

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  )
}

function AppRoutes() {
  const { user, profile, loading, isProfileComplete } = useAuth()

  console.log("AppRoutes - User:", user)
  console.log("AppRoutes - Profile:", profile)
  console.log("AppRoutes - Loading:", loading)
  console.log("AppRoutes - Profile Complete:", isProfileComplete)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/complete-profile" element={<ProfileCompletion />} />
      <Route path="/auth/callback" element={<AuthCallback />} /> {/* AuthCallback for Google OAuth */}
      
      {/* Redirect authenticated users based on role and profile completion */}
      <Route
        path="/"
        element={
          user ? (
            // If user is authenticated but profile is incomplete, redirect to profile completion
            !isProfileComplete ? (
              <Navigate to="/complete-profile" replace />
            ) : profile?.role === 'teacher' ? (
              <Navigate to="/teacher/dashboard" replace />
            ) : profile?.role === 'student' ? (
              <Navigate to="/student/dashboard" replace />
            ) : (
              <Navigate to="/login" replace />
            )
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      {/* Teacher Routes - Protected and require complete profile */}
      <Route 
        path="/teacher/dashboard" 
        element={
          <ProtectedRoute requireRole="teacher" requireCompleteProfile={true}>
            <TeacherDashboard />
          </ProtectedRoute>
        }
      />
      <Route 
        path="/teacher/classes" 
        element={
          <ProtectedRoute requireRole="teacher" requireCompleteProfile={true}>
            <TeacherClasses />
          </ProtectedRoute>
        }
      />
      <Route 
        path="/teacher/students" 
        element={
          <ProtectedRoute requireRole="teacher" requireCompleteProfile={true}>
            <TeacherStudents />
          </ProtectedRoute>
        }
      />
      <Route 
        path="/teacher/check-in" 
        element={
          <ProtectedRoute requireRole="teacher" requireCompleteProfile={true}>
            <TeacherCheckIn />
          </ProtectedRoute>
        }
      />
      <Route 
        path="/teacher/attendance-report" 
        element={
          <ProtectedRoute requireRole="teacher" requireCompleteProfile={true}>
            <AttendanceReport />
          </ProtectedRoute>
        }
      />
      <Route 
        path="/teacher/low-credits-report" 
        element={
          <ProtectedRoute requireRole="teacher" requireCompleteProfile={true}>
            <LowCreditsReport />
          </ProtectedRoute>
        }
      />
      <Route 
        path="/teacher/credit-history-report" 
        element={
          <ProtectedRoute requireRole="teacher" requireCompleteProfile={true}>
            <CreditHistoryReport />
          </ProtectedRoute>
        }
      />
      <Route 
        path="/teacher/email-notifications" 
        element={
          <ProtectedRoute requireRole="teacher" requireCompleteProfile={true}>
            <EmailNotifications />
          </ProtectedRoute>
        }
      />
      
      {/* Student Routes - Protected and require complete profile */}
      <Route 
        path="/student/dashboard" 
        element={
          <ProtectedRoute requireRole="student" requireCompleteProfile={true}>
            <StudentDashboard />
          </ProtectedRoute>
        }
      />
      <Route 
        path="/student/history" 
        element={
          <ProtectedRoute requireRole="student" requireCompleteProfile={true}>
            <StudentHistory />
          </ProtectedRoute>
        }
      />

      {/* Catch all - Redirect to login if path not found and not authenticated */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default App
