alter table public.donor_vehicles
add column if not exists purchase_price numeric(12,2);

alter table public.donor_vehicles
add column if not exists purchase_currency text default 'AED';

alter table public.donor_vehicles
add constraint if not exists donor_vehicles_purchase_currency_check check (purchase_currency in ('AED', 'USD'));