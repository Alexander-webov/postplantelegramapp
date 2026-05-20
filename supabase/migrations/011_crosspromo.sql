-- ============================================================================
-- Postplan — Crosspromo (взаимопиар) engine
-- Migration: 011_crosspromo.sql
-- Description: listings, deals, reputation + RLS + indexes + triggers
--
-- This is the growth engine: channels list themselves, get matched with
-- similar-sized channels in the same topic, exchange promo posts via the
-- EXISTING scheduler (scheduled_posts), and a verifier worker confirms both
-- sides actually published and held the post — building a public reputation
-- and "Verified" badge on real, un-fakeable reach data.
--
-- Idempotent: safe to run more than once.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Enums (guarded so re-running doesn't error)
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'cp_topic') then
    create type cp_topic as enum (
      'business','crypto','tech','news','entertainment','lifestyle',
      'education','health','sports','gaming','beauty','travel',
      'finance','marketing','design','memes','music','food','other'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'cp_listing_status') then
    create type cp_listing_status as enum ('active','paused');
  end if;

  if not exists (select 1 from pg_type where typname = 'cp_deal_status') then
    create type cp_deal_status as enum (
      'proposed',   -- initiator proposed, waiting for partner's answer
      'accepted',   -- both agreed, posts being scheduled
      'scheduled',  -- two scheduled_posts created, waiting for publish time
      'live',       -- both published, hold window in progress
      'completed',  -- success: both published and held the agreed time
      'failed',     -- a side broke the deal (deleted early / never published)
      'cancelled',  -- cancelled before publishing
      'declined'    -- partner rejected the proposal
    );
  end if;
end $$;

