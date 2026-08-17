alter table public.profiles
  add column if not exists disabled_at timestamptz;

create index if not exists profiles_disabled_at_idx
  on public.profiles (disabled_at);

create or replace function public.current_user_role()
returns public.user_role
language sql
security definer
stable
as $$
  select case
    when exists (select 1 from public.profiles where id = auth.uid() and disabled_at is not null) then null::public.user_role
    else coalesce((select role from public.profiles where id = auth.uid()), 'deal'::public.user_role)
  end;
$$;
