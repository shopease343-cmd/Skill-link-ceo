-- SkillLink API contract compatibility layer

-- Ensure only the current SkillLink auth trigger remains active.
drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists skilllink_on_auth_user_created on auth.users;
-- Run after 004_registration_and_package_upgrades.sql.
-- Keeps the current backend API contract compatible with the canonical schema.

alter table public.profiles add column if not exists username text;

create or replace function public.skilllink_handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare requested_username text; referral_code_from_metadata text; begin
  requested_username := new.raw_user_meta_data ->> 'username';
  referral_code_from_metadata := nullif(upper(trim(new.raw_user_meta_data ->> 'referral_code')), '');
  insert into public.profiles (id,username,full_name,role,status,referral_code,created_at,updated_at)
  values (new.id, coalesce(nullif(trim(requested_username),''), split_part(coalesce(new.email,''),'@',1)), nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 'student','active', public.skilllink_make_referral_code(), now(), now())
  on conflict (id) do nothing;
  if referral_code_from_metadata is not null then update public.profiles p set referred_by=(select rp.id from public.profiles rp where upper(rp.referral_code)=referral_code_from_metadata and rp.role='partner' and rp.status='active' limit 1), updated_at=now() where p.id=new.id; end if;
  return new;
end; $$;
create trigger skilllink_on_auth_user_created after insert on auth.users for each row execute function public.skilllink_handle_new_user();
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists avatar_url text;

update public.profiles
set username = coalesce(username, split_part(id::text, '-', 1) || '_' || right(replace(id::text,'-',''), 6))
where username is null;
create unique index if not exists profiles_username_unique_idx on public.profiles(username) where username is not null;

alter table public.packages add column if not exists price numeric(12,2);
alter table public.packages add column if not exists active boolean;
alter table public.packages add column if not exists featured boolean;
update public.packages set price = base_price where price is null;
update public.packages set active = is_active where active is null;
update public.packages set featured = is_featured where featured is null;

create or replace function public.sync_package_api_columns()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.price := coalesce(new.price, new.base_price);
    new.base_price := coalesce(new.base_price, new.price);
    new.active := coalesce(new.active, new.is_active);
    new.is_active := coalesce(new.is_active, new.active);
    new.featured := coalesce(new.featured, new.is_featured);
    new.is_featured := coalesce(new.is_featured, new.featured);
  else
    if new.base_price is distinct from old.base_price and new.price is not distinct from old.price then new.price := new.base_price; end if;
    if new.price is distinct from old.price and new.base_price is not distinct from old.base_price then new.base_price := new.price; end if;
    if new.is_active is distinct from old.is_active and new.active is not distinct from old.active then new.active := new.is_active; end if;
    if new.active is distinct from old.active and new.is_active is not distinct from old.is_active then new.is_active := new.active; end if;
    if new.is_featured is distinct from old.is_featured and new.featured is not distinct from old.featured then new.featured := new.is_featured; end if;
    if new.featured is distinct from old.featured and new.is_featured is not distinct from old.is_featured then new.is_featured := new.featured; end if;
  end if;
  return new;
end $$;
drop trigger if exists sync_package_api_columns on public.packages;
create trigger sync_package_api_columns before insert or update on public.packages for each row execute function public.sync_package_api_columns();

alter table public.enrollments add column if not exists user_id uuid references public.profiles(id) on delete cascade;
alter table public.enrollments add column if not exists order_id uuid references public.orders(id) on delete set null;
alter table public.enrollments add column if not exists enrolled_at timestamptz;
alter table public.enrollments add column if not exists expires_at timestamptz;
alter table public.masterclasses add column if not exists thumbnail_url text;
alter table public.workshops add column if not exists thumbnail_url text;
alter table public.masterclasses add column if not exists resources_url text;
alter table public.workshops add column if not exists resources_url text;
alter table public.masterclasses add column if not exists recording_url text;
alter table public.workshops add column if not exists recording_url text;
update public.enrollments set user_id = student_id where user_id is null;
update public.enrollments set enrolled_at = created_at where enrolled_at is null;

create or replace function public.sync_enrollment_api_columns()
returns trigger language plpgsql as $$
begin
  if new.student_id is null and new.user_id is not null then new.student_id := new.user_id; end if;
  if new.user_id is null and new.student_id is not null then new.user_id := new.student_id; end if;
  if new.enrolled_at is null then new.enrolled_at := coalesce(new.created_at, now()); end if;
  return new;
end $$;
drop trigger if exists sync_enrollment_api_columns on public.enrollments;
create trigger sync_enrollment_api_columns before insert or update on public.enrollments for each row execute function public.sync_enrollment_api_columns();

alter table public.orders add column if not exists user_id uuid references public.profiles(id);
alter table public.orders add column if not exists order_type text;
alter table public.orders add column if not exists updated_at timestamptz;
update public.orders set user_id = buyer_id where user_id is null;
update public.orders set updated_at = created_at where updated_at is null;
update public.orders set order_type = case when package_id is not null then 'package' when course_id is not null then 'course' when masterclass_id is not null then 'masterclass' when workshop_id is not null then 'workshop' end where order_type is null;

