-- ============================================================================
-- Postplan — Auto-delete posts (Revenue OS feature #1)
-- Migration: 006_auto_delete.sql
-- ============================================================================
-- Adds the ability to schedule a post and have it auto-deleted from Telegram
-- after N hours. Useful for promo posts that should disappear after the
-- advertiser's contracted display window expires.
--
-- Idempotent: safe to re-run.
-- ============================================================================

-- 1. Auto-delete config and tracking on scheduled_posts
alter table scheduled_posts
  -- How many hours after sending should the post be auto-deleted? null = never.
  add column if not exists auto_delete_after_hours integer,
  -- Computed at send-time: sent_at + auto_delete_after_hours. The Edge
  -- Function picks rows where this is in the past and not yet deleted.
  add column if not exists auto_delete_at timestamptz,
  -- When the actual deletion happened (success). null while pending.
  add column if not exists auto_deleted_at timestamptz,
  -- If deletion failed (bot removed, message too old, etc.) — store reason.
  add column if not exists auto_delete_error text;

-- 2. Album support — store ALL Telegram message ids, not just the first.
-- Existing rows have telegram_message_id (singular) — we keep that for
-- backwards compatibility but ALSO add an array for albums (media groups).
alter table scheduled_posts
  add column if not exists telegram_message_ids bigint[];

-- Backfill existing rows: if telegram_message_id is set but the array is null,
-- copy the single id into the array so the new code path works for old data.
update scheduled_posts
set telegram_message_ids = array[telegram_message_id]
where telegram_message_id is not null
  and telegram_message_ids is null;

-- 3. Index for the auto-delete worker — only scan rows that need to be checked
create index if not exists idx_scheduled_posts_auto_delete_due
  on scheduled_posts(auto_delete_at)
  where auto_delete_at is not null
    and auto_deleted_at is null
    and auto_delete_error is null
    and status = 'sent';

-- 4. Sanity constraint — auto_delete_after_hours must be positive
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'auto_delete_hours_positive'
  ) then
    alter table scheduled_posts
      add constraint auto_delete_hours_positive
      check (auto_delete_after_hours is null or auto_delete_after_hours > 0);
  end if;
end $$;
