-- SkillLink v9 payment/checkout support.
-- Run after 001_initial_schema.sql and 002_ceo_control_center.sql.
alter table public.payments add column if not exists provider_order_id text;
alter table public.payments add column if not exists provider_event_id text;
alter table public.payments add column if not exists raw_status text;
create unique index if not exists payments_provider_order_id_uidx on public.payments(provider_order_id) where provider_order_id is not null;
create unique index if not exists payments_provider_event_id_uidx on public.payments(provider_event_id) where provider_event_id is not null;
create index if not exists orders_buyer_status_idx on public.orders(buyer_id,status);
create index if not exists payments_order_status_idx on public.payments(order_id,status);

-- Partner commission is controlled by CEO and is never calculated from frontend input.
alter table public.packages add column if not exists partner_commission numeric(12,2) not null default 0 check(partner_commission >= 0);
