import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

const AuthCallback = () => {
  const { user, profile, loading, isProfileComplete } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Handle the auth callback
        const { data, error } = await supabase.auth.getSession()

        if (error) {
          console.error('Auth callback error:', error)
          navigate('/login', { replace: true })
          return
        }

        if (data?.session?.user) {
          // User is authenticated, wait for profile to load and then check completion
          const checkProfileAndRedirect = () => {
            if (!loading && profile) {
              console.log('Profile loaded:', profile)
              console.log('Is profile complete:', isProfileComplete)

              if (!isProfileComplete) {
                // Profile not complete, redirect to profile completion
                console.log('Redirecting to profile completion')
                navigate('/complete-profile', { replace: true })
              } else {
                // Profile complete, redirect to appropriate dashboard
                const targetPath = profile.role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard'
                console.log('Redirecting to dashboard:', targetPath)
                navigate(targetPath, { replace: true })
              }
            } else if (!loading && !profile) {
              // Profile failed to load, redirect to home
              console.log('No profile found, redirecting to home')
              navigate('/', { replace: true })
            }
          }

          // Check immediately
          checkProfileAndRedirect()

          // Also set up a watcher for profile changes
          if (loading) {
            const timeout = setTimeout(checkProfileAndRedirect, 2000) // Wait up to 2 seconds for profile to load
            return () => clearTimeout(timeout)
          }
        } else {
          // No session, redirect to login
          console.log('No session found, redirecting to login')
          navigate('/login', { replace: true })
        }
      } catch (error) {
        console.error('Auth callback handling error:', error)
        navigate('/login', { replace: true })
      }
    }

    handleAuthCallback()
  }, [user, profile, loading, isProfileComplete, navigate])

  return <div>Signing in with Google...</div>
}

export default AuthCallback
