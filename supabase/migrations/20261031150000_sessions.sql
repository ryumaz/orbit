-- Real sessions between members, with credits held in escrow.
--   request  -> nothing moves
--   accept   -> the learner's credits are held (ledger 'hold', negative)
--   complete -> the mentor is paid (ledger 'earn'), only the learner can do this
--   cancel   -> held credits go back (ledger 'refund')
-- Every move happens inside one function, under a row lock, and a unique index
-- makes a second hold, payment or refund for the same session impossible.

alter table public.profiles add column rate integer not null default 10 check (rate between 2 and 40);
grant update (rate) on public.profiles to authenticated;

create table public.sessions (
  id            bigint generated always as identity primary key,
  learner_id    uuid not null references public.profiles (id) on delete cascade,
  mentor_id     uuid not null references public.profiles (id) on delete cascade,
  skill         text not null check (char_length(skill) between 1 and 40),
  message       text not null default '' check (char_length(message) <= 500),
  minutes       integer not null check (minutes in (15, 30, 45, 60)),
  cost          integer not null check (cost between 1 and 200),
  status        text not null default 'requested'
                check (status in ('requested', 'accepted', 'live', 'completed', 'declined', 'cancelled')),
  created_at    timestamptz not null default now(),
  accepted_at   timestamptz,
  started_at    timestamptz,
  ended_at      timestamptz,
  ended_by      uuid,
  check (learner_id <> mentor_id)
);
create index sessions_learner_idx on public.sessions (learner_id, created_at desc);
create index sessions_mentor_idx on public.sessions (mentor_id, created_at desc);
-- one open request at a time between the same two people
create unique index sessions_one_open on public.sessions (learner_id, mentor_id)
  where status in ('requested', 'accepted', 'live');

alter table public.ledger add constraint ledger_session_fk foreign key (session_id) references public.sessions (id);
create unique index ledger_once_per_session on public.ledger (session_id, type) where session_id is not null;

alter table public.sessions enable row level security;
create policy "members see their own sessions" on public.sessions
  for select to authenticated using (auth.uid() in (learner_id, mentor_id));
revoke all on public.sessions from anon;
revoke insert, update, delete on public.sessions from authenticated;

create function public.balance_of(uid uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(amount), 0)::integer from public.ledger where user_id = uid;
$$;
revoke execute on function public.balance_of(uuid) from public, anon, authenticated;

-- learner asks a mentor (by handle) for a session
create function public.request_session(mentor_handle text, skill text, minutes integer, message text default '')
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
  price := ceil(m.rate * minutes / 30.0);
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

-- mentor accepts: hold the learner's credits now
create function public.accept_session(sid bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare s public.sessions; mentor_name text;
begin
  select * into s from public.sessions where id = sid for update;
  if s.id is null or s.mentor_id <> auth.uid() then raise exception 'Only the mentor can accept this.'; end if;
  if s.status <> 'requested' then raise exception 'This request was already %.', s.status; end if;
  perform 1 from public.profiles where id = s.learner_id for update; -- one balance check at a time per learner
  if public.balance_of(s.learner_id) < s.cost then
    raise exception 'They don''t have enough credits any more.';
  end if;
  select name into mentor_name from public.profiles where id = s.mentor_id;
  insert into public.ledger (user_id, amount, type, note, session_id)
  values (s.learner_id, -s.cost, 'hold', 'held for ' || s.skill || ' with ' || mentor_name, s.id);
  update public.sessions set status = 'accepted', accepted_at = now() where id = sid;
end $$;

create function public.decline_session(sid bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare s public.sessions;
begin
  select * into s from public.sessions where id = sid for update;
  if s.id is null or s.mentor_id <> auth.uid() then raise exception 'Only the mentor can decline this.'; end if;
  if s.status <> 'requested' then raise exception 'This request was already %.', s.status; end if;
  update public.sessions set status = 'declined', ended_at = now(), ended_by = auth.uid() where id = sid;
end $$;

-- either person opens the room: the session is live
create function public.start_session(sid bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare s public.sessions;
begin
  select * into s from public.sessions where id = sid for update;
  if s.id is null or auth.uid() not in (s.learner_id, s.mentor_id) then raise exception 'Not your session.'; end if;
  if s.status = 'accepted' then
    update public.sessions set status = 'live', started_at = now() where id = sid;
  end if;
end $$;

-- the learner says it worked: pay the mentor, once
create function public.complete_session(sid bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare s public.sessions; learner_name text;
begin
  select * into s from public.sessions where id = sid for update;
  if s.id is null or s.learner_id <> auth.uid() then raise exception 'Only the learner can release the credits.'; end if;
  if s.status not in ('accepted', 'live') then raise exception 'This session is %.', s.status; end if;
  select name into learner_name from public.profiles where id = s.learner_id;
  insert into public.ledger (user_id, amount, type, note, session_id)
  values (s.mentor_id, s.cost, 'earn', 'taught ' || s.skill || ' to ' || learner_name, s.id);
  update public.sessions set status = 'completed', ended_at = now(), ended_by = auth.uid() where id = sid;
end $$;

-- either person cancels: held credits go back to the learner
create function public.cancel_session(sid bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare s public.sessions;
begin
  select * into s from public.sessions where id = sid for update;
  if s.id is null or auth.uid() not in (s.learner_id, s.mentor_id) then raise exception 'Not your session.'; end if;
  if s.status not in ('requested', 'accepted', 'live') then raise exception 'This session is already %.', s.status; end if;
  if s.status in ('accepted', 'live') then
    insert into public.ledger (user_id, amount, type, note, session_id)
    values (s.learner_id, s.cost, 'refund', 'refund: ' || s.skill || ' was cancelled', s.id);
  end if;
  update public.sessions set status = 'cancelled', ended_at = now(), ended_by = auth.uid() where id = sid;
end $$;

revoke execute on function public.request_session(text, text, integer, text) from public, anon;
revoke execute on function public.accept_session(bigint) from public, anon;
revoke execute on function public.decline_session(bigint) from public, anon;
revoke execute on function public.start_session(bigint) from public, anon;
revoke execute on function public.complete_session(bigint) from public, anon;
revoke execute on function public.cancel_session(bigint) from public, anon;
grant execute on function public.request_session(text, text, integer, text) to authenticated;
grant execute on function public.accept_session(bigint) to authenticated;
grant execute on function public.decline_session(bigint) to authenticated;
grant execute on function public.start_session(bigint) to authenticated;
grant execute on function public.complete_session(bigint) to authenticated;
grant execute on function public.cancel_session(bigint) to authenticated;

-- public card now includes the rate (return type changes, so recreate)
drop function public.profile_by_handle(text);
drop function public.list_members();
create function public.profile_by_handle(h text)
returns table (handle text, name text, bio text, langs text[], teaches text[], learns text[], city text,
               avatar_url text, card_color text, rate integer, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.handle, p.name, p.bio, p.langs, p.teaches, p.learns, p.city, p.avatar_url, p.card_color, p.rate, p.created_at
  from public.profiles p where p.handle = lower(trim(h));
$$;
create function public.list_members()
returns table (handle text, name text, bio text, langs text[], teaches text[], learns text[], city text,
               avatar_url text, card_color text, rate integer, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.handle, p.name, p.bio, p.langs, p.teaches, p.learns, p.city, p.avatar_url, p.card_color, p.rate, p.created_at
  from public.profiles p where cardinality(p.teaches) > 0
  order by p.created_at desc limit 500;
$$;
revoke execute on function public.profile_by_handle(text) from public;
revoke execute on function public.list_members() from public;
grant execute on function public.profile_by_handle(text) to anon, authenticated;
grant execute on function public.list_members() to anon, authenticated;

-- live updates: new requests and credit moves reach the app instantly (RLS still applies)
alter publication supabase_realtime add table public.sessions, public.ledger;
