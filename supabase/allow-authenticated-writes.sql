-- Deprecated intentionally.
--
-- This file used to grant broad write access to every authenticated user.
-- It is now a cleanup-only script that removes those unsafe policies.
-- Role-scoped RLS lives in schema.sql and team-access-and-role-scope.sql.

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
