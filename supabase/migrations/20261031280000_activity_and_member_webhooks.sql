-- 1. Activity graph (like GitHub's contributions): what a member did each day for the
--    last year, so profiles can show the squares and a streak.
-- 2. Personal Discord alerts: each member can add their own Discord webhook and pick
--    which moments ping it (a new request, an accepted request, getting paid, a dispute).
--    The link is kept private: nobody, not even the member, reads it back in full.

-- ---------- activity ----------
create function public.activity_for(h text)
returns table (day date, taught integer, learned integer, reviews integer)
language sql stable security definer set search_path = '' as $$
  with p as (select id from public.profiles where handle = lower(trim(h)) and deleted_at is null),
  done as (
    select (coalesce(s.ended_at, s.created_at) at time zone 'Asia/Kolkata')::date as d,
           (s.mentor_id = p.id) as as_teacher
    from public.sessions s join p on p.id in (s.learner_id, s.mentor_id)
    where s.status in ('completed', 'ended', 'resolved')
      and coalesce(s.ended_at, s.created_at) > now() - interval '371 days'
  ),
  rev as (
    select (r.created_at at time zone 'Asia/Kolkata')::date as d
    from public.reviews r join p on r.reviewer_id = p.id
    where r.created_at > now() - interval '371 days'
  ),
  days as (select d from done union select d from rev)
  select days.d,
         (select count(*)::integer from done where done.d = days.d and done.as_teacher),
         (select count(*)::integer from done where done.d = days.d and not done.as_teacher),
         (select count(*)::integer from rev where rev.d = days.d)
  from days order by days.d;
$$;
revoke execute on function public.activity_for(text) from public;
grant execute on function public.activity_for(text) to anon, authenticated;

-- ---------- personal Discord alerts ----------
create table public.member_webhooks (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  url        text not null check (url ~ '^https://(canary\.|ptb\.)?discord(app)?\.com/api/webhooks/[0-9]+/[A-Za-z0-9_-]+$'),
  events     text[] not null default '{request,accepted,paid,dispute}',
  created_at timestamptz not null default now()
);
alter table public.member_webhooks enable row level security;
revoke all on public.member_webhooks from anon, authenticated;

create function public.my_webhook() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select jsonb_build_object('set', true, 'hint', '…' || right(url, 6), 'events', to_jsonb(events)) from public.member_webhooks where user_id = auth.uid()),
    jsonb_build_object('set', false, 'events', '["request","accepted","paid","dispute"]'::jsonb));
$$;

create function public.set_my_webhook(url text, events text[]) returns void
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_variable
declare clean text[];
begin
  if auth.uid() is null then raise exception 'Log in first.'; end if;
  clean := array(select distinct e from unnest(coalesce(events, '{}')) e where e in ('request', 'accepted', 'paid', 'dispute'));
  if nullif(trim(coalesce(url, '')), '') is null then
    -- no new link: keep the saved one and just update the choices, or remove it if asked
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

-- send one message to a member's own webhook, if they want this kind
create function public.notify_member(uid uuid, kind text, title text, body text, link text) returns void
language plpgsql security definer set search_path = '' as $$
declare w public.member_webhooks;
begin
  select * into w from public.member_webhooks where user_id = uid;
  if w.user_id is null or not (kind = any (w.events) or kind = 'test') then return; end if;
  perform net.http_post(
    url := w.url,
    body := jsonb_build_object('username', 'orbit', 'embeds', jsonb_build_array(jsonb_build_object(
      'title', left(title, 250), 'description', left(coalesce(body, ''), 1500), 'url', link, 'color', 10191615,
      'timestamp', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')))),
    headers := '{"Content-Type": "application/json"}'::jsonb);
exception when others then
  null;
end $$;
revoke execute on function public.notify_member(uuid, text, text, text, text) from public, anon, authenticated;

create function public.test_my_webhook() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.member_webhooks where user_id = auth.uid()) then raise exception 'Save a webhook link first.'; end if;
  perform public.notify_member(auth.uid(), 'test', 'orbit is connected', 'You''ll get a message here when something happens with your classes.', 'https://orbit.voids.wtf/#/sessions');
end $$;

-- the moments that ping
create function public.member_alerts() returns trigger
language plpgsql security definer set search_path = '' as $$
declare learner text; mentor text;
begin
  select name into learner from public.profiles where id = new.learner_id;
  select name into mentor from public.profiles where id = new.mentor_id;
  if tg_op = 'INSERT' then
    perform public.notify_member(new.mentor_id, 'request', learner || ' wants to learn ' || new.skill,
      new.minutes || ' min · pays ' || new.cost || ' credits' || case when new.message <> '' then E'\n“' || left(new.message, 300) || '”' else '' end ||
      E'\nAccept or decline within 5 hours.', 'https://orbit.voids.wtf/#/sessions');
  elsif new.status is distinct from old.status then
    if new.status = 'accepted' then
      perform public.notify_member(new.learner_id, 'accepted', mentor || ' accepted your ' || new.skill || ' class',
        new.cost || ' credits are on hold. Join the room when you''re ready.', 'https://orbit.voids.wtf/#/s/' || new.id);
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
create trigger sessions_member_alerts after insert or update on public.sessions
  for each row execute function public.member_alerts();

revoke execute on function public.my_webhook(), public.set_my_webhook(text, text[]), public.test_my_webhook() from public, anon;
grant execute on function public.my_webhook(), public.set_my_webhook(text, text[]), public.test_my_webhook() to authenticated;
