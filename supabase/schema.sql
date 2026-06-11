-- Reimagine IQ Supabase schema
-- Run this in Supabase SQL Editor on a clean project.

create extension if not exists "pgcrypto";

create type public.user_role as enum ('admin', 'franchisor', 'franchisee');
create type public.deal_stage as enum (
  'Kick Off',
  'Market Study',
  'Site Tours',
  'First LOI(s) Submitted',
  'LOI Negotiations',
  'Lease Negotiations',
  'Signed',
  'On Hold'
);
create type public.prospect_status as enum ('active_client', 'inactive_client', 'prospect', 'dead');
create type public.tour_book_status as enum ('draft', 'generated', 'sent');
create type public.take_action_audience as enum ('internal', 'franchisor', 'franchisee');
create type public.take_action_status as enum ('open', 'in_progress', 'resolved', 'archived');
create type public.site_stage as enum ('Prospecting', 'LOI', 'Lease', 'Open', 'Closed');
create type public.gas_requirement as enum ('Yes', 'No', 'Preferred');
create type public.second_floor_requirement as enum ('Allowed', 'Maybe', 'Not Allowed');

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  logo_color text not null default '#E18739',
  corporate_link text not null default '#',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  username text unique,
  role public.user_role not null default 'franchisee',
  brand_id uuid references public.brands(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  franchisee text not null,
  broker text not null,
  associate text,
  cell_phone text,
  city text not null,
  state text not null,
  stage public.deal_stage not null default 'Kick Off',
  store_count integer not null default 1,
  stores_bought integer not null default 0,
  estimated_commission numeric(12, 2) not null default 0,
  intro_call_date date,
  lease_signed_date date,
  territory_map_link text,
  market_study_link text,
  map_link text,
  tour_book_link text,
  cobroker text,
  cobroker_percent text,
  is_one_off boolean not null default false,
  corporate boolean not null default false,
  corporate_comments text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sites (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  address text not null,
  city text not null,
  state text not null,
  lat double precision,
  lng double precision,
  stage public.site_stage not null default 'Prospecting',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.deal_documents (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  document_key text not null check (document_key in (
    'engagementLetter',
    'cobrokerAgreement',
    'flyer',
    'demo',
    'signedLOI',
    'floorPlan',
    'approvalPackage',
    'commissionAgreement',
    'signedLease'
  )),
  file_path text not null,
  created_at timestamptz not null default now(),
  unique (deal_id, document_key)
);

create table public.deal_notes (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  author_id uuid references public.profiles(id),
  author_name text,
  body text not null,
  created_at timestamptz not null default now()
);

create table public.prospects (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  category text not null,
  sub_category text,
  status public.prospect_status not null default 'prospect',
  owner text,
  website text,
  is_franchise boolean not null default true,
  reach_out_method text,
  main_contact text,
  cell text,
  main_contact_position text,
  main_contact_email text,
  reach_out_1 date,
  reach_out_2 date,
  reach_out_3 date,
  reach_out_4 date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.space_requirements (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  brand_name text not null,
  space_type text not null,
  min_sf integer not null,
  max_sf integer not null,
  ideal_sf integer not null,
  min_storefront_width text not null,
  power text not null,
  hvac text not null,
  gas public.gas_requirement not null,
  water_line_size text not null,
  sewer_line_size text not null,
  slab text not null,
  grease_trap text not null check (grease_trap in ('Yes', 'No')),
  second_floor public.second_floor_requirement not null,
  parking text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tour_books (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  title text not null,
  status public.tour_book_status not null default 'draft',
  generated_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.take_action_items (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  audience public.take_action_audience not null,
  status public.take_action_status not null default 'open',
  title text not null,
  body text not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index brands_name_idx on public.brands (name);
create index profiles_role_idx on public.profiles (role);
create index deals_brand_id_idx on public.deals (brand_id);
create index deals_stage_idx on public.deals (stage);
create index sites_deal_id_idx on public.sites (deal_id);
create index prospects_status_idx on public.prospects (status);
create index space_requirements_brand_id_idx on public.space_requirements (brand_id);
create index take_action_items_deal_id_idx on public.take_action_items (deal_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger brands_set_updated_at before update on public.brands for each row execute function public.set_updated_at();
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger deals_set_updated_at before update on public.deals for each row execute function public.set_updated_at();
create trigger sites_set_updated_at before update on public.sites for each row execute function public.set_updated_at();
create trigger prospects_set_updated_at before update on public.prospects for each row execute function public.set_updated_at();
create trigger space_requirements_set_updated_at before update on public.space_requirements for each row execute function public.set_updated_at();
create trigger tour_books_set_updated_at before update on public.tour_books for each row execute function public.set_updated_at();
create trigger take_action_items_set_updated_at before update on public.take_action_items for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, username, role)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'username', ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'role', '')::public.user_role, 'franchisee'::public.user_role)
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    username = excluded.username,
    role = excluded.role,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.brands enable row level security;
alter table public.profiles enable row level security;
alter table public.deals enable row level security;
alter table public.sites enable row level security;
alter table public.deal_documents enable row level security;
alter table public.deal_notes enable row level security;
alter table public.prospects enable row level security;
alter table public.space_requirements enable row level security;
alter table public.tour_books enable row level security;
alter table public.take_action_items enable row level security;

create or replace function public.current_user_role()
returns public.user_role
language sql
security definer
stable
as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'franchisee'::public.user_role);
$$;

create policy "authenticated can read brands" on public.brands for select using (auth.role() = 'authenticated');
create policy "admins can manage brands" on public.brands for all using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');

create policy "users can read own profile or admins can read all" on public.profiles for select using (id = auth.uid() or public.current_user_role() = 'admin');
create policy "users can update own profile" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "admins can manage profiles" on public.profiles for all using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');

create policy "authenticated can read deals" on public.deals for select using (auth.role() = 'authenticated');
create policy "admins can manage deals" on public.deals for all using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');

create policy "authenticated can read sites" on public.sites for select using (auth.role() = 'authenticated');
create policy "admins can manage sites" on public.sites for all using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');

create policy "authenticated can read deal documents" on public.deal_documents for select using (auth.role() = 'authenticated');
create policy "admins can manage deal documents" on public.deal_documents for all using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');

create policy "authenticated can read deal notes" on public.deal_notes for select using (auth.role() = 'authenticated');
create policy "admins can manage deal notes" on public.deal_notes for all using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');

create policy "authenticated can read prospects" on public.prospects for select using (auth.role() = 'authenticated');
create policy "admins can manage prospects" on public.prospects for all using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');

create policy "authenticated can read space requirements" on public.space_requirements for select using (auth.role() = 'authenticated');
create policy "admins can manage space requirements" on public.space_requirements for all using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');

create policy "authenticated can read tour books" on public.tour_books for select using (auth.role() = 'authenticated');
create policy "admins can manage tour books" on public.tour_books for all using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');

create policy "authenticated can read take action items" on public.take_action_items for select using (auth.role() = 'authenticated');
create policy "admins can manage take action items" on public.take_action_items for all using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');
