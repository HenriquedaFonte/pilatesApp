// import { useEffect } from 'react'
// import { useNavigate } from 'react-router-dom'
// import { useAuth } from '../hooks/useAuth'

// const AuthCallback = () => {
//   const { user, profile, loading } = useAuth()
//   const navigate = useNavigate()

//   useEffect(() => {
//     if (!loading) {
//       if (user && profile) {
//         if (profile.role === 'teacher') {
//           navigate('/teacher/dashboard', { replace: true })
//         } else if (profile.role === 'student') {
//           navigate('/student/dashboard', { replace: true })
//         } else {
//           navigate('/', { replace: true })
//         }
//       } else {
//         navigate('/login', { replace: true })
//       }
//     }
//   }, [user, profile, loading, navigate])

//   return <div>Signing in with Google...</div>
// }

// export default AuthCallback

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const AuthCallback = () => {
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading) {
      if (user) {
        // If user is authenticated, navigate to the root path.
        // The App.jsx routing will then handle redirection based on profile completeness and role.
        navigate('/', { replace: true })
      } else {
        // If no user, redirect to login
        navigate('/login', { replace: true })
      }
    }
  }, [user, loading, navigate])

  return <div>Signing in with Google...</div>
}

export default AuthCallback
