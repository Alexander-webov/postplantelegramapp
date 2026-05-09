-- ============================================================================
-- Postplan — Payments and billing
-- Migration: 005_billing.sql
-- Description:
--   - payments table: full history of all payment attempts (success + fail)
--   - profiles: add yookassa_customer_id for future recurring payments
--   - RLS: users see their own payments, system can insert from webhooks
--
-- Idempotent: safe to run multiple times. Uses ADD VALUE IF NOT EXISTS so
-- the enum can be extended even if it was created earlier with fewer values.
-- ============================================================================

-- 1. Payment status enum
-- Create the type if it doesn't exist with the FULL value set...
do $$
begin
  if not exists (select 1 from pg_type where typname = 'payment_status') then
    create type payment_status as enum (
      'pending',     -- created in YooKassa, waiting for user to pay
      'waiting_for_capture', -- user paid, awaiting our capture call (we auto-capture)
      'succeeded',   -- payment completed successfully
      'canceled',    -- user cancelled or YooKassa rejected
      'refunded'     -- we refunded (manual via YooKassa dashboard for now)
    );
  end if;
end $$;

-- ...and ALSO ensure each value exists individually (handles the case where
-- the enum already existed with fewer values from a previous run).
-- ALTER TYPE ... ADD VALUE IF NOT EXISTS requires Postgres 9.6+ and cannot
-- run inside a transaction block alongside other ALTER TYPE on the same type
-- in older versions, so we run them as separate statements.
alter type payment_status add value if not exists 'pending';
alter type payment_status add value if not exists 'waiting_for_capture';
alter type payment_status add value if not exists 'succeeded';
alter type payment_status add value if not exists 'canceled';
alter type payment_status add value if not exists 'refunded';

-- 2. Payments table
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- YooKassa identifiers
  yookassa_payment_id text unique,    -- payment id from YooKassa
  idempotence_key uuid not null default gen_random_uuid(), -- our key sent on creation

  -- Plan being purchased
  tier subscription_tier not null,
  -- Period in days (typically 30 for monthly)
  period_days integer not null default 30,

  -- Money
  amount_rub numeric(10, 2) not null,
  currency text not null default 'RUB',

  -- Status
  status payment_status not null default 'pending',

  -- YooKassa metadata (raw response copies for debugging)
  confirmation_url text,           -- where we redirect the user to pay
  payment_method_type text,        -- "bank_card", "yoo_money", "sbp", etc.
  paid boolean default false,
  cancellation_reason text,
  error_message text,

  -- Webhook tracking
  webhook_received_at timestamptz,

  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_payments_user_id on payments(user_id, created_at desc);
-- This index now safely references waiting_for_capture because we ensured the
-- enum value exists above.
create index if not exists idx_payments_status on payments(status) where status in ('pending', 'waiting_for_capture');
create index if not exists idx_payments_yookassa_id on payments(yookassa_payment_id);

-- 3. Auto-update updated_at
drop trigger if exists payments_updated_at on payments;
create trigger payments_updated_at
  before update on payments
  for each row execute procedure update_updated_at_column();

-- 4. RLS — users see their own payments only
alter table payments enable row level security;

drop policy if exists "Users see own payments" on payments;
create policy "Users see own payments"
  on payments for select
  to authenticated
  using (auth.uid() = user_id);

-- INSERT/UPDATE happen via service-role (server actions and webhook),
-- so no policy for them — RLS-bypass via service_role key.

-- 5. profiles: add YooKassa customer id (for future recurring auto-charges)
alter table profiles
  add column if not exists yookassa_customer_id text;
