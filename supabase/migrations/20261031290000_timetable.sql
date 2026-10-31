-- Timetable booking.
-- 1. Teachers set weekly class hours (India time): e.g. Mon 18:00-21:00, Sat 10:00-13:00.
-- 2. Learners pick a start time inside those hours when they book; a class can still be
--    booked "as soon as you can" like before. Booked times can't overlap.
-- 3. A booked class starts at its time: the room's clock, the 24-hour release and the
--    request expiry all count from it, and the room can't go live more than 10 minutes early.
-- 4. 15 minutes before, both people get a reminder on their own Discord webhook.

-- ---------- weekly hours ----------
-- [{ "d": 1, "from": 1080, "to": 1260 }]: d is the weekday (0 = Sunday), from/to are
-- minutes after midnight in India time
alter table public.profiles add column class_hours jsonb not null default '[]';

alter table public.sessions
  add column scheduled_at timestamptz,
  add column reminded_at timestamptz;
create index sessions_mentor_scheduled_idx on public.sessions (mentor_id, scheduled_at) where scheduled_at is not null;

create function public.set_my_hours(hours jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare r jsonb; clean jsonb := '[]';
begin
  if auth.uid() is null then raise exception 'Log in first.'; end if;
  if jsonb_typeof(coalesce(hours, '[]')) <> 'array' or jsonb_array_length(coalesce(hours, '[]')) > 28 then
    raise exception 'Too many time ranges (28 at most).';
  end if;
  for r in select * from jsonb_array_elements(coalesce(hours, '[]')) loop
    if not (r ? 'd' and r ? 'from' and r ? 'to')
       or (r->>'d')::int not between 0 and 6
       or (r->>'from')::int not between 0 and 1425 or (r->>'to')::int not between 15 and 1440
       or (r->>'from')::int % 15 <> 0 or (r->>'to')::int % 15 <> 0
       or (r->>'to')::int - (r->>'from')::int < 15 then
      raise exception 'Each range needs a day and a start before its end, in 15-minute steps.';
    end if;
    clean := clean || jsonb_build_array(jsonb_build_object('d', (r->>'d')::int, 'from', (r->>'from')::int, 'to', (r->>'to')::int));
  end loop;
  update public.profiles
  set class_hours = (select coalesce(jsonb_agg(x order by (x->>'d')::int, (x->>'from')::int), '[]') from jsonb_array_elements(clean) x)
  where id = auth.uid();
end $$;

-- what a learner needs to pick a time: the teacher's hours and the times already taken
-- (no names or skills, just when)
create function public.timetable_for(h text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'hours', p.class_hours,
    'busy', coalesce((
      select jsonb_agg(jsonb_build_object('at', s.scheduled_at, 'minutes', s.minutes) order by s.scheduled_at)
      from public.sessions s
      where s.mentor_id = p.id and s.scheduled_at > now() - interval '2 hours'
        and s.status in ('requested', 'accepted', 'live')), '[]'))
  from public.profiles p where p.handle = lower(trim(h)) and p.deleted_at is null;
$$;

-- does [start_at, start_at + minutes) sit inside one of the teacher's ranges?
create function public.in_class_hours(hours jsonb, start_at timestamptz, minutes integer) returns boolean
language sql immutable set search_path = '' as $$
  with t as (select (start_at at time zone 'Asia/Kolkata') as l)
  select exists (
    select 1 from jsonb_array_elements(hours) r, t
    where (r->>'d')::int = extract(dow from t.l)::int
      and (r->>'from')::int <= extract(hour from t.l)::int * 60 + extract(minute from t.l)::int
      and extract(hour from t.l)::int * 60 + extract(minute from t.l)::int + minutes <= (r->>'to')::int);
$$;

-- ---------- booking with a time ----------
drop function public.request_session(text, text, integer, text);
create function public.request_session(mentor_handle text, skill text, minutes integer, message text default '', start_at timestamptz default null)
returns bigint language plpgsql security definer set search_path = '' as $$
#variable_conflict use_variable
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
  if start_at is not null then
    if start_at < now() + interval '30 minutes' then raise exception 'Pick a time at least 30 minutes from now.'; end if;
    if start_at > now() + interval '15 days' then raise exception 'You can book up to two weeks ahead.'; end if;
    if extract(minute from start_at)::int % 15 <> 0 or extract(second from start_at) <> 0 then raise exception 'Pick a time on the quarter hour.'; end if;
    if not public.in_class_hours(m.class_hours, start_at, minutes) then
      raise exception 'That time is outside %''s class hours.', m.name;
    end if;
    if exists (select 1 from public.sessions s
               where s.mentor_id = m.id
                 and s.status in ('requested', 'accepted', 'live') and s.scheduled_at is not null
                 and tstzrange(s.scheduled_at, s.scheduled_at + make_interval(mins => s.minutes)) && tstzrange(start_at, start_at + make_interval(mins => minutes))) then
      raise exception 'Someone just booked that time. Pick another.';
    end if;
    if exists (select 1 from public.sessions s
               where me in (s.mentor_id, s.learner_id) and s.status in ('requested', 'accepted', 'live') and s.scheduled_at is not null
                 and tstzrange(s.scheduled_at, s.scheduled_at + make_interval(mins => s.minutes)) && tstzrange(start_at, start_at + make_interval(mins => minutes))) then
      raise exception 'You already have a class at that time.';
    end if;
  end if;
  price := ceil(public.rate_for(m, skill) * minutes / 30.0);
  if public.balance_of(me) < price then
    raise exception 'You have % credits; this costs %. Teach someone to earn more.', public.balance_of(me), price;
  end if;
  insert into public.sessions (learner_id, mentor_id, skill, message, minutes, cost, scheduled_at)
  values (me, m.id, trim(skill), left(coalesce(trim(message), ''), 500), minutes, price, start_at)
  returning id into new_id;
  return new_id;
exception when unique_violation then
  raise exception 'You already have an open session with %. Finish or cancel it first.', m.name;
end $$;

-- ---------- the clock counts from the booked time ----------
-- the class begins when the room opens, or at its booked time (never before it was accepted)
create or replace function public.release_at(s public.sessions) returns timestamptz
language sql stable set search_path = '' as $$
  select coalesce(s.started_at, greatest(s.accepted_at, s.scheduled_at), s.created_at) + make_interval(mins => s.minutes) + interval '24 hours';
$$;
-- an unanswered request lapses after 5 hours, or when its booked time comes, whichever is first
create or replace function public.expires_at(s public.sessions) returns timestamptz
language sql stable set search_path = '' as $$
  select least(s.created_at + interval '5 hours', coalesce(s.scheduled_at, 'infinity'));
$$;

-- opening the room early doesn't start the clock: it starts 10 minutes before the booked time at most
create or replace function public.start_session(sid bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare s public.sessions;
begin
  select * into s from public.sessions where id = sid for update;
  if s.id is null or auth.uid() not in (s.learner_id, s.mentor_id) then raise exception 'Not your session.'; end if;
  if s.status = 'accepted' and (s.scheduled_at is null or now() >= s.scheduled_at - interval '10 minutes') then
    update public.sessions set status = 'live', started_at = greatest(now(), coalesce(s.scheduled_at, now())) where id = sid;
  end if;
end $$;

-- ---------- reminders ----------
alter table public.member_webhooks alter column events set default '{request,accepted,paid,dispute,reminder}';
update public.member_webhooks set events = array_append(events, 'reminder') where not ('reminder' = any (events));

create or replace function public.set_my_webhook(url text, events text[]) returns void
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_variable
declare clean text[];
begin
  if auth.uid() is null then raise exception 'Log in first.'; end if;
  clean := array(select distinct e from unnest(coalesce(events, '{}')) e where e in ('request', 'accepted', 'paid', 'dispute', 'reminder'));
  if nullif(trim(coalesce(url, '')), '') is null then
    if events is null then delete from public.member_webhooks where user_id = auth.uid();
    else update public.member_webhooks set events = clean where user_id = auth.uid(); end if;
    return;
  end if;
  if trim(url) !~ '^https://(canary\.|ptb\.)?discord(app)?\.com/api/webhooks/[0-9]+/[A-Za-z0-9_-]+$' then
    raise exception 'That isn''t a Discord webhook link. In Discord: channel settings → Integrations → Webhooks → Copy Webhook URL.';
  end if;
  insert into public.member_webhooks (user_id, url, events) values (auth.uid(), trim(url), clean)
  on conflict (user_id) do update set url = excluded.url, events = excluded.events;
end $$;

create or replace function public.my_webhook() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select jsonb_build_object('set', true, 'hint', '…' || right(url, 6), 'events', to_jsonb(events)) from public.member_webhooks where user_id = auth.uid()),
    jsonb_build_object('set', false, 'events', '["request","accepted","paid","dispute","reminder"]'::jsonb));
$$;

-- every 5 minutes: classes starting within 15 minutes get one reminder each
create function public.remind_upcoming() returns integer
language plpgsql security definer set search_path = '' as $$
declare s record; n integer := 0; t text;
begin
  for s in
    update public.sessions x set reminded_at = now()
    where x.status = 'accepted' and x.reminded_at is null and x.scheduled_at is not null
      and x.scheduled_at between now() and now() + interval '16 minutes'
    returning x.id, x.skill, x.minutes, x.scheduled_at, x.learner_id, x.mentor_id
  loop
    t := to_char(s.scheduled_at at time zone 'Asia/Kolkata', 'HH12:MI am') || ' IST';
    perform public.notify_member(s.mentor_id, 'reminder', 'Your ' || s.skill || ' class starts at ' || t,
      (select name from public.profiles where id = s.learner_id) || ' is booked for ' || s.minutes || ' min. Open the room a few minutes early.',
      'https://orbit.voids.wtf/#/s/' || s.id);
    perform public.notify_member(s.learner_id, 'reminder', 'Your ' || s.skill || ' class starts at ' || t,
      'With ' || (select name from public.profiles where id = s.mentor_id) || ', ' || s.minutes || ' min. Open the room a few minutes early.',
      'https://orbit.voids.wtf/#/s/' || s.id);
    n := n + 1;
  end loop;
  return n;
