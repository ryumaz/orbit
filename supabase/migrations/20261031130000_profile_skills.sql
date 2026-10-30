-- What a member teaches, wants to learn, and roughly where they are (for in-person sessions).
alter table public.profiles
  add column teaches text[] not null default '{}',
  add column learns  text[] not null default '{}',
  add column city    text   not null default '' check (char_length(city) <= 60),
  add constraint profiles_teaches_max check (cardinality(teaches) <= 12),
  add constraint profiles_learns_max  check (cardinality(learns) <= 12),
  add constraint profiles_langs_max   check (cardinality(langs) <= 8);

grant update (teaches, learns, city) on public.profiles to authenticated;
