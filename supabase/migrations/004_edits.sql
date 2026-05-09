-- ============================================================================
-- Postplan — Edits and history cleanup
-- Migration: 004_edits.sql
-- Description:
--   - Adds last_edited_at to scheduled_posts (for showing "edited" badge)
--   - Index for filtering history items
-- ============================================================================

alter table scheduled_posts
  add column if not exists last_edited_at timestamptz;

create index if not exists idx_scheduled_posts_history
  on scheduled_posts(user_id, status)
  where status in ('sent', 'failed', 'cancelled');
