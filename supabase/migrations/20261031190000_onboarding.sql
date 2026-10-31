-- New members confirm their name and username once, on a welcome step, before the
-- dashboard. Quick sign-ins (GitHub, Discord, Google) prefill both from the provider.
alter table public.profiles add column onboarded boolean not null default false;

-- everyone who already set up a profile by hand counts as done; the account made by
-- a Discord sign-in this morning has not seen the welcome step yet
update public.profiles p set onboarded = true
where not exists (select 1 from auth.identities i where i.user_id = p.id and i.provider <> 'email');

grant update (onboarded) on public.profiles to authenticated;
