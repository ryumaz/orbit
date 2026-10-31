-- The landing page runs on real data, and Orbi (the help assistant) can pass a
-- question to a person.
-- * orbit_stats(): four public numbers for the landing page
-- * recent_sessions(): the latest finished sessions, mentor side only (who taught what)
-- * support_requests: messages to the team. Anyone can send one (login trouble happens
--   before login); members see their own and any reply. Replies are written from the
--   Supabase dashboard.

create function public.orbit_stats()
returns table (members integer, teachers integer, sessions_done integer, credits_earned integer)
language sql stable security definer set search_path = '' as $$
  select (select count(*)::integer from public.profiles),
         (select count(*)::integer from public.profiles where cardinality(teaches) > 0),
         (select count(*)::integer from public.sessions where status in ('completed', 'ended')),
         (select coalesce(sum(amount), 0)::integer from public.ledger where type = 'earn');
$$;

-- learners are never named: only the mentor, the skill and the length
create function public.recent_sessions()
returns table (name text, handle text, avatar_url text, skill text, minutes integer, cost integer, at timestamptz)
language sql stable security definer set search_path = '' as $$
  select m.name, m.handle, m.avatar_url, s.skill, s.minutes, coalesce(s.mentor_share, s.cost), coalesce(s.ended_at, s.created_at)
  from public.sessions s join public.profiles m on m.id = s.mentor_id
  where s.status in ('completed', 'ended')
  order by coalesce(s.ended_at, s.created_at) desc
  limit 12;
$$;

revoke execute on function public.orbit_stats() from public;
revoke execute on function public.recent_sessions() from public;
grant execute on function public.orbit_stats() to anon, authenticated;
grant execute on function public.recent_sessions() to anon, authenticated;

create table public.support_requests (
  id         bigint generated always as identity primary key,
  user_id    uuid default auth.uid() references auth.users (id) on delete set null,
  email      text not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 120),
  topic      text not null check (topic in ('account', 'credits', 'sessions', 'calls', 'report', 'other')),
  message    text not null check (char_length(trim(message)) between 5 and 2000),
  page       text not null default '' check (char_length(page) <= 200),
  status     text not null default 'open' check (status in ('open', 'answered', 'closed')),
  reply      text,
  created_at timestamptz not null default now(),
  replied_at timestamptz
);
create index support_requests_user_idx on public.support_requests (user_id, created_at desc);
alter table public.support_requests enable row level security;

-- a request is always filed as whoever is signed in (or nobody), never as someone else
create policy "send a support request" on public.support_requests
  for insert to anon, authenticated
  with check (user_id is not distinct from auth.uid() and status = 'open' and reply is null and replied_at is null);
create policy "read my support requests" on public.support_requests
  for select to authenticated
  using (user_id = auth.uid());

revoke all on public.support_requests from anon, authenticated;
grant insert (email, topic, message, page) on public.support_requests to anon, authenticated;
grant select on public.support_requests to authenticated;

-- no flooding: at most 5 requests an hour from one email or one member
create function public.support_rate_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.support_requests r
      where r.created_at > now() - interval '1 hour'
        and (lower(r.email) = lower(new.email) or (new.user_id is not null and r.user_id = new.user_id))) >= 5 then
    raise exception 'Too many requests. Wait a little, then try again.';
  end if;
  new.message := trim(new.message);
  new.email := lower(trim(new.email));
  return new;
end $$;
create trigger support_rate_limit before insert on public.support_requests
  for each row execute function public.support_rate_limit();
revoke execute on function public.support_rate_limit() from public, anon, authenticated;

-- stamp replies made from the dashboard
create function public.support_replied() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.reply is distinct from old.reply and new.reply is not null then
    new.replied_at := now();
    if new.status = 'open' then new.status := 'answered'; end if;
  end if;
  return new;
end $$;
create trigger support_replied before update on public.support_requests
  for each row execute function public.support_replied();
revoke execute on function public.support_replied() from public, anon, authenticated;
