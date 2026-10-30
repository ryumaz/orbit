-- Run after the audit/end/reviews migration. Ends with RAISE so everything rolls back.
-- Passing run: "ERROR: ALL END/REVIEW CHECKS PASSED (everything rolled back)".
do $$
declare
  a uuid := gen_random_uuid(); -- learner
  b uuid := gen_random_uuid(); -- mentor
  sid bigint; sid2 bigint; ok boolean; r text; n int;
begin
  insert into auth.users (id, email, raw_user_meta_data, aud, role) values
    (a, 'orbit-l2@example.com', '{"name":"Test Learner"}', 'authenticated', 'authenticated'),
    (b, 'orbit-m2@example.com', '{"name":"Test Mentor"}', 'authenticated', 'authenticated');
  update public.profiles set teaches = array['Physics'], rate = 10 where id = b;

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  sid := public.request_session((select handle from public.profiles where id = b), 'Physics', 30, '');
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform public.accept_session(sid);
  -- cancelling alone is no longer allowed once accepted
  ok := false;
  begin perform public.cancel_session(sid); exception when others then ok := true; end;
  execute 'reset role';
  if not ok then raise exception 'mentor cancelled alone'; end if;

  -- learner proposes: mentor keeps 4 of 10
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  r := public.propose_end(sid, 4);
  ok := false;
  begin perform public.answer_end(sid, true); exception when others then ok := true; end; -- can't answer own proposal
  execute 'reset role';
  if r <> 'proposed' or not ok then raise exception 'proposal step wrong: %', r; end if;

  -- mentor says no, then the learner proposes again, then the mentor agrees
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform public.answer_end(sid, false);
  execute 'reset role';
  if (select end_by from public.sessions where id = sid) is not null then raise exception 'rejection did not clear'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform public.propose_end(sid, 4);
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform public.answer_end(sid, true);
  execute 'reset role';
  if (select status from public.sessions where id = sid) <> 'ended' then raise exception 'not ended'; end if;
  if public.balance_of(a) <> 26 or public.balance_of(b) <> 34 then
    raise exception 'split wrong: learner %, mentor %', public.balance_of(a), public.balance_of(b);
  end if;

  -- second session: the mentor gives everything back -> ends at once, no agreement needed
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  sid2 := public.request_session((select handle from public.profiles where id = b), 'Physics', 15, '');
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform public.accept_session(sid2);
  r := public.propose_end(sid2, 0);
  execute 'reset role';
  if r <> 'ended' or public.balance_of(a) <> 26 then raise exception 'full refund wrong: % %', r, public.balance_of(a); end if;

  -- reviews: learner rates the mentor 5; a second review of the same session is refused
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform public.leave_review(sid, 5, 'clear and patient');
  ok := false;
  begin perform public.leave_review(sid, 1, 'again'); exception when others then ok := true; end;
  execute 'reset role';
  if not ok then raise exception 'reviewed twice'; end if;
  if (select rating from public.profile_by_handle((select handle from public.profiles where id = b))) <> 5.0 then raise exception 'rating wrong'; end if;
  if (select count(*) from public.reviews_for((select handle from public.profiles where id = b))) <> 1 then raise exception 'reviews_for wrong'; end if;

  -- a stranger can't review, and can't see the events
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  ok := false;
  begin perform public.leave_review(sid, 1, 'x'); exception when others then ok := true; end;
  if (select count(*) from public.events where session_id in (sid, sid2)) <> 0 then raise exception 'stranger saw events'; end if;
  execute 'reset role';
  if not ok then raise exception 'stranger reviewed'; end if;

  -- the audit log has the whole story of the first session
  select count(*) into n from public.events where session_id = sid
    and kind in ('requested', 'accepted', 'end-proposed', 'end-rejected', 'ended', 'reviewed');
  if n < 6 then raise exception 'audit log incomplete: % events', n; end if;
  if not exists (select 1 from public.events where actor_id = b and kind = 'profile-updated') then raise exception 'profile edit not logged'; end if;

  raise exception 'ALL END/REVIEW CHECKS PASSED (everything rolled back)';
end $$;
