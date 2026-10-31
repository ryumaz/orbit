-- Quick sign-in with Google, GitHub or Discord.
-- New members from those get a real name and handle from what the provider sends:
--   Discord: custom_claims.global_name (display name), user_name / full_name (username)
--   GitHub:  full_name / name (may be empty), user_name (login)
--   Google:  full_name / name
-- Provider photos are not copied: profile photos only come from orbit's own storage.

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  username text := nullif(trim(regexp_replace(coalesce(meta ->> 'user_name', meta ->> 'preferred_username', ''), '#\d+$', '')), '');
  display_name text := nullif(trim(regexp_replace(coalesce(
    nullif(trim(meta -> 'custom_claims' ->> 'global_name'), ''),
    nullif(trim(meta ->> 'name'), ''),
    nullif(trim(meta ->> 'full_name'), ''),
    username,
    ''
  ), '#\d+$', '')), '');
  shown text := left(coalesce(display_name, nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'member'), 40);
begin
  insert into public.profiles (id, name, handle)
  values (new.id, shown, public.make_handle(coalesce(username, shown)));
  insert into public.ledger (user_id, amount, type, note)
  values (new.id, 30, 'welcome', 'welcome credits');
  return new;
end $$;

revoke execute on function public.handle_new_user() from anon, authenticated, public;
