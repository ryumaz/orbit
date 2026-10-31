-- Disputes become tickets. A learner opens one; it waits until an admin accepts it.
-- Then a private thread opens for the learner, the teacher and orbit staff: each side
-- gives their account, staff can ask questions, and the class's own record (chat,
-- files, timeline) is there as evidence. Staff then decide who was right, or split.

alter table public.sessions
  add column dispute_claimed_by uuid references public.profiles (id) on delete set null,
  add column dispute_claimed_at timestamptz;

create table public.dispute_messages (
  id         bigint generated always as identity primary key,
  session_id bigint not null references public.sessions (id) on delete cascade,
  author_id  uuid references public.profiles (id) on delete set null,
  role       text not null check (role in ('learner', 'teacher', 'staff', 'system')),
  body       text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index dispute_messages_session_idx on public.dispute_messages (session_id, id);
alter table public.dispute_messages enable row level security;
create policy "the two people and staff read the ticket" on public.dispute_messages
  for select to authenticated using (public.in_session(session_id) or public.is_admin());
revoke all on public.dispute_messages from anon, authenticated;
grant select on public.dispute_messages to authenticated;
alter publication supabase_realtime add table public.dispute_messages;

-- staff take the ticket: both people are let in and told so
create function public.admin_claim_dispute(sid bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare s public.sessions; me text;
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  select * into s from public.sessions where id = sid for update;
  if s.id is null or s.status <> 'disputed' then raise exception 'This session is not in dispute.'; end if;
  if auth.uid() in (s.learner_id, s.mentor_id) then raise exception 'You are part of this session, so another admin has to handle it.'; end if;
  if s.dispute_claimed_by is not null and s.dispute_claimed_by <> auth.uid() then raise exception 'Another admin already has this ticket.'; end if;
  select name into me from public.profiles where id = auth.uid();
  update public.sessions set dispute_claimed_by = auth.uid(), dispute_claimed_at = now() where id = sid;
  insert into public.dispute_messages (session_id, author_id, role, body) values (sid, auth.uid(), 'system',
    coalesce(me, 'orbit support') || ' from orbit support has opened this ticket. Both of you can now explain what happened. Be honest and specific: the class chat and timeline are part of the record.');
  insert into public.events (session_id, actor_id, kind, detail) values (sid, auth.uid(), 'dispute-claimed', jsonb_build_object('skill', s.skill));
end $$;

-- learner, teacher or staff write in an open ticket
create function public.dispute_post(sid bigint, body text) returns void
language plpgsql security definer set search_path = '' as $$
declare s public.sessions; r text;
begin
  select * into s from public.sessions where id = sid;
  if s.id is null then raise exception 'No such session.'; end if;
  if auth.uid() = s.learner_id then r := 'learner';
  elsif auth.uid() = s.mentor_id then r := 'teacher';
  elsif public.is_admin() then r := 'staff';
  else raise exception 'This ticket is not yours.'; end if;
  if s.status <> 'disputed' then raise exception 'This dispute is closed.'; end if;
  if s.dispute_claimed_by is null and r <> 'staff' then raise exception 'Wait until orbit support opens the ticket.'; end if;
  if char_length(trim(coalesce(body, ''))) < 2 then raise exception 'Write something first.'; end if;
  if r <> 'staff' and (select count(*) from public.dispute_messages where session_id = sid and author_id = auth.uid() and created_at > now() - interval '1 minute') >= 6 then
    raise exception 'Slow down a little.';
  end if;
  insert into public.dispute_messages (session_id, author_id, role, body) values (sid, auth.uid(), r, left(trim(body), 2000));
end $$;

-- settling also closes the ticket with the verdict in the thread
create or replace function public.resolve_dispute(sid bigint, share integer, note text) returns void
language plpgsql security definer set search_path = '' as $$
declare s public.sessions; verdict text;
begin
  if not public.is_admin() then raise exception 'Only orbit admins can settle disputes.'; end if;
  select * into s from public.sessions where id = sid for update;
  if s.id is null or s.status <> 'disputed' then raise exception 'This session is not in dispute.'; end if;
  if auth.uid() in (s.learner_id, s.mentor_id) then raise exception 'You are part of this session, so another admin has to settle it.'; end if;
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
  verdict := case when share = 0 then 'Decision: the learner is right. All ' || s.cost || ' credits go back to the learner.'
                  when share = s.cost then 'Decision: the teacher is right. All ' || s.cost || ' credits go to the teacher.'
                  else 'Decision: split. The teacher keeps ' || share || ', the learner gets ' || (s.cost - share) || ' back.' end;
  insert into public.dispute_messages (session_id, author_id, role, body)
  values (sid, auth.uid(), 'system', verdict || E'\n' || left(trim(note), 1000));
  update public.sessions
  set status = 'resolved', mentor_share = share, resolution = left(trim(note), 1000), resolved_by = auth.uid(),
      ended_at = now(), ended_by = auth.uid(),
      dispute_claimed_by = coalesce(dispute_claimed_by, auth.uid()), dispute_claimed_at = coalesce(dispute_claimed_at, now())
  where id = sid;
end $$;

-- the record staff judge by: every step of the session, in order
create function public.admin_session_timeline(sid bigint)
returns table (id bigint, kind text, detail jsonb, created_at timestamptz, actor text, actor_handle text)
language sql stable security definer set search_path = '' as $$
  select e.id, e.kind, e.detail, e.created_at, a.name, a.handle
  from public.events e left join public.profiles a on a.id = e.actor_id
  where public.is_admin() and e.session_id = sid
  order by e.id;
$$;

-- the disputes list now says who has the ticket and how lively it is
drop function public.admin_disputes();
create function public.admin_disputes()
returns table (id bigint, skill text, minutes integer, cost integer, status text, dispute_reason text, dispute_at timestamptz,
               started_at timestamptz, accepted_at timestamptz, learner text, learner_handle text, mentor text, mentor_handle text,
               resolution text, mentor_share integer, claimed_by text, claimed_by_handle text, claimed_at timestamptz,
               messages integer, chat_messages integer, last_message_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select s.id, s.skill, s.minutes, s.cost, s.status, s.dispute_reason, s.dispute_at, s.started_at, s.accepted_at,
         l.name, l.handle, m.name, m.handle, s.resolution, s.mentor_share, c.name, c.handle, s.dispute_claimed_at,
         (select count(*)::integer from public.dispute_messages d where d.session_id = s.id and d.role <> 'system'),
         (select count(*)::integer from public.messages x where x.session_id = s.id),
         (select max(d.created_at) from public.dispute_messages d where d.session_id = s.id)
  from public.sessions s
  join public.profiles l on l.id = s.learner_id
  join public.profiles m on m.id = s.mentor_id
  left join public.profiles c on c.id = s.dispute_claimed_by
  where public.is_admin() and s.status in ('disputed', 'resolved')
  order by (s.status = 'disputed') desc, s.dispute_at desc nulls last
  limit 200;
$$;

revoke execute on function public.admin_claim_dispute(bigint), public.dispute_post(bigint, text), public.admin_session_timeline(bigint), public.admin_disputes() from public, anon;
grant execute on function public.admin_claim_dispute(bigint), public.dispute_post(bigint, text), public.admin_session_timeline(bigint), public.admin_disputes() to authenticated;
