-- Shareable, searchable profiles.
-- * every member gets a unique handle: orbit.voids.wtf/u/<handle>
-- * a profile photo (stored in the public "avatars" bucket) and a card colour
-- * anyone can read the public part of a profile, by handle or in the member list.
--   Email and auth ids are never part of a public result.

alter table public.profiles
  add column handle text,
  add column avatar_url text not null default '',
  add column card_color text not null default 'chalk';

alter table public.profiles
  add constraint profiles_card_color check (card_color in ('chalk', 'violet', 'amber', 'mint', 'sky', 'rose', 'ink')),
  -- only photos from orbit's own storage, never arbitrary links
  add constraint profiles_avatar_url check (
    avatar_url = '' or avatar_url like 'https://nhgdwvzjivmlyvupnuwu.supabase.co/storage/v1/object/public/avatars/%'
  );

-- letters and digits from a name, made unique with a short number if needed
create function public.make_handle(base text) returns text
language plpgsql volatile set search_path = '' as $$
declare
  stem text := left(regexp_replace(lower(coalesce(base, '')), '[^a-z0-9]+', '', 'g'), 16);
  candidate text;
begin
  if char_length(stem) < 3 then stem := stem || 'member'; end if;
  candidate := stem;
  while exists (select 1 from public.profiles where handle = candidate) loop
    candidate := left(stem, 16) || (floor(random() * 9000) + 1000)::int;
  end loop;
  return candidate;
end $$;

do $$
declare r record;
begin
  for r in select id, name from public.profiles where handle is null order by created_at loop
    update public.profiles set handle = public.make_handle(r.name) where id = r.id;
  end loop;
end $$;

alter table public.profiles
  alter column handle set not null,
  add constraint profiles_handle_key unique (handle),
  add constraint profiles_handle_format check (handle ~ '^[a-z0-9_]{3,20}$');

grant update (handle, avatar_url, card_color) on public.profiles to authenticated;

-- signups get a handle too
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  display_name text := nullif(trim(new.raw_user_meta_data ->> 'name'), '');
  shown text := left(coalesce(display_name, split_part(new.email, '@', 1)), 40);
begin
  insert into public.profiles (id, name, handle)
  values (new.id, shown, public.make_handle(shown));
  insert into public.ledger (user_id, amount, type, note)
  values (new.id, 30, 'welcome', 'welcome credits');
  return new;
end $$;

-- the public card, by handle
create function public.profile_by_handle(h text)
returns table (handle text, name text, bio text, langs text[], teaches text[], learns text[], city text,
               avatar_url text, card_color text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.handle, p.name, p.bio, p.langs, p.teaches, p.learns, p.city, p.avatar_url, p.card_color, p.created_at
  from public.profiles p
  where p.handle = lower(trim(h));
$$;

-- everyone who teaches something, newest first, for search
create function public.list_members()
returns table (handle text, name text, bio text, langs text[], teaches text[], learns text[], city text,
               avatar_url text, card_color text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.handle, p.name, p.bio, p.langs, p.teaches, p.learns, p.city, p.avatar_url, p.card_color, p.created_at
  from public.profiles p
  where cardinality(p.teaches) > 0
  order by p.created_at desc
  limit 500;
$$;

revoke execute on function public.make_handle(text) from public, anon, authenticated;
revoke execute on function public.profile_by_handle(text) from public;
revoke execute on function public.list_members() from public;
grant execute on function public.profile_by_handle(text) to anon, authenticated;
grant execute on function public.list_members() to anon, authenticated;

-- profile photos: public to read, each member writes only inside their own folder
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "members upload their own photo" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "members replace their own photo" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "members delete their own photo" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
