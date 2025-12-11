import { createContext, useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import emailScheduler from '../utils/emailScheduler'

const AuthContext = createContext({})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const handleSession = async session => {
      try {
        if (session?.user) {
          setUser(session.user)
          await fetchOrCreateProfile(session.user)
        } else {
          setUser(null)
          setProfile(null)
        }
      } catch (error) {
        console.error('Error in handleSession:', error)
        setUser(null)
        setProfile(null)
      } finally {
        setLoading(false)
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSession(session)
    })

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, session) => {
      handleSession(session)
    })

    // Auto-refresh session before expiry
    const refreshInterval = setInterval(async () => {
      try {
        const {
          data: { session }
        } = await supabase.auth.getSession()
        if (session) {
          const expiresAt = session.expires_at
          const now = Math.floor(Date.now() / 1000)
          // Refresh 5 minutes before expiry
          if (expiresAt - now < 300) {
            const { error } = await supabase.auth.refreshSession()
            if (error) {
              console.warn('Session refresh failed:', error.message)
            }
          }
        }
      } catch (error) {
        console.warn('Session check failed:', error.message)
      }
    }, 60000) // Check every minute

    return () => {
      subscription.unsubscribe()
      clearInterval(refreshInterval)
    }
  }, [])

  const fetchOrCreateProfile = async user => {
    try {
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select(
          'id, email, full_name, role, individual_credits, duo_credits, group_credits, created_at, observations, phone, preferred_language'
        )
        .eq('id', user.id)
        .single()

      if (existingProfile) {
        setProfile(existingProfile)

        // Automatic email scheduler disabled - only manual emails via Email Notifications remain active
        // if (existingProfile.role === 'teacher') {
        //   emailScheduler.start()
        // }

        return
      }

      // Profile not found - create it
      console.log(
        'Profile not found for user:',
        user.email,
        'Creating new profile...'
      )

      const { data: newProfile, error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          email: user.email,
          full_name:
            user.user_metadata?.full_name || user.user_metadata?.name || '',
          role: user.user_metadata?.role || 'student',
          individual_credits: 0,
          duo_credits: 0,
          group_credits: 0,
          phone: user.user_metadata?.phone || null,
          preferred_language: user.user_metadata?.preferred_language || 'pt',
          created_at: new Date().toISOString()
        })
        .select()
        .single()

      if (insertError) {
        console.error('Error creating profile:', insertError)
        setProfile(null)
        return
      }

      setProfile(newProfile)

      // Automatic email scheduler disabled - only manual emails via Email Notifications remain active
      // if (newProfile.role === 'teacher') {
      //   emailScheduler.start()
      // }
    } catch (error) {
      console.error('Error fetching/creating profile:', error)
      console.log('User ID for failed profile operation:', user.id)
      setProfile(null)
    }
  }

  const signUp = async (
    email,
    password,
    fullName,
    role = 'student',
    phone = null,
    preferredLanguage = 'pt'
  ) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role: role,
            phone: phone,
            preferred_language: preferredLanguage
          }
        }
      })

      if (error) throw error
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }

  const signIn = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) throw error
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }

  const signInWithGoogle = async () => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      })

      if (error) throw error
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }

  const signOut = async () => {
    try {
      emailScheduler.stop()

      // Check if there's a session before attempting to sign out
      const {
        data: { session }
      } = await supabase.auth.getSession()
      if (session) {
        // Only attempt server logout if there's an active session
        const { error } = await supabase.auth.signOut()
        if (error) {
          console.warn('Supabase signOut warning (ignored):', error.message)
        }
      }

      // Always clear local state
      setUser(null)
      setProfile(null)
    } catch (error) {
      console.error('Error signing out:', error)

      // Even if there's an error, clear local state
      setUser(null)
      setProfile(null)

      // Navigate to home page even on error
      navigate('/')
    }
  }

  const updateProfile = async updates => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single()

      if (error) throw error
      setProfile(data)
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }

  const completeProfile = async (phone, preferredLanguage) => {
    try {
      if (!user) {
        throw new Error('User not authenticated')
      }

      const { data, error } = await supabase
        .from('profiles')
        .update({
          phone: phone || null,
          preferred_language: preferredLanguage
        })
        .eq('id', user.id)
        .select()
        .single()

      if (error) throw error

      setProfile(data)
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }

  const updateThemePreference = async theme => {
    try {
      if (!user) return

      const { error } = await supabase
        .from('profiles')
        .update({ theme_preference: theme })
        .eq('id', user.id)

      if (error) throw error
    } catch (error) {
      console.error('Error updating theme preference:', error)
    }
  }

  const value = {
    user,
    profile,
    loading,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    updateProfile,
    completeProfile,
    updateThemePreference,
    isTeacher: profile?.role === 'teacher',
    isStudent: profile?.role === 'student',
    isProfileComplete: profile?.phone != null,
    supabase
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
