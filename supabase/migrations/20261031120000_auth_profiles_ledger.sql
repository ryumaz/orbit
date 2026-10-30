-- orbit: accounts, profiles and the credit ledger.
-- Every signup gets a profile and 30 welcome credits, once.
-- The balance is never stored: it is the sum of a member's ledger rows.
-- Clients can read, but never write, the ledger; only server functions add rows.

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 40),
  bio         text not null default '' check (char_length(bio) <= 160),
  langs       text[] not null default '{}',
  created_at  timestamptz not null default now()
);

create table public.ledger (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  amount      integer not null check (amount <> 0),
  type        text not null check (type in ('welcome', 'hold', 'earn', 'refund')),
  note        text not null default '',
  session_id  bigint,
  created_at  timestamptz not null default now()
);
create index ledger_user_idx on public.ledger (user_id, created_at);
-- welcome credits can only ever be given once per member
create unique index ledger_one_welcome on public.ledger (user_id) where type = 'welcome';

alter table public.profiles enable row level security;
alter table public.ledger enable row level security;

-- anyone signed in can see who teaches what; you can only edit yourself
create policy "profiles are visible to members" on public.profiles
  for select to authenticated using (true);
create policy "members edit their own profile" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "members read their own ledger" on public.ledger
  for select to authenticated using (user_id = auth.uid());

revoke all on public.profiles from anon;
revoke insert, delete on public.profiles from authenticated;
revoke update on public.profiles from authenticated;
grant update (name, bio, langs) on public.profiles to authenticated;
revoke all on public.ledger from anon;
revoke insert, update, delete on public.ledger from authenticated;

-- new auth user -> profile + welcome credits
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  display_name text := nullif(trim(new.raw_user_meta_data ->> 'name'), '');
begin
  insert into public.profiles (id, name)
  values (new.id, left(coalesce(display_name, split_part(new.email, '@', 1)), 40));
  insert into public.ledger (user_id, amount, type, note)
  values (new.id, 30, 'welcome', 'welcome credits');
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- the signed-in member's balance, summed from the ledger
create function public.my_balance() returns integer
language sql stable security invoker set search_path = '' as $$
  select coalesce(sum(amount), 0)::integer from public.ledger where user_id = auth.uid();
$$;
revoke execute on function public.my_balance() from public, anon;
grant execute on function public.my_balance() to authenticated;
revoke execute on function public.handle_new_user() from anon, authenticated, public;
