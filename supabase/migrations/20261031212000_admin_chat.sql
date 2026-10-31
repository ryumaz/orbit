-- Admins read a disputed session's chat (with who said what) to settle it fairly.
create function public.admin_session_messages(sid bigint)
returns table (id bigint, sender text, sender_handle text, body text, file_path text, file_name text, file_type text, file_size integer, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select m.id, p.name, p.handle, m.body, m.file_path, m.file_name, m.file_type, m.file_size, m.created_at
  from public.messages m join public.profiles p on p.id = m.sender_id
  where public.is_admin() and m.session_id = sid
  order by m.id
  limit 1000;
$$;
revoke execute on function public.admin_session_messages(bigint) from public, anon;
grant execute on function public.admin_session_messages(bigint) to authenticated;
