-- Reimagine IQ Supabase schema
-- Run this in Supabase SQL Editor.
-- WARNING: this resets the application tables/types below before recreating them.
-- It does not delete auth.users.

create extension if not exists "pgcrypto";

drop trigger if exists on_auth_user_created on auth.users;

drop table if exists public.ai_feedback cascade;
drop table if exists public.ai_insights cascade;
drop table if exists public.brand_action_items cascade;
drop table if exists public.take_action_items cascade;
drop table if exists public.tour_books cascade;
drop table if exists public.space_requirements cascade;
drop table if exists public.prospects cascade;
drop table if exists public.deal_notes cascade;
drop table if exists public.deal_documents cascade;
drop table if exists public.sites cascade;
drop table if exists public.deals cascade;
drop table if exists public.profiles cascade;
drop table if exists public.brands cascade;

drop function if exists public.handle_new_user() cascade;
drop function if exists public.current_user_role() cascade;
drop function if exists public.current_profile_brand_id() cascade;
drop function if exists public.current_profile_deal_id() cascade;
drop function if exists public.current_profile_broker_name() cascade;
drop function if exists public.current_user_brand_id() cascade;
drop function if exists public.current_user_deal_id() cascade;
drop function if exists public.current_user_broker_name() cascade;
drop function if exists public.current_user_can_access_brand(uuid) cascade;
drop function if exists public.current_user_can_access_deal(uuid) cascade;
drop function if exists public.current_user_can_access_site(uuid) cascade;
drop function if exists public.normalize_user_role(text) cascade;
drop function if exists public.set_updated_at() cascade;

drop type if exists public.ai_insight_type cascade;
drop type if exists public.second_floor_requirement cascade;
drop type if exists public.gas_requirement cascade;
drop type if exists public.site_stage cascade;
drop type if exists public.take_action_status cascade;
drop type if exists public.take_action_audience cascade;
drop type if exists public.tour_book_status cascade;
drop type if exists public.prospect_status cascade;
drop type if exists public.deal_stage cascade;
drop type if exists public.user_role cascade;

