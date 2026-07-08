alter table public.take_action_items
  add column if not exists response_body text,
  add column if not exists responded_by uuid references public.profiles(id),
  add column if not exists responded_at timestamptz;

alter table public.brand_action_items
  add column if not exists response_body text,
  add column if not exists responded_by uuid references public.profiles(id),
  add column if not exists responded_at timestamptz;
