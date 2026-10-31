-- Discord alerts ping the admin role for disputes and reports (support messages arrive without a ping).
create or replace function public.notify_admins(title text, body text, link text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  hook text;
  role_id constant text := '1566101170005737493';
  ping boolean := title like 'Dispute%' or title like 'New report%';
begin
  select value into hook from public.admin_settings where key = 'discord_webhook';
  if hook is null then return; end if;
  perform net.http_post(
    url := hook,
    body := jsonb_build_object(
      'username', 'orbit control',
      'content', case when ping then '<@&' || role_id || '>' else '' end,
      'allowed_mentions', jsonb_build_object('roles', case when ping then jsonb_build_array(role_id) else '[]'::jsonb end),
      'embeds', jsonb_build_array(jsonb_build_object(
        'title', left(title, 250), 'description', left(coalesce(body, ''), 1500), 'url', link, 'color', 5195493,
        'timestamp', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')))),
    headers := '{"Content-Type": "application/json"}'::jsonb);
exception when others then
  null;
end $$;
