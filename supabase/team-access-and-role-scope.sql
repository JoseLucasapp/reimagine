-- Reimagine CRE team access and platform role scoping support.
-- Run in Supabase SQL Editor after the imported data exists.
-- Auth users for examples below must be created/invited first.

alter table public.profiles
  add column if not exists email text;

create unique index if not exists profiles_email_unique_idx
  on public.profiles (lower(email))
  where email is not null;

update public.profiles p
set email = lower(u.email),
    updated_at = now()
from auth.users u
where p.id = u.id
  and (p.email is null or p.email = '');

create or replace function public.normalize_user_role(value text)
returns public.user_role
language sql
immutable
as $$
  select case
    when lower(coalesce(value, '')) = 'admin' then 'admin'::public.user_role
    when lower(coalesce(value, '')) in ('brand', 'franchisor') then 'brand'::public.user_role
    when lower(coalesce(value, '')) in ('deal', 'franchisee') then 'deal'::public.user_role
    else 'deal'::public.user_role
  end;
$$;

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
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    username = coalesce(excluded.username, public.profiles.username),
    role = public.profiles.role,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert or update of email, raw_user_meta_data on auth.users
for each row execute function public.handle_new_user();

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

create or replace function public.current_user_can_access_brand(brand_uuid uuid)
returns boolean
language sql
security definer
stable
as $$
  select case
    when auth.role() <> 'authenticated' then false
    when public.current_user_role() = 'admin' then true
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

alter table public.profiles enable row level security;
alter table public.brands enable row level security;
alter table public.deals enable row level security;
alter table public.sites enable row level security;
alter table public.deal_documents enable row level security;
alter table public.deal_notes enable row level security;
alter table public.prospects enable row level security;
alter table public.space_requirements enable row level security;
alter table public.tour_books enable row level security;
alter table public.take_action_items enable row level security;
alter table public.brand_action_items enable row level security;

drop policy if exists "authenticated can manage brands" on public.brands;
drop policy if exists "authenticated can manage deals" on public.deals;
drop policy if exists "authenticated can manage sites" on public.sites;
drop policy if exists "authenticated can manage deal documents" on public.deal_documents;
drop policy if exists "authenticated can manage deal notes" on public.deal_notes;
drop policy if exists "authenticated can manage prospects" on public.prospects;
drop policy if exists "authenticated can manage space requirements" on public.space_requirements;
drop policy if exists "authenticated can manage tour books" on public.tour_books;
drop policy if exists "authenticated can manage take action items" on public.take_action_items;
drop policy if exists "authenticated can manage brand action items" on public.brand_action_items;

drop policy if exists "profiles select own or admin" on public.profiles;
drop policy if exists "profiles select own admin or reimagine team" on public.profiles;
create policy "profiles select own admin or reimagine team"
on public.profiles
for select
using (
  id = auth.uid()
  or public.current_user_role() = 'admin'
  or lower(coalesce(email, '')) like '%@reimagine.com'
);

drop policy if exists "profiles update own" on public.profiles;

drop policy if exists "admins manage profiles" on public.profiles;
create policy "admins manage profiles"
on public.profiles
for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "brands select by platform scope" on public.brands;
create policy "brands select by platform scope"
on public.brands
for select
using (public.current_user_can_access_brand(id));

drop policy if exists "admins manage brands" on public.brands;
create policy "admins manage brands"
on public.brands
for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "deals select by platform scope" on public.deals;
create policy "deals select by platform scope"
on public.deals
for select
using (public.current_user_can_access_deal(id));

drop policy if exists "admins manage deals" on public.deals;
create policy "admins manage deals"
on public.deals
for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "sites select by deal scope" on public.sites;
create policy "sites select by deal scope"
on public.sites
for select
using (public.current_user_can_access_deal(deal_id));

drop policy if exists "admins manage sites" on public.sites;
create policy "admins manage sites"
on public.sites
for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "deal documents select by deal scope" on public.deal_documents;
create policy "deal documents select by deal scope"
on public.deal_documents
for select
using (public.current_user_can_access_deal(deal_id));

drop policy if exists "admins manage deal documents" on public.deal_documents;
create policy "admins manage deal documents"
on public.deal_documents
for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "deal notes select by deal scope" on public.deal_notes;
create policy "deal notes select by deal scope"
on public.deal_notes
for select
using (public.current_user_can_access_deal(deal_id));

drop policy if exists "deal notes insert by deal scope" on public.deal_notes;
create policy "deal notes insert by deal scope"
on public.deal_notes
for insert
with check (public.current_user_can_access_deal(deal_id));

