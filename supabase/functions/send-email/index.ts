import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

console.log('Send Email function loaded')

interface EmailPayload {
  from: string
  to: string[]
  subject: string
  html: string
  text: string
  attachments?: Array<{
    filename: string
    path: string
    contentType: string
  }>
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
    // Get the email payload
    const emailPayload: EmailPayload = await req.json()

    console.log('Sending email to:', emailPayload.to)
    console.log('Email payload:', JSON.stringify(emailPayload, null, 2))

    // Send email via Resend API
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      console.error('RESEND_API_KEY not configured')
      return new Response(
        JSON.stringify({ error: 'Email service not configured' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Prepare the payload for Resend API
    const resendPayload: any = {
      from: emailPayload.from,
      to: emailPayload.to,
      subject: emailPayload.subject,
      html: emailPayload.html,
      text: emailPayload.text
    }

    // Add attachments if present
    if (emailPayload.attachments && emailPayload.attachments.length > 0) {
      console.log(`Processing ${emailPayload.attachments.length} attachments`)
      resendPayload.attachments = []

      for (const attachment of emailPayload.attachments) {
        try {
          console.log(`Processing attachment: ${attachment.filename} from ${attachment.path}`)

          // For URLs (https/http), fetch them first
          if (attachment.path.startsWith('http://') || attachment.path.startsWith('https://')) {
            console.log(`Fetching attachment from URL: ${attachment.path}`)
            const fileResponse = await fetch(attachment.path)

            if (!fileResponse.ok) {
              console.error(`Failed to fetch attachment: ${attachment.path} - Status: ${fileResponse.status}`)
              continue
            }

            const contentType = fileResponse.headers.get('content-type')
            console.log(`Attachment content-type: ${contentType}`)

            const fileBuffer = await fileResponse.arrayBuffer()
            console.log(`Attachment size: ${fileBuffer.byteLength} bytes`)

            // Convert to base64 properly
            const uint8Array = new Uint8Array(fileBuffer)
            let binaryString = ''
            for (let i = 0; i < uint8Array.length; i++) {
              binaryString += String.fromCharCode(uint8Array[i])
            }
            const base64Content = btoa(binaryString)

            resendPayload.attachments.push({
              filename: attachment.filename,
              content: base64Content,
              type: attachment.contentType
            })

            console.log(`Successfully processed attachment: ${attachment.filename}`)
          } else {
            // For local files, read from filesystem
            console.log(`Reading local file: ${attachment.path}`)
            const fileContent = await Deno.readFile(attachment.path)
            const base64Content = btoa(String.fromCharCode.apply(null, Array.from(fileContent)))

            resendPayload.attachments.push({
              filename: attachment.filename,
              content: base64Content,
              type: attachment.contentType
            })
          }
        } catch (error) {
          console.error(`Error processing attachment ${attachment.filename}:`, error)
        }
      }

      console.log(`Final attachments count: ${resendPayload.attachments.length}`)
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(resendPayload)
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Resend API error:', data)
      console.error('Response status:', response.status)
      console.error('Response headers available')
      return new Response(
        JSON.stringify({
          error: data.message || 'Failed to send email',
          details: data,
          status: response.status
        }),
        {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('Email sent successfully:', data.id)

    return new Response(
      JSON.stringify({ success: true, data }),
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