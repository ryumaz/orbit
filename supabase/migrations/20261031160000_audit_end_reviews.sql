-- 1. Audit log: every session step, early-ending proposal, review and profile edit
--    is written by the database itself (triggers and functions), never by the app.
-- 2. Ending early needs both people: one proposes how the held credits split,
--    the other agrees or says no. Giving everything away needs no agreement.
-- 3. Reviews: 1 to 5 stars after a session, one per person per session.

-- ---------- audit log ----------
create table public.events (
  id          bigint generated always as identity primary key,
  session_id  bigint references public.sessions (id) on delete cascade,
  actor_id    uuid references public.profiles (id) on delete set null,
  kind        text not null,
  detail      jsonb not null default '{}',
  created_at  timestamptz not null default now()
);
create index events_session_idx on public.events (session_id, created_at);
create index events_actor_idx on public.events (actor_id, created_at);
alter table public.events enable row level security;
create policy "members see events about them" on public.events
  for select to authenticated using (
    actor_id = auth.uid()
    or exists (select 1 from public.sessions s where s.id = session_id and auth.uid() in (s.learner_id, s.mentor_id))
  );
revoke all on public.events from anon;
revoke insert, update, delete on public.events from authenticated;

-- ---------- ending early ----------
alter table public.sessions drop constraint sessions_status_check;
alter table public.sessions add constraint sessions_status_check
  check (status in ('requested', 'accepted', 'live', 'completed', 'declined', 'cancelled', 'ended'));
alter table public.sessions
  add column end_by uuid,          -- who proposed ending early (null = no proposal)
  add column end_share integer,    -- proposed credits for the mentor
  add column end_at timestamptz,
  add column mentor_share integer; -- what the mentor kept when it ended early

-- log session steps and proposals
create function public.log_session_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.events (session_id, actor_id, kind, detail)
    values (new.id, coalesce(auth.uid(), new.learner_id), 'requested',
            jsonb_build_object('skill', new.skill, 'minutes', new.minutes, 'cost', new.cost));
    return new;
  end if;
  if new.status is distinct from old.status then
    insert into public.events (session_id, actor_id, kind, detail)
    values (new.id, auth.uid(), new.status,
            jsonb_build_object('skill', new.skill, 'cost', new.cost, 'mentor_share', new.mentor_share));
  elsif new.end_by is distinct from old.end_by or new.end_share is distinct from old.end_share then
    if new.end_by is not null then
      insert into public.events (session_id, actor_id, kind, detail)
      values (new.id, auth.uid(), 'end-proposed', jsonb_build_object('share', new.end_share, 'cost', new.cost, 'skill', new.skill));
    else
      insert into public.events (session_id, actor_id, kind, detail)
      values (new.id, auth.uid(), case when auth.uid() = old.end_by then 'end-withdrawn' else 'end-rejected' end,
              jsonb_build_object('share', old.end_share, 'cost', new.cost, 'skill', new.skill));
    end if;
  end if;
  return new;
end $$;
create trigger sessions_audit after insert or update on public.sessions
  for each row execute function public.log_session_change();

-- log profile edits (which fields changed, not their values)
create function public.log_profile_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare changed text[] := '{}';
begin
  if new.name is distinct from old.name then changed := array_append(changed, 'name'); end if;
  if new.handle is distinct from old.handle then changed := array_append(changed, 'username'); end if;
  if new.bio is distinct from old.bio then changed := array_append(changed, 'bio'); end if;
  if new.city is distinct from old.city then changed := array_append(changed, 'area'); end if;
  if new.langs is distinct from old.langs then changed := array_append(changed, 'languages'); end if;
  if new.teaches is distinct from old.teaches then changed := array_append(changed, 'what you teach'); end if;
  if new.learns is distinct from old.learns then changed := array_append(changed, 'what you want to learn'); end if;
  if new.avatar_url is distinct from old.avatar_url then changed := array_append(changed, 'photo'); end if;
  if new.card_color is distinct from old.card_color then changed := array_append(changed, 'card colour'); end if;
  if new.rate is distinct from old.rate then changed := array_append(changed, 'price'); end if;
  if cardinality(changed) > 0 then
    insert into public.events (session_id, actor_id, kind, detail)
    values (null, new.id, 'profile-updated', jsonb_build_object('fields', changed, 'rate', new.rate));
  end if;
  return new;
end $$;
create trigger profiles_audit after update on public.profiles
  for each row execute function public.log_profile_change();

-- split the held credits: share to the mentor, the rest back to the learner
create function public.finish_early(sid bigint, share integer) returns void
language plpgsql security definer set search_path = '' as $$
declare s public.sessions;
begin
  select * into s from public.sessions where id = sid for update;
  if share > 0 then
    insert into public.ledger (user_id, amount, type, note, session_id)
    values (s.mentor_id, share, 'earn', 'kept ' || share || ' of ' || s.cost || ' for part of ' || s.skill, s.id);
  end if;
  if s.cost - share > 0 then
    insert into public.ledger (user_id, amount, type, note, session_id)
    values (s.learner_id, s.cost - share, 'refund', 'refund: ' || s.skill || ' ended early', s.id);
  end if;
  update public.sessions
  set status = 'ended', mentor_share = share, end_by = null, end_share = null, end_at = null,
      ended_at = now(), ended_by = auth.uid()
  where id = sid;
end $$;
revoke execute on function public.finish_early(bigint, integer) from public, anon, authenticated;

create function public.propose_end(sid bigint, share integer) returns text
language plpgsql security definer set search_path = '' as $$
declare s public.sessions; me uuid := auth.uid();
begin
  select * into s from public.sessions where id = sid for update;
  if s.id is null or me not in (s.learner_id, s.mentor_id) then raise exception 'Not your session.'; end if;
  if s.status not in ('accepted', 'live') then raise exception 'This session is already %.', s.status; end if;
  if share is null or share < 0 or share > s.cost then raise exception 'Pick between 0 and % credits.', s.cost; end if;
  -- giving everything to the other person needs no agreement
  if (me = s.mentor_id and share = 0) or (me = s.learner_id and share = s.cost) then
    perform public.finish_early(sid, share);
    return 'ended';
  end if;
  update public.sessions set end_by = me, end_share = share, end_at = now() where id = sid;
  return 'proposed';
end $$;

create function public.answer_end(sid bigint, agree boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare s public.sessions; me uuid := auth.uid();
begin
  select * into s from public.sessions where id = sid for update;
  if s.id is null or me not in (s.learner_id, s.mentor_id) then raise exception 'Not your session.'; end if;
  if s.status not in ('accepted', 'live') then raise exception 'This session is already %.', s.status; end if;
  if s.end_by is null then raise exception 'There is no proposal to answer.'; end if;
  if s.end_by = me then raise exception 'Waiting for the other person to answer.'; end if;
  if agree then
    perform public.finish_early(sid, s.end_share);
  else
    update public.sessions set end_by = null, end_share = null, end_at = null where id = sid;
  end if;
end $$;

create function public.withdraw_end(sid bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare s public.sessions;
begin
  select * into s from public.sessions where id = sid for update;
  if s.id is null or s.end_by is distinct from auth.uid() then raise exception 'You have no proposal on this session.'; end if;
  update public.sessions set end_by = null, end_share = null, end_at = null where id = sid;
end $$;

-- cancelling alone only works before the mentor accepts
create or replace function public.cancel_session(sid bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare s public.sessions;
begin
  select * into s from public.sessions where id = sid for update;
  if s.id is null or auth.uid() not in (s.learner_id, s.mentor_id) then raise exception 'Not your session.'; end if;
  if s.status in ('accepted', 'live') then
    raise exception 'You both need to agree to end an accepted session. Use End early instead.';
  end if;
  if s.status <> 'requested' then raise exception 'This session is already %.', s.status; end if;
  update public.sessions set status = 'cancelled', ended_at = now(), ended_by = auth.uid() where id = sid;
end $$;

-- completing also clears any open proposal
create or replace function public.complete_session(sid bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare s public.sessions; learner_name text;
begin
  select * into s from public.sessions where id = sid for update;
  if s.id is null or s.learner_id <> auth.uid() then raise exception 'Only the learner can release the credits.'; end if;
  if s.status not in ('accepted', 'live') then raise exception 'This session is %.', s.status; end if;
  select name into learner_name from public.profiles where id = s.learner_id;
  insert into public.ledger (user_id, amount, type, note, session_id)
  values (s.mentor_id, s.cost, 'earn', 'taught ' || s.skill || ' to ' || learner_name, s.id);
  update public.sessions
  set status = 'completed', ended_at = now(), ended_by = auth.uid(), end_by = null, end_share = null, end_at = null
  where id = sid;
end $$;

-- ---------- reviews ----------
create table public.reviews (
  id           bigint generated always as identity primary key,
  session_id   bigint not null references public.sessions (id) on delete cascade,
  reviewer_id  uuid not null references public.profiles (id) on delete cascade,
  reviewee_id  uuid not null references public.profiles (id) on delete cascade,
  stars        integer not null check (stars between 1 and 5),
  body         text not null default '' check (char_length(body) <= 500),
  created_at   timestamptz not null default now(),
  unique (session_id, reviewer_id)
);
create index reviews_reviewee_idx on public.reviews (reviewee_id, created_at desc);
alter table public.reviews enable row level security;
create policy "members see reviews they wrote or got" on public.reviews
  for select to authenticated using (auth.uid() in (reviewer_id, reviewee_id));
revoke all on public.reviews from anon;
revoke insert, update, delete on public.reviews from authenticated;

create function public.leave_review(sid bigint, stars integer, body text default '') returns void
language plpgsql security definer set search_path = '' as $$
declare s public.sessions; me uuid := auth.uid(); other uuid;
begin
  select * into s from public.sessions where id = sid;
  if s.id is null or me not in (s.learner_id, s.mentor_id) then raise exception 'Not your session.'; end if;
  if s.status not in ('completed', 'ended') then raise exception 'You can review once the session is over.'; end if;
  if stars is null or stars < 1 or stars > 5 then raise exception 'Pick 1 to 5 stars.'; end if;
  other := case when me = s.learner_id then s.mentor_id else s.learner_id end;
  insert into public.reviews (session_id, reviewer_id, reviewee_id, stars, body)
  values (sid, me, other, stars, left(coalesce(trim(body), ''), 500));
  insert into public.events (session_id, actor_id, kind, detail)
  values (sid, me, 'reviewed', jsonb_build_object('stars', stars, 'skill', s.skill));
exception when unique_violation then
  raise exception 'You already reviewed this session.';
end $$;

-- public reviews of a member, by handle (names and handles only, no ids or emails)
create function public.reviews_for(h text)
returns table (stars integer, body text, created_at timestamptz, skill text, as_mentor boolean,
               reviewer_name text, reviewer_handle text, reviewer_avatar text)
language sql stable security definer set search_path = '' as $$
  select r.stars, r.body, r.created_at, s.skill, (s.mentor_id = r.reviewee_id),
         p.name, p.handle, p.avatar_url
  from public.reviews r
  join public.sessions s on s.id = r.session_id
  join public.profiles p on p.id = r.reviewer_id
  where r.reviewee_id = (select id from public.profiles where handle = lower(trim(h)))
  order by r.created_at desc
  limit 50;
$$;

-- public cards now carry the rating
drop function public.profile_by_handle(text);
drop function public.list_members();
create function public.profile_by_handle(h text)
returns table (handle text, name text, bio text, langs text[], teaches text[], learns text[], city text,
               avatar_url text, card_color text, rate integer, created_at timestamptz, rating numeric, reviews integer)
language sql stable security definer set search_path = '' as $$
  select p.handle, p.name, p.bio, p.langs, p.teaches, p.learns, p.city, p.avatar_url, p.card_color, p.rate, p.created_at,
         (select round(avg(r.stars)::numeric, 1) from public.reviews r where r.reviewee_id = p.id),
         (select count(*)::integer from public.reviews r where r.reviewee_id = p.id)
  from public.profiles p where p.handle = lower(trim(h));
$$;
create function public.list_members()
returns table (handle text, name text, bio text, langs text[], teaches text[], learns text[], city text,
               avatar_url text, card_color text, rate integer, created_at timestamptz, rating numeric, reviews integer)
language sql stable security definer set search_path = '' as $$
  select p.handle, p.name, p.bio, p.langs, p.teaches, p.learns, p.city, p.avatar_url, p.card_color, p.rate, p.created_at,
         (select round(avg(r.stars)::numeric, 1) from public.reviews r where r.reviewee_id = p.id),
         (select count(*)::integer from public.reviews r where r.reviewee_id = p.id)
  from public.profiles p where cardinality(p.teaches) > 0
  order by p.created_at desc limit 500;
$$;

revoke execute on function public.propose_end(bigint, integer) from public, anon;
revoke execute on function public.answer_end(bigint, boolean) from public, anon;
revoke execute on function public.withdraw_end(bigint) from public, anon;
revoke execute on function public.leave_review(bigint, integer, text) from public, anon;
revoke execute on function public.reviews_for(text) from public;
revoke execute on function public.profile_by_handle(text) from public;
revoke execute on function public.list_members() from public;
grant execute on function public.propose_end(bigint, integer) to authenticated;
grant execute on function public.answer_end(bigint, boolean) to authenticated;
grant execute on function public.withdraw_end(bigint) to authenticated;
grant execute on function public.leave_review(bigint, integer, text) to authenticated;
grant execute on function public.reviews_for(text) to anon, authenticated;
grant execute on function public.profile_by_handle(text) to anon, authenticated;
grant execute on function public.list_members() to anon, authenticated;
revoke execute on function public.log_session_change() from public, anon, authenticated;
revoke execute on function public.log_profile_change() from public, anon, authenticated;
