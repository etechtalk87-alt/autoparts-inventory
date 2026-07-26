import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, role, branch_ids } = await req.json()

    if (!email || !role) {
      return new Response(
        JSON.stringify({ error: 'email and role are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (role === 'branch_staff' && (!branch_ids || branch_ids.length === 0)) {
      return new Response(
        JSON.stringify({ error: 'branch_staff invites require at least one branch_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Client using the CALLER's auth token — to verify who's calling
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

    // Admin client using service_role — for privileged operations
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Verify caller is actually a company_admin, and get their company_id
    const { data: callerStaff, error: staffError } = await adminClient
      .from('staff')
      .select('id, company_id, role')
      .eq('id', callerUser.id)
      .maybeSingle()

    if (staffError || !callerStaff || callerStaff.role !== 'company_admin') {
      return new Response(
        JSON.stringify({ error: 'Only company admins can invite staff' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify branch_ids (if any) actually belong to the admin's company
    if (branch_ids && branch_ids.length > 0) {
      const { data: validBranches } = await adminClient
        .from('branches')
        .select('id')
        .eq('company_id', callerStaff.company_id)
        .in('id', branch_ids)

      if (!validBranches || validBranches.length !== branch_ids.length) {
        return new Response(
          JSON.stringify({ error: 'One or more branch_ids are invalid for this company' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Insert the invite record
    const { data: invite, error: insertError } = await adminClient
      .from('staff_invites')
      .insert({
        email,
        company_id: callerStaff.company_id,
        role,
        branch_ids: branch_ids ?? [],
        invited_by: callerStaff.id,
      })
      .select()
      .maybeSingle()

    if (insertError) {
      return new Response(
        JSON.stringify({ error: `Failed to create invite: ${insertError.message}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Send the actual invite email via Supabase Auth
    const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: { invite_id: invite.id },
    })

    if (inviteError) {
      // Roll back the invite row so it's not left dangling if the email failed
      await adminClient.from('staff_invites').delete().eq('id', invite.id)
      return new Response(
        JSON.stringify({ error: `Failed to send invite email: ${inviteError.message}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, invite }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Unexpected error: ${err.message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})