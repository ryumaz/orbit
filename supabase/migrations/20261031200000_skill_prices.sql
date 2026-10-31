-- A price per skill. Members keep one default price (rate, credits per 30 minutes)
-- and can set a different one for any skill they teach: an hour of exam prep can be
-- worth more than an hour of Free Fire tips.
--   skill_rates = { "Physics": 16, "Free fire": 6 }   (credits per 30 minutes, 2 to 80)
-- Booking always charges the skill's own price, worked out here, never by the browser.

create function public.valid_skill_rates(r jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(r) = 'object'
     and (select count(*) from jsonb_object_keys(r)) <= 12
     and coalesce((select bool_and(jsonb_typeof(v) = 'number' and (v::text)::numeric = trunc((v::text)::numeric)
                                   and (v::text)::numeric between 2 and 80)
                   from jsonb_each(r) as e(k, v)), true);
$$;

alter table public.profiles
  add column skill_rates jsonb not null default '{}'::jsonb,
  add constraint profiles_skill_rates check (public.valid_skill_rates(skill_rates));
grant update (skill_rates) on public.profiles to authenticated;

-- the price of 30 minutes of one skill (case doesn't matter), or the default
create function public.rate_for(p public.profiles, skill text) returns integer
language sql stable set search_path = '' as $$
  select coalesce(
    (select (e.v::text)::integer from jsonb_each(p.skill_rates) as e(k, v) where lower(e.k) = lower(trim(skill)) limit 1),
    p.rate);
$$;

create or replace function public.request_session(mentor_handle text, skill text, minutes integer, message text default '')
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  m public.profiles;
  price integer;
  new_id bigint;
begin
  if me is null then raise exception 'Log in to book a session.'; end if;
  select * into m from public.profiles where handle = lower(trim(mentor_handle));
  if m.id is null then raise exception 'That member no longer exists.'; end if;
  if m.id = me then raise exception 'You can''t book yourself.'; end if;
  if not exists (select 1 from unnest(m.teaches) t where lower(t) = lower(trim(skill))) then
    raise exception '% doesn''t list % any more.', m.name, skill;
  end if;
  if minutes not in (15, 30, 45, 60) then raise exception 'Pick 15, 30, 45 or 60 minutes.'; end if;
  price := ceil(public.rate_for(m, skill) * minutes / 30.0);
  if public.balance_of(me) < price then
    raise exception 'You have % credits; this costs %. Teach someone to earn more.', public.balance_of(me), price;
  end if;
  insert into public.sessions (learner_id, mentor_id, skill, message, minutes, cost)
  values (me, m.id, trim(skill), left(coalesce(trim(message), ''), 500), minutes, price)
  returning id into new_id;
  return new_id;
exception when unique_violation then
  raise exception 'You already have an open session with %. Finish or cancel it first.', m.name;
end $$;

-- public profiles now carry the per-skill prices
drop function public.profile_by_handle(text);
drop function public.list_members();
create function public.profile_by_handle(h text)
returns table (handle text, name text, bio text, langs text[], teaches text[], learns text[], city text,
               avatar_url text, card_color text, rate integer, skill_rates jsonb, created_at timestamptz, rating numeric, reviews integer)
language sql stable security definer set search_path = '' as $$
  select p.handle, p.name, p.bio, p.langs, p.teaches, p.learns, p.city, p.avatar_url, p.card_color, p.rate, p.skill_rates, p.created_at,
         (select round(avg(r.stars)::numeric, 1) from public.reviews r where r.reviewee_id = p.id),
         (select count(*)::integer from public.reviews r where r.reviewee_id = p.id)
  from public.profiles p where p.handle = lower(trim(h));
$$;
create function public.list_members()
returns table (handle text, name text, bio text, langs text[], teaches text[], learns text[], city text,
               avatar_url text, card_color text, rate integer, skill_rates jsonb, created_at timestamptz, rating numeric, reviews integer)
language sql stable security definer set search_path = '' as $$
  select p.handle, p.name, p.bio, p.langs, p.teaches, p.learns, p.city, p.avatar_url, p.card_color, p.rate, p.skill_rates, p.created_at,
         (select round(avg(r.stars)::numeric, 1) from public.reviews r where r.reviewee_id = p.id),
         (select count(*)::integer from public.reviews r where r.reviewee_id = p.id)
  from public.profiles p where cardinality(p.teaches) > 0
  order by p.created_at desc limit 500;
$$;

revoke execute on function public.profile_by_handle(text) from public;
revoke execute on function public.list_members() from public;
grant execute on function public.profile_by_handle(text) to anon, authenticated;
grant execute on function public.list_members() to anon, authenticated;
revoke execute on function public.rate_for(public.profiles, text) from public, anon;
grant execute on function public.rate_for(public.profiles, text) to authenticated;
