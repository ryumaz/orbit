-- The admin dashboard (its own app at /admin/): totals, members and sessions.
-- Like the other admin functions, these answer only for accounts in public.admins,
-- and show names and handles, never emails.

-- one call for the overview: counts, credits and the last 14 days
create function public.admin_overview() returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when not public.is_admin() then null else jsonb_build_object(
    'members',       (select count(*) from public.profiles where deleted_at is null),
    'members_week',  (select count(*) from public.profiles where deleted_at is null and created_at > now() - interval '7 days'),
    'deleted',       (select count(*) from public.profiles where deleted_at is not null),
    'teachers',      (select count(*) from public.profiles where deleted_at is null and cardinality(teaches) > 0),
    'sessions',      (select count(*) from public.sessions),
    'by_status',     (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb) from (select status, count(*) as n from public.sessions group by status) x),
    'credits_total', (select coalesce(sum(amount), 0) from public.ledger),
    'credits_held',  (select coalesce(sum(cost), 0) from public.sessions where status in ('accepted', 'live', 'disputed')),
    'credits_moved', (select coalesce(sum(amount), 0) from public.ledger where type = 'earn'),
    'open_disputes', (select count(*) from public.sessions where status = 'disputed'),
    'open_reports',  (select count(*) from public.reports where status <> 'closed'),
    'open_support',  (select count(*) from public.support_requests where status = 'open'),
    'days', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'day', d::date,
        'sessions', (select count(*) from public.sessions s where s.created_at >= d and s.created_at < d + interval '1 day'),
        'members',  (select count(*) from public.profiles p where p.created_at >= d and p.created_at < d + interval '1 day')
      ) order by d), '[]'::jsonb)
      from generate_series(date_trunc('day', now()) - interval '13 days', date_trunc('day', now()), interval '1 day') d
    )
  ) end;
$$;

-- everyone who has an account, newest first
create function public.admin_members()
returns table (handle text, name text, avatar_url text, created_at timestamptz, deleted boolean, sign_ins text,
               balance integer, taught integer, learned integer, reports integer, is_admin boolean, teaches text[])
language sql stable security definer set search_path = '' as $$
  select p.handle, p.name, p.avatar_url, p.created_at, p.deleted_at is not null,
         (select string_agg(distinct i.provider, ', ') from auth.identities i where i.user_id = p.id),
         (select coalesce(sum(l.amount), 0)::integer from public.ledger l where l.user_id = p.id),
         (select count(*)::integer from public.sessions s where s.mentor_id = p.id and s.status in ('completed', 'resolved')),
         (select count(*)::integer from public.sessions s where s.learner_id = p.id and s.status in ('completed', 'resolved')),
         (select count(*)::integer from public.reports r where r.reported_id = p.id),
         exists (select 1 from public.admins a where a.user_id = p.id),
         p.teaches
  from public.profiles p
  where public.is_admin()
  order by p.created_at desc
  limit 1000;
$$;

-- the latest sessions, all statuses
create function public.admin_sessions()
returns table (id bigint, skill text, minutes integer, cost integer, status text, created_at timestamptz, started_at timestamptz,
               ended_at timestamptz, learner text, learner_handle text, mentor text, mentor_handle text, messages integer)
language sql stable security definer set search_path = '' as $$
  select s.id, s.skill, s.minutes, s.cost, s.status, s.created_at, s.started_at, s.ended_at,
         l.name, l.handle, m.name, m.handle,
         (select count(*)::integer from public.messages x where x.session_id = s.id)
  from public.sessions s join public.profiles l on l.id = s.learner_id join public.profiles m on m.id = s.mentor_id
  where public.is_admin()
  order by s.created_at desc
  limit 500;
$$;

revoke execute on function public.admin_overview(), public.admin_members(), public.admin_sessions() from public, anon;
grant execute on function public.admin_overview(), public.admin_members(), public.admin_sessions() to authenticated;
