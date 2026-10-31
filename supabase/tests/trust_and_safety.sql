-- Run after the trust and safety migration. Ends with RAISE so everything rolls back.
-- Passing run: "ERROR: ALL TRUST AND SAFETY CHECKS PASSED (everything rolled back)".
do $$
declare
  a uuid := gen_random_uuid(); -- learner
  b uuid := gen_random_uuid(); -- mentor
  c uuid := gen_random_uuid(); -- outsider
  adm uuid := gen_random_uuid(); -- admin
  s1 bigint; s2 bigint; s3 bigint; s4 bigint; mh text; ah text; ok boolean; n integer; bal integer; st text;
begin
  insert into auth.users (id, email, raw_user_meta_data, aud, role) values
    (a, 'orbit-t1@example.com', '{"name":"Trust Learner"}', 'authenticated', 'authenticated'),
    (b, 'orbit-t2@example.com', '{"name":"Trust Mentor"}', 'authenticated', 'authenticated'),
    (c, 'orbit-t3@example.com', '{"name":"Trust Outsider"}', 'authenticated', 'authenticated'),
    (adm, 'orbit-t4@example.com', '{"name":"Trust Admin"}', 'authenticated', 'authenticated');
  update public.profiles set teaches = array['Physics', 'Chess', 'Drums'], rate = 4 where id = b;
  insert into public.admins (user_id) values (adm);
  select handle into mh from public.profiles where id = b;
  select handle into ah from public.profiles where id = a;

  -- a request older than 5 hours expires; nothing was charged
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  s1 := public.request_session(mh, 'Physics', 30, '');
  execute 'reset role';
  update public.sessions set created_at = now() - interval '6 hours' where id = s1;
  perform public.sweep_due();
  select status into st from public.sessions where id = s1;
  if st <> 'expired' then raise exception 'old request is %, expected expired', st; end if;

  -- an accepted session past its time plus 24 hours pays the teacher by itself
  execute 'set local role authenticated';
  s2 := public.request_session(mh, 'Chess', 30, '');
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform public.accept_session(s2);
  execute 'reset role';
  update public.sessions set accepted_at = now() - interval '25 hours', created_at = now() - interval '25 hours' where id = s2;
  perform public.sweep_due();
  select status into st from public.sessions where id = s2;
  if st <> 'completed' then raise exception 'overdue session is %, expected completed', st; end if;
  if not exists (select 1 from public.ledger where session_id = s2 and type = 'earn' and user_id = b and amount = 4) then raise exception 'teacher was not paid automatically'; end if;
  perform public.sweep_due(); -- a second sweep changes nothing
  if (select count(*) from public.ledger where session_id = s2 and type = 'earn') <> 1 then raise exception 'teacher paid twice'; end if;

  -- a dispute stops the clock; only the learner may open one; an admin settles it
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  s3 := public.request_session(mh, 'Drums', 60, '');
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform public.accept_session(s3);
  ok := false;
  begin perform public.open_dispute(s3, 'the teacher wants to dispute'); exception when others then ok := true; end;
  if not ok then raise exception 'the teacher opened a dispute'; end if;
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform public.open_dispute(s3, 'They never showed up to the room.');
  -- the learner can't settle it themselves
  ok := false;
  begin perform public.resolve_dispute(s3, 0, 'refund me please'); exception when others then ok := true; end;
  if not ok then raise exception 'a learner settled their own dispute'; end if;
  execute 'reset role';
  update public.sessions set accepted_at = now() - interval '40 hours' where id = s3;
  perform public.sweep_due();
  select status into st from public.sessions where id = s3;
  if st <> 'disputed' then raise exception 'disputed session was auto-released (%)', st; end if;
  select public.balance_of(a) into bal;
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  if not exists (select 1 from public.admin_disputes() d where d.id = s3) then raise exception 'admin cannot see the dispute'; end if;
  perform public.resolve_dispute(s3, 2, 'Teacher joined late; most credits go back.');
  execute 'reset role';
  select status into st from public.sessions where id = s3;
  if st <> 'resolved' then raise exception 'dispute not resolved (%)', st; end if;
  if public.balance_of(a) <> bal + 6 then raise exception 'learner refund wrong: % -> %', bal, public.balance_of(a); end if;

  -- outsiders see no disputes, no reports, no chat
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.admin_disputes();
  if n <> 0 then raise exception 'an outsider saw % disputes', n; end if;
  ok := false;
  begin insert into public.messages (session_id, body) values (s3, 'sneaking in'); exception when others then ok := true; end;
  if not ok then raise exception 'an outsider wrote in someone else''s chat'; end if;
  execute 'reset role';

  -- the two people chat; each sees it; files must live in the session's folder
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.messages (session_id, body) values (s3, 'hello there');
  ok := false;
  begin insert into public.messages (session_id, body, file_path, file_name) values (s3, '', '999999/x.png', 'x.png'); exception when others then ok := true; end;
  if not ok then raise exception 'a file outside the session folder was accepted'; end if;
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.messages where session_id = s3;
  if n <> 1 then raise exception 'the teacher sees % messages, expected 1', n; end if;
  -- reports: filed as yourself, never about yourself, readable only by you and admins
  perform public.report_member(ah, 'no-show', 'Did not join.', s3);
  ok := false;
  begin perform public.report_member(mh, 'other', 'me'); exception when others then ok := true; end;
  if not ok then raise exception 'reported themselves'; end if;
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.reports;
  if n <> 0 then raise exception 'the reported person can read the report'; end if;
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  if not exists (select 1 from public.admin_reports() r where r.reported_handle = ah) then raise exception 'admin cannot see the report'; end if;
  update public.reports set status = 'closed', admin_note = 'Talked to both.' where reported_id = a;
  execute 'reset role';
  if not exists (select 1 from public.reports where reported_id = a and status = 'closed') then raise exception 'admin could not close the report'; end if;

  -- deleting an account: refused with open sessions, then anonymises and signs out
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  s4 := public.request_session(mh, 'Physics', 15, '');
  ok := false;
  begin perform public.delete_my_account(); exception when others then ok := true; end;
  if not ok then raise exception 'deleted an account with an open request'; end if;
  perform public.cancel_session(s4);
  perform public.delete_my_account();
  execute 'reset role';
  if (select name from public.profiles where id = a) <> 'Deleted member' then raise exception 'profile not anonymised'; end if;
  if (select email from auth.users where id = a) not like 'deleted_%@deleted.orbit.invalid' then raise exception 'email not freed'; end if;
  if exists (select 1 from public.messages where sender_id = a) then raise exception 'messages kept after deletion'; end if;
  if (select banned_until from auth.users where id = a) <> 'infinity'::timestamptz then raise exception 'deleted account can still sign in'; end if;

  raise exception 'ALL TRUST AND SAFETY CHECKS PASSED (everything rolled back)';
end $$;
