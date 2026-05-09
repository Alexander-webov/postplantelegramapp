-- ============================================================================
-- Postplan — Initial Schema
-- Migration: 001_initial_schema.sql
-- Description: Core tables, RLS policies, indexes, triggers
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Extensions
-- ----------------------------------------------------------------------------
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
create type subscription_tier as enum ('free', 'start', 'pro', 'network');
create type subscription_status as enum ('active', 'cancelled', 'expired', 'trialing');
create type post_status as enum ('draft', 'scheduled', 'published', 'failed', 'archived');
create type schedule_status as enum ('pending', 'processing', 'sent', 'failed', 'cancelled');
create type media_type as enum ('photo', 'video', 'animation', 'document', 'audio');
create type tg_parse_mode as enum ('HTML', 'MarkdownV2', 'plain');
create type payment_provider as enum ('yookassa', 'stripe');
create type payment_status as enum ('pending', 'succeeded', 'failed', 'refunded');

-- ----------------------------------------------------------------------------
-- Helper trigger function: auto-update updated_at
-- ----------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ============================================================================
-- 1. profiles (mirrors auth.users)
-- ============================================================================
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  subscription_tier subscription_tier not null default 'free',
  subscription_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_profiles_updated_at
  before update on profiles
  for each row execute function set_updated_at();

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

alter table profiles enable row level security;

create policy "Users view own profile" on profiles
  for select using (auth.uid() = id);
create policy "Users update own profile" on profiles
  for update using (auth.uid() = id);

-- ============================================================================
-- 2. bots (Telegram bots — user provides via @BotFather)
-- ============================================================================
create table bots (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  -- token is encrypted application-side before insert; never store plaintext
  token_encrypted text not null,
  username text not null,
  first_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, username)
);

create trigger trg_bots_updated_at
  before update on bots
  for each row execute function set_updated_at();

create index idx_bots_user on bots(user_id);

alter table bots enable row level security;
create policy "Users manage own bots" on bots
  for all using (auth.uid() = user_id);

-- ============================================================================
-- 3. channels
-- ============================================================================
create table channels (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  bot_id uuid not null references bots(id) on delete cascade,
  -- Telegram chat IDs can exceed 32-bit; store as text for safety
  telegram_chat_id text not null,
  title text not null,
  username text,
  photo_url text,
  subscriber_count integer default 0,
  is_active boolean not null default true,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, telegram_chat_id)
);

create trigger trg_channels_updated_at
  before update on channels
  for each row execute function set_updated_at();

create index idx_channels_user on channels(user_id);
create index idx_channels_bot on channels(bot_id);

alter table channels enable row level security;
create policy "Users manage own channels" on channels
  for all using (auth.uid() = user_id);

