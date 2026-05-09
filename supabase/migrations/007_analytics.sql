-- ============================================================================
-- Postplan — Analytics (views) for Revenue OS
-- Migration: 007_analytics.sql
-- ============================================================================
-- Adds view-count tracking for sent posts. Views are snapshotted at
-- 1h / 6h / 24h / 48h after publication via a separate Edge Function that
-- runs every minute (alongside the publish + delete workers).
--
-- We use Telegram's Bot API editMessageReplyMarkup trick — sending the
-- existing markup back to Telegram returns the updated Message including
-- the channel-post `views` field. Undocumented but stable in production.
--
-- Idempotent: safe to re-run.
-- ============================================================================

-- 1. Snapshot fields on scheduled_posts
alter table scheduled_posts
  -- Latest known view count (refreshed at every snapshot time + on demand)
  add column if not exists views_latest integer,
  -- Time when views_latest was last fetched (so UI can show "5 minutes ago")
  add column if not exists views_latest_at timestamptz,
  -- Snapshots at fixed intervals after publication.
  -- These are write-once — once filled they never change. Used for advertiser
  -- reports: "1247 views in 24h" is a contract-relevant number.
  add column if not exists views_1h integer,
  add column if not exists views_6h integer,
  add column if not exists views_24h integer,
  add column if not exists views_48h integer,
  -- If a snapshot fails (bot kicked, channel deleted, message deleted),
  -- record the last error so we can show it to the user.
  add column if not exists views_error text;

-- 2. Index for the analytics worker — only scan rows that still need a snapshot
-- A row needs scanning if:
--   - status = 'sent' and not auto-deleted yet
--   - At least ONE of views_1h..views_48h is null
--   - sent_at is set (always true if status=sent, but guard anyway)
create index if not exists idx_scheduled_posts_views_due
  on scheduled_posts(sent_at)
  where status = 'sent'
    and sent_at is not null
    and (views_1h is null or views_6h is null or views_24h is null or views_48h is null);
