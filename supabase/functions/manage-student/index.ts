import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Create user client using the incoming Authorization header to verify who is calling
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const {
      data: { user },
    } = await userClient.auth.getUser()

    if (!user) {
      throw new Error('User not authenticated')
    }

    // 2. Create admin client with the service role key to perform deletions and auth updates
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 3. Verify permissions: Only a user with the 'teacher' role is allowed to perform these operations
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || profile?.role !== 'teacher') {
      throw new Error('Only teachers are authorized to manage student profiles and accounts')
    }

    const { action, studentId, email } = await req.json()

    if (!studentId) {
      throw new Error('studentId is required')
    }

    // Action A: Safely Delete Student
    if (action === 'delete') {
      console.log(`Starting secure cascade deletion of student: ${studentId}`)

      // Delete child records sequentially with explicit error checking to pinpoint failures
      const { error: linkErr } = await supabaseClient.from('student_class_link').delete().eq('student_id', studentId)
      if (linkErr) {
        throw new Error(`Failed to delete student class links: ${linkErr.message}`)
      }

      const { error: checkinErr } = await supabaseClient.from('check_ins').delete().eq('student_id', studentId)
      if (checkinErr) {
        throw new Error(`Failed to delete student check-in history: ${checkinErr.message}`)
      }

      const { error: balanceErr } = await supabaseClient.from('balance_history').delete().eq('student_id', studentId)
      if (balanceErr) {
        throw new Error(`Failed to delete student balance history: ${balanceErr.message}`)
      }

      const { error: emailErr } = await supabaseClient.from('email_notifications').delete().eq('student_id', studentId)
      if (emailErr) {
        throw new Error(`Failed to delete student email notifications: ${emailErr.message}`)
      }

      const { error: profileErr } = await supabaseClient.from('profiles').delete().eq('id', studentId)
      if (profileErr) {
        throw new Error(`Failed to delete student public profile: ${profileErr.message}`)
      }

      // Delete the login account from Supabase Auth
      const { error: authDeleteError } = await supabaseClient.auth.admin.deleteUser(studentId)
      if (authDeleteError) {
        throw new Error(`Failed to delete student auth credentials: ${authDeleteError.message}`)
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Student and all related records deleted successfully' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    // Action B: Safely Update Student Email
    if (action === 'update-email') {
      if (!email) {
        throw new Error('email is required to update student email')
      }

      console.log(`Updating email for student ${studentId} to: ${email}`)

      // 1. Update the email in Supabase Auth (auth.users)
      const { error: authUpdateError } = await supabaseClient.auth.admin.updateUserById(
        studentId,
        { email: email, email_confirm: true }
      )
      if (authUpdateError) {
        throw new Error(`Failed to update student auth email: ${authUpdateError.message}`)
      }

      // 2. Update the email in public.profiles
      const { error: profileUpdateError } = await supabaseClient
        .from('profiles')
        .update({ email: email })
        .eq('id', studentId)

      if (profileUpdateError) {
        throw new Error(`Failed to update student profile email: ${profileUpdateError.message}`)
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Student email updated successfully in auth and profile schemas' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    throw new Error(`Unsupported action: ${action}`)

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
