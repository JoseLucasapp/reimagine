alter table public.account_requests
  add column if not exists brand_id uuid references public.brands(id) on delete set null,
  add column if not exists deal_id uuid references public.deals(id) on delete set null,
  add column if not exists broker_name text;

create index if not exists account_requests_brand_id_idx on public.account_requests (brand_id);
create index if not exists account_requests_deal_id_idx on public.account_requests (deal_id);

grant insert on public.account_requests to anon, authenticated;
grant select, update on public.account_requests to authenticated;
