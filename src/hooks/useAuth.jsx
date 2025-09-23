import { createContext, useContext, useEffect, useState } from 'react'
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

  useEffect(() => {
    const handleSession = async (session) => {
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

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSession(session)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        handleSession(session)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const fetchOrCreateProfile = async (user) => {
    try {
      // First, try to fetch existing profile
      const { data: existingProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (existingProfile) {
        console.log('Fetched existing profile:', existingProfile)
        setProfile(existingProfile)

        // Start email scheduler for teachers
        if (existingProfile.role === 'teacher') {
          emailScheduler.start()
        }

        return
      }

      // If profile doesn't exist, try to create it for any user type
      if (fetchError?.code === 'PGRST116') {
        console.log('Profile not found, attempting to create for user:', user.email)

        // Determine if this is an OAuth user or traditional user
        const isOAuthUser = user.app_metadata?.provider === 'google'

        if (isOAuthUser) {
          // Handle OAuth user profile creation
          console.log('Creating profile for Google OAuth user:', user.email)

          const { data: createResult, error: createError } = await supabase.functions.invoke('create-user', {
            body: {
              oauth_user_id: user.id,
              email: user.email,
              fullName: user.user_metadata?.full_name || user.email,
              // Don't provide phone or preferredLanguage - let the function mark as incomplete
            }
          })

          if (createError) {
            console.error('Error creating OAuth profile:', createError)
            throw createError
          }

          if (createResult.error) {
            console.error('Error in create-user function:', createResult.error)
            throw new Error(createResult.error)
          }

          console.log('Created OAuth profile:', createResult.profile)
          setProfile(createResult.profile)

          // Start email scheduler for teachers
          if (createResult.profile.role === 'teacher') {
            emailScheduler.start()
          }
        } else {
          // For traditional users, try to create a basic profile
          console.log('Profile not found for traditional user, creating basic profile:', user.email)

          const { data: createResult, error: createError } = await supabase.functions.invoke('create-user', {
            body: {
              oauth_user_id: user.id,
              email: user.email,
              fullName: user.user_metadata?.full_name || user.email.split('@')[0], // Use part before @ as name
              // Mark as incomplete so they go through profile completion
              update_existing: false
            }
          })

          if (createError) {
            console.error('Error creating profile for traditional user:', createError)
            throw createError
          }

          if (createResult.error) {
            console.error('Error in create-user function for traditional user:', createResult.error)
            throw new Error(createResult.error)
          }

          console.log('Created basic profile for traditional user:', createResult.profile)
          setProfile(createResult.profile)

          // Start email scheduler for teachers
          if (createResult.profile.role === 'teacher') {
            emailScheduler.start()
          }
        }

        return
      }

      // If there's another type of error, throw it
      if (fetchError) {
        throw fetchError
      }

    } catch (error) {
      console.error('Error fetching/creating profile:', error)
      console.log('User ID for failed profile operation:', user.id)
      // Set profile to null on error to prevent infinite loading
      setProfile(null)
    }
  }

  const signUp = async (email, password, fullName, role = 'student', phone = null, preferredLanguage = 'pt') => {
    try {
      // For traditional signup, call the create-user Edge Function
      const { data: createResult, error: createError } = await supabase.functions.invoke('create-user', {
        body: {
          email,
          password,
          fullName,
          role,
          phone,
          preferredLanguage
        }
      })

      if (createError) {
        throw createError
      }

      if (createResult.error) {
        throw new Error(createResult.error)
      }

      // The user should now be created and we can sign them in
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (signInError) {
        throw signInError
      }

      return { data: signInData, error: null }
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
      // Profile will be fetched automatically by the auth state change handler
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
      // Stop email scheduler if it's running
      emailScheduler.stop()

      const { error } = await supabase.auth.signOut()
      if (error) throw error
      setUser(null)
      setProfile(null)
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  const updateProfile = async (updates) => {
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

      // Call the create-user Edge Function to update the profile
      const { data: updateResult, error: updateError } = await supabase.functions.invoke('create-user', {
        body: {
          oauth_user_id: user.id,
          email: user.email,
          fullName: user.user_metadata?.full_name || user.email,
          phone,
          preferredLanguage,
          update_existing: true
        }
      })

      if (updateError) {
        throw updateError
      }

      if (updateResult.error) {
        throw new Error(updateResult.error)
      }

      // Update local profile state
      setProfile(updateResult.profile)
      return { data: updateResult.profile, error: null }
    } catch (error) {
      return { data: null, error }
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
    isTeacher: profile?.role === 'teacher',
    isStudent: profile?.role === 'student',
    isProfileComplete: profile?.profile_complete === true,
    supabase // Expose supabase client for direct use in components
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

