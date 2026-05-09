-- ============================================================================
-- Postplan — Scheduler cron job
-- Migration: 002_scheduler_cron.sql
-- Description: Sets up pg_cron + pg_net to call the publish-scheduled-posts
--              Edge Function once per minute. Idempotent: safe to re-run.
-- ============================================================================

-- pg_cron is in the `extensions` schema on Supabase. Enable it.
create extension if not exists pg_cron with schema extensions;

-- pg_net is needed for HTTP requests from inside Postgres.
create extension if not exists pg_net with schema extensions;

-- ----------------------------------------------------------------------------
-- Helper to (re)create the publish-scheduled-posts cron job.
-- It calls our Edge Function via HTTP every minute.
--
-- Required: set the following Postgres GUCs in Supabase Dashboard ->
--   Settings -> Database -> Custom Postgres Config:
--     app.supabase_url        = 'https://YOUR_PROJECT.supabase.co'
--     app.supabase_service_key = 'YOUR_SERVICE_ROLE_KEY'
--
-- (Or set them ad-hoc with `alter database postgres set app.supabase_url = '...';`)
-- ----------------------------------------------------------------------------

-- Drop any previous schedule of the same name, so we can re-run this migration.
do $$
declare
  jid bigint;
begin
  select jobid into jid
  from cron.job
  where jobname = 'postplan_publish_scheduled_posts';
  if jid is not null then
    perform cron.unschedule(jid);
  end if;
end $$;

-- Schedule: every minute.
-- The cron job calls our Edge Function with a service-role bearer token.
-- We use current_setting() to read GUCs; if either is unset, the call will
-- fail loudly in the cron.job_run_details table (this is intentional —
-- a misconfigured worker should be obvious).
select cron.schedule(
  'postplan_publish_scheduled_posts',
  '* * * * *',
  $$
  select net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/publish-scheduled-posts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_service_key')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);

-- ----------------------------------------------------------------------------
-- Sanity check view — see the last 20 cron runs and whether they succeeded.
-- Query in SQL editor: select * from public.scheduler_recent_runs;
-- ----------------------------------------------------------------------------
create or replace view public.scheduler_recent_runs as
select
  jrd.runid,
  jrd.jobid,
  j.jobname,
  jrd.start_time,
  jrd.end_time,
  jrd.status,
  jrd.return_message
from cron.job_run_details jrd
join cron.job j on j.jobid = jrd.jobid
where j.jobname = 'postplan_publish_scheduled_posts'
order by jrd.start_time desc
limit 20;
