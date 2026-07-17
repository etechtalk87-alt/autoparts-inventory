import { supabase } from './supabaseClient'

export async function logAuditEvent({ tableName, recordId, action, performedBy, companyId, snapshot }) {
  const auditRow = {
    table_name: tableName,
    record_id: recordId,
    action,
    performed_by: performedBy,
    company_id: companyId,
    snapshot: snapshot || null,
  }

  const { error } = await supabase.from('audit_log').insert([auditRow])

  if (error) {
    console.error('Audit log error:', error)
  }

  return { error }
}
