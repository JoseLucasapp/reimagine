-- Incremental support for importing the Reimagine CRE Google Sheet/XLSX.
-- Safe to run multiple times. This file does not delete existing data.

alter table public.brands
  add column if not exists source_key text,
  add column if not exists internal_link text,
  add column if not exists franchisor_link text,
  add column if not exists franchisor_map_link text,
  add column if not exists source_sheet text,
  add column if not exists source_row integer;

create unique index if not exists brands_source_key_uidx
  on public.brands(source_key)
  where source_key is not null;

alter table public.deals
  add column if not exists name text,
  add column if not exists source_key text,
  add column if not exists source_sheet text,
  add column if not exists source_row integer,
  add column if not exists source_status_label text;

create unique index if not exists deals_source_key_uidx
  on public.deals(source_key)
  where source_key is not null;

alter table public.prospects
  add column if not exists source_key text,
  add column if not exists source_status_label text,
  add column if not exists date_added date,
  add column if not exists brick_and_mortar text,
  add column if not exists estimated_location_count integer,
  add column if not exists franchise_or_corporate text,
  add column if not exists office_phone text,
  add column if not exists linkedin text,
  add column if not exists secondary_contact text,
  add column if not exists secondary_position text,
  add column if not exists secondary_email text,
  add column if not exists secondary_cell text,
  add column if not exists secondary_office text,
  add column if not exists secondary_linkedin text,
  add column if not exists lead_source text,
  add column if not exists reach_out_5 date,
  add column if not exists final_reach_out date,
  add column if not exists last_reach_out_date date,
  add column if not exists next_follow_up_date date,
  add column if not exists overdue text,
  add column if not exists update_notes text,
  add column if not exists source_sheet text,
  add column if not exists source_row integer;

create unique index if not exists prospects_source_key_uidx
  on public.prospects(source_key)
  where source_key is not null;

alter table public.space_requirements
  add column if not exists source_key text,
  add column if not exists landlord_deck_link text,
  add column if not exists loi_template_link text,
  add column if not exists min_sf_raw text,
  add column if not exists max_sf_raw text,
  add column if not exists ideal_sf_raw text,
  add column if not exists other_special_requirements text,
  add column if not exists source_sheet text,
  add column if not exists source_row integer;

create unique index if not exists space_requirements_source_key_uidx
  on public.space_requirements(source_key)
  where source_key is not null;

alter table public.deal_documents
  add column if not exists source_key text,
  add column if not exists source_sheet text,
  add column if not exists source_row integer,
  add column if not exists source_label text;

create unique index if not exists deal_documents_source_key_uidx
  on public.deal_documents(source_key)
  where source_key is not null;

alter table public.deal_notes
  add column if not exists source_key text,
  add column if not exists source_sheet text,
  add column if not exists source_row integer;

create unique index if not exists deal_notes_source_key_uidx
  on public.deal_notes(source_key)
  where source_key is not null;

create table if not exists public.prospect_activity_logs (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid references public.prospects(id) on delete set null,
  company_name text not null,
  owner text,
  method text,
  notes text,
  occurred_at timestamptz,
  next_follow_up date,
  source_key text,
  source_sheet text,
  source_row integer,
  created_at timestamptz not null default now()
);

create unique index if not exists prospect_activity_logs_source_key_uidx
  on public.prospect_activity_logs(source_key)
  where source_key is not null;

alter table public.prospect_activity_logs enable row level security;

drop policy if exists "prospect activity logs admin select" on public.prospect_activity_logs;
drop policy if exists "admins manage prospect activity logs" on public.prospect_activity_logs;

create policy "prospect activity logs admin select"
  on public.prospect_activity_logs
  for select
  using (public.current_user_role() = 'admin');

create policy "admins manage prospect activity logs"
  on public.prospect_activity_logs
  for all
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');
