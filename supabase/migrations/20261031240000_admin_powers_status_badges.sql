-- 1. Admin powers: suspend and unsuspend, add or remove credits, make or remove admins,
--    clear a bio or photo, delete a review, and one call with everything about a member.
-- 2. Alerts: a Discord message when a dispute, report or support request comes in.
-- 3. A site-wide notice, shown across orbit while it is switched on.
-- 4. Status: online, idle, do not disturb or invisible, like Discord.
-- 5. Badges: achievements worked out from what a member has actually done.
-- Every admin action is written to the audit log with the admin as the actor.

-- ---------- suspension ----------
alter table public.profiles
  add column suspended_at timestamptz,
  add column suspended_reason text check (suspended_reason is null or char_length(suspended_reason) <= 500);

-- a suspended member can't be booked, book, or write in a chat (even with a token that hasn't expired yet)
create function public.block_suspended_session() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.profiles where id in (new.learner_id, new.mentor_id) and suspended_at is not null) then
    raise exception 'This member is suspended.';
  end if;
  return new;
end $$;
create trigger sessions_block_suspended before insert on public.sessions
  for each row execute function public.block_suspended_session();

create function public.block_suspended_message() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.profiles where id = new.sender_id and suspended_at is not null) then
    raise exception 'Your account is suspended.';
  end if;
  return new;
end $$;
create trigger messages_block_suspended before insert on public.messages
  for each row execute function public.block_suspended_message();

-- suspended members drop out of Find (same shape as before, one more condition)
create or replace function public.list_members()
returns table (handle text, name text, bio text, langs text[], teaches text[], learns text[], city text,
               avatar_url text, card_color text, rate integer, skill_rates jsonb, created_at timestamptz, rating numeric, reviews integer)
language sql stable security definer set search_path = '' as $$
  select p.handle, p.name, p.bio, p.langs, p.teaches, p.learns, p.city, p.avatar_url, p.card_color, p.rate, p.skill_rates, p.created_at,
         (select round(avg(r.stars)::numeric, 1) from public.reviews r where r.reviewee_id = p.id),
         (select count(*)::integer from public.reviews r where r.reviewee_id = p.id)
  from public.profiles p where cardinality(p.teaches) > 0 and p.suspended_at is null and p.deleted_at is null
  order by p.created_at desc limit 500;
$$;

-- admin credit changes get their own ledger type
alter table public.ledger drop constraint ledger_type_check;
alter table public.ledger add constraint ledger_type_check check (type in ('welcome', 'hold', 'earn', 'refund', 'adjust'));

-- the member a handle points to, for admin actions
create function public.admin_target(h text) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare target uuid;
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  select id into target from public.profiles where handle = lower(trim(h)) and deleted_at is null;
  if target is null then raise exception 'No member with that username.'; end if;
  return target;
end $$;

create function public.admin_log(kind text, detail jsonb) returns void
language sql security definer set search_path = '' as $$
  insert into public.events (session_id, actor_id, kind, detail) values (null, auth.uid(), kind, detail);
$$;

create function public.admin_suspend(h text, reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare target uuid := public.admin_target(h);
begin
  if target = auth.uid() then raise exception 'You can''t suspend yourself.'; end if;
  if exists (select 1 from public.admins where user_id = target) then raise exception 'Remove their admin role first.'; end if;
  if char_length(trim(coalesce(reason, ''))) < 3 then raise exception 'Write a short reason for the log.'; end if;
  update public.profiles set suspended_at = now(), suspended_reason = left(trim(reason), 500) where id = target;
  -- no new sign-ins, and every device is signed out
  update auth.users set banned_until = 'infinity'::timestamptz where id = target;
  delete from auth.sessions where user_id = target;
  perform public.admin_log('admin-suspended', jsonb_build_object('member', lower(trim(h)), 'reason', left(trim(reason), 500)));
end $$;

create function public.admin_unsuspend(h text) returns void
language plpgsql security definer set search_path = '' as $$
declare target uuid := public.admin_target(h);
begin
  update public.profiles set suspended_at = null, suspended_reason = null where id = target;
  update auth.users set banned_until = null where id = target;
  perform public.admin_log('admin-unsuspended', jsonb_build_object('member', lower(trim(h))));
end $$;

create function public.admin_adjust_credits(h text, amount integer, reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare target uuid := public.admin_target(h);
begin
  if amount is null or amount = 0 or abs(amount) > 500 then raise exception 'Pick an amount between -500 and 500, not 0.'; end if;
  if char_length(trim(coalesce(reason, ''))) < 3 then raise exception 'Write a short reason. The member sees it on their Credits page.'; end if;
  if public.balance_of(target) + amount < 0 then raise exception 'That would take them below zero.'; end if;
  insert into public.ledger (user_id, amount, type, note) values (target, amount, 'adjust', 'From orbit support: ' || left(trim(reason), 200));
  perform public.admin_log('admin-credits', jsonb_build_object('member', lower(trim(h)), 'amount', amount, 'reason', left(trim(reason), 200)));
end $$;

create function public.admin_set_admin(h text, make boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare target uuid := public.admin_target(h);
begin
  if make then
    if (select suspended_at from public.profiles where id = target) is not null then raise exception 'Unsuspend them first.'; end if;
    insert into public.admins (user_id) values (target) on conflict do nothing;
  else
    if target = auth.uid() then raise exception 'You can''t remove yourself. Ask another admin.'; end if;
    delete from public.admins where user_id = target;
  end if;
  perform public.admin_log(case when make then 'admin-granted' else 'admin-revoked' end, jsonb_build_object('member', lower(trim(h))));
end $$;

create function public.admin_clear_profile(h text, what text) returns void
language plpgsql security definer set search_path = '' as $$
declare target uuid := public.admin_target(h);
begin
  if what = 'bio' then update public.profiles set bio = '' where id = target;
  elsif what = 'photo' then update public.profiles set avatar_url = '' where id = target;
  else raise exception 'Clear the bio or the photo.';
  end if;
  perform public.admin_log('admin-cleared', jsonb_build_object('member', lower(trim(h)), 'field', what));
end $$;

create function public.admin_delete_review(rid bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.reviews;
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  delete from public.reviews where id = rid returning * into r;
  if r.id is null then raise exception 'That review is already gone.'; end if;
  perform public.admin_log('admin-review-deleted', jsonb_build_object(
    'stars', r.stars, 'body', left(r.body, 200), 'session', r.session_id,
    'member', (select handle from public.profiles where id = r.reviewer_id)));
end $$;

-- the full members list now says who is suspended
drop function public.admin_members();
create function public.admin_members()
returns table (handle text, name text, avatar_url text, created_at timestamptz, deleted boolean, sign_ins text,
               balance integer, taught integer, learned integer, reports integer, is_admin boolean, teaches text[], suspended boolean)
language sql stable security definer set search_path = '' as $$
  select p.handle, p.name, p.avatar_url, p.created_at, p.deleted_at is not null,
         (select string_agg(distinct i.provider, ', ') from auth.identities i where i.user_id = p.id),
         (select coalesce(sum(l.amount), 0)::integer from public.ledger l where l.user_id = p.id),
         (select count(*)::integer from public.sessions s where s.mentor_id = p.id and s.status in ('completed', 'resolved')),
         (select count(*)::integer from public.sessions s where s.learner_id = p.id and s.status in ('completed', 'resolved')),
         (select count(*)::integer from public.reports r where r.reported_id = p.id),
         exists (select 1 from public.admins a where a.user_id = p.id),
         p.teaches, p.suspended_at is not null
  from public.profiles p
  where public.is_admin()
  order by p.created_at desc
  limit 1000;
$$;

-- ---------- status ----------
alter table public.profiles add column status text not null default 'online'
  check (status in ('online', 'idle', 'dnd', 'invisible'));

create function public.set_my_status(s text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Log in first.'; end if;
  if s not in ('online', 'idle', 'dnd', 'invisible') then raise exception 'Pick online, idle, do not disturb or invisible.'; end if;
  update public.profiles set status = s where id = auth.uid();
end $$;

-- ---------- badges ----------
-- earned_at is when it happened, or null when it can't be pinned to one moment
create function public.badges_for(h text)
returns table (badge text, earned_at timestamptz)
language sql stable security definer set search_path = '' as $$
  with p as (select id, created_at, langs from public.profiles where handle = lower(trim(h)) and deleted_at is null),
  taught as (select coalesce(s.ended_at, s.created_at) as at, s.skill from public.sessions s join p on s.mentor_id = p.id
             where s.status in ('completed', 'ended', 'resolved')),
  learned as (select coalesce(s.ended_at, s.created_at) as at, s.skill from public.sessions s join p on s.learner_id = p.id
              where s.status in ('completed', 'ended', 'resolved')),
  booked as (select s.created_at as at from public.sessions s join p on s.learner_id = p.id),
  got as (select r.stars, r.created_at as at from public.reviews r join p on r.reviewee_id = p.id),
  wrote as (select r.created_at as at from public.reviews r join p on r.reviewer_id = p.id)
  select 'first-booking', (select min(at) from booked) where exists (select 1 from booked)
  union all select 'first-teach', (select min(at) from taught) where exists (select 1 from taught)
  union all select 'teach-5', (select at from taught order by at offset 4 limit 1) where (select count(*) from taught) >= 5
  union all select 'teach-10', (select at from taught order by at offset 9 limit 1) where (select count(*) from taught) >= 10
  union all select 'first-learn', (select min(at) from learned) where exists (select 1 from learned)
  union all select 'learn-5', (select at from learned order by at offset 4 limit 1) where (select count(*) from learned) >= 5
  union all select 'explorer', null::timestamptz where (select count(distinct lower(skill)) from learned) >= 3
  union all select 'fair-trader', greatest((select min(at) from taught), (select min(at) from learned))
    where exists (select 1 from taught) and exists (select 1 from learned)
  union all select 'five-star', (select min(at) from got where stars = 5) where exists (select 1 from got where stars = 5)
  union all select 'loved', null::timestamptz where (select count(*) from got) >= 3 and (select avg(stars) from got) >= 4.5
  union all select 'critic', (select at from wrote order by at offset 4 limit 1) where (select count(*) from wrote) >= 5
  union all select 'polyglot', null::timestamptz from p where cardinality(p.langs) >= 3
  union all select 'credits-100', null::timestamptz
    where (select coalesce(sum(l.amount), 0) from public.ledger l join p on l.user_id = p.id where l.type = 'earn') >= 100
  union all select 'early', p.created_at from p where p.created_at < '2026-11-15'::timestamptz;
$$;

-- ---------- everything about one member, for admins ----------
create function public.admin_member(h text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare p public.profiles;
begin
  if not public.is_admin() then return null; end if;
  select * into p from public.profiles where handle = lower(trim(h));
  if p.id is null then return null; end if;
  return jsonb_build_object(
    'profile', jsonb_build_object('handle', p.handle, 'name', p.name, 'bio', p.bio, 'avatar_url', p.avatar_url, 'city', p.city,
      'langs', p.langs, 'teaches', p.teaches, 'learns', p.learns, 'created_at', p.created_at, 'deleted', p.deleted_at is not null,
      'suspended_at', p.suspended_at, 'suspended_reason', p.suspended_reason, 'status', p.status),
    'is_admin', exists (select 1 from public.admins where user_id = p.id),
    'is_me', p.id = auth.uid(),
    'sign_ins', (select string_agg(distinct provider, ', ') from auth.identities where user_id = p.id),
    'last_sign_in', (select last_sign_in_at from auth.users where id = p.id),
    'balance', public.balance_of(p.id),
    'sessions', coalesce((select jsonb_agg(x order by x.created_at desc) from (
        select s.id, s.skill, s.status, s.cost, s.minutes, s.created_at, s.mentor_id = p.id as teaching, o.name as other, o.handle as other_handle
        from public.sessions s join public.profiles o on o.id = case when s.mentor_id = p.id then s.learner_id else s.mentor_id end
        where p.id in (s.learner_id, s.mentor_id) order by s.created_at desc limit 100) x), '[]'::jsonb),
    'reviews_got', coalesce((select jsonb_agg(x order by x.created_at desc) from (
        select r.id, r.stars, r.body, r.created_at, s.skill, a.name as who, a.handle as who_handle
        from public.reviews r join public.sessions s on s.id = r.session_id join public.profiles a on a.id = r.reviewer_id
        where r.reviewee_id = p.id limit 100) x), '[]'::jsonb),
    'reviews_gave', coalesce((select jsonb_agg(x order by x.created_at desc) from (
        select r.id, r.stars, r.body, r.created_at, s.skill, b.name as who, b.handle as who_handle
        from public.reviews r join public.sessions s on s.id = r.session_id join public.profiles b on b.id = r.reviewee_id
        where r.reviewer_id = p.id limit 100) x), '[]'::jsonb),
    'reports', coalesce((select jsonb_agg(x order by x.created_at desc) from (
        select r.id, r.reason, r.details, r.status, r.created_at, a.name as who, a.handle as who_handle
        from public.reports r join public.profiles a on a.id = r.reporter_id
        where r.reported_id = p.id limit 100) x), '[]'::jsonb),
    'reports_filed', (select count(*) from public.reports where reporter_id = p.id),
    'ledger', coalesce((select jsonb_agg(x order by x.id desc) from (
        select l.id, l.amount, l.type, l.note, l.session_id, l.created_at from public.ledger l
        where l.user_id = p.id order by l.id desc limit 100) x), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(x order by x.id desc) from (
        select e.id, e.kind, e.detail, e.created_at, e.session_id from public.events e
        where e.actor_id = p.id order by e.id desc limit 100) x), '[]'::jsonb),
    'badges', coalesce((select jsonb_agg(jsonb_build_object('badge', b.badge, 'earned_at', b.earned_at)) from public.badges_for(p.handle) b), '[]'::jsonb)
  );
end $$;

-- ---------- site-wide notice ----------
create table public.site_notice (
  id         integer primary key default 1 check (id = 1),
  body       text not null default '' check (char_length(body) <= 280),
  tone       text not null default 'info' check (tone in ('info', 'warn', 'good')),
  link_url   text check (link_url is null or link_url ~ '^(https://|/)' and char_length(link_url) <= 300),
  link_label text check (link_label is null or char_length(link_label) <= 40),
  active     boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
insert into public.site_notice (id) values (1);
alter table public.site_notice enable row level security;
revoke all on public.site_notice from anon, authenticated;

-- what orbit shows (nothing when it's switched off)
create function public.site_notice_now()
returns table (body text, tone text, link_url text, link_label text, updated_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select n.body, n.tone, n.link_url, n.link_label, n.updated_at from public.site_notice n where n.active and n.body <> '';
$$;

create function public.admin_get_notice() returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when public.is_admin() then to_jsonb(n) - 'updated_by' end from public.site_notice n;
$$;

create function public.admin_set_notice(body text, tone text, link_url text, link_label text, active boolean) returns void
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_variable
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  if active and char_length(trim(coalesce(body, ''))) < 3 then raise exception 'Write the notice first.'; end if;
  update public.site_notice
  set body = left(trim(coalesce(body, '')), 280), tone = coalesce(tone, 'info'),
      link_url = nullif(trim(coalesce(link_url, '')), ''), link_label = nullif(trim(coalesce(link_label, '')), ''),
      active = coalesce(active, false), updated_at = now(), updated_by = auth.uid()
  where id = 1;
  perform public.admin_log('notice-updated', jsonb_build_object('active', active, 'body', left(trim(coalesce(body, '')), 280)));
end $$;

-- ---------- alerts to Discord ----------
create extension if not exists pg_net;

create table public.admin_settings (
  key        text primary key,
  value      text,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.admin_settings enable row level security;
revoke all on public.admin_settings from anon, authenticated;

-- post to the Discord channel, if one is set; an alert never blocks what it reports
create function public.notify_admins(title text, body text, link text) returns void
language plpgsql security definer set search_path = '' as $$
declare hook text;
begin
  select value into hook from public.admin_settings where key = 'discord_webhook';
  if hook is null then return; end if;
  perform net.http_post(
    url := hook,
    body := jsonb_build_object('username', 'orbit control', 'embeds', jsonb_build_array(jsonb_build_object(
      'title', left(title, 250), 'description', left(coalesce(body, ''), 1500), 'url', link, 'color', 5195493,
      'timestamp', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')))),
    headers := '{"Content-Type": "application/json"}'::jsonb);
exception when others then
  null;
end $$;
revoke execute on function public.notify_admins(text, text, text) from public, anon, authenticated;

create function public.alert_dispute() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'disputed' and old.status is distinct from 'disputed' then
    perform public.notify_admins('Dispute on #' || new.id || ' · ' || new.skill,
      coalesce(new.dispute_reason, '') || E'\n' || new.cost || ' credits on hold.', 'https://orbit.voids.wtf/admin/#disputes');
  end if;
  return new;
end $$;
create trigger sessions_alert_dispute after update on public.sessions
  for each row execute function public.alert_dispute();

create function public.alert_report() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.notify_admins('New report: ' || new.reason,
    '@' || (select handle from public.profiles where id = new.reported_id) || ' was reported.' ||
    case when new.details <> '' then E'\n“' || left(new.details, 500) || '”' else '' end,
    'https://orbit.voids.wtf/admin/#reports');
  return new;
end $$;
create trigger reports_alert after insert on public.reports
  for each row execute function public.alert_report();

create function public.alert_support() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.notify_admins('Support: ' || new.topic, left(new.message, 800), 'https://orbit.voids.wtf/admin/#support');
  return new;
end $$;
create trigger support_alert after insert on public.support_requests
  for each row execute function public.alert_support();

-- admins see whether alerts are on (never the full link) and can change or test them
create function public.admin_get_alerts() returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when public.is_admin() then jsonb_build_object(
    'discord', exists (select 1 from public.admin_settings where key = 'discord_webhook' and value is not null),
    'hint', (select '…' || right(value, 6) from public.admin_settings where key = 'discord_webhook'),
    'updated_at', (select updated_at from public.admin_settings where key = 'discord_webhook')) end;
$$;

create function public.admin_set_discord(url text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  if nullif(trim(coalesce(url, '')), '') is null then
    delete from public.admin_settings where key = 'discord_webhook';
  elsif trim(url) !~ '^https://(canary\.|ptb\.)?discord(app)?\.com/api/webhooks/[0-9]+/[A-Za-z0-9_-]+$' then
    raise exception 'That isn''t a Discord webhook link. In Discord: channel settings → Integrations → Webhooks → Copy Webhook URL.';
  else
    insert into public.admin_settings (key, value, updated_by) values ('discord_webhook', trim(url), auth.uid())
    on conflict (key) do update set value = excluded.value, updated_at = now(), updated_by = auth.uid();
  end if;
  perform public.admin_log('alerts-updated', jsonb_build_object('discord', nullif(trim(coalesce(url, '')), '') is not null));
end $$;

create function public.admin_test_alert() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  if not exists (select 1 from public.admin_settings where key = 'discord_webhook') then raise exception 'Add a Discord webhook link first.'; end if;
  perform public.notify_admins('Test alert from orbit control',
    'Alerts work. Disputes, reports and support messages will show up here.', 'https://orbit.voids.wtf/admin/');
end $$;

-- ---------- who may call what ----------
revoke execute on function public.admin_target(text), public.admin_log(text, jsonb), public.admin_suspend(text, text),
  public.admin_unsuspend(text), public.admin_adjust_credits(text, integer, text), public.admin_set_admin(text, boolean),
  public.admin_clear_profile(text, text), public.admin_delete_review(bigint), public.admin_members(), public.admin_member(text),
  public.set_my_status(text), public.admin_get_notice(), public.admin_set_notice(text, text, text, text, boolean),
  public.admin_get_alerts(), public.admin_set_discord(text), public.admin_test_alert() from public, anon;
grant execute on function public.admin_suspend(text, text), public.admin_unsuspend(text), public.admin_adjust_credits(text, integer, text),
  public.admin_set_admin(text, boolean), public.admin_clear_profile(text, text), public.admin_delete_review(bigint),
  public.admin_members(), public.admin_member(text), public.set_my_status(text), public.admin_get_notice(),
  public.admin_set_notice(text, text, text, text, boolean), public.admin_get_alerts(), public.admin_set_discord(text),
  public.admin_test_alert() to authenticated;
-- internal helpers: only the functions above may use them (Supabase grants new functions to signed-in users by default)
revoke execute on function public.admin_target(text), public.admin_log(text, jsonb) from authenticated;
revoke execute on function public.badges_for(text), public.site_notice_now() from public;
grant execute on function public.badges_for(text), public.site_notice_now() to anon, authenticated;
