-- Fix intermittent workspace load failures caused by timeout on
-- /rest/v1/deal_documents?select=* for scoped users.
--
-- Run after the role-scope and disabled-user migrations.

create index if not exists deal_documents_deal_id_idx
  on public.deal_documents (deal_id);

create index if not exists deal_notes_deal_id_idx
  on public.deal_notes (deal_id);

create index if not exists tour_books_deal_id_idx
  on public.tour_books (deal_id);

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

create or replace function public.current_user_is_active_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.disabled_at is null
  );
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

create or replace function public.current_profile_brand_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select case
    when p.disabled_at is not null then null::uuid
    else p.brand_id
  end
  from (select auth.uid() as user_id) current_auth
  left join public.profiles p on p.id = current_auth.user_id;
$$;

create or replace function public.current_profile_deal_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select case
    when p.disabled_at is not null then null::uuid
    else p.deal_id
  end
  from (select auth.uid() as user_id) current_auth
  left join public.profiles p on p.id = current_auth.user_id;
$$;

create or replace function public.current_profile_broker_name()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select case
    when p.disabled_at is not null then null::text
    else nullif(lower(trim(p.broker_name)), '')
  end
  from (select auth.uid() as user_id) current_auth
  left join public.profiles p on p.id = current_auth.user_id;
$$;

create or replace function public.current_user_brand_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select public.current_profile_brand_id();
$$;

create or replace function public.current_user_deal_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select public.current_profile_deal_id();
$$;

create or replace function public.current_user_broker_name()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select public.current_profile_broker_name();
$$;

create or replace function public.current_user_can_access_brand(brand_uuid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  with profile_scope as (
    select
      coalesce(p.role, 'deal'::public.user_role) as role,
      p.brand_id,
      p.deal_id,
      nullif(lower(trim(p.broker_name)), '') as broker_name,
      p.disabled_at
    from (select auth.uid() as user_id) current_auth
    left join public.profiles p on p.id = current_auth.user_id
  )
  select case
    when auth.role() <> 'authenticated' then false
    when (select disabled_at from profile_scope) is not null then false
    when (select role from profile_scope) = 'admin' then true
    when exists (
      select 1
      from public.brands b
      where b.id = brand_uuid
        and b.is_hidden
    ) then false
    when (select role from profile_scope) = 'mapiq' then true
    when (select role from profile_scope) = 'broker' then exists (
      select 1
      from public.deals d
      where d.brand_id = brand_uuid
        and exists (
          select 1
          from regexp_split_to_table(lower(coalesce(d.broker, '')), '\s*[,/&]\s*') broker_code
          where broker_code = (select broker_name from profile_scope)
        )
    )
    when (select role from profile_scope) = 'brand' then brand_uuid = (select brand_id from profile_scope)
    when (select role from profile_scope) = 'deal' then exists (
      select 1
      from public.deals d
      where d.id = (select deal_id from profile_scope)
        and d.brand_id = brand_uuid
    ) or brand_uuid = (select brand_id from profile_scope)
    else false
  end;
$$;

create or replace function public.current_user_can_access_deal(deal_uuid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  with profile_scope as (
    select
      coalesce(p.role, 'deal'::public.user_role) as role,
      p.brand_id,
      p.deal_id,
      nullif(lower(trim(p.broker_name)), '') as broker_name,
      p.disabled_at
    from (select auth.uid() as user_id) current_auth
    left join public.profiles p on p.id = current_auth.user_id
  )
  select case
    when auth.role() <> 'authenticated' then false
    when (select disabled_at from profile_scope) is not null then false
    when (select role from profile_scope) = 'admin' then true
    when exists (
      select 1
      from public.deals d
      join public.brands b on b.id = d.brand_id
      where d.id = deal_uuid
        and b.is_hidden
    ) then false
    when (select role from profile_scope) = 'mapiq' then true
    when (select role from profile_scope) = 'broker' then exists (
      select 1
      from public.deals d
      where d.id = deal_uuid
        and exists (
          select 1
          from regexp_split_to_table(lower(coalesce(d.broker, '')), '\s*[,/&]\s*') broker_code
          where broker_code = (select broker_name from profile_scope)
        )
    )
    when (select role from profile_scope) = 'brand' then exists (
      select 1
      from public.deals d
      where d.id = deal_uuid
        and d.brand_id = (select brand_id from profile_scope)
    )
    when (select role from profile_scope) = 'deal' then deal_uuid = (select deal_id from profile_scope)
    else false
  end;
$$;

create or replace function public.current_user_can_access_site(site_uuid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.sites s
    where s.id = site_uuid
      and public.current_user_can_access_deal(s.deal_id)
  );
$$;

drop policy if exists "profiles select own admin or reimagine team" on public.profiles;
create policy "profiles select own admin or reimagine team"
on public.profiles
for select
using (
  auth.role() = 'authenticated'
  and not public.current_user_is_disabled()
  and (
    id = auth.uid()
    or public.current_user_is_active_admin()
    or lower(coalesce(email, '')) like '%@reimagine.com'
    or lower(coalesce(email, '')) like '%@reimaginecre.com'
  )
);

drop policy if exists "admins manage profiles" on public.profiles;
create policy "admins manage profiles"
on public.profiles
for all
using (public.current_user_is_active_admin())
with check (public.current_user_is_active_admin());

grant execute on function public.current_user_is_disabled() to anon, authenticated;
grant execute on function public.current_user_is_active_admin() to anon, authenticated;
grant execute on function public.current_user_role() to anon, authenticated;
grant execute on function public.current_profile_brand_id() to anon, authenticated;
grant execute on function public.current_profile_deal_id() to anon, authenticated;
grant execute on function public.current_profile_broker_name() to anon, authenticated;
grant execute on function public.current_user_brand_id() to anon, authenticated;
grant execute on function public.current_user_deal_id() to anon, authenticated;
grant execute on function public.current_user_broker_name() to anon, authenticated;
grant execute on function public.current_user_can_access_brand(uuid) to anon, authenticated;
grant execute on function public.current_user_can_access_deal(uuid) to anon, authenticated;
grant execute on function public.current_user_can_access_site(uuid) to anon, authenticated;
