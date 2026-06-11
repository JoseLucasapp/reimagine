-- Run this if the schema already exists and you only need to fix write permissions.
-- This does not delete data.

drop policy if exists "admins can manage brands" on public.brands;
drop policy if exists "authenticated can manage brands" on public.brands;
create policy "authenticated can manage brands" on public.brands for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "admins can manage deals" on public.deals;
drop policy if exists "authenticated can manage deals" on public.deals;
create policy "authenticated can manage deals" on public.deals for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "admins can manage sites" on public.sites;
drop policy if exists "authenticated can manage sites" on public.sites;
create policy "authenticated can manage sites" on public.sites for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "admins can manage deal documents" on public.deal_documents;
drop policy if exists "authenticated can manage deal documents" on public.deal_documents;
create policy "authenticated can manage deal documents" on public.deal_documents for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "admins can manage deal notes" on public.deal_notes;
drop policy if exists "authenticated can manage deal notes" on public.deal_notes;
create policy "authenticated can manage deal notes" on public.deal_notes for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "admins can manage prospects" on public.prospects;
drop policy if exists "authenticated can manage prospects" on public.prospects;
create policy "authenticated can manage prospects" on public.prospects for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "admins can manage space requirements" on public.space_requirements;
drop policy if exists "authenticated can manage space requirements" on public.space_requirements;
create policy "authenticated can manage space requirements" on public.space_requirements for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "admins can manage tour books" on public.tour_books;
drop policy if exists "authenticated can manage tour books" on public.tour_books;
create policy "authenticated can manage tour books" on public.tour_books for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "admins can manage take action items" on public.take_action_items;
drop policy if exists "authenticated can manage take action items" on public.take_action_items;
create policy "authenticated can manage take action items" on public.take_action_items for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "admins can manage brand action items" on public.brand_action_items;
drop policy if exists "authenticated can manage brand action items" on public.brand_action_items;
create policy "authenticated can manage brand action items" on public.brand_action_items for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
