alter table public.brands
  add column if not exists is_hidden boolean not null default false;

create index if not exists brands_is_hidden_idx
  on public.brands (is_hidden);

create or replace function public.current_user_can_access_brand(brand_uuid uuid)
returns boolean
language sql
security definer
stable
as $$
  select case
    when auth.role() <> 'authenticated' then false
    when public.current_user_role()::text = 'admin' then true
    when exists (
      select 1
      from public.brands b
      where b.id = brand_uuid
        and b.is_hidden
    ) then false
    when public.current_user_role()::text = 'broker' then true
    when public.current_user_role()::text = 'brand' then brand_uuid = public.current_profile_brand_id()
    when public.current_user_role()::text = 'deal' then exists (
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
    when public.current_user_role()::text = 'admin' then true
    when exists (
      select 1
      from public.deals d
      join public.brands b on b.id = d.brand_id
      where d.id = deal_uuid
        and b.is_hidden
    ) then false
    when public.current_user_role()::text = 'broker' then true
    when public.current_user_role()::text = 'brand' then exists (
      select 1 from public.deals d
      where d.id = deal_uuid
        and d.brand_id = public.current_profile_brand_id()
    )
    when public.current_user_role()::text = 'deal' then deal_uuid = public.current_profile_deal_id()
    else false
  end;
$$;
