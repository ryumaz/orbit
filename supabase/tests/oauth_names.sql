-- New members from Discord, GitHub, Google and email get a sensible name, handle and
-- welcome credits. Ends with RAISE so nothing is kept.
-- Expected: Ryuma @ryumaz | Plain Email @plainemail | octo-cat @octocat | Asha Verma @ashaverma, 30 credits each.
do $t$
declare a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid(); d uuid := gen_random_uuid(); out text;
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data) values
    (a, 'zz-discord-test@example.invalid', 'authenticated', 'authenticated', '{"name":"ryumaz#0","full_name":"ryumaz","user_name":"ryumaz","custom_claims":{"global_name":"Ryuma"}}'),
    (b, 'zz-github-test@example.invalid', 'authenticated', 'authenticated', '{"user_name":"octo-cat","name":"","full_name":""}'),
    (c, 'zz-google-test@example.invalid', 'authenticated', 'authenticated', '{"name":"Asha Verma","full_name":"Asha Verma","picture":"https://x/y.png"}'),
    (d, 'zz-email-test@example.invalid', 'authenticated', 'authenticated', '{"name":"Plain Email"}');
  select string_agg(p.name || ' @' || p.handle || ' credits=' || (select sum(amount) from public.ledger l where l.user_id = p.id), ' | ' order by u.email)
    into out from public.profiles p join auth.users u on u.id = p.id where p.id in (a, b, c, d);
  raise exception 'ROLLED BACK OK: %', out;
end $t$;
