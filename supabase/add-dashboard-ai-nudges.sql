-- Enables real AI-generated Dashboard Follow-Up Queue items in public.ai_insights.
-- Run this once if your database was created before dashboard entity support was added.

alter table public.ai_insights
  drop constraint if exists ai_insights_entity_type_check;

alter table public.ai_insights
  add constraint ai_insights_entity_type_check
  check (entity_type in ('brand', 'deal', 'site', 'dashboard'));

drop policy if exists "ai insights select by entity scope" on public.ai_insights;

create policy "ai insights select by entity scope" on public.ai_insights for select using (
  created_by = auth.uid()
  or public.current_user_role() = 'admin'
  or (entity_type = 'brand' and public.current_user_can_access_brand(entity_id))
  or (entity_type = 'deal' and public.current_user_can_access_deal(entity_id))
  or (entity_type = 'site' and public.current_user_can_access_site(entity_id))
  or (entity_type = 'dashboard' and (created_by = auth.uid() or public.current_user_role() = 'admin'))
);
