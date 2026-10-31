-- Rate limits, enforced by the database so no client can skip them.
-- (Reports, support messages and dispute replies already have their own limits.)

-- class requests: 8 an hour per learner, and at most 5 waiting for an answer at once
create function public.limit_requests() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.sessions where learner_id = new.learner_id and created_at > now() - interval '1 hour') >= 8 then
    raise exception 'That''s a lot of requests for one hour. Wait a little before asking again.';
  end if;
  if (select count(*) from public.sessions where learner_id = new.learner_id and status = 'requested') >= 5 then
    raise exception 'You already have 5 requests waiting. Wait for answers, or withdraw one first.';
  end if;
  return new;
end $$;
create trigger sessions_rate_limit before insert on public.sessions
  for each row execute function public.limit_requests();

-- class chat: 20 messages a minute per person, and 15 files an hour
create index if not exists messages_sender_idx on public.messages (sender_id, created_at);
create function public.limit_messages() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.messages where sender_id = new.sender_id and created_at > now() - interval '1 minute') >= 20 then
    raise exception 'You''re sending messages too fast. Wait a few seconds.';
  end if;
  if new.file_path is not null
     and (select count(*) from public.messages where sender_id = new.sender_id and file_path is not null and created_at > now() - interval '1 hour') >= 15 then
    raise exception 'That''s a lot of files for one hour. Try again a bit later.';
  end if;
  return new;
end $$;
create trigger messages_rate_limit before insert on public.messages
  for each row execute function public.limit_messages();