drop policy if exists "admins manage deal notes" on public.deal_notes;
create policy "admins manage deal notes"
on public.deal_notes
for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "prospects admin select" on public.prospects;
create policy "prospects admin select"
on public.prospects
for select
using (public.current_user_role() = 'admin');

drop policy if exists "admins manage prospects" on public.prospects;
create policy "admins manage prospects"
on public.prospects
for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "space requirements select by brand scope" on public.space_requirements;
create policy "space requirements select by brand scope"
on public.space_requirements
for select
using (public.current_user_can_access_brand(brand_id));

drop policy if exists "admins manage space requirements" on public.space_requirements;
create policy "admins manage space requirements"
on public.space_requirements
for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "tour books select by deal scope" on public.tour_books;
create policy "tour books select by deal scope"
on public.tour_books
for select
using (public.current_user_can_access_deal(deal_id));

drop policy if exists "tour books insert by deal scope" on public.tour_books;
create policy "tour books insert by deal scope"
on public.tour_books
for insert
with check (public.current_user_can_access_deal(deal_id));

drop policy if exists "admins manage tour books" on public.tour_books;
create policy "admins manage tour books"
on public.tour_books
for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "take action select by deal scope" on public.take_action_items;
create policy "take action select by deal scope"
on public.take_action_items
for select
using (public.current_user_can_access_deal(deal_id));

drop policy if exists "take action insert by deal scope" on public.take_action_items;
create policy "take action insert by deal scope"
on public.take_action_items
for insert
with check (public.current_user_can_access_deal(deal_id));

drop policy if exists "take action update by deal scope" on public.take_action_items;
create policy "take action update by deal scope"
on public.take_action_items
for update
using (public.current_user_can_access_deal(deal_id))
with check (public.current_user_can_access_deal(deal_id));

drop policy if exists "admins manage take action" on public.take_action_items;
create policy "admins manage take action"
on public.take_action_items
for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "brand action select by brand scope" on public.brand_action_items;
create policy "brand action select by brand scope"
on public.brand_action_items
for select
using (
  public.current_user_role() = 'admin'
  or (
    public.current_user_role() = 'brand'
    and brand_id = public.current_profile_brand_id()
  )
);

drop policy if exists "brand action insert by brand scope" on public.brand_action_items;
create policy "brand action insert by brand scope"
on public.brand_action_items
for insert
with check (
  public.current_user_role() = 'admin'
  or (
    public.current_user_role() = 'brand'
    and brand_id = public.current_profile_brand_id()
  )
);

drop policy if exists "brand action update by brand scope" on public.brand_action_items;
create policy "brand action update by brand scope"
on public.brand_action_items
for update
using (
  public.current_user_role() = 'admin'
  or (
    public.current_user_role() = 'brand'
    and brand_id = public.current_profile_brand_id()
  )
)
with check (
  public.current_user_role() = 'admin'
  or (
    public.current_user_role() = 'brand'
    and brand_id = public.current_profile_brand_id()
  )
);

drop policy if exists "admins manage brand action" on public.brand_action_items;
create policy "admins manage brand action"
on public.brand_action_items
for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

-- Example: configure accounting@reimagine.com as an internal team recipient
-- after creating/inviting the Auth user.
--
-- update public.profiles
-- set email = 'accounting@reimagine.com',
--     full_name = coalesce(full_name, 'Accounting'),
--     username = coalesce(username, 'accounting'),
--     role = 'admin',
--     brand_id = null,
--     deal_id = null,
--     updated_at = now()
-- where id = (select id from auth.users where lower(email) = 'accounting@reimagine.com');

-- Example: configure jjhill4@yahoo.com as the franchisee/deal user for
-- Golf TRK Southlake after creating/inviting the Auth user.
--
-- update public.profiles p
-- set email = 'jjhill4@yahoo.com',
--     full_name = coalesce(p.full_name, 'JJ Hill'),
--     username = coalesce(p.username, 'jjhill4'),
--     role = 'deal',
--     deal_id = d.id,
--     brand_id = d.brand_id,
--     updated_at = now()
-- from public.deals d
-- where p.id = (select id from auth.users where lower(email) = 'jjhill4@yahoo.com')
--   and (
--     lower(coalesce(d.name, '')) = 'golf trk southlake'
--     or lower(d.franchisee) like '%golf trk southlake%'
--     or (lower(d.franchisee) like '%golf trk%' and lower(d.city) = 'southlake')
--   );
