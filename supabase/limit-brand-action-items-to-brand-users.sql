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
