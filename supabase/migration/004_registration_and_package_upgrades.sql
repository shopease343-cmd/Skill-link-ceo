-- SkillLink registration fee + package bundle + upgrade accounting.
-- Run after 003_payments_and_checkout.sql.
alter table public.profiles add column if not exists registration_fee_paid numeric(12,2) not null default 0 check(registration_fee_paid >= 0);
alter table public.profiles add column if not exists registration_fee_paid_at timestamptz;
alter table public.orders add column if not exists order_purpose text not null default 'purchase' check(order_purpose in ('registration_bundle','purchase','upgrade'));
alter table public.orders add column if not exists registration_fee numeric(12,2) not null default 0 check(registration_fee >= 0);
alter table public.orders add column if not exists package_price numeric(12,2) not null default 0 check(package_price >= 0);
alter table public.orders add column if not exists upgrade_from_package_id uuid references public.packages(id);
create index if not exists orders_purpose_idx on public.orders(buyer_id,order_purpose,status);