-- ============================================================================
-- 4. templates
-- ============================================================================
create table templates (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  -- supports {{variables}} like {{channel_title}}, {{date}}, {{time}}
  content text not null default '',
  default_buttons jsonb not null default '[]'::jsonb,
  default_hashtags text[] not null default '{}',
  -- if true, auto-append to all posts when toggled in composer
  is_signature boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_templates_updated_at
  before update on templates
  for each row execute function set_updated_at();

create index idx_templates_user on templates(user_id);

alter table templates enable row level security;
create policy "Users manage own templates" on templates
  for all using (auth.uid() = user_id);

-- ============================================================================
-- 5. posts (the content unit, not yet bound to a channel/time)
-- ============================================================================
create table posts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  title text, -- internal label for the user's reference, optional
  content text not null default '',
  parse_mode tg_parse_mode not null default 'HTML',
  disable_preview boolean not null default false,
  silent boolean not null default false,
  status post_status not null default 'draft',
  template_id uuid references templates(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_posts_updated_at
  before update on posts
  for each row execute function set_updated_at();

create index idx_posts_user_status on posts(user_id, status);
create index idx_posts_user_updated on posts(user_id, updated_at desc);

alter table posts enable row level security;
create policy "Users manage own posts" on posts
  for all using (auth.uid() = user_id);

-- ============================================================================
-- 6. post_media (attached to posts; up to 10 per album)
-- ============================================================================
create table post_media (
  id uuid primary key default uuid_generate_v4(),
  post_id uuid not null references posts(id) on delete cascade,
  type media_type not null,
  storage_path text not null, -- path in supabase storage bucket 'post-media'
  storage_url text,           -- cached signed/public URL
  caption text,
  position integer not null default 0,
  width integer,
  height integer,
  duration_seconds integer,
  file_size_bytes bigint,
  created_at timestamptz not null default now()
);

create index idx_post_media_post on post_media(post_id, position);

alter table post_media enable row level security;
create policy "Users manage media of own posts" on post_media
  for all using (
    exists (select 1 from posts p where p.id = post_media.post_id and p.user_id = auth.uid())
  );

-- ============================================================================
-- 7. post_buttons (inline keyboard, URL-only buttons for Bot API in channels)
-- ============================================================================
create table post_buttons (
  id uuid primary key default uuid_generate_v4(),
  post_id uuid not null references posts(id) on delete cascade,
  row integer not null default 0,
  col integer not null default 0,
  text text not null,
  url text not null,
  created_at timestamptz not null default now()
);

create index idx_post_buttons_post on post_buttons(post_id, row, col);

alter table post_buttons enable row level security;
create policy "Users manage buttons of own posts" on post_buttons
  for all using (
    exists (select 1 from posts p where p.id = post_buttons.post_id and p.user_id = auth.uid())
  );

-- ============================================================================
-- 8. post_polls (one-to-zero-or-one with posts)
-- ============================================================================
create table post_polls (
  post_id uuid primary key references posts(id) on delete cascade,
  question text not null,
  options jsonb not null, -- array of strings: ["Yes", "No", "Maybe"]
  is_anonymous boolean not null default true,
  allows_multiple_answers boolean not null default false,
  is_quiz boolean not null default false,
  correct_option_id integer,
  created_at timestamptz not null default now()
);

alter table post_polls enable row level security;
create policy "Users manage polls of own posts" on post_polls
  for all using (
    exists (select 1 from posts p where p.id = post_polls.post_id and p.user_id = auth.uid())
  );

-- ============================================================================
-- 9. scheduled_posts — the publish queue (post × channel × time)
-- This is the heart of the scheduler. The worker polls this every minute.
-- ============================================================================
create table scheduled_posts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  post_id uuid not null references posts(id) on delete cascade,
  channel_id uuid not null references channels(id) on delete cascade,
  scheduled_at timestamptz not null,
  status schedule_status not null default 'pending',
  -- after successful send: store the resulting Telegram message id
  telegram_message_id bigint,
  error_message text,
  retry_count integer not null default 0,
  next_retry_at timestamptz,
  sent_at timestamptz,
  -- Per-channel customization (overrides post's defaults if present)
  custom_content text,
  custom_disable_preview boolean,
  custom_silent boolean,
  -- Auto-delete after sending (for stories-like ephemeral posts)
  auto_delete_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_scheduled_posts_updated_at
  before update on scheduled_posts
  for each row execute function set_updated_at();

-- Critical: the worker's primary query — keep this index hot.
create index idx_scheduled_due
  on scheduled_posts(scheduled_at, status)
  where status in ('pending', 'processing');

-- For "show me my queue" UI listings
create index idx_scheduled_user_status on scheduled_posts(user_id, status, scheduled_at);
create index idx_scheduled_channel on scheduled_posts(channel_id, scheduled_at desc);
create index idx_scheduled_post on scheduled_posts(post_id);

-- For auto-delete worker
create index idx_scheduled_auto_delete
  on scheduled_posts(auto_delete_at)
  where auto_delete_at is not null and deleted_at is null and status = 'sent';

alter table scheduled_posts enable row level security;
create policy "Users manage own scheduled posts" on scheduled_posts
  for all using (auth.uid() = user_id);

-- ============================================================================
-- 10. post_analytics (engagement snapshots over time)
-- ============================================================================
create table post_analytics (
  id uuid primary key default uuid_generate_v4(),
  scheduled_post_id uuid not null references scheduled_posts(id) on delete cascade,
  views integer default 0,
  reactions jsonb not null default '{}'::jsonb, -- {"❤️": 15, "🔥": 8}
  forwards integer default 0,
  replies integer default 0,
  snapshot_at timestamptz not null default now()
);

create index idx_post_analytics_scheduled on post_analytics(scheduled_post_id, snapshot_at desc);

alter table post_analytics enable row level security;
create policy "Users view analytics of own scheduled posts" on post_analytics
  for select using (
    exists (
      select 1 from scheduled_posts sp
      where sp.id = post_analytics.scheduled_post_id
      and sp.user_id = auth.uid()
    )
  );

-- ============================================================================
-- 11. channel_analytics (daily subscriber count snapshots)
-- ============================================================================
create table channel_analytics (
  id uuid primary key default uuid_generate_v4(),
  channel_id uuid not null references channels(id) on delete cascade,
  subscriber_count integer not null,
  snapshot_date date not null,
  unique (channel_id, snapshot_date)
);

create index idx_channel_analytics on channel_analytics(channel_id, snapshot_date desc);

alter table channel_analytics enable row level security;
create policy "Users view analytics of own channels" on channel_analytics
  for select using (
    exists (select 1 from channels c where c.id = channel_analytics.channel_id and c.user_id = auth.uid())
  );

-- ============================================================================
-- 12. subscriptions (billing state, one active per user)
-- ============================================================================
create table subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  tier subscription_tier not null,
  status subscription_status not null default 'active',
  provider payment_provider not null,
  provider_subscription_id text,
  current_period_start timestamptz not null,
  current_period_end timestamptz not null,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_subscriptions_updated_at
  before update on subscriptions
  for each row execute function set_updated_at();

create index idx_subscriptions_user on subscriptions(user_id, status);
-- partial unique: only one active subscription per user
create unique index uq_subscriptions_user_active
  on subscriptions(user_id)
  where status in ('active', 'trialing');

alter table subscriptions enable row level security;
create policy "Users view own subscriptions" on subscriptions
  for select using (auth.uid() = user_id);

-- ============================================================================
-- 13. payment_history
-- ============================================================================
create table payment_history (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  subscription_id uuid references subscriptions(id) on delete set null,
  amount numeric(10,2) not null,
  currency text not null default 'RUB',
  status payment_status not null,
  provider payment_provider not null,
  provider_payment_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_payment_history_user on payment_history(user_id, created_at desc);
create unique index uq_payment_provider_id
  on payment_history(provider, provider_payment_id);

alter table payment_history enable row level security;
create policy "Users view own payment history" on payment_history
  for select using (auth.uid() = user_id);

-- ============================================================================
-- Storage bucket setup notes
-- ============================================================================
-- Run separately via Supabase dashboard or SQL:
--
--   insert into storage.buckets (id, name, public)
--   values ('post-media', 'post-media', false);
--
-- Then create storage policies:
--
--   create policy "Users upload own media"
--     on storage.objects for insert
--     with check (
--       bucket_id = 'post-media'
--       and (storage.foldername(name))[1] = auth.uid()::text
--     );
--
--   create policy "Users read own media"
--     on storage.objects for select
--     using (
--       bucket_id = 'post-media'
--       and (storage.foldername(name))[1] = auth.uid()::text
--     );
--
--   create policy "Users delete own media"
--     on storage.objects for delete
--     using (
--       bucket_id = 'post-media'
--       and (storage.foldername(name))[1] = auth.uid()::text
--     );
