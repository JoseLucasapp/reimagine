-- Reimagine IQ Supabase schema
-- Enable UUID generation in the Supabase SQL editor before running if needed.
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
  city text not null,
  state text not null,
  stage public.deal_stage not null default 'Kick Off',
  store_count integer not null default 1,
  stores_bought integer not null default 0,
  estimated_commission numeric(12, 2) not null default 0,
  intro_call_date date,
  lease_signed_date date,
  is_one_off boolean not null default false,
  corporate boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.deal_documents (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  document_key text not null,
  file_path text not null,
  created_at timestamptz not null default now(),
  unique (deal_id, document_key)
);

create table public.deal_notes (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  author_id uuid references public.profiles(id),
  body text not null,
  created_at timestamptz not null default now()
);

create table public.prospects (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  category text not null,
  status public.prospect_status not null default 'prospect',
  owner text,
  website text,
  main_contact text,
  main_contact_email text,
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
create index deals_brand_id_idx on public.deals (brand_id);
create index deals_stage_idx on public.deals (stage);
create index prospects_status_idx on public.prospects (status);
create index take_action_items_deal_id_idx on public.take_action_items (deal_id);

alter table public.brands enable row level security;
alter table public.profiles enable row level security;
alter table public.deals enable row level security;
alter table public.deal_documents enable row level security;
alter table public.deal_notes enable row level security;
alter table public.prospects enable row level security;
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

create policy "Admins can manage brands" on public.brands
for all using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

create policy "Authenticated users can read brands" on public.brands
for select using (auth.role() = 'authenticated');

create policy "Admins can manage profiles" on public.profiles
for all using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

create policy "Users can read own profile" on public.profiles
for select using (id = auth.uid() or public.current_user_role() = 'admin');

create policy "Admins can manage deals" on public.deals
for all using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

create policy "Clients can read deals" on public.deals
for select using (auth.role() = 'authenticated');

create policy "Admins can manage prospects" on public.prospects
for all using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

create policy "Admins can manage tour books" on public.tour_books
for all using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

create policy "Authenticated users can read tour books" on public.tour_books
for select using (auth.role() = 'authenticated');

create policy "Admins can manage take action items" on public.take_action_items
for all using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

create policy "Authenticated users can read take action items" on public.take_action_items
for select using (auth.role() = 'authenticated');
