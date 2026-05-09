-- ============================================================================
-- Postplan — Advertisers CRM (Part B: tables, indexes, triggers, RLS)
-- Migration: 008b_advertisers_tables.sql
-- ============================================================================
-- ⚠ Run AFTER 008a_placement_status_enum.sql is committed.
-- Idempotent.
-- ============================================================================

-- 1. Advertisers — the "rolodex"
create table if not exists advertisers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  name text not null,                              -- "Ozon", "Иван Петров"
  telegram_username text,                          -- without @
  contact text,                                    -- free-text contact

  notes text,

  -- Cached aggregates (refreshed by trigger on ad_placements changes)
  total_placements integer not null default 0,
  total_revenue_rub numeric(12, 2) not null default 0,

  archived_at timestamptz,                         -- soft-delete

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_advertisers_user
  on advertisers(user_id, created_at desc)
  where archived_at is null;

create index if not exists idx_advertisers_user_name
  on advertisers(user_id, lower(name))
  where archived_at is null;

-- 2. Ad placements — deal record per scheduled_post
create table if not exists ad_placements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  advertiser_id uuid not null references advertisers(id) on delete cascade,
  scheduled_post_id uuid not null references scheduled_posts(id) on delete cascade,

  price_rub numeric(10, 2) not null default 0,
  format text,                                     -- "1/24", "2/48", etc.
  status placement_status not null default 'draft',

  notes text,
  paid_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(scheduled_post_id)
);

create index if not exists idx_placements_user_created
  on ad_placements(user_id, created_at desc);
create index if not exists idx_placements_advertiser
  on ad_placements(advertiser_id, created_at desc);
create index if not exists idx_placements_status
  on ad_placements(user_id, status)
  where status in ('awaiting_payment', 'paid');

-- 3. updated_at triggers using existing set_updated_at()
drop trigger if exists advertisers_updated_at on advertisers;
create trigger advertisers_updated_at
  before update on advertisers
  for each row execute procedure set_updated_at();

drop trigger if exists placements_updated_at on ad_placements;
create trigger placements_updated_at
  before update on ad_placements
  for each row execute procedure set_updated_at();

-- 4. Aggregate refresh trigger
create or replace function refresh_advertiser_totals()
returns trigger as $$
declare
  target_advertiser uuid;
begin
  if (tg_op = 'DELETE') then
    target_advertiser := old.advertiser_id;
  else
    target_advertiser := new.advertiser_id;
  end if;

  update advertisers a
  set
    total_placements = (
      select count(*) from ad_placements
      where advertiser_id = target_advertiser
    ),
    total_revenue_rub = coalesce((
      select sum(price_rub) from ad_placements
      where advertiser_id = target_advertiser
        and status in ('paid', 'published', 'reported')
    ), 0)
  where a.id = target_advertiser;

  -- If advertiser_id changed via UPDATE, refresh OLD advertiser too
  if (tg_op = 'UPDATE' and old.advertiser_id is distinct from new.advertiser_id) then
    update advertisers a
    set
      total_placements = (
        select count(*) from ad_placements
        where advertiser_id = old.advertiser_id
      ),
      total_revenue_rub = coalesce((
        select sum(price_rub) from ad_placements
        where advertiser_id = old.advertiser_id
          and status in ('paid', 'published', 'reported')
      ), 0)
    where a.id = old.advertiser_id;
  end if;

  return null;
end;
$$ language plpgsql security definer;

drop trigger if exists placements_refresh_totals on ad_placements;
create trigger placements_refresh_totals
  after insert or update or delete on ad_placements
  for each row execute procedure refresh_advertiser_totals();

-- 5. RLS
alter table advertisers enable row level security;
alter table ad_placements enable row level security;

drop policy if exists "Users CRUD own advertisers" on advertisers;
create policy "Users CRUD own advertisers"
  on advertisers for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users CRUD own placements" on ad_placements;
create policy "Users CRUD own placements"
  on ad_placements for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