create or replace function public.sync_order_api_columns()
returns trigger language plpgsql as $$
begin
  if new.buyer_id is null and new.user_id is not null then new.buyer_id := new.user_id; end if;
  if new.user_id is null and new.buyer_id is not null then new.user_id := new.buyer_id; end if;
  if new.order_type is null then new.order_type := case when new.package_id is not null then 'package' when new.course_id is not null then 'course' when new.masterclass_id is not null then 'masterclass' when new.workshop_id is not null then 'workshop' end; end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists sync_order_api_columns on public.orders;
create trigger sync_order_api_columns before insert or update on public.orders for each row execute function public.sync_order_api_columns();

alter table public.referrals add column if not exists referrer_id uuid references public.profiles(id);
alter table public.referrals add column if not exists status text;
alter table public.referrals add column if not exists activated_at timestamptz;
update public.referrals set referrer_id = partner_id where referrer_id is null;
update public.referrals set status = case when attribution_status = 'attributed' then 'attributed' else attribution_status end where status is null;

create or replace function public.sync_referral_api_columns()
returns trigger language plpgsql as $$
begin
  if new.partner_id is null and new.referrer_id is not null then new.partner_id := new.referrer_id; end if;
  if new.referrer_id is null and new.partner_id is not null then new.referrer_id := new.partner_id; end if;
  if new.status is null then new.status := coalesce(new.attribution_status,'attributed'); end if;
  if new.attribution_status is null then new.attribution_status := new.status; end if;
  return new;
end $$;
drop trigger if exists sync_referral_api_columns on public.referrals;
create trigger sync_referral_api_columns before insert or update on public.referrals for each row execute function public.sync_referral_api_columns();

alter table public.commissions add column if not exists referred_user_id uuid references public.profiles(id);
alter table public.commissions add column if not exists package_id uuid references public.packages(id);
alter table public.commissions add column if not exists available_at timestamptz;
alter table public.commissions add column if not exists paid_at timestamptz;

alter table public.earnings_ledger add column if not exists transaction_type text;
alter table public.earnings_ledger add column if not exists balance_after numeric(12,2);
update public.earnings_ledger set transaction_type = type where transaction_type is null;
update public.earnings_ledger set balance_after = 0 where balance_after is null;

create or replace function public.sync_ledger_api_columns()
returns trigger language plpgsql as $$
begin
  if new.type is null and new.transaction_type is not null then new.type := new.transaction_type; end if;
  if new.transaction_type is null and new.type is not null then new.transaction_type := new.type; end if;
  return new;
end $$;
drop trigger if exists sync_ledger_api_columns on public.earnings_ledger;
create trigger sync_ledger_api_columns before insert or update on public.earnings_ledger for each row execute function public.sync_ledger_api_columns();

alter table public.withdrawals add column if not exists requested_at timestamptz;
alter table public.withdrawals add column if not exists payment_method text;
alter table public.withdrawals add column if not exists payment_reference text;
update public.withdrawals set requested_at = created_at where requested_at is null;
create or replace function public.set_withdrawal_requested_at() returns trigger language plpgsql as $$ begin new.requested_at := coalesce(new.requested_at, now()); return new; end $$;
drop trigger if exists set_withdrawal_requested_at on public.withdrawals;
create trigger set_withdrawal_requested_at before insert on public.withdrawals for each row execute function public.set_withdrawal_requested_at();

alter table public.payments add column if not exists paid_at timestamptz;
update public.payments set paid_at = verified_at where paid_at is null;

alter table public.platform_settings add column if not exists setting_key text;
alter table public.platform_settings add column if not exists setting_value jsonb;
update public.platform_settings set setting_key = key where setting_key is null;
update public.platform_settings set setting_value = value where setting_value is null;
create unique index if not exists platform_settings_setting_key_idx on public.platform_settings(setting_key) where setting_key is not null;

-- Keep the legacy reward API table name available as an updatable view over reward_rules.
drop view if exists public.level_rewards;
create view public.level_rewards as
select id, level, reward_name, description, image_url, eligibility, is_active, created_at, updated_at
from public.reward_rules;

-- Common API indexes.
create index if not exists orders_user_idx on public.orders(user_id);
create index if not exists enrollments_user_idx on public.enrollments(user_id);
create index if not exists referrals_referrer_idx on public.referrals(referrer_id);
create index if not exists withdrawals_requested_idx on public.withdrawals(requested_at);


create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.profiles(id) on delete set null,
  assigned_partner_id uuid references public.profiles(id) on delete set null,
  title text not null,
  description text not null default '',
  budget numeric(12,2) not null default 0 check(budget >= 0),
  status text not null default 'open' check(status in ('open','assigned','in_progress','submitted','completed','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.projects enable row level security;
create index if not exists projects_client_idx on public.projects(client_id);
create index if not exists projects_partner_idx on public.projects(assigned_partner_id);
create index if not exists projects_status_idx on public.projects(status);
