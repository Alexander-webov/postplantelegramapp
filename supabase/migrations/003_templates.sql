-- ============================================================================
-- Postplan — Templates upgrade
-- Migration: 003_templates.sql
-- Description:
--   - Adds 'kind' to templates so we can distinguish signature / full template / hashtag set
--   - Adds applied_signature_id on posts so the publish worker knows which signature to append
-- ============================================================================

-- 1. New enum for template categorization
do $$
begin
  if not exists (select 1 from pg_type where typname = 'template_kind') then
    create type template_kind as enum ('signature', 'post', 'hashtags');
  end if;
end $$;

-- 2. Add 'kind' column to templates with default 'post' for backward compat
alter table templates
  add column if not exists kind template_kind not null default 'post';

-- 3. Posts table: track which signature was applied (nullable; null = no signature)
alter table posts
  add column if not exists applied_signature_id uuid references templates(id) on delete set null;

-- The existing `is_signature` boolean was a hack from the original schema — keep it for now,
-- but new code uses `kind = 'signature'`. We auto-migrate any existing rows.
update templates set kind = 'signature' where is_signature = true and kind = 'post';

-- 4. Helpful index for looking up active signature by user
create index if not exists idx_templates_user_kind
  on templates(user_id, kind);
