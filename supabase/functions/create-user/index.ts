import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

console.log('Create User function loaded')

interface UserData {
  email: string
  fullName: string
  role: string
  password: string
  preferredLanguage: string
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

    const { email, fullName, role, password, preferredLanguage }: UserData = await req.json()

    // Check if user already exists in auth
    const { data: existingUsers, error: checkError } = await supabaseClient.auth.admin.listUsers()

    if (checkError) {
      console.error('Error checking existing users:', checkError)
      return new Response(
        JSON.stringify({ error: 'Failed to check existing users' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const userExists = existingUsers.users.some(user => user.email === email)

    if (userExists) {
      console.log('User already exists:', email)
      return new Response(
        JSON.stringify({ error: 'User with this email already exists' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Create the user in auth
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
    const { error: profileError } = await supabaseClient
      .from('profiles')
      .insert({
        id: authData.user.id,
        email: email,
        full_name: fullName,
        role: role,
        preferred_language: preferredLanguage,
        individual_credits: 0,
        duo_credits: 0,
        group_credits: 0
      })

    if (profileError) {
      console.error('Error creating profile:', profileError)

      // If profile creation fails, we should clean up the auth user
      await supabaseClient.auth.admin.deleteUser(authData.user.id)

      return new Response(
        JSON.stringify({ error: 'Failed to create user profile' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('Profile created successfully for user:', authData.user.id)

    return new Response(
      JSON.stringify({
        message: 'User created successfully',
        user: {
          id: authData.user.id,
          email: email,
          full_name: fullName,
          role: role
        }
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