import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@17.0.0?target=deno'

Deno.serve(async (req) => {
  const signature = req.headers.get('stripe-signature')
  const body = await req.text()

  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
    apiVersion: '2024-06-20',
  })

  let event: Stripe.Event

  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature ?? '',
      Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? ''
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message)
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }

  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const companyId = session.metadata?.company_id
        const planId = session.metadata?.plan_id

        if (companyId && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
          const trialEndsAt = subscription.trial_end
            ? new Date(subscription.trial_end * 1000).toISOString()
            : null

          await adminClient
            .from('companies')
            .update({
              stripe_customer_id: session.customer as string,
              stripe_subscription_id: session.subscription as string,
              plan_id: planId,
              subscription_status: 'trial',
              trial_ends_at: trialEndsAt,
            })
            .eq('id', companyId)
        }
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const companyId = subscription.metadata?.company_id

        if (companyId) {
          let status = 'active'
          if (subscription.status === 'trialing') status = 'trial'
          else if (subscription.status === 'past_due') status = 'past_due'
          else if (subscription.status === 'canceled') status = 'cancelled'
          else if (subscription.status === 'active') status = 'active'

          await adminClient
            .from('companies')
            .update({ subscription_status: status })
            .eq('id', companyId)
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const companyId = subscription.metadata?.company_id

        if (companyId) {
          await adminClient
            .from('companies')
            .update({ subscription_status: 'cancelled' })
            .eq('id', companyId)
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId = invoice.subscription as string

        if (subscriptionId) {
          await adminClient
            .from('companies')
            .update({ subscription_status: 'past_due' })
            .eq('stripe_subscription_id', subscriptionId)
        }
        break
      }

      default:
        // Unhandled event types are fine to ignore
        break
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 })
  } catch (err) {
    console.error('Webhook processing error:', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})