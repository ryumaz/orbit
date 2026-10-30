-- Run in the Supabase SQL editor after the sessions migration. Ends with RAISE so everything rolls back.
-- Passing run: "ERROR: ALL SESSION CHECKS PASSED (everything rolled back)".
do $$
declare
  a uuid := gen_random_uuid(); -- learner
  b uuid := gen_random_uuid(); -- mentor
  sid bigint; sid2 bigint; ok boolean;
begin
  insert into auth.users (id, email, raw_user_meta_data, aud, role) values
    (a, 'orbit-learner@example.com', '{"name":"Test Learner"}', 'authenticated', 'authenticated'),
    (b, 'orbit-mentor@example.com',  '{"name":"Test Mentor"}',  'authenticated', 'authenticated');
  update public.profiles set teaches = array['Guitar'], rate = 10 where id = b;

  -- as the learner: request 45 min of guitar -> costs ceil(10 * 45 / 30) = 15
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  sid := public.request_session((select handle from public.profiles where id = b), 'guitar', 45, 'teach me chords');
  execute 'reset role';
  if (select cost from public.sessions where id = sid) <> 15 then raise exception 'wrong price'; end if;
  if public.balance_of(a) <> 30 then raise exception 'request moved credits'; end if;

  -- the learner cannot accept their own request
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  ok := false;
  begin perform public.accept_session(sid); exception when others then ok := true; end;
  execute 'reset role';
  if not ok then raise exception 'learner could accept'; end if;

  -- as the mentor: accept -> 15 held from the learner
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform public.accept_session(sid);
  ok := false;
  begin perform public.complete_session(sid); exception when others then ok := true; end; -- mentor cannot pay themself
  execute 'reset role';
  if not ok then raise exception 'mentor could release credits'; end if;
  if public.balance_of(a) <> 15 then raise exception 'hold wrong: %', public.balance_of(a); end if;

  -- as the learner: complete -> mentor earns 15, exactly once
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform public.complete_session(sid);
  ok := false;
  begin perform public.complete_session(sid); exception when others then ok := true; end;
  execute 'reset role';
  if not ok then raise exception 'paid twice'; end if;
  if public.balance_of(b) <> 45 or public.balance_of(a) <> 15 then
    raise exception 'after pay: learner %, mentor %', public.balance_of(a), public.balance_of(b);
  end if;

  -- second session: accept then cancel -> refund
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  sid2 := public.request_session((select handle from public.profiles where id = b), 'Guitar', 15, '');
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform public.accept_session(sid2);
  perform public.cancel_session(sid2);
  execute 'reset role';
  if public.balance_of(a) <> 15 then raise exception 'refund wrong: %', public.balance_of(a); end if;

  -- too expensive: 60 min costs 20, learner has 15
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  ok := false;
  begin perform public.request_session((select handle from public.profiles where id = b), 'Guitar', 60, ''); exception when others then ok := true; end;
  -- a stranger cannot see these sessions
  execute 'reset role';
  if not ok then raise exception 'booked without enough credits'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  if (select count(*) from public.sessions where id in (sid, sid2)) <> 0 then raise exception 'stranger saw sessions'; end if;
  execute 'reset role';

  raise exception 'ALL SESSION CHECKS PASSED (everything rolled back)';
end $$;
