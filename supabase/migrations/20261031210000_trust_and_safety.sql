-- Trust and safety.
-- 1. Requests expire after 5 hours if nobody answers (the learner can still withdraw before).
-- 2. Held credits never get stuck: 24 hours after a session's time is up the teacher is
--    paid automatically, unless the learner opened a dispute first.
-- 3. Disputes go to orbit's admins, who split the held credits (all, none or part).
-- 4. Admins: a list of user ids. They see disputes, reports and support requests.
-- 5. Reports: any member can report another; only admins read them.
-- 6. Chat is saved per session, with file attachments in a private storage bucket
--    that only the two people in the session can read.
-- 7. Members can delete their account: the profile is anonymised, sign-in is removed.
-- One function, sweep_due(), does the clock-driven work; pg_cron runs it every 5 minutes
-- and the app also calls it, so it happens even if cron is off.

-- ---------- statuses and new columns ----------
alter table public.sessions drop constraint sessions_status_check;
alter table public.sessions add constraint sessions_status_check
  check (status in ('requested', 'accepted', 'live', 'completed', 'declined', 'cancelled', 'ended', 'expired', 'disputed', 'resolved'));
alter table public.sessions
  add column dispute_by uuid,
  add column dispute_at timestamptz,
  add column dispute_reason text check (dispute_reason is null or char_length(dispute_reason) <= 1000),
  add column resolution text check (resolution is null or char_length(resolution) <= 1000),
  add column resolved_by uuid;
alter table public.profiles add column deleted_at timestamptz;

-- when held credits go to the teacher by themselves
create function public.release_at(s public.sessions) returns timestamptz
language sql stable set search_path = '' as $$
  select coalesce(s.started_at, s.accepted_at, s.created_at) + make_interval(mins => s.minutes) + interval '24 hours';
$$;
-- when an unanswered request lapses
create function public.expires_at(s public.sessions) returns timestamptz
language sql stable set search_path = '' as $$
  select s.created_at + interval '5 hours';
$$;

-- the audit log now also records why a session closed (auto-release, dispute outcome)
create or replace function public.log_session_change() returns trigger
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
            jsonb_build_object('skill', new.skill, 'cost', new.cost, 'mentor_share', new.mentor_share,
                               'resolution', new.resolution, 'reason', new.dispute_reason));
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

