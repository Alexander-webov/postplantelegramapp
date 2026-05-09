-- ============================================================================
-- Postplan — Advertisers CRM (Part A: enum)
-- Migration: 008a_placement_status_enum.sql
-- ============================================================================
-- Postgres won't allow newly added enum values to be used in the same
-- transaction. Split as 008a (enum) + 008b (tables), run both as separate
-- queries in Supabase SQL Editor.
--
-- Idempotent.
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'placement_status') then
    create type placement_status as enum (
      'draft',
      'awaiting_payment',
      'paid',
      'published',
      'reported',
      'cancelled'
    );
  end if;
end $$;

alter type placement_status add value if not exists 'draft';
alter type placement_status add value if not exists 'awaiting_payment';
alter type placement_status add value if not exists 'paid';
alter type placement_status add value if not exists 'published';
alter type placement_status add value if not exists 'reported';
alter type placement_status add value if not exists 'cancelled';
