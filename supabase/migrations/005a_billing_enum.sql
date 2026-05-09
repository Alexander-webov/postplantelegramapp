-- ============================================================================
-- Postplan — Billing migration (Part A: enum)
-- Migration: 005a_billing_enum.sql
-- ============================================================================
-- Postgres won't allow newly added enum values to be used in the same
-- transaction. So we split the billing migration in two:
--   1. RUN THIS FILE FIRST.  Adds the payment_status enum + missing values.
--   2. Then run 005b_billing_tables.sql in a SEPARATE query.
--
-- This file is idempotent — safe to run as many times as you like.
-- ============================================================================

-- Create the type if it doesn't exist
do $$
begin
  if not exists (select 1 from pg_type where typname = 'payment_status') then
    create type payment_status as enum (
      'pending',
      'waiting_for_capture',
      'succeeded',
      'canceled',
      'refunded'
    );
  end if;
end $$;

-- Ensure each value exists individually (in case the enum was created earlier
-- with a different set of values). ADD VALUE IF NOT EXISTS is idempotent.
alter type payment_status add value if not exists 'pending';
alter type payment_status add value if not exists 'waiting_for_capture';
alter type payment_status add value if not exists 'succeeded';
alter type payment_status add value if not exists 'canceled';
alter type payment_status add value if not exists 'refunded';