-- ---------- admins ----------
create table public.admins (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- ---------- the clock: expiry and auto-release ----------
create function public.sweep_due() returns integer
language plpgsql security definer set search_path = '' as $$
declare s public.sessions; n integer := 0;
begin
  -- one sweep at a time
  if not pg_try_advisory_xact_lock(hashtext('orbit-sweep')) then return 0; end if;

  update public.sessions x set status = 'expired', ended_at = now(), resolution = 'No answer within 5 hours.'
  where x.status = 'requested' and now() > public.expires_at(x);
  get diagnostics n = row_count;

  for s in
    select * from public.sessions x
    where x.status in ('accepted', 'live') and now() > public.release_at(x)
    for update skip locked
  loop
    insert into public.ledger (user_id, amount, type, note, session_id)
    values (s.mentor_id, s.cost, 'earn', 'paid automatically for ' || s.skill || ' (no dispute within 24 hours)', s.id)
    on conflict do nothing;
    update public.sessions
    set status = 'completed', ended_at = now(), end_by = null, end_share = null, end_at = null,
        resolution = 'Paid automatically: no dispute within 24 hours.'
    where id = s.id;
    n := n + 1;
  end loop;
  return n;
end $$;

-- ---------- disputes ----------
create function public.open_dispute(sid bigint, reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare s public.sessions;
begin
  select * into s from public.sessions where id = sid for update;
  if s.id is null or s.learner_id <> auth.uid() then raise exception 'Only the learner can open a dispute.'; end if;
  if s.status not in ('accepted', 'live') then raise exception 'This session is already %.', s.status; end if;
  if now() > public.release_at(s) then raise exception 'The 24 hours to dispute this session are over.'; end if;
  if char_length(trim(coalesce(reason, ''))) < 10 then raise exception 'Say in a sentence what went wrong.'; end if;
  update public.sessions
  set status = 'disputed', dispute_by = auth.uid(), dispute_at = now(), dispute_reason = left(trim(reason), 1000),
      end_by = null, end_share = null, end_at = null
  where id = sid;
end $$;

-- an admin decides: the teacher keeps `share` of the held credits, the rest goes back
create function public.resolve_dispute(sid bigint, share integer, note text) returns void
language plpgsql security definer set search_path = '' as $$
declare s public.sessions;
begin
  if not public.is_admin() then raise exception 'Only orbit admins can settle disputes.'; end if;
  select * into s from public.sessions where id = sid for update;
  if s.id is null or s.status <> 'disputed' then raise exception 'This session is not in dispute.'; end if;
  if share is null or share < 0 or share > s.cost then raise exception 'Pick between 0 and % credits.', s.cost; end if;
  if char_length(trim(coalesce(note, ''))) < 5 then raise exception 'Write a short note for both people.'; end if;
  if share > 0 then
    insert into public.ledger (user_id, amount, type, note, session_id)
    values (s.mentor_id, share, 'earn', 'dispute settled: kept ' || share || ' of ' || s.cost || ' for ' || s.skill, s.id);
  end if;
  if s.cost - share > 0 then
    insert into public.ledger (user_id, amount, type, note, session_id)
    values (s.learner_id, s.cost - share, 'refund', 'dispute settled: ' || (s.cost - share) || ' back for ' || s.skill, s.id);
  end if;
  update public.sessions
  set status = 'resolved', mentor_share = share, resolution = left(trim(note), 1000), resolved_by = auth.uid(),
      ended_at = now(), ended_by = auth.uid()
  where id = sid;
end $$;

-- what admins see for each open dispute (names, not emails)
create function public.admin_disputes()
returns table (id bigint, skill text, minutes integer, cost integer, status text, dispute_reason text, dispute_at timestamptz,
               started_at timestamptz, learner text, learner_handle text, mentor text, mentor_handle text, resolution text, mentor_share integer)
language sql stable security definer set search_path = '' as $$
  select s.id, s.skill, s.minutes, s.cost, s.status, s.dispute_reason, s.dispute_at, s.started_at,
         l.name, l.handle, m.name, m.handle, s.resolution, s.mentor_share
  from public.sessions s join public.profiles l on l.id = s.learner_id join public.profiles m on m.id = s.mentor_id
  where public.is_admin() and s.status in ('disputed', 'resolved')
  order by (s.status = 'disputed') desc, s.dispute_at desc nulls last
  limit 200;
$$;

-- ---------- chat ----------
create table public.messages (
  id         bigint generated always as identity primary key,
  session_id bigint not null references public.sessions (id) on delete cascade,
  sender_id  uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body       text not null default '' check (char_length(body) <= 2000),
  file_path  text check (file_path is null or char_length(file_path) <= 300),
  file_name  text check (file_name is null or char_length(file_name) <= 200),
  file_type  text check (file_type is null or char_length(file_type) <= 120),
  file_size  integer check (file_size is null or file_size between 1 and 26214400),
  created_at timestamptz not null default now(),
  check (char_length(trim(body)) > 0 or file_path is not null),
  check (file_path is null or file_path like session_id::text || '/%')
);
create index messages_session_idx on public.messages (session_id, created_at);
alter table public.messages enable row level security;

create function public.in_session(sid bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.sessions s where s.id = sid and auth.uid() in (s.learner_id, s.mentor_id));
$$;

create policy "the two people read their chat" on public.messages
  for select to authenticated using (public.in_session(session_id) or public.is_admin());
create policy "the two people write in their chat" on public.messages
  for insert to authenticated
  with check (sender_id = auth.uid() and public.in_session(session_id)
              and exists (select 1 from public.sessions s where s.id = session_id
                          and s.status not in ('declined', 'cancelled', 'expired')));
revoke all on public.messages from anon, authenticated;
grant select on public.messages to authenticated;
grant insert (session_id, body, file_path, file_name, file_type, file_size) on public.messages to authenticated;
alter publication supabase_realtime add table public.messages;

-- files: private bucket, folder = session id, 25 MB each
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-files', 'chat-files', false, 26214400, array[
  'image/png', 'image/jpeg', 'image/webp', 'image/gif',
  'video/mp4', 'video/webm', 'video/quicktime',
  'audio/mpeg', 'audio/mp4', 'audio/webm', 'audio/ogg', 'audio/wav',
  'application/pdf', 'text/plain', 'text/csv', 'application/zip',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
]);
create policy "session files: the two people upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'chat-files' and name ~ '^[0-9]+/' and public.in_session(split_part(name, '/', 1)::bigint));
create policy "session files: the two people (and admins) read" on storage.objects
  for select to authenticated
  using (bucket_id = 'chat-files' and name ~ '^[0-9]+/' and (public.in_session(split_part(name, '/', 1)::bigint) or public.is_admin()));

-- ---------- reports ----------
create table public.reports (
  id          bigint generated always as identity primary key,
  reporter_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  reported_id uuid not null references public.profiles (id) on delete cascade,
  session_id  bigint references public.sessions (id) on delete set null,
  reason      text not null check (reason in ('harassment', 'no-show', 'scam', 'inappropriate', 'fake', 'other')),
  details     text not null default '' check (char_length(details) <= 2000),
  status      text not null default 'open' check (status in ('open', 'reviewing', 'closed')),
  admin_note  text check (admin_note is null or char_length(admin_note) <= 1000),
  created_at  timestamptz not null default now(),
  closed_at   timestamptz,
  check (reporter_id <> reported_id)
);
alter table public.reports enable row level security;
create policy "members file reports as themselves" on public.reports
  for insert to authenticated with check (reporter_id = auth.uid() and status = 'open' and admin_note is null);
