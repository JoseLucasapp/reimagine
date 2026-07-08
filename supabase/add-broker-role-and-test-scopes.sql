-- Adds broker-scoped access for Reimagine IQ role testing.
-- Run this in Supabase SQL Editor before mapping broker test profiles.

alter type public.user_role add value if not exists 'broker';

alter table public.profiles
  add column if not exists broker_name text;

create or replace function public.current_profile_broker_name()
returns text
language sql
security definer
stable
as $$
  select nullif(lower(trim(broker_name)), '') from public.profiles where id = auth.uid();
$$;

create or replace function public.current_user_broker_name()
returns text
language sql
security definer
stable
as $$
  select public.current_profile_broker_name();
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
    when public.current_user_role()::text = 'broker' then exists (
      select 1
      from public.deals d,
      lateral regexp_split_to_table(lower(coalesce(d.broker, '')), '\s*[,/&]\s*') broker_code
      where d.brand_id = brand_uuid
        and broker_code = public.current_profile_broker_name()
    )
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
    when public.current_user_role()::text = 'broker' then exists (
      select 1
      from public.deals d,
      lateral regexp_split_to_table(lower(coalesce(d.broker, '')), '\s*[,/&]\s*') broker_code
      where d.id = deal_uuid
        and broker_code = public.current_profile_broker_name()
    )
    when public.current_user_role()::text = 'brand' then exists (
      select 1 from public.deals d
      where d.id = deal_uuid
        and d.brand_id = public.current_profile_brand_id()
    )
    when public.current_user_role()::text = 'deal' then deal_uuid = public.current_profile_deal_id()
    else false
  end;
$$;

-- Optional role normalization update. Run this block separately after the
-- ALTER TYPE transaction commits if broker users will be created via Auth
-- metadata instead of explicit profile updates.
--
-- create or replace function public.normalize_user_role(value text)
-- returns public.user_role
-- language sql
-- immutable
-- as $$
--   select case
--     when lower(coalesce(value, '')) = 'admin' then 'admin'::public.user_role
--     when lower(coalesce(value, '')) in ('broker', 'reimagine_broker') then 'broker'::public.user_role
--     when lower(coalesce(value, '')) in ('brand', 'franchisor') then 'brand'::public.user_role
--     when lower(coalesce(value, '')) in ('deal', 'franchisee') then 'deal'::public.user_role
--     else 'deal'::public.user_role
--   end;
-- $$;

-- Test profile mappings verified in the live project on 2026-07-08.
-- Uncomment only the rows the client wants to test as non-admin broker accounts.
--
-- High-volume broker: Jackson Hill / JH, currently present as jhill@reimaginecre.com.
-- update public.profiles
-- set role = 'broker',
--     broker_name = 'JH',
--     brand_id = null,
--     deal_id = null,
--     updated_at = now()
-- where lower(email) = 'jhill@reimaginecre.com';
--
-- Lower-volume broker: Ryan Moore / RM, currently present as rmoore@reimaginecre.com.
-- update public.profiles
-- set role = 'broker',
--     broker_name = 'RM',
--     brand_id = null,
--     deal_id = null,
--     updated_at = now()
-- where lower(email) = 'rmoore@reimaginecre.com';
--
-- Existing verified scopes; included here as idempotent repair statements.
-- update public.profiles p
-- set role = 'brand',
--     brand_id = b.id,
--     deal_id = null,
--     broker_name = null,
--     updated_at = now()
-- from public.brands b
-- where lower(p.email) = 'jwright1036@gmail.com'
--   and lower(b.name) = 'golftrk';
--
-- update public.profiles p
-- set role = 'deal',
--     brand_id = d.brand_id,
--     deal_id = d.id,
--     broker_name = null,
--     updated_at = now()
-- from public.deals d
-- where lower(p.email) = 'jjhill41@yahoo.com'
--   and lower(coalesce(d.name, '')) = 'golftrk - southlake, tx';
