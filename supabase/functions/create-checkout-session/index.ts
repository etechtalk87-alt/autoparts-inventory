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
    const { plan_id } = await req.json()

    if (!plan_id) {
      return new Response(
        JSON.stringify({ error: 'plan_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify the caller
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

    // Confirm caller is a company_admin, get their company
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

    // Look up the plan's Stripe price ID
    const { data: planRow, error: planError } = await adminClient
      .from('subscription_plans')
      .select('id, stripe_price_id, name')
      .eq('id', plan_id)
      .maybeSingle()

    if (planError || !planRow || !planRow.stripe_price_id) {
      return new Response(
        JSON.stringify({ error: 'Invalid plan selected' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get the company's existing Stripe customer ID, if any
    const { data: companyRow } = await adminClient
      .from('companies')
      .select('name, stripe_customer_id')
      .eq('id', staffRow.company_id)
      .maybeSingle()

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2024-06-20',
    })

    const appUrl = Deno.env.get('APP_URL') ?? 'https://apinv-system.vercel.app'

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      line_items: [{ price: planRow.stripe_price_id, quantity: 1 }],
      subscription_data: {
        trial_period_days: 30,
        metadata: { company_id: staffRow.company_id, plan_id: planRow.id },
      },
      success_url: `${appUrl}/settings?billing=success`,
      cancel_url: `${appUrl}/settings?billing=cancelled`,
      metadata: { company_id: staffRow.company_id, plan_id: planRow.id },
    }

    // Reuse existing Stripe customer if we have one, otherwise create new
    if (companyRow?.stripe_customer_id) {
      sessionParams.customer = companyRow.stripe_customer_id
    } else {
      sessionParams.customer_email = callerUser.email
    }

    const session = await stripe.checkout.sessions.create(sessionParams)

    return new Response(
      JSON.stringify({ url: session.url }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('Checkout session error:', err)
    return new Response(
      JSON.stringify({ error: `Unexpected error: ${err.message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})