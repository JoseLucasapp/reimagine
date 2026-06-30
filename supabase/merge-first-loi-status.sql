-- Merge the retired "First LOI(s) Submitted" deal stage into "LOI Negotiations".
-- Run this after taking a database backup.

begin;

update public.deals
set stage = 'LOI Negotiations'::public.deal_stage
where stage::text = 'First LOI(s) Submitted';

alter table public.deals alter column stage drop default;
alter type public.deal_stage rename to deal_stage_old;

create type public.deal_stage as enum (
  'Kick Off',
  'Market Study',
  'Site Tours',
  'LOI Negotiations',
  'Lease Negotiations',
  'Signed',
  'On Hold'
);

alter table public.deals
alter column stage type public.deal_stage
using stage::text::public.deal_stage;

alter table public.deals
alter column stage set default 'Kick Off'::public.deal_stage;

drop type public.deal_stage_old;

commit;