create policy "reporters see their reports, admins see all" on public.reports
  for select to authenticated using (reporter_id = auth.uid() or public.is_admin());
create policy "admins update reports" on public.reports
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.reports from anon, authenticated;
grant select on public.reports to authenticated;
grant insert (reported_id, session_id, reason, details) on public.reports to authenticated;
grant update (status, admin_note, closed_at) on public.reports to authenticated;

-- report a member by handle (the app never needs their id)
create function public.report_member(h text, reason text, details text, sid bigint default null) returns void
language plpgsql security definer set search_path = '' as $$
declare target uuid;
begin
  if auth.uid() is null then raise exception 'Log in to report someone.'; end if;
  select id into target from public.profiles where handle = lower(trim(h));
  if target is null then raise exception 'That member no longer exists.'; end if;
  if target = auth.uid() then raise exception 'You can''t report yourself.'; end if;
  if (select count(*) from public.reports where reporter_id = auth.uid() and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Too many reports in an hour. Wait a little.';
  end if;
  insert into public.reports (reporter_id, reported_id, session_id, reason, details)
  values (auth.uid(), target, case when sid is not null and public.in_session(sid) then sid end, reason, left(coalesce(trim(details), ''), 2000));
end $$;

create function public.admin_reports()
returns table (id bigint, reason text, details text, status text, admin_note text, created_at timestamptz, session_id bigint,
               reporter text, reporter_handle text, reported text, reported_handle text, reported_reports integer)
language sql stable security definer set search_path = '' as $$
  select r.id, r.reason, r.details, r.status, r.admin_note, r.created_at, r.session_id,
         a.name, a.handle, b.name, b.handle,
         (select count(*)::integer from public.reports x where x.reported_id = r.reported_id)
  from public.reports r join public.profiles a on a.id = r.reporter_id join public.profiles b on b.id = r.reported_id
  where public.is_admin()
  order by (r.status = 'closed'), r.created_at desc
  limit 300;
$$;

-- ---------- support: admins read and answer ----------
create policy "admins read all support requests" on public.support_requests
  for select to authenticated using (public.is_admin());
create policy "admins answer support requests" on public.support_requests
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
grant update (reply, status) on public.support_requests to authenticated;

-- ---------- delete my account ----------
create function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); tag text;
begin
  if me is null then raise exception 'Log in first.'; end if;
  if exists (select 1 from public.sessions where me in (learner_id, mentor_id) and status in ('requested', 'accepted', 'live', 'disputed')) then
    raise exception 'Finish, cancel or settle your open sessions first. Credits on hold need somewhere to go.';
  end if;
  tag := 'deleted_' || substr(md5(me::text || clock_timestamp()::text), 1, 10);
  -- the profile stays only as a name on other people's history
  update public.profiles
  set name = 'Deleted member', handle = tag, bio = '', langs = '{}', teaches = '{}', learns = '{}', city = '',
      avatar_url = '', card_color = 'chalk', skill_rates = '{}', onboarded = true, deleted_at = now()
  where id = me;
  delete from public.messages where sender_id = me;
  delete from public.support_requests where user_id = me;
  delete from public.admins where user_id = me;
  -- no more signing in: email freed, sign-ins removed, all devices logged out
  update auth.users
  set email = tag || '@deleted.orbit.invalid', phone = null, raw_user_meta_data = '{}'::jsonb,
      encrypted_password = '', banned_until = 'infinity'::timestamptz
  where id = me;
  delete from auth.identities where user_id = me;
  delete from auth.sessions where user_id = me;
  insert into public.events (session_id, actor_id, kind, detail) values (null, me, 'account-deleted', '{}');
end $$;

-- ---------- who may call what ----------
revoke execute on function public.release_at(public.sessions) from public, anon;
revoke execute on function public.expires_at(public.sessions) from public, anon;
grant execute on function public.release_at(public.sessions) to authenticated;
grant execute on function public.expires_at(public.sessions) to authenticated;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
revoke execute on function public.sweep_due() from public, anon;
grant execute on function public.sweep_due() to authenticated;
revoke execute on function public.open_dispute(bigint, text) from public, anon;
grant execute on function public.open_dispute(bigint, text) to authenticated;
revoke execute on function public.resolve_dispute(bigint, integer, text) from public, anon;
grant execute on function public.resolve_dispute(bigint, integer, text) to authenticated;
revoke execute on function public.admin_disputes() from public, anon;
grant execute on function public.admin_disputes() to authenticated;
revoke execute on function public.in_session(bigint) from public, anon;
grant execute on function public.in_session(bigint) to authenticated;
revoke execute on function public.report_member(text, text, text, bigint) from public, anon;
grant execute on function public.report_member(text, text, text, bigint) to authenticated;
revoke execute on function public.admin_reports() from public, anon;
grant execute on function public.admin_reports() to authenticated;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- the first admin: the account that runs orbit
insert into public.admins (user_id) select id from public.profiles where handle = 'ryumaxa';
