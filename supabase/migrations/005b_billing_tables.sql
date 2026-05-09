-- ============================================================================
-- Postplan — Billing migration (Part B: tables, indexes, policies)
-- Migration: 005b_billing_tables.sql
-- ============================================================================
-- ⚠ Run AFTER 005a_billing_enum.sql has been committed (separate query).
-- This file is idempotent — safe to re-run.
-- ============================================================================

-- 1. Payments table
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- YooKassa identifiers
  yookassa_payment_id text unique,
  idempotence_key uuid not null default gen_random_uuid(),

  -- Plan being purchased
  tier subscription_tier not null,
  period_days integer not null default 30,

  -- Money
  amount_rub numeric(10, 2) not null,
  currency text not null default 'RUB',

  -- Status
  status payment_status not null default 'pending',

  -- YooKassa metadata
  confirmation_url text,
  payment_method_type text,
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
create index if not exists idx_payments_status on payments(status) where status in ('pending', 'waiting_for_capture');
create index if not exists idx_payments_yookassa_id on payments(yookassa_payment_id);

-- 2. Auto-update updated_at trigger
drop trigger if exists payments_updated_at on payments;
create trigger payments_updated_at
  before update on payments
  for each row execute procedure set_updated_at();

-- 3. RLS — users see their own payments only
alter table payments enable row level security;

drop policy if exists "Users see own payments" on payments;
create policy "Users see own payments"
  on payments for select
  to authenticated
  using (auth.uid() = user_id);

-- INSERT/UPDATE happen via service-role (server actions and webhook),
-- so no policy for them — RLS-bypass via service_role key.

-- 4. profiles: add YooKassa customer id (for future recurring auto-charges)
alter table profiles
  add column if not exists yookassa_customer_id text;
