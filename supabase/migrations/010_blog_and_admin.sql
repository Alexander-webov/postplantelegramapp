-- ============================================================================
-- 010_blog_and_admin.sql
-- ============================================================================
-- Adds:
--   1. profiles.is_admin flag — used to gate /admin and admin server actions
--   2. blog_posts table — content for /blog (public) + /admin/posts (CRUD)
--   3. RLS policies: anyone can read published blog posts, only service-role
--      writes (via server actions guarded by is_admin check)
--   4. Auto-promotion of the founder account if it exists at migration time
--
-- Safe to re-run: all DDL uses IF NOT EXISTS, all policies DROP first.
-- ============================================================================

-- 1. is_admin flag ------------------------------------------------------------
alter table profiles
  add column if not exists is_admin boolean not null default false;

-- Promote the founder account if it already exists. Idempotent.
update profiles
   set is_admin = true
 where email = 'vilmenshtain2@gmail.com'
   and is_admin = false;

-- 2. blog_posts ---------------------------------------------------------------
create table if not exists blog_posts (
  id                uuid primary key default uuid_generate_v4(),
  slug              text not null unique,
  title             text not null,
  excerpt           text,                       -- short summary for the index page
  content_md        text not null default '',   -- body in Markdown
  cover_image_url   text,
  meta_title        text,                       -- <title> override for SEO
  meta_description  text,                       -- <meta name="description"> for SEO
  og_image_url      text,                       -- override OG image
  is_published      boolean not null default false,
  published_at      timestamptz,                -- null until published; set on publish
  author_name       text,                       -- display name on the post page
  author_id         uuid references profiles(id) on delete set null,
  reading_minutes   int,                        -- estimated read time, set on save
  view_count        int not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_blog_posts_published
  on blog_posts (is_published, published_at desc);
create index if not exists idx_blog_posts_slug on blog_posts (slug);

drop trigger if exists trg_blog_posts_updated_at on blog_posts;
create trigger trg_blog_posts_updated_at
  before update on blog_posts
  for each row execute function set_updated_at();

-- RLS — anonymous and authenticated can read published posts; everything
-- else goes through service-role (server actions guarded by is_admin check).
alter table blog_posts enable row level security;

drop policy if exists "Anyone reads published posts" on blog_posts;
create policy "Anyone reads published posts" on blog_posts
  for select
  to anon, authenticated
  using (is_published = true);
