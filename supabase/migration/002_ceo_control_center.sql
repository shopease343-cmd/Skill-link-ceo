-- Additive migration for the CEO Control Center.
-- Run after 001_initial_schema.sql.

create table if not exists public.admin_permissions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles(id) on delete cascade,
  permission_key text not null,
  granted_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(admin_id,permission_key)
);

create table if not exists public.platform_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.reward_rules (
  id uuid primary key default gen_random_uuid(),
  level integer not null unique references public.level_rules(level) on delete cascade,
  reward_name text not null,
  description text not null default '',
  image_url text,
  eligibility jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.package_courses (
  package_id uuid not null references public.packages(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(package_id,course_id)
);

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  discount_type text not null check(discount_type in ('percent','fixed')),
  discount_value numeric(12,2) not null check(discount_value >= 0),
  max_uses integer,
  used_count integer not null default 0 check(used_count >= 0),
  starts_at timestamptz,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists admin_permissions_admin_idx on public.admin_permissions(admin_id);
create index if not exists package_courses_course_idx on public.package_courses(course_id);
create index if not exists coupons_active_idx on public.coupons(is_active);

alter table public.admin_permissions enable row level security;
alter table public.platform_settings enable row level security;
alter table public.reward_rules enable row level security;
alter table public.package_courses enable row level security;
alter table public.coupons enable row level security;

-- Privileged writes are performed by the protected server using the service role.
-- No public client policy is granted for these CEO-controlled tables.

insert into public.reward_rules(level,reward_name,description)
values
(1,'Starter Reward','Starter recognition reward.'),
(2,'ID Card','Applicable SkillLink identification reward.'),
(3,'T-shirt','Applicable SkillLink merchandise reward.'),
(4,'Growth Reward','Configured by CEO.'),
(5,'Milestone Reward','Configured by CEO.'),
(6,'Advanced Reward','Configured by CEO.'),
(7,'Elite Reward','Configured by CEO.'),
(8,'Premium Reward','Configured by CEO.'),
(9,'Shikhar Reward','Configured by CEO.')
on conflict(level) do nothing;