-- ============================================================================
-- 1. cp_listings — a channel offered into the crosspromo exchange
-- ============================================================================
create table if not exists cp_listings (
  id uuid primary key default uuid_generate_v4(),
  channel_id uuid not null references channels(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  topic cp_topic not null,
  -- snapshot metrics captured at listing/refresh time
  avg_reach integer not null default 0,
  subscriber_count integer not null default 0,
  -- how many crosspromo deals per week this channel is willing to do
  weekly_slots integer not null default 3,
  -- minimum partner reach as a percentage of own reach (avoid promoting tiny channels)
  min_partner_reach_pct integer not null default 50,
  description text,
  status cp_listing_status not null default 'active',
  last_refreshed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (channel_id)
);

drop trigger if exists trg_cp_listings_updated_at on cp_listings;
create trigger trg_cp_listings_updated_at
  before update on cp_listings
  for each row execute function set_updated_at();

create index if not exists idx_cp_listings_match
  on cp_listings(topic, status, avg_reach)
  where status = 'active';
create index if not exists idx_cp_listings_user on cp_listings(user_id);

alter table cp_listings enable row level security;

-- Owner: full control
drop policy if exists "Users manage own listings" on cp_listings;
create policy "Users manage own listings" on cp_listings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Everyone: can SEE active listings (needed for matching).
-- RLS can't hide individual columns, but listings contain no secrets —
-- only public channel metrics. The owner's user_id is exposed but that's
-- an opaque uuid, not PII.
drop policy if exists "Anyone views active listings" on cp_listings;
create policy "Anyone views active listings" on cp_listings
  for select using (status = 'active');

-- ============================================================================
-- 2. cp_deals — a crosspromo agreement between two channels
-- ============================================================================
create table if not exists cp_deals (
  id uuid primary key default uuid_generate_v4(),
  status cp_deal_status not null default 'proposed',

  -- initiator side
  initiator_listing_id uuid not null references cp_listings(id) on delete cascade,
  initiator_channel_id uuid not null references channels(id) on delete cascade,
  initiator_user_id uuid not null references profiles(id) on delete cascade,

  -- partner side
  partner_listing_id uuid not null references cp_listings(id) on delete cascade,
  partner_channel_id uuid not null references channels(id) on delete cascade,
  partner_user_id uuid not null references profiles(id) on delete cascade,

  -- agreed terms
  agreed_at timestamptz,
  publish_at timestamptz,                       -- both publish at this moment
  min_hold_hours integer not null default 24,   -- post must stay up this long

  -- promo message bodies (what each side will publish about the OTHER channel)
  -- initiator publishes promo_for_partner in their own channel, and vice-versa
  promo_text_for_partner text,                  -- text initiator posts (promotes partner)
  promo_text_for_initiator text,                -- text partner posts (promotes initiator)

  -- links to the actual publications created in scheduled_posts
  initiator_scheduled_post_id uuid references scheduled_posts(id) on delete set null,
  partner_scheduled_post_id uuid references scheduled_posts(id) on delete set null,

  -- verification results (filled by cp-verify worker)
  initiator_delivered boolean,
  partner_delivered boolean,
  initiator_reach integer,
  partner_reach integer,
  initiator_held_full boolean,
  partner_held_full boolean,
  verified_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- a channel can't have a deal with itself
  constraint cp_deals_distinct_channels check (initiator_channel_id <> partner_channel_id)
);

drop trigger if exists trg_cp_deals_updated_at on cp_deals;
create trigger trg_cp_deals_updated_at
  before update on cp_deals
  for each row execute function set_updated_at();

create index if not exists idx_cp_deals_initiator on cp_deals(initiator_user_id, status);
create index if not exists idx_cp_deals_partner   on cp_deals(partner_user_id, status);
create index if not exists idx_cp_deals_live
  on cp_deals(status, publish_at)
  where status in ('scheduled','live');

alter table cp_deals enable row level security;

-- Both participants can view their deals
drop policy if exists "Participants view their deals" on cp_deals;
create policy "Participants view their deals" on cp_deals
  for select using (auth.uid() = initiator_user_id or auth.uid() = partner_user_id);

-- Initiator can create a proposal (must be the initiator)
drop policy if exists "Initiator creates deal" on cp_deals;
create policy "Initiator creates deal" on cp_deals
  for insert with check (auth.uid() = initiator_user_id);

-- Both participants can update (accept/decline/cancel)
drop policy if exists "Participants update their deals" on cp_deals;
create policy "Participants update their deals" on cp_deals
  for update using (auth.uid() = initiator_user_id or auth.uid() = partner_user_id);

-- ============================================================================
-- 3. cp_reputation — per-channel crosspromo trust record (public)
-- ============================================================================
create table if not exists cp_reputation (
  channel_id uuid primary key references channels(id) on delete cascade,
  deals_total integer not null default 0,
  deals_completed integer not null default 0,
  deals_failed integer not null default 0,
  -- average honesty of reach: crosspromo-post reach / channel avg reach
  avg_reach_ratio numeric(4,2),
  is_verified boolean not null default false,
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_cp_reputation_updated_at on cp_reputation;
create trigger trg_cp_reputation_updated_at
  before update on cp_reputation
  for each row execute function set_updated_at();

alter table cp_reputation enable row level security;

-- Reputation is PUBLIC — that's the entire point of a trust badge.
drop policy if exists "Anyone views reputation" on cp_reputation;
create policy "Anyone views reputation" on cp_reputation
  for select using (true);

-- Only the service role (workers) writes reputation. No user-facing policy for
-- insert/update means regular clients can't tamper with their own score.

-- ============================================================================
-- 4. RPC: recompute a channel's reputation from its completed/failed deals.
-- Called by the cp-verify worker (service role) after each verification.
-- SECURITY DEFINER so it can upsert into cp_reputation regardless of RLS.
-- ============================================================================
create or replace function cp_recompute_reputation(p_channel_id uuid)
returns void as $$
declare
  v_total     integer;
  v_completed integer;
  v_failed    integer;
  v_ratio     numeric(4,2);
begin
  -- Count deals where this channel participated, by terminal status
  select
    count(*) filter (where status in ('completed','failed')),
    count(*) filter (where status = 'completed'),
    count(*) filter (where status = 'failed')
  into v_total, v_completed, v_failed
  from cp_deals
  where initiator_channel_id = p_channel_id
     or partner_channel_id = p_channel_id;

  -- Average reach ratio across this channel's completed deals
  select avg(
    case
      when initiator_channel_id = p_channel_id and l.avg_reach > 0
        then initiator_reach::numeric / l.avg_reach
      when partner_channel_id = p_channel_id and l.avg_reach > 0
        then partner_reach::numeric / l.avg_reach
      else null
    end
  )
  into v_ratio
  from cp_deals d
  join cp_listings l on l.channel_id = p_channel_id
  where d.status = 'completed'
    and (d.initiator_channel_id = p_channel_id or d.partner_channel_id = p_channel_id);

  insert into cp_reputation as r (channel_id, deals_total, deals_completed, deals_failed, avg_reach_ratio, is_verified)
  values (
    p_channel_id,
    coalesce(v_total, 0),
    coalesce(v_completed, 0),
    coalesce(v_failed, 0),
    v_ratio,
    coalesce(v_completed, 0) >= 5 and coalesce(v_failed, 0) = 0
  )
  on conflict (channel_id) do update set
    deals_total     = excluded.deals_total,
    deals_completed = excluded.deals_completed,
    deals_failed    = excluded.deals_failed,
    avg_reach_ratio = excluded.avg_reach_ratio,
    is_verified     = excluded.is_verified,
    updated_at      = now();
end;
$$ language plpgsql security definer set search_path = public;

-- ============================================================================
-- 5. Helper view: count a user's crosspromo deals in the current ISO week.
-- Used for tier-limit enforcement (maxCrosspromoSlotsPerWeek).
-- A "consumed" slot = any deal not declined/cancelled this week.
-- ============================================================================
create or replace view cp_weekly_usage as
select
  user_id,
  count(*) as deals_this_week
from (
  select initiator_user_id as user_id, created_at, status from cp_deals
  union all
  select partner_user_id as user_id, created_at, status from cp_deals
) all_sides
where created_at >= date_trunc('week', now())
  and status not in ('declined','cancelled')
group by user_id;
