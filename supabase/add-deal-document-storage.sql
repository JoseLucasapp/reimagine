insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'deal-documents',
  'deal-documents',
  true,
  26214400,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/jpeg',
    'image/png',
    'image/webp',
    'text/plain',
    'text/csv'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "deal documents storage public read" on storage.objects;
drop policy if exists "admins upload deal documents" on storage.objects;
drop policy if exists "admins update deal documents" on storage.objects;
drop policy if exists "admins delete deal documents" on storage.objects;

create policy "deal documents storage public read"
on storage.objects
for select
using (bucket_id = 'deal-documents');

create policy "admins upload deal documents"
on storage.objects
for insert
with check (bucket_id = 'deal-documents' and public.current_user_role() = 'admin');

create policy "admins update deal documents"
on storage.objects
for update
using (bucket_id = 'deal-documents' and public.current_user_role() = 'admin')
with check (bucket_id = 'deal-documents' and public.current_user_role() = 'admin');

create policy "admins delete deal documents"
on storage.objects
for delete
using (bucket_id = 'deal-documents' and public.current_user_role() = 'admin');
