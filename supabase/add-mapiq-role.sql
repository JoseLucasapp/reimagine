-- Run this first. Postgres may require a separate transaction before using a new enum value.

alter type public.user_role add value if not exists 'mapiq';