create type public.user_role as enum ('admin', 'broker', 'brand', 'deal');
create type public.deal_stage as enum (
  'Kick Off',
  'Market Study',
  'Site Tours',
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
create type public.ai_insight_type as enum ('deal_summary', 'suggested_action', 'property_insight', 'dashboard_nudge', 'bizdev_follow_up', 'tour_book_draft');

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
    else 'deal'::public.user_role
  end;
$$;

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  logo_color text not null default '#E18739',
  corporate_link text not null default '#',
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

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  full_name text,
  username text unique,
  role public.user_role not null default 'deal',
  brand_id uuid references public.brands(id) on delete set null,
  deal_id uuid references public.deals(id) on delete set null,
  broker_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sites (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  property_name text,
  address text not null,
  city text not null,
  state text not null,
  zip_code text,
  lat double precision,
  lng double precision,
  stage public.site_stage not null default 'Prospecting',
  status_label text,
  notes text,
  square_footage text,
  space_type text,
  property_type text,
  landlord text,
  landlord_contact text,
  lease_term text,
  possession_date date,
  tour_time text,
  broker_name text,
  broker_phone text,
  photo_urls text[] not null default '{}',
  brochure_url text,
  floor_plan_url text,
  loi_url text,
  lease_url text,
  base_rent text,
  nnn text,
  gross_monthly_rent text,
  commencement_date date,
  ti_allowance text,
  loi_notes text,
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
  response_body text,
  responded_by uuid references public.profiles(id),
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.brand_action_items (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  deal_name text,
  action_type_key text not null,
  action_type_label text not null,
  recipients text[] not null default '{}',
  message text,
  urgency text not null default 'normal',
  requested_by text not null,
  response_body text,
  responded_by uuid references public.profiles(id),
  responded_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ai_insights (
  id uuid primary key default gen_random_uuid(),
  insight_type public.ai_insight_type not null,
  entity_type text not null check (entity_type in ('brand', 'deal', 'site', 'dashboard')),
  entity_id uuid not null,
  prompt_version text not null,
  input_hash text not null,
  output jsonb not null,
  model text,
  status text not null default 'completed' check (status in ('completed', 'failed')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ai_feedback (
  id uuid primary key default gen_random_uuid(),
  insight_id uuid not null references public.ai_insights(id) on delete cascade,
  user_id uuid references public.profiles(id) default auth.uid(),
  rating text not null check (rating in ('up', 'down')),
  comment text,
  created_at timestamptz not null default now()
);

create index brands_name_idx on public.brands (name);
create index profiles_role_idx on public.profiles (role);
create index profiles_brand_id_idx on public.profiles (brand_id);
create index profiles_deal_id_idx on public.profiles (deal_id);
create index deals_brand_id_idx on public.deals (brand_id);
create index deals_stage_idx on public.deals (stage);
create index sites_deal_id_idx on public.sites (deal_id);
create index prospects_status_idx on public.prospects (status);
create index space_requirements_brand_id_idx on public.space_requirements (brand_id);
create index take_action_items_deal_id_idx on public.take_action_items (deal_id);
create index brand_action_items_brand_id_idx on public.brand_action_items (brand_id);
create index ai_insights_lookup_idx on public.ai_insights (insight_type, entity_type, entity_id, created_at desc);

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
create trigger brand_action_items_set_updated_at before update on public.brand_action_items for each row execute function public.set_updated_at();
create trigger ai_insights_set_updated_at before update on public.ai_insights for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, username, role)
  values (
    new.id,
    lower(nullif(new.email, '')),
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'username', ''),
    public.normalize_user_role(new.raw_user_meta_data ->> 'role')
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    username = excluded.username,
    email = excluded.email,
    role = public.profiles.role,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert or update of email, raw_user_meta_data on auth.users
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
alter table public.brand_action_items enable row level security;
alter table public.ai_insights enable row level security;
alter table public.ai_feedback enable row level security;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'deal-documents',
  'deal-documents',
  true,
  26214400,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/jpeg',
    'image/png',
    'image/webp',
    'text/plain',
    'text/csv'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.current_user_role()
returns public.user_role
language sql
security definer
stable
as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'deal'::public.user_role);
$$;

create or replace function public.current_profile_brand_id()
returns uuid
language sql
security definer
stable
as $$
  select brand_id from public.profiles where id = auth.uid();
$$;

create or replace function public.current_profile_deal_id()
returns uuid
language sql
security definer
stable
as $$
  select deal_id from public.profiles where id = auth.uid();
$$;

create or replace function public.current_profile_broker_name()
returns text
language sql
security definer
stable
as $$
  select nullif(lower(trim(broker_name)), '') from public.profiles where id = auth.uid();
$$;

create or replace function public.current_user_brand_id()
returns uuid
language sql
security definer
stable
as $$
  select public.current_profile_brand_id();
$$;

create or replace function public.current_user_deal_id()
returns uuid
language sql
security definer
stable
as $$
  select public.current_profile_deal_id();
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
    when public.current_user_role() = 'admin' then true
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



create or replace function public.current_user_can_access_site(site_uuid uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.sites s
    where s.id = site_uuid
      and public.current_user_can_access_deal(s.deal_id)
  );
$$;

create policy "brands select by platform scope" on public.brands for select using (public.current_user_can_access_brand(id));
create policy "admins manage brands" on public.brands for all using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');

create policy "profiles select own admin or reimagine team" on public.profiles for select using (
  id = auth.uid()
  or public.current_user_role() = 'admin'
  or lower(coalesce(email, '')) like '%@reimagine.com'
);
create policy "admins manage profiles" on public.profiles for all using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');

create policy "deals select by platform scope" on public.deals for select using (public.current_user_can_access_deal(id));
create policy "admins manage deals" on public.deals for all using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');

create policy "sites select by deal scope" on public.sites for select using (public.current_user_can_access_deal(deal_id));
create policy "admins manage sites" on public.sites for all using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');

create policy "deal documents select by deal scope" on public.deal_documents for select using (public.current_user_can_access_deal(deal_id));
create policy "admins manage deal documents" on public.deal_documents for all using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');

drop policy if exists "deal documents storage public read" on storage.objects;
drop policy if exists "admins upload deal documents" on storage.objects;
drop policy if exists "admins update deal documents" on storage.objects;
drop policy if exists "admins delete deal documents" on storage.objects;
create policy "deal documents storage public read" on storage.objects for select using (bucket_id = 'deal-documents');
create policy "admins upload deal documents" on storage.objects for insert with check (bucket_id = 'deal-documents' and public.current_user_role() = 'admin');
create policy "admins update deal documents" on storage.objects for update using (bucket_id = 'deal-documents' and public.current_user_role() = 'admin') with check (bucket_id = 'deal-documents' and public.current_user_role() = 'admin');
create policy "admins delete deal documents" on storage.objects for delete using (bucket_id = 'deal-documents' and public.current_user_role() = 'admin');

create policy "deal notes select by deal scope" on public.deal_notes for select using (public.current_user_can_access_deal(deal_id));
create policy "deal notes insert by deal scope" on public.deal_notes for insert with check (public.current_user_can_access_deal(deal_id));
create policy "admins manage deal notes" on public.deal_notes for all using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');

create policy "prospects admin select" on public.prospects for select using (public.current_user_role() = 'admin');
create policy "admins manage prospects" on public.prospects for all using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');

create policy "space requirements select by brand scope" on public.space_requirements for select using (public.current_user_can_access_brand(brand_id));
create policy "admins manage space requirements" on public.space_requirements for all using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');

create policy "tour books select by deal scope" on public.tour_books for select using (public.current_user_can_access_deal(deal_id));
create policy "tour books insert by deal scope" on public.tour_books for insert with check (public.current_user_can_access_deal(deal_id));
create policy "admins manage tour books" on public.tour_books for all using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');

create policy "take action select by deal scope" on public.take_action_items for select using (public.current_user_can_access_deal(deal_id));
create policy "take action insert by deal scope" on public.take_action_items for insert with check (public.current_user_can_access_deal(deal_id));
create policy "take action update by deal scope" on public.take_action_items for update using (public.current_user_can_access_deal(deal_id)) with check (public.current_user_can_access_deal(deal_id));
create policy "admins manage take action" on public.take_action_items for all using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');

create policy "brand action select by brand scope" on public.brand_action_items for select using (public.current_user_can_access_brand(brand_id));
create policy "brand action insert by brand scope" on public.brand_action_items for insert with check (public.current_user_can_access_brand(brand_id));
create policy "brand action update by brand scope" on public.brand_action_items for update using (public.current_user_can_access_brand(brand_id)) with check (public.current_user_can_access_brand(brand_id));
create policy "admins manage brand action" on public.brand_action_items for all using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');

create policy "ai insights select by entity scope" on public.ai_insights for select using (
  created_by = auth.uid()
  or public.current_user_role() = 'admin'
  or (entity_type = 'brand' and public.current_user_can_access_brand(entity_id))
  or (entity_type = 'deal' and public.current_user_can_access_deal(entity_id))
  or (entity_type = 'site' and public.current_user_can_access_site(entity_id))
  or (entity_type = 'dashboard' and (created_by = auth.uid() or public.current_user_role() = 'admin'))
);
create policy "service or admin manages ai insights" on public.ai_insights for all using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');

create policy "ai feedback select own or admin" on public.ai_feedback for select using (user_id = auth.uid() or public.current_user_role() = 'admin');
create policy "ai feedback upsert own" on public.ai_feedback for all using (user_id = auth.uid()) with check (user_id = auth.uid());
