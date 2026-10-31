-- Run after the landing/support migration. Ends with RAISE so everything rolls back.
-- Passing run: "ERROR: ALL SUPPORT CHECKS PASSED (everything rolled back)".
do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  ok boolean; n int; who uuid; st record;
begin
  insert into auth.users (id, email, raw_user_meta_data, aud, role) values
    (a, 'orbit-s1@example.com', '{"name":"Support A"}', 'authenticated', 'authenticated'),
    (b, 'orbit-s2@example.com', '{"name":"Support B"}', 'authenticated', 'authenticated');

  -- the public numbers work for anyone
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  execute 'set local role anon';
  select * into st from public.orbit_stats();
  if st.members < 2 then raise exception 'stats did not count members'; end if;
  perform * from public.recent_sessions();

  -- someone logged out can send a request, and it is filed under nobody
  insert into public.support_requests (email, topic, message) values ('Guest@Example.com ', 'account', '  cannot log in  ');
  -- but cannot read any
  ok := false;
  begin perform 1 from public.support_requests; exception when others then ok := true; end;
  if not ok then raise exception 'anon could read support requests'; end if;
  -- and cannot write a reply or status
  ok := false;
  begin insert into public.support_requests (email, topic, message, reply) values ('x@example.com', 'other', 'hello there', 'fake'); exception when others then ok := true; end;
  if not ok then raise exception 'anon wrote a reply'; end if;
  execute 'reset role';
  select user_id is null and email = 'guest@example.com' and message = 'cannot log in' into ok from public.support_requests where email = 'guest@example.com';
  if not ok then raise exception 'anon request not stored as expected'; end if;

  -- a member's request is filed as them, and only they see it
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.support_requests (email, topic, message) values ('orbit-s1@example.com', 'credits', 'where are my credits');
  select count(*) into n from public.support_requests;
  if n <> 1 then raise exception 'member A sees % requests, expected 1', n; end if;
  execute 'reset role';
  select user_id into who from public.support_requests where message = 'where are my credits';
  if who <> a then raise exception 'request not filed as member A'; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.support_requests;
  if n <> 0 then raise exception 'member B sees someone else''s request'; end if;
  -- B cannot edit A's request
  begin update public.support_requests set message = 'changed' where user_id = a; exception when others then null; end;
  execute 'reset role';
  if exists (select 1 from public.support_requests where message = 'changed') then raise exception 'B edited A''s request'; end if;

  -- a reply from the dashboard marks it answered
  update public.support_requests set reply = 'Fixed, check again' where user_id = a;
  select status = 'answered' and replied_at is not null into ok from public.support_requests where user_id = a;
  if not ok then raise exception 'reply did not mark answered'; end if;

  -- no more than 5 an hour from one email
  for i in 1..4 loop
    insert into public.support_requests (email, topic, message) values ('guest@example.com', 'other', 'spam number ' || i);
  end loop;
  ok := false;
  begin insert into public.support_requests (email, topic, message) values ('guest@example.com', 'other', 'one too many'); exception when others then ok := true; end;
  if not ok then raise exception 'rate limit did not stop the sixth request'; end if;

  raise exception 'ALL SUPPORT CHECKS PASSED (everything rolled back)';
end $$;
