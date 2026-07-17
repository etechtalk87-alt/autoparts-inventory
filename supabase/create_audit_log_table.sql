create table if not exists public.audit_log (
  id uuid default gen_random_uuid() primary key,
  table_name text not null,
  record_id uuid,
  action text not null,
  performed_by uuid,
  company_id uuid not null,
  performed_at timestamp with time zone default now() not null,
  snapshot jsonb
);

create index if not exists audit_log_table_name_idx on public.audit_log (table_name);
create index if not exists audit_log_performed_by_idx on public.audit_log (performed_by);
create index if not exists audit_log_record_id_idx on public.audit_log (record_id);
