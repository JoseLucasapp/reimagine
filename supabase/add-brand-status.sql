alter table public.brands
  add column if not exists status text not null default 'active';

alter table public.brands
  drop constraint if exists brands_status_check;

alter table public.brands
  add constraint brands_status_check
  check (status in ('active', 'prospect'));

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
