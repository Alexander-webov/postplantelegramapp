-- ============================================================================
-- Postplan — Storage bucket for post media
-- Migration: 002_storage_bucket.sql
-- Description: Creates the 'post-media' bucket and per-user access policies.
--              Files are stored under <user_id>/<random>.<ext>; only the owner
--              can read/upload/delete their own files.
-- ============================================================================

-- 1. Bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'post-media',
  'post-media',
  false,                                       -- private; we use signed URLs
  52428800,                                    -- 50 MB per file (Telegram Bot API limit for video)
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/quicktime', 'video/webm'
  ]
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 2. RLS policies (drop first so the migration is re-runnable)
drop policy if exists "Users upload own media" on storage.objects;
drop policy if exists "Users read own media" on storage.objects;
drop policy if exists "Users delete own media" on storage.objects;
drop policy if exists "Users update own media" on storage.objects;

-- Users can upload only into a folder named after their own user_id.
-- The first path segment is the user_id, e.g. "abc123/photo.jpg".
create policy "Users upload own media"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'post-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users read own media"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'post-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users update own media"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'post-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users delete own media"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'post-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
