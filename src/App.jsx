import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './hooks/useAuth'
import ProtectedRoute from './components/ProtectedRoute'
import { ThemeProvider } from './components/ThemeProvider'
import { CardSkeleton } from './components/ui/skeleton'
import { queryClient } from './lib/queryClient'
import './App.css'

// Lazy load all pages for better performance
const Login = lazy(() => import('./pages/Login'))
const Signup = lazy(() => import('./pages/Signup'))
const ProfileCompletion = lazy(() => import('./pages/ProfileCompletion'))
const ChangePassword = lazy(() => import('./pages/ChangePassword'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const TeacherDashboard = lazy(() => import('./pages/TeacherDashboard'))
const TeacherClasses = lazy(() => import('./pages/TeacherClasses'))
const TeacherStudents = lazy(() => import('./pages/TeacherStudents'))
const TeacherCheckIn = lazy(() => import('./pages/TeacherCheckIn'))
const StudentDashboard = lazy(() => import('./pages/StudentDashboard'))
const StudentHistory = lazy(() => import('./pages/StudentHistory'))
const StudioRules = lazy(() => import('./pages/StudioRules'))
const StudentProfile = lazy(() => import('./pages/StudentProfile'))
const TeacherProfile = lazy(() => import('./pages/TeacherProfile'))
const AttendanceReport = lazy(() => import('./pages/AttendanceReport'))
const LowCreditsReport = lazy(() => import('./pages/lowCreditsReport'))
const CreditHistoryReport = lazy(() => import('./pages/CreditHistoryReport'))
const FinancialReport = lazy(() => import('./pages/FinancialReport'))
const EmailNotifications = lazy(() => import('./pages/EmailNotifications'))
const AuthCallback = lazy(() => import('./components/AuthCallback'))
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'))
const TermsOfService = lazy(() => import('./pages/TermsOfService'))
const StudioHome = lazy(() => import('./pages/StudioHome'))

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <Router>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </Router>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

function AppRoutes() {
  const { loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <Suspense fallback={<CardSkeleton />}>
      <Routes>
      <Route path="/" element={<StudioHome />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/complete-profile" element={<ProfileCompletion />} />
      <Route path="/change-password" element={<ChangePassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/privacy-policy" element={<PrivacyPolicy />} />
      <Route path="/terms-of-service" element={<TermsOfService />} />

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
        path="/teacher/financial-report"
        element={
          <ProtectedRoute requireRole="teacher" requireCompleteProfile={true}>
            <FinancialReport />
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
      <Route
        path="/teacher/profile"
        element={
          <ProtectedRoute requireRole="teacher" requireCompleteProfile={true}>
            <TeacherProfile />
          </ProtectedRoute>
        }
      />
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
      <Route
        path="/student/rules"
        element={
          <ProtectedRoute requireRole="student" requireCompleteProfile={true}>
            <StudioRules />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/profile"
        element={
          <ProtectedRoute requireRole="student" requireCompleteProfile={true}>
            <StudentProfile />
          </ProtectedRoute>
        }
      />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  )
}

export default App
