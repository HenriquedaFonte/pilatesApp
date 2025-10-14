import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, origin } = await req.json()

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const redirectTo = origin ? `${origin}/reset-password` : `${new URL(req.url).origin}/reset-password`

    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Generate recovery link
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        redirectTo: redirectTo
      }
    })

    if (error) {
      console.error('Error generating recovery link:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to generate recovery link' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const resetLink = data.properties?.action_link

    if (!resetLink) {
      return new Response(
        JSON.stringify({ error: 'Failed to generate reset link' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Send the email using the send-email function
    const emailPayload = {
      from: 'Josi Pilates <josi@josipilates.com>',
      to: [email],
      subject: 'Password Reset - Josi Pilates',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Reset - Josi Pilates</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #01b48d 0%, #017a6b 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Josi Pilates</h1>
            <p style="color: #f0f0f0; margin: 5px 0 0 0; font-size: 16px;">Password Reset Requested</p>
          </div>

          <div style="background: white; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 10px 10px;">
            <h2 style="color: #1e293b; margin-top: 0;">Hello!</h2>

            <p>We received a request to reset your Josi Pilates account password.</p>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}"
                 style="background: linear-gradient(135deg, #01b48d 0%, #017a6b 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px; box-shadow: 0 4px 15px rgba(1, 180, 141, 0.4);">
                Reset My Password
              </a>
            </div>

            <p>This link is valid for 1 hour. For security reasons, it will automatically expire after 1 hour.</p>

            <p>If you did not request this reset, please ignore this email.</p>

            <hr style="margin: 30px 0; border: none; border-top: 1px solid #e2e8f0;">

            <p style="color: #64748b; font-size: 14px; text-align: center;">
              Contact: +1 (438) 274-8396 | josi@josipilates.com<br>
              Sincerely,<br>
              The Josi Pilates Team<br>
              © 2024 Josi Pilates. All rights reserved.
            </p>
          </div>
        </body>
        </html>
      `,
      text: `
Password Reset - Josi Pilates

Hello!

We received a request to reset your Josi Pilates account password.

Reset My Password: ${resetLink}

This link is valid for 1 hour. For security reasons, it will automatically expire after 1 hour.

If you did not request this reset, please ignore this email.

Contact: +1 (438) 274-8396 | josi@josipilates.com

Sincerely,
The Josi Pilates Team
© 2024 Josi Pilates. All rights reserved.
      `
    }

    const emailResponse = await supabaseAdmin.functions.invoke('send-email', {
      body: emailPayload
    })

    if (emailResponse.error) {
      console.error('Error sending email:', emailResponse.error)
      return new Response(
        JSON.stringify({ error: 'Failed to send email' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in reset-password function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})