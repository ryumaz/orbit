-- run expiry and auto-release (public.sweep_due) every 5 minutes
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
select cron.schedule('orbit-sweep', '*/5 * * * *', 'select public.sweep_due()');
