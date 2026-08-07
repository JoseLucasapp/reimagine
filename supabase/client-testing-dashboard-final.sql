-- Final client-testing cleanup and role-scope updates.
-- Run after supabase/add-broker-role-and-test-scopes.sql if the broker enum
-- has not already been added in the target Supabase project.

alter table public.profiles
  add column if not exists broker_name text;

alter table public.brands
  add column if not exists is_hidden boolean not null default false;

create or replace function public.normalize_user_role(value text)
returns public.user_role
language sql
immutable
as $$
  select case
    when lower(coalesce(value, '')) = 'admin' then 'admin'::public.user_role
    when lower(coalesce(value, '')) in ('broker', 'reimagine_broker') then 'broker'::public.user_role
    when lower(coalesce(value, '')) in ('brand', 'franchisor') then 'brand'::public.user_role
    when lower(coalesce(value, '')) in ('deal', 'franchisee') then 'deal'::public.user_role
    else 'deal'::public.user_role
  end;
$$;

create or replace function public.current_profile_broker_name()
returns text
language sql
security definer
stable
as $$
  select nullif(lower(trim(broker_name)), '') from public.profiles where id = auth.uid();
$$;

create or replace function public.current_user_can_access_brand(brand_uuid uuid)
returns boolean
language sql
security definer
stable
as $$
  select case
    when auth.role() <> 'authenticated' then false
    when public.current_user_role()::text = 'admin' then true
    when exists (
      select 1
      from public.brands b
      where b.id = brand_uuid
        and b.is_hidden
    ) then false
    when public.current_user_role()::text = 'broker' then true
    when public.current_user_role()::text = 'brand' then brand_uuid = public.current_profile_brand_id()
    when public.current_user_role()::text = 'deal' then exists (
      select 1 from public.deals d
      where d.id = public.current_profile_deal_id()
        and d.brand_id = brand_uuid
    ) or brand_uuid = public.current_profile_brand_id()
    else false
  end;
$$;

create or replace function public.current_user_can_access_deal(deal_uuid uuid)
returns boolean
language sql
security definer
stable
as $$
  select case
    when auth.role() <> 'authenticated' then false
    when public.current_user_role()::text = 'admin' then true
    when exists (
      select 1
      from public.deals d
      join public.brands b on b.id = d.brand_id
      where d.id = deal_uuid
        and b.is_hidden
    ) then false
    when public.current_user_role()::text = 'broker' then true
    when public.current_user_role()::text = 'brand' then exists (
      select 1 from public.deals d
      where d.id = deal_uuid
        and d.brand_id = public.current_profile_brand_id()
    )
    when public.current_user_role()::text = 'deal' then deal_uuid = public.current_profile_deal_id()
    else false
  end;
$$;

drop policy if exists "profiles select own admin or reimagine team" on public.profiles;
create policy "profiles select own admin or reimagine team"
on public.profiles
for select
using (
  id = auth.uid()
  or public.current_user_role() = 'admin'
  or lower(coalesce(email, '')) like '%@reimaginecre.com'
);

alter table public.brands
  add column if not exists status text not null default 'active';

alter table public.brands
  add column if not exists is_hidden boolean not null default false;

alter table public.brands
  drop constraint if exists brands_status_check;

alter table public.brands
  add constraint brands_status_check
  check (status in ('active', 'prospect'));

create index if not exists brands_is_hidden_idx
  on public.brands (is_hidden);

-- Keep The NOW Massage and IMAGE Studios available for import testing.
delete from public.brands b
where lower(trim(b.name)) in (
  'fresh monkee',
  'new mom school',
  'chatime',
  'whole health club',
  'reforming pilates'
)
or (
  not exists (select 1 from public.deals d where d.brand_id = b.id)
  and lower(trim(b.name)) not in ('the now massage', 'image studios')
);

update public.brands
set name = 'Demo – Flex/Retail',
    status = 'prospect',
    updated_at = now()
where lower(trim(name)) = 'united defense tactical';

update public.brands
set name = 'Demo – Retail/Med Office/Office',
    status = 'prospect',
    updated_at = now()
where lower(trim(name)) in ('gameday', 'game day');

update public.brands
set name = 'Demo – Med Office',
    status = 'prospect',
    updated_at = now()
where lower(trim(name)) = 'nora';

update public.brands
set name = 'Demo – Small Retail',
    status = 'prospect',
    updated_at = now()
where lower(trim(name)) = 'sit still';

update public.brands
set status = 'prospect',
    updated_at = now()
where lower(trim(name)) in (
  'demo - flex/retail',
  'demo – flex/retail',
  'demo - retail/med office/office',
  'demo – retail/med office/office',
  'demo - med office',
  'demo – med office',
  'demo - small retail',
  'demo – small retail'
);

-- Brand/franchisor test login.
update public.profiles p
set role = 'brand',
    brand_id = b.id,
    deal_id = null,
    broker_name = null,
    updated_at = now()
from public.brands b
where lower(p.email) = 'jwright1036@gmail.com'
  and lower(b.name) = 'golftrk';

-- Deal/franchisee test login. The target deal should already be the signed
-- GolfTRK Summerlin, NV deal in the imported data.
update public.profiles p
set role = 'deal',
    brand_id = d.brand_id,
    deal_id = d.id,
    broker_name = null,
    updated_at = now()
from public.deals d
join public.brands b on b.id = d.brand_id
where lower(p.email) = 'jjhill41@yahoo.com'
  and lower(b.name) = 'golftrk'
  and lower(d.city) = 'summerlin'
  and lower(d.state) = 'nv';

-- Internal broker test login replacing the old jhill broker test account.
-- Dashboard is client-filtered to this broker code, while RLS permits broader
-- internal access elsewhere.
update public.profiles
set role = 'broker',
    full_name = coalesce(full_name, 'Quinn Cleveland'),
    username = coalesce(username, 'qcleveland'),
    broker_name = 'QC',
    brand_id = null,
    deal_id = null,
    updated_at = now()
where lower(email) = 'qcleveland@reimaginecre.com';
