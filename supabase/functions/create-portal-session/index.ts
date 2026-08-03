import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@17.0.0?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader ?? '' } } }
    )

    const { data: { user: callerUser }, error: callerError } = await callerClient.auth.getUser()
    if (callerError || !callerUser) {
      return new Response(
        JSON.stringify({ error: 'Not authenticated' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: staffRow, error: staffError } = await adminClient
      .from('staff')
      .select('company_id, role')
      .eq('id', callerUser.id)
      .maybeSingle()

    if (staffError || !staffRow || staffRow.role !== 'company_admin') {
      return new Response(
        JSON.stringify({ error: 'Only company admins can manage billing' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: companyRow, error: companyError } = await adminClient
      .from('companies')
      .select('stripe_customer_id')
      .eq('id', staffRow.company_id)
      .maybeSingle()

    if (companyError || !companyRow?.stripe_customer_id) {
      return new Response(
        JSON.stringify({ error: 'No billing account found. Please subscribe to a plan first.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2024-06-20',
    })

    const appUrl = Deno.env.get('APP_URL') ?? 'https://apinv-system.vercel.app'

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: companyRow.stripe_customer_id,
      return_url: `${appUrl}/billing`,
    })

    return new Response(
      JSON.stringify({ url: portalSession.url }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('Portal session error:', err)
    return new Response(
      JSON.stringify({ error: `Unexpected error: ${err.message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})