create extension if not exists pgcrypto;

create type public.app_role as enum ('ceo','admin','partner','instructor','student');
create type public.account_status as enum ('active','pending','suspended','disabled');
create type public.content_status as enum ('draft','pending_review','published','rejected','archived');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role public.app_role not null default 'student',
  status public.account_status not null default 'active',
  referral_code text unique,
  referred_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.packages (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  subtitle text not null,
  description text not null default '',
  base_price numeric(12,2) not null check(base_price >= 0),
  access_days integer,
  is_active boolean not null default true,
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid references public.profiles(id) on delete set null,
  title text not null,
  slug text unique not null,
  description text not null default '',
  price numeric(12,2) not null default 0 check(price >= 0),
  status public.content_status not null default 'draft',
  thumbnail_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  position integer not null check(position >= 0),
  content text not null default '',
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  unique(course_id,position)
);

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  package_id uuid references public.packages(id) on delete set null,
  status text not null default 'active' check(status in ('active','completed','cancelled')),
  progress numeric(5,2) not null default 0 check(progress between 0 and 100),
  created_at timestamptz not null default now(),
  check(course_id is not null or package_id is not null)
);

create table public.masterclasses (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid references public.profiles(id) on delete set null,
  title text not null,
  description text not null default '',
  price numeric(12,2) not null default 0 check(price >= 0),
  scheduled_at timestamptz,
  seats integer check(seats is null or seats > 0),
  mode text not null default 'live' check(mode in ('live','recorded')),
  status public.content_status not null default 'draft',
  created_at timestamptz not null default now()
);

create table public.workshops (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid references public.profiles(id) on delete set null,
  title text not null,
  description text not null default '',
  price numeric(12,2) not null default 0 check(price >= 0),
  scheduled_at timestamptz,
  seats integer check(seats is null or seats > 0),
  status public.content_status not null default 'draft',
  created_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles(id),
  package_id uuid references public.packages(id),
  course_id uuid references public.courses(id),
  masterclass_id uuid references public.masterclasses(id),
  workshop_id uuid references public.workshops(id),
  amount numeric(12,2) not null check(amount >= 0),
  currency text not null default 'INR',
  status text not null default 'pending' check(status in ('pending','paid','failed','refunded','cancelled')),
  referral_code text,
  created_at timestamptz not null default now(),
  check(num_nonnulls(package_id,course_id,masterclass_id,workshop_id)=1)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid unique not null references public.orders(id) on delete cascade,
  provider text not null,
  provider_payment_id text unique,
  amount numeric(12,2) not null check(amount >= 0),
  status text not null default 'pending' check(status in ('pending','verified','failed','refunded')),
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.profiles(id),
  referred_user_id uuid references public.profiles(id),
  referral_code text not null,
  order_id uuid references public.orders(id),
  attribution_status text not null default 'attributed',
  created_at timestamptz not null default now()
);

create table public.commissions (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.profiles(id),
  order_id uuid not null references public.orders(id),
  amount numeric(12,2) not null check(amount >= 0),
  status text not null default 'pending' check(status in ('pending','available','reversed')),
  created_at timestamptz not null default now(),
  unique(partner_id,order_id)
);

create table public.earnings_ledger (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.profiles(id),
  type text not null check(type in ('commission','withdrawal','adjustment','reversal')),
  amount numeric(12,2) not null,
  reference_id uuid,
  description text not null default '',
  created_at timestamptz not null default now()
);

create table public.withdrawals (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.profiles(id),
  amount numeric(12,2) not null check(amount > 0),
  status text not null default 'pending' check(status in ('pending','approved','rejected')),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  note text,
  created_at timestamptz not null default now()
);

create table public.qr_codes (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.profiles(id) on delete cascade,
  code text unique not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id),
  course_id uuid references public.courses(id),
  masterclass_id uuid references public.masterclasses(id),
  workshop_id uuid references public.workshops(id),
  rating integer not null check(rating between 1 and 5),
  body text not null default '',
  status text not null default 'pending' check(status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  check(num_nonnulls(course_id,masterclass_id,workshop_id)=1)
);

create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id),
  course_id uuid references public.courses(id),
  enrollment_id uuid references public.enrollments(id),
  certificate_number text unique not null,
  issued_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  subject text not null,
  message text not null,
  status text not null default 'open' check(status in ('open','in_progress','resolved','closed')),
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.level_rules (
  level integer primary key check(level between 1 and 9),
  points_required integer not null check(points_required >= 0),
  referral_required integer not null default 0 check(referral_required >= 0),
  skill_mastery_required boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.member_progress (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  points integer not null default 0 check(points >= 0),
  valid_referrals integer not null default 0 check(valid_referrals >= 0),
  current_level integer not null default 1 check(current_level between 1 and 9),
  updated_at timestamptz not null default now()
);

insert into public.packages(name,subtitle,base_price) values
('Aarambh','Digital Foundation',499),
('Udaan','Creative + Content Skills',999),
('Pragati','Marketing + Client Skills',1999),
('Brahmastra','Advanced Digital Skills',3999),
('Shikhar','Leadership + Business',6999)
on conflict(name) do nothing;

insert into public.level_rules(level,points_required) values
(1,100),(2,250),(3,400),(4,500),(5,650),(6,800),(7,1000),(8,1500),(9,2000)
on conflict(level) do nothing;

create index courses_status_idx on public.courses(status);
create index courses_instructor_idx on public.courses(instructor_id);
create index orders_buyer_idx on public.orders(buyer_id);
create index orders_status_idx on public.orders(status);
create index commissions_partner_idx on public.commissions(partner_id);
create index ledger_partner_idx on public.earnings_ledger(partner_id);
create index withdrawals_partner_idx on public.withdrawals(partner_id);
create index audit_actor_idx on public.audit_logs(actor_id);

alter table public.profiles enable row level security;
alter table public.packages enable row level security;
alter table public.courses enable row level security;
alter table public.lessons enable row level security;
alter table public.enrollments enable row level security;
alter table public.masterclasses enable row level security;
alter table public.workshops enable row level security;
alter table public.orders enable row level security;
alter table public.payments enable row level security;
alter table public.referrals enable row level security;
alter table public.commissions enable row level security;
alter table public.earnings_ledger enable row level security;
alter table public.withdrawals enable row level security;
alter table public.qr_codes enable row level security;
alter table public.reviews enable row level security;
alter table public.certificates enable row level security;
alter table public.notifications enable row level security;
alter table public.support_tickets enable row level security;
alter table public.audit_logs enable row level security;
alter table public.level_rules enable row level security;
alter table public.member_progress enable row level security;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  incoming_ref text;
  partner_id uuid;
  new_ref text;
begin
  incoming_ref:=upper(nullif(trim(coalesce(new.raw_user_meta_data->>'referral_code','')),''));
  select id into partner_id from public.profiles where upper(referral_code)=incoming_ref and role='partner' and status='active' limit 1;
  new_ref:='SL-'||upper(substr(replace(new.id::text,'-',''),1,8));
  insert into public.profiles(id,full_name,role,status,referral_code,referred_by)
  values(new.id,coalesce(new.raw_user_meta_data->>'full_name',''),'student','active',new_ref,partner_id);
  insert into public.member_progress(user_id) values(new.id);
  if partner_id is not null then
    insert into public.referrals(partner_id,referred_user_id,referral_code,attribution_status)
    values(partner_id,new.id,incoming_ref,'attributed');
    update public.member_progress set valid_referrals=valid_referrals+1,updated_at=now() where user_id=partner_id;
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create policy "public can view published courses" on public.courses
for select using (status='published');

create policy "users view own profile" on public.profiles
for select using (auth.uid()=id);

create policy "users update own profile" on public.profiles
for update using (auth.uid()=id);

create policy "public can view active packages" on public.packages
for select using (is_active=true);

create policy "users view own enrollments" on public.enrollments
for select using (auth.uid()=student_id);

create policy "users view own notifications" on public.notifications
for select using (auth.uid()=user_id);

create policy "users view own progress" on public.member_progress
for select using (auth.uid()=user_id);
