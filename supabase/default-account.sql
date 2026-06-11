-- Default account for the approved prototype credentials.
-- Run this AFTER supabase/schema.sql.
-- Login in the app with:
-- Username: Reimagine
-- Password: Imagine#12345
-- Internally this maps to email: reimagine@reimaginecre.local

create extension if not exists "pgcrypto";

do $$
declare
  default_user_id uuid := '00000000-0000-0000-0000-000000000001';
  default_email text := 'reimagine@reimaginecre.local';
  default_username text := 'Reimagine';
  default_password text := 'Imagine#12345';
begin
  insert into auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  )
  values (
    default_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    default_email,
    crypt(default_password, gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', 'Reimagine Admin', 'username', default_username, 'role', 'admin'),
    now(),
    now(),
    '',
    '',
    '',
    ''
  )
  on conflict (id) do update set
    email = excluded.email,
    encrypted_password = excluded.encrypted_password,
    email_confirmed_at = now(),
    raw_app_meta_data = excluded.raw_app_meta_data,
    raw_user_meta_data = excluded.raw_user_meta_data,
    updated_at = now();

  insert into auth.identities (
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  )
  values (
    default_user_id::text,
    default_user_id,
    jsonb_build_object(
      'sub', default_user_id::text,
      'email', default_email,
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    now(),
    now(),
    now()
  )
  on conflict (provider_id, provider) do update set
    user_id = excluded.user_id,
    identity_data = excluded.identity_data,
    updated_at = now();

  insert into public.profiles (id, full_name, username, role)
  values (default_user_id, 'Reimagine Admin', default_username, 'admin')
  on conflict (id) do update set
    full_name = excluded.full_name,
    username = excluded.username,
    role = excluded.role,
    updated_at = now();
end $$;