end $$;
select cron.schedule('orbit-remind', '*/5 * * * *', 'select public.remind_upcoming()');

-- the request ping says when
create or replace function public.member_alerts() returns trigger
language plpgsql security definer set search_path = '' as $$
declare learner text; mentor text; at_text text;
begin
  select name into learner from public.profiles where id = new.learner_id;
  select name into mentor from public.profiles where id = new.mentor_id;
  at_text := case when new.scheduled_at is null then '' else
    E'\n📅 ' || to_char(new.scheduled_at at time zone 'Asia/Kolkata', 'Dy DD Mon, HH12:MI am') || ' IST' end;
  if tg_op = 'INSERT' then
    perform public.notify_member(new.mentor_id, 'request', learner || ' wants to learn ' || new.skill,
      new.minutes || ' min · pays ' || new.cost || ' credits' || at_text || case when new.message <> '' then E'\n“' || left(new.message, 300) || '”' else '' end ||
      E'\nAccept or decline within 5 hours.', 'https://orbit.voids.wtf/#/sessions');
  elsif new.status is distinct from old.status then
    if new.status = 'accepted' then
      perform public.notify_member(new.learner_id, 'accepted', mentor || ' accepted your ' || new.skill || ' class',
        new.cost || ' credits are on hold.' || at_text || case when new.scheduled_at is null then E'\nJoin the room when you''re ready.' else '' end,
        'https://orbit.voids.wtf/#/s/' || new.id);
    elsif new.status = 'completed' then
      perform public.notify_member(new.mentor_id, 'paid', 'You got ' || new.cost || ' credits for ' || new.skill,
        coalesce(new.resolution, learner || ' said it worked. Nice teaching!'), 'https://orbit.voids.wtf/#/credits');
    elsif new.status = 'disputed' then
      perform public.notify_member(new.mentor_id, 'dispute', learner || ' opened a dispute on ' || new.skill,
        coalesce(new.dispute_reason, '') || E'\norbit support will open a ticket where you can give your side.', 'https://orbit.voids.wtf/#/s/' || new.id);
    end if;
  end if;
  return new;
end $$;

-- ---------- grants (new functions are open to everyone by default) ----------
revoke execute on function public.set_my_hours(jsonb) from public, anon;
grant execute on function public.set_my_hours(jsonb) to authenticated;
revoke execute on function public.timetable_for(text) from public;
grant execute on function public.timetable_for(text) to anon, authenticated;
revoke execute on function public.in_class_hours(jsonb, timestamptz, integer) from public, anon;
grant execute on function public.in_class_hours(jsonb, timestamptz, integer) to authenticated;
revoke execute on function public.request_session(text, text, integer, text, timestamptz) from public, anon;
grant execute on function public.request_session(text, text, integer, text, timestamptz) to authenticated;
revoke execute on function public.remind_upcoming() from public, anon, authenticated;
