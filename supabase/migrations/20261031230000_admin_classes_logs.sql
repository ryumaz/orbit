-- orbit control: how classes went, every review, and the complete audit log.
-- Admins only, names and handles only (no emails), like the other admin functions.

-- classes: booked, attended, finished, and the ones that didn't work out; reviews; per skill
create function public.admin_classes() returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when not public.is_admin() then null else (
    select jsonb_build_object(
      'booked',    count(*),
      'open',      count(*) filter (where status in ('requested', 'accepted', 'live')),
      'attended',  count(*) filter (where started_at is not null),
      'completed', count(*) filter (where status = 'completed'),
      'ended',     count(*) filter (where status = 'ended'),
      'disputed',  count(*) filter (where status in ('disputed', 'resolved')),
      'declined',  count(*) filter (where status = 'declined'),
      'cancelled', count(*) filter (where status = 'cancelled'),
      'expired',   count(*) filter (where status = 'expired'),
      -- accepted, but the room was never opened before it closed
      'no_show',   count(*) filter (where accepted_at is not null and started_at is null and status in ('cancelled', 'expired', 'disputed', 'resolved')),
      'minutes',   coalesce(sum(minutes) filter (where status in ('completed', 'ended', 'resolved')), 0),
      'credits',   coalesce(sum(cost) filter (where status = 'completed'), 0),
      'reviews', (
        select jsonb_build_object(
          'count', count(*),
          'avg', round(avg(r.stars)::numeric, 2),
          'of_teachers', count(*) filter (where r.reviewee_id = x.mentor_id),
          'of_learners', count(*) filter (where r.reviewee_id = x.learner_id),
          'avg_teachers', round((avg(r.stars) filter (where r.reviewee_id = x.mentor_id))::numeric, 2),
          'avg_learners', round((avg(r.stars) filter (where r.reviewee_id = x.learner_id))::numeric, 2),
          'by_stars', jsonb_build_object(
            '5', count(*) filter (where r.stars = 5), '4', count(*) filter (where r.stars = 4), '3', count(*) filter (where r.stars = 3),
            '2', count(*) filter (where r.stars = 2), '1', count(*) filter (where r.stars = 1)),
          'reviewed_sessions', count(distinct r.session_id)
        )
        from public.reviews r join public.sessions x on x.id = r.session_id
      ),
      'skills', (
        select coalesce(jsonb_agg(t order by t.booked desc, t.skill), '[]'::jsonb) from (
          select s2.skill, count(*) as booked,
                 count(*) filter (where s2.status in ('completed', 'ended')) as done,
                 count(*) filter (where s2.status in ('declined', 'cancelled', 'expired', 'disputed', 'resolved')) as failed,
                 (select round(avg(r.stars)::numeric, 1) from public.reviews r join public.sessions y on y.id = r.session_id
                  where y.skill = s2.skill and r.reviewee_id = y.mentor_id) as rating
          from public.sessions s2 group by s2.skill order by count(*) desc limit 30
        ) t
      )
    ) from public.sessions
  ) end;
$$;

-- every review, both directions
create function public.admin_reviews()
returns table (id bigint, stars integer, body text, created_at timestamptz, session_id bigint, skill text, of_teacher boolean,
               reviewer text, reviewer_handle text, reviewee text, reviewee_handle text)
language sql stable security definer set search_path = '' as $$
  select r.id, r.stars, r.body, r.created_at, r.session_id, s.skill, r.reviewee_id = s.mentor_id,
         a.name, a.handle, b.name, b.handle
  from public.reviews r
  join public.sessions s on s.id = r.session_id
  join public.profiles a on a.id = r.reviewer_id
  join public.profiles b on b.id = r.reviewee_id
  where public.is_admin()
  order by r.created_at desc
  limit 500;
$$;

-- the complete audit log, newest first, 300 at a time (pass the oldest id seen to go further back)
create function public.admin_events(before_id bigint default null)
returns table (id bigint, created_at timestamptz, kind text, detail jsonb, session_id bigint, skill text,
               actor text, actor_handle text, learner text, mentor text)
language sql stable security definer set search_path = '' as $$
  select e.id, e.created_at, e.kind, e.detail, e.session_id, s.skill, a.name, a.handle, l.name, m.name
  from public.events e
  left join public.profiles a on a.id = e.actor_id
  left join public.sessions s on s.id = e.session_id
  left join public.profiles l on l.id = s.learner_id
  left join public.profiles m on m.id = s.mentor_id
  where public.is_admin() and (before_id is null or e.id < before_id)
  order by e.id desc
  limit 300;
$$;

revoke execute on function public.admin_classes(), public.admin_reviews(), public.admin_events(bigint) from public, anon;
grant execute on function public.admin_classes(), public.admin_reviews(), public.admin_events(bigint) to authenticated;
