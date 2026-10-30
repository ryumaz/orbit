-- Run in the Supabase SQL editor. Ends with RAISE so every change rolls back.
-- Passing run: "ERROR: ALL CHECKS PASSED (everything rolled back)".
do $$
declare u uuid := gen_random_uuid(); b int; n text; other int;
begin
  insert into auth.users (id, email, raw_user_meta_data, aud, role)
  values (u, 'orbit-test@example.com', '{"name":"Test Person"}', 'authenticated', 'authenticated');
  select name into n from public.profiles where id = u;
  select sum(amount) into b from public.ledger where user_id = u;
  if n is distinct from 'Test Person' or b is distinct from 30 then raise exception 'signup trigger wrong: % %', n, b; end if;

  begin
    insert into public.ledger (user_id, amount, type) values (u, 30, 'welcome');
    raise exception 'second welcome was allowed';
  exception when unique_violation then null;
  end;

  if has_table_privilege('authenticated', 'public.ledger', 'insert') then raise exception 'members can write the ledger'; end if;
  if has_table_privilege('authenticated', 'public.ledger', 'update') then raise exception 'members can edit the ledger'; end if;
  if has_table_privilege('anon', 'public.profiles', 'select') then raise exception 'logged-out visitors can read profiles'; end if;
  if has_column_privilege('authenticated', 'public.profiles', 'id', 'update') then raise exception 'members can change their id'; end if;
  if not has_column_privilege('authenticated', 'public.profiles', 'bio', 'update') then raise exception 'members cannot edit bio'; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select public.my_balance() into b;
  select count(*) into other from public.ledger where user_id <> u;
  execute 'reset role';
  if b <> 30 then raise exception 'my_balance gave %', b; end if;
  if other <> 0 then raise exception 'member could see other ledgers'; end if;

  raise exception 'ALL CHECKS PASSED (everything rolled back)';
end $$;
