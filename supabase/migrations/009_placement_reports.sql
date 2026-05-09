-- ============================================================================
-- Postplan — Ad placement reports (Revenue OS Phase 2 Batch 3)
-- Migration: 009_placement_reports.sql
-- ============================================================================
-- Adds a public-shareable slug to each ad_placement so advertisers can view
-- a branded report at /r/<slug> without an account. The slug is set on first
-- access (lazy generation) — we don't want every placement to immediately
-- have a public URL.
--
-- Idempotent.
-- ============================================================================

-- 1. Add report fields to ad_placements
alter table ad_placements
  -- Random URL-safe slug. NULL until user clicks "Generate report link".
  -- ~12 chars of base32 = 60 bits of entropy, sufficient against guessing
  add column if not exists report_slug text unique,
  -- When the slug was generated (= when report became public)
  add column if not exists report_generated_at timestamptz,
  -- When the report URL was actually visited (any time someone opens it)
  add column if not exists report_first_viewed_at timestamptz,
  add column if not exists report_last_viewed_at timestamptz,
  -- How many times the report URL was opened (rough engagement metric)
  add column if not exists report_view_count integer not null default 0;

-- 2. Index for fast slug → placement lookup on the public route
create index if not exists idx_placements_slug
  on ad_placements(report_slug)
  where report_slug is not null;

-- 3. Function to generate URL-safe slugs.
-- Postgres has gen_random_uuid() — we base64-encode + strip padding/symbols.
-- Why our own function: we want short readable slugs, not a UUID in URL.
create or replace function generate_placement_slug()
returns text as $$
declare
  candidate text;
  attempts integer := 0;
begin
  loop
    -- 9 random bytes = 12 base64 chars after stripping
    candidate := translate(
      encode(gen_random_bytes(9), 'base64'),
      '+/=', 'xyz'
    );
    candidate := substring(candidate from 1 for 12);

    -- Vanishingly unlikely to collide, but check anyway
    if not exists (select 1 from ad_placements where report_slug = candidate) then
      return candidate;
    end if;

    attempts := attempts + 1;
    if attempts > 5 then
      raise exception 'Could not generate unique slug after 5 attempts';
    end if;
  end loop;
end;
$$ language plpgsql;
