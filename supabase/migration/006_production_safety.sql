-- SkillLink production safety compatibility layer.
-- Non-destructive: no tables/data are dropped.
-- Run after 005_api_contract_compatibility.sql.

-- Public signup must always create a valid non-null profile name, even if a
-- client omits full_name metadata. Privileged roles are still never accepted
-- from signup metadata.
create or replace function public.skilllink_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_username text;
  requested_full_name text;
  referral_code_from_metadata text;
begin
  requested_username := nullif(trim(new.raw_user_meta_data ->> 'username'), '');
  requested_full_name := nullif(trim(new.raw_user_meta_data ->> 'full_name'), '');
  referral_code_from_metadata := nullif(upper(trim(new.raw_user_meta_data ->> 'referral_code')), '');

  insert into public.profiles (
    id, username, full_name, role, status, referral_code, created_at, updated_at
  )
  values (
    new.id,
    coalesce(requested_username, split_part(coalesce(new.email, ''), '@', 1), 'member'),
    coalesce(requested_full_name, split_part(coalesce(new.email, ''), '@', 1), 'Member'),
    'student',
    'active',
    public.skilllink_make_referral_code(),
    now(),
    now()
  )
  on conflict (id) do nothing;

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
    where p.id = new.id;
  end if;

  return new;
end;
$$;

-- Keep the expected trigger attached exactly once.
drop trigger if exists skilllink_on_auth_user_created on auth.users;
create trigger skilllink_on_auth_user_created
after insert on auth.users
for each row execute function public.skilllink_handle_new_user();
