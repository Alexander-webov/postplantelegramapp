-- 1) Check which bot each channel uses.
select
  c.id as channel_id,
  c.title,
  c.username,
  c.bot_id,
  b.username as bot_username,
  b.created_at as bot_created_at
from channels c
left join bots b on b.id = c.bot_id
order by c.created_at desc;

-- 2) If a channel still points to an old bot, update it manually.
-- Replace CHANNEL_ID and NEW_BOT_ID before running.
-- update channels
-- set bot_id = 'NEW_BOT_ID'
-- where id = 'CHANNEL_ID';

-- 3) Reset stuck processing/pending rows after a broken cron run.
update scheduled_posts
set
  status = 'pending',
  error_message = null
where status = 'processing'
  and scheduled_at <= now() - interval '3 minutes';

-- 4) Let auto-delete try again after fixing bot/channel link.
update scheduled_posts
set
  auto_delete_error = null,
  auto_deleted_at = null
where status = 'sent'
  and auto_delete_error is not null;

-- 5) Let view snapshots try again after fixing bot/channel link.
update scheduled_posts
set
  views_1h = null,
  views_6h = null,
  views_24h = null,
  views_48h = null,
  views_latest = null,
  views_latest_at = null,
  views_error = null
where status = 'sent'
  and views_error is not null;
