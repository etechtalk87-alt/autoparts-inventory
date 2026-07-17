alter table public.donor_vehicles
add column if not exists deleted_at timestamp with time zone;

create index if not exists donor_vehicles_deleted_at_idx on public.donor_vehicles (deleted_at);
