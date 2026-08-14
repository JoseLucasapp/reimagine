-- Maps Reimagine team emails to broker-scoped logins.
-- This updates existing Supabase profiles only; it does not create auth users.

with broker_mappings(email, full_name, username, broker_name) as (
  values
    ('jwright@reimaginecre.com', 'Jeremy Wright', 'jwright', 'JW'),
    ('cwilmes@reimaginecre.com', 'Carly Wilmes', 'cwilmes', 'CW'),
    ('gneedleman@reimaginecre.com', 'Greg Needleman', 'gneedleman', 'GN'),
    ('rmoore@reimaginecre.com', 'Ryan Moore', 'rmoore', 'RM'),
    ('erosen@reimaginecre.com', 'Eric Rosen', 'erosen', 'ER'),
    ('qcleveland@reimaginecre.com', 'Quinn Cleveland', 'qcleveland', 'QC'),
    ('jhill@reimaginecre.com', 'Jackson Hill', 'jhill', 'JH')
)
update public.profiles p
set role = 'broker',
    full_name = coalesce(nullif(p.full_name, ''), m.full_name),
    username = coalesce(nullif(p.username, ''), m.username),
    broker_name = m.broker_name,
    brand_id = null,
    deal_id = null,
    updated_at = now()
from broker_mappings m
where lower(p.email) = m.email;

-- Validation query to run after this update:
--
-- with broker_mappings(email, broker_name) as (
--   values
--     ('jwright@reimaginecre.com', 'JW'),
--     ('cwilmes@reimaginecre.com', 'CW'),
--     ('gneedleman@reimaginecre.com', 'GN'),
--     ('rmoore@reimaginecre.com', 'RM'),
--     ('erosen@reimaginecre.com', 'ER'),
--     ('qcleveland@reimaginecre.com', 'QC'),
--     ('jhill@reimaginecre.com', 'JH')
-- )
-- select
--   m.email,
--   p.id is not null as profile_found,
--   p.role,
--   p.broker_name,
--   count(d.id) as matched_deals
-- from broker_mappings m
-- left join public.profiles p on lower(p.email) = m.email
-- left join lateral (
--   select d.id
--   from public.deals d,
--   lateral regexp_split_to_table(lower(coalesce(d.broker, '')), '\s*[,/&]\s*') broker_code
--   where broker_code = lower(m.broker_name)
-- ) d on true
-- group by m.email, p.id, p.role, p.broker_name
-- order by m.email;
