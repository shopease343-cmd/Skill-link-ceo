-- SkillLink profile/auth compatibility migration
-- Safe for the current public.profiles schema:
-- id, username, full_name, phone, avatar_url, role, status,
-- referral_code, referred_by, created_at, updated_at.
-- Public signups always get role='student'. Privileged roles must be assigned by an authorized CEO/Admin workflow.

create or replace function public.skilllink_make_referral_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate text;
begin
  loop
    candidate := 'SL-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 10));
    exit when not exists (
      select 1 from public.profiles where referral_code = candidate
    );
  end loop;
  return candidate;
end;
$$;

create or replace function public.skilllink_make_username(
  requested_username text,
  user_email text,
  user_id uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  base text;
  candidate text;
  suffix text;
begin
  base := lower(
    regexp_replace(
      coalesce(
        nullif(trim(requested_username), ''),
        split_part(coalesce(user_email, ''), '@', 1),
        'user'
      ),
      '[^a-z0-9_]+',
      '_',
      'g'
    )
  );

  base := trim(both '_' from base);

  if base = '' then
    base := 'user';
  end if;

  base := left(base, 40);
  candidate := base;

  if exists (select 1 from public.profiles where username = candidate) then
    suffix := '_' || substr(replace(user_id::text, '-', ''), 1, 8);
    candidate := left(base, 31) || suffix;
  end if;

  return candidate;
end;
$$;

create or replace function public.skilllink_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_username text;
  referral_code_from_metadata text;
  new_profile_id uuid;
begin
  requested_username := new.raw_user_meta_data ->> 'username';
  referral_code_from_metadata := nullif(
    upper(trim(new.raw_user_meta_data ->> 'referral_code')),
    ''
  );

  insert into public.profiles (
    id,
    username,
    full_name,
    role,
    status,
    referral_code,
    created_at,
    updated_at
  )
  values (
    new.id,
    public.skilllink_make_username(requested_username, new.email, new.id),
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    'student',
    'active',
    public.skilllink_make_referral_code(),
    now(),
    now()
  )
  on conflict (id) do nothing
  returning id into new_profile_id;

  if referral_code_from_metadata is not null then
    update public.profiles p
    set referred_by = (
      select rp.id
      from public.profiles rp
      where upper(rp.referral_code) = referral_code_from_metadata
        and rp.role = 'partner'
        and rp.status = 'active'
      limit 1
    ),
    updated_at = now()
    where p.id = new.id
      and exists (
        select 1
        from public.profiles rp
        where upper(rp.referral_code) = referral_code_from_metadata
          and rp.role = 'partner'
          and rp.status = 'active'
      );
  end if;

  return new;
end;
$$;

drop trigger if exists skilllink_on_auth_user_created on auth.users;

create trigger skilllink_on_auth_user_created
after insert on auth.users
for each row
execute function public.skilllink_handle_new_user();

-- Backfill Auth users that already exist but have no profile.
-- They are deliberately created as normal students; this does NOT grant CEO/Admin privileges.
insert into public.profiles (
  id,
  username,
  full_name,
  role,
  status,
  referral_code,
  created_at,
  updated_at
)
select
  u.id,
  public.skilllink_make_username(
    u.raw_user_meta_data ->> 'username',
    u.email,
    u.id
  ),
  nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
  'student',
  'active',
  public.skilllink_make_referral_code(),
  coalesce(u.created_at, now()),
  now()
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

-- Verify the result.
select
  u.id,
  u.email,
  p.username,
  p.full_name,
  p.role,
  p.status,
  p.referral_code
from auth.users u
left join public.profiles p on p.id = u.id
order by u.created_at desc;
