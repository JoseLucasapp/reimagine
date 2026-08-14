-- Run this after supabase/add-mapiq-role.sql.
-- Login created here:
-- Username: Reimaginemap
-- Password: Imagine#12345
-- Internally this maps to email: reimaginemap@reimaginecre.local

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.normalize_user_role(value text)
returns public.user_role
language sql
immutable
as $$
  select case
    when lower(coalesce(value, '')) in ('admin') then 'admin'::public.user_role
    when lower(coalesce(value, '')) in ('broker', 'reimagine_broker') then 'broker'::public.user_role
    when lower(coalesce(value, '')) in ('brand', 'franchisor') then 'brand'::public.user_role
    when lower(coalesce(value, '')) in ('deal', 'franchisee') then 'deal'::public.user_role
    when lower(coalesce(value, '')) in ('mapiq', 'map_iq', 'mapiq_only') then 'mapiq'::public.user_role
    else 'deal'::public.user_role
  end;
$$;

create table if not exists public.account_requests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  requested_role public.user_role not null check (requested_role in ('broker', 'brand', 'deal')),
  company text,
  brand_name text,
  deal_name text,
  brand_id uuid references public.brands(id) on delete set null,
  deal_id uuid references public.deals(id) on delete set null,
  broker_name text,
  message text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_notes text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists account_requests_status_idx on public.account_requests (status, created_at desc);
create index if not exists account_requests_email_idx on public.account_requests (lower(email));
create index if not exists account_requests_brand_id_idx on public.account_requests (brand_id);
create index if not exists account_requests_deal_id_idx on public.account_requests (deal_id);

drop trigger if exists account_requests_set_updated_at on public.account_requests;
create trigger account_requests_set_updated_at
before update on public.account_requests
for each row execute function public.set_updated_at();

alter table public.account_requests enable row level security;

drop policy if exists "anyone can create account requests" on public.account_requests;
drop policy if exists "admins select account requests" on public.account_requests;
drop policy if exists "admins update account requests" on public.account_requests;

create policy "anyone can create account requests"
on public.account_requests
for insert
with check (requested_role in ('broker', 'brand', 'deal'));

create policy "admins select account requests"
on public.account_requests
for select
using (public.current_user_role() = 'admin');

create policy "admins update account requests"
on public.account_requests
for update
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

grant insert on public.account_requests to anon, authenticated;
grant select, update on public.account_requests to authenticated;

create or replace function public.current_user_can_access_brand(brand_uuid uuid)
returns boolean
language sql
security definer
stable
as $$
  select case
    when auth.role() <> 'authenticated' then false
    when public.current_user_role() = 'admin' then true
    when exists (
      select 1 from public.brands b
      where b.id = brand_uuid
        and b.is_hidden
    ) then false
    when public.current_user_role() = 'mapiq' then true
    when public.current_user_role() = 'broker' then exists (
      select 1
      from public.deals d,
      lateral regexp_split_to_table(lower(coalesce(d.broker, '')), '\s*[,/&]\s*') broker_code
      where d.brand_id = brand_uuid
        and broker_code = public.current_profile_broker_name()
    )
    when public.current_user_role() = 'brand' then brand_uuid = public.current_profile_brand_id()
    when public.current_user_role() = 'deal' then exists (
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
    when public.current_user_role() = 'admin' then true
    when exists (
      select 1
      from public.deals d
      join public.brands b on b.id = d.brand_id
      where d.id = deal_uuid
        and b.is_hidden
    ) then false
    when public.current_user_role() = 'mapiq' then true
    when public.current_user_role() = 'broker' then exists (
      select 1
      from public.deals d,
      lateral regexp_split_to_table(lower(coalesce(d.broker, '')), '\s*[,/&]\s*') broker_code
      where d.id = deal_uuid
        and broker_code = public.current_profile_broker_name()
    )
    when public.current_user_role() = 'brand' then exists (
      select 1 from public.deals d
      where d.id = deal_uuid
        and d.brand_id = public.current_profile_brand_id()
    )
    when public.current_user_role() = 'deal' then deal_uuid = public.current_profile_deal_id()
    else false
  end;
$$;

do $$
declare
  mapiq_user_id uuid := '00000000-0000-0000-0000-0000000000a1';
  mapiq_email text := 'reimaginemap@reimaginecre.local';
  mapiq_username text := 'Reimaginemap';
  mapiq_password text := 'Imagine#12345';
begin
  insert into auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  )
  values (
    mapiq_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    mapiq_email,
    crypt(mapiq_password, gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', 'Reimagine MapIQ', 'username', mapiq_username, 'role', 'mapiq'),
    now(),
    now(),
    '',
    '',
    '',
    ''
  )
  on conflict (id) do update set
    email = excluded.email,
    encrypted_password = excluded.encrypted_password,
    email_confirmed_at = now(),
    raw_app_meta_data = excluded.raw_app_meta_data,
    raw_user_meta_data = excluded.raw_user_meta_data,
    updated_at = now();

  insert into auth.identities (
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  )
  values (
    mapiq_user_id::text,
    mapiq_user_id,
    jsonb_build_object(
      'sub', mapiq_user_id::text,
      'email', mapiq_email,
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    now(),
    now(),
    now()
  )
  on conflict (provider_id, provider) do update set
    user_id = excluded.user_id,
    identity_data = excluded.identity_data,
    updated_at = now();

  insert into public.profiles (id, email, full_name, username, role)
  values (mapiq_user_id, mapiq_email, 'Reimagine MapIQ', mapiq_username, 'mapiq')
  on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    username = excluded.username,
    role = excluded.role,
    brand_id = null,
    deal_id = null,
    broker_name = null,
    updated_at = now();
end $$;
