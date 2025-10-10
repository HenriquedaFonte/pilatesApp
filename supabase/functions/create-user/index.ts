import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

console.log('Create User function loaded')

interface UserData {
  email: string
  fullName: string
  role?: string
  password?: string
  preferredLanguage?: string
  oauth_user_id?: string
  update_existing?: boolean
}

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { email, fullName, role, password, preferredLanguage, oauth_user_id, update_existing }: UserData = await req.json()

    console.log('Creating user:', { email, fullName, role, preferredLanguage, oauth_user_id, update_existing })

    // First check if a profile already exists for this email
    const { data: existingProfile, error: profileCheckError } = await supabaseClient
      .from('profiles')
      .select('id, email')
      .eq('email', email)
      .single()

    if (profileCheckError && profileCheckError.code !== 'PGRST116') {
      // PGRST116 is "not found" error, which is expected if no profile exists
      console.error('Error checking existing profile:', profileCheckError)
      return new Response(
        JSON.stringify({ error: 'Failed to check existing user' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (existingProfile) {
      console.log('Profile already exists for email:', email)
      return new Response(
        JSON.stringify({ error: 'User with this email already exists' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    let userId: string
    let userEmail: string = email

    if (oauth_user_id) {
      // For OAuth users, the auth user already exists
      userId = oauth_user_id
      console.log('Using existing OAuth user ID:', userId)
    } else {
      // Try to create the user in auth
      const { data: authData, error: authError } = await supabaseClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          full_name: fullName,
          role: role,
          preferred_language: preferredLanguage
        }
      })

      if (authError) {
        console.error('Error creating auth user:', authError)

        // Check if the error is because user already exists
        if (authError.message?.includes('already registered') ||
            authError.message?.includes('already exists') ||
            authError.message?.includes('User already registered')) {
          return new Response(
            JSON.stringify({ error: 'User with this email already exists' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          )
        }

        return new Response(
          JSON.stringify({ error: 'Failed to create user account' }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      if (!authData.user) {
        console.error('No user data returned from auth creation')
        return new Response(
          JSON.stringify({ error: 'Failed to create user account' }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      userId = authData.user.id
      console.log('Auth user created:', userId)
    }

    if (authError) {
      console.error('Error creating auth user:', authError)

      // Check if the error is because user already exists
      if (authError.message?.includes('already registered') ||
          authError.message?.includes('already exists') ||
          authError.message?.includes('User already registered')) {
        return new Response(
          JSON.stringify({ error: 'User with this email already exists' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      return new Response(
        JSON.stringify({ error: 'Failed to create user account' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (!authData.user) {
      console.error('No user data returned from auth creation')
      return new Response(
        JSON.stringify({ error: 'Failed to create user account' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('Auth user created:', authData.user.id)

    // Create the profile
    console.log('Creating profile for user:', userId)
    const { data: profileData, error: profileError } = await supabaseClient
      .from('profiles')
      .insert({
        id: userId,
        email: userEmail,
        full_name: fullName,
        role: role || 'student',
        preferred_language: preferredLanguage || 'pt',
        individual_credits: 0,
        duo_credits: 0,
        group_credits: 0,
        profile_complete: false,
        password_changed: false
      })
      .select('id, email, full_name, role, individual_credits, duo_credits, group_credits, created_at, observations, phone, preferred_language, profile_complete, password_changed')

    if (profileError) {
      console.error('Error creating profile:', profileError)
      console.error('Profile error details:', JSON.stringify(profileError, null, 2))

      // If profile creation fails and it's not OAuth, clean up the auth user
      if (!oauth_user_id) {
        console.log('Cleaning up auth user due to profile creation failure')
        await supabaseClient.auth.admin.deleteUser(userId)
      }

      return new Response(
        JSON.stringify({ error: 'Failed to create user profile' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('Profile created successfully:', profileData)

    return new Response(
      JSON.stringify({
        message: 'User created successfully',
        user: {
          id: userId,
          email: userEmail,
          full_name: fullName,
          role: role || 'student'
        },
        profile: profileData[0]
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})