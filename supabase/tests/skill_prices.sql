-- Run after the skill prices migration. Ends with RAISE so everything rolls back.
-- Passing run: "ERROR: ALL SKILL PRICE CHECKS PASSED (everything rolled back)".
do $$
declare
  a uuid := gen_random_uuid(); -- learner
  b uuid := gen_random_uuid(); -- mentor
  c uuid := gen_random_uuid(); -- second learner
  sid bigint; cost integer; ok boolean; mh text;
begin
  insert into auth.users (id, email, raw_user_meta_data, aud, role) values
    (a, 'orbit-p1@example.com', '{"name":"Price Learner"}', 'authenticated', 'authenticated'),
    (b, 'orbit-p2@example.com', '{"name":"Price Mentor"}', 'authenticated', 'authenticated'),
    (c, 'orbit-p3@example.com', '{"name":"Price Learner Two"}', 'authenticated', 'authenticated');
  select handle into mh from public.profiles where id = b;

  -- the mentor sets a default and a special price, as themselves
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  update public.profiles set teaches = array['Physics', 'Free fire'], rate = 10, skill_rates = '{"Physics": 16}' where id = b;
  -- out of range or not a whole number is refused
  ok := false;
  begin update public.profiles set skill_rates = '{"Physics": 500}' where id = b; exception when others then ok := true; end;
  if not ok then raise exception 'a price of 500 was accepted'; end if;
  ok := false;
  begin update public.profiles set skill_rates = '{"Physics": 9.5}' where id = b; exception when others then ok := true; end;
  if not ok then raise exception 'a fractional price was accepted'; end if;
  ok := false;
  begin update public.profiles set skill_rates = '["Physics"]' where id = b; exception when others then ok := true; end;
  if not ok then raise exception 'a list was accepted as prices'; end if;
  execute 'reset role';

  -- 45 minutes of Physics costs ceil(16 x 1.5) = 24, whatever case the learner types
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  sid := public.request_session(mh, 'physics', 45, '');
  execute 'reset role';
  select s.cost into cost from public.sessions s where s.id = sid;
  if cost <> 24 then raise exception 'Physics for 45 min cost %, expected 24', cost; end if;

  -- a skill without its own price uses the default: 45 min of Free fire = ceil(10 * 1.5) = 15
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  sid := public.request_session(mh, 'Free fire', 45, '');
  execute 'reset role';
  select s.cost into cost from public.sessions s where s.id = sid;
  if cost <> 15 then raise exception 'Free fire for 45 min cost %, expected 15', cost; end if;

  -- the public card shows the prices
  if (select p.skill_rates ->> 'Physics' from public.profile_by_handle(mh) p) <> '16' then raise exception 'profile_by_handle lacks skill_rates'; end if;
  if not exists (select 1 from public.list_members() m where m.handle = mh and m.skill_rates ? 'Physics') then raise exception 'list_members lacks skill_rates'; end if;

  raise exception 'ALL SKILL PRICE CHECKS PASSED (everything rolled back)';
end $$;
