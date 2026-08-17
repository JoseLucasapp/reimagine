alter table public.profiles
  add column if not exists disabled_at timestamptz;

create index if not exists profiles_disabled_at_idx
  on public.profiles (disabled_at);

create or replace function public.current_user_is_disabled()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((
    select p.disabled_at is not null
    from public.profiles p
    where p.id = auth.uid()
    limit 1
  ), false);
$$;

create or replace function public.current_user_role()
returns public.user_role
language sql
security definer
stable
set search_path = public
as $$
  select case
    when auth.role() <> 'authenticated' then null::public.user_role
    when p.disabled_at is not null then null::public.user_role
    else coalesce(p.role, 'deal'::public.user_role)
  end
  from (select auth.uid() as user_id) current_auth
  left join public.profiles p on p.id = current_auth.user_id;
$$;

grant execute on function public.current_user_is_disabled() to anon, authenticated;
grant execute on function public.current_user_role() to anon, authenticated;
