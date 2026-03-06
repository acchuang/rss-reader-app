-- Core worker-oriented SQL examples.
-- Parameter markers use :named style for readability.

-- Claim a due feed for refresh inside a transaction.
-- Suggested flow:
-- 1. begin
-- 2. run this query
-- 3. if a row is returned, perform fetch+parse
-- 4. update feed with outcome and commit
with claimed as (
  select id
  from feeds
  where status <> 'disabled'
    and next_poll_at <= now()
  order by next_poll_at asc, consecutive_failures asc, id asc
  for update skip locked
  limit 1
)
update feeds f
set next_poll_at = now() + interval '15 minutes'
from claimed
where f.id = claimed.id
returning
  f.id,
  f.feed_url,
  f.etag,
  f.last_modified,
  f.poll_interval_minutes,
  f.status,
  f.consecutive_failures;

-- Record a successful feed refresh with a caller-computed next poll time.
update feeds
set
  etag = :etag,
  last_modified = :last_modified,
  last_polled_at = now(),
  last_success_at = now(),
  next_poll_at = :next_poll_at,
  status = 'active',
  consecutive_failures = 0,
  last_error_message = null
where id = :feed_id
returning id, last_polled_at, last_success_at, next_poll_at, status;

-- Record a 304 not modified.
update feeds
set
  last_polled_at = now(),
  next_poll_at = :next_poll_at
where id = :feed_id
returning id, last_polled_at, next_poll_at;

-- Record a failed refresh with caller-computed backoff and status.
update feeds
set
  last_polled_at = now(),
  next_poll_at = :next_poll_at,
  status = :status,
  consecutive_failures = consecutive_failures + 1,
  last_error_message = :last_error_message
where id = :feed_id
returning id, consecutive_failures, status, next_poll_at, last_error_message;

-- Append a refresh log row.
insert into feed_fetch_logs (
  feed_id,
  status_code,
  fetch_started_at,
  fetch_finished_at,
  outcome,
  error_message,
  items_found
)
values (
  :feed_id,
  :status_code,
  :fetch_started_at,
  :fetch_finished_at,
  :outcome,
  :error_message,
  :items_found
)
returning id;

-- Deduplication probe by feed/guid.
select id
from articles
where feed_id = :feed_id
  and guid = :guid
limit 1;

-- Deduplication probe by feed/canonical URL.
select id
from articles
where feed_id = :feed_id
  and canonical_url = :canonical_url
limit 1;

-- Insert a new article if dedupe keys do not already exist.
-- Prefer this after checking GUID and canonical URL in application code.
insert into articles (
  feed_id,
  guid,
  url,
  canonical_url,
  title,
  author,
  summary,
  content_html,
  content_text,
  published_at,
  fetched_at,
  hash
)
values (
  :feed_id,
  :guid,
  :url,
  :canonical_url,
  :title,
  :author,
  :summary,
  :content_html,
  :content_text,
  :published_at,
  :fetched_at,
  :hash
)
on conflict (feed_id, canonical_url) do nothing
returning id;

-- Fan out a new article to every subscriber of the feed.
insert into user_articles (user_id, article_id, is_read, is_saved, created_at)
select
  s.user_id,
  :article_id,
  false,
  false,
  now()
from subscriptions s
where s.feed_id = :feed_id
on conflict (user_id, article_id) do nothing;

-- Rebuild fanout for a feed if needed after a bug fix or migration.
insert into user_articles (user_id, article_id, is_read, is_saved, created_at)
select
  s.user_id,
  a.id,
  false,
  false,
  coalesce(a.created_at, now())
from subscriptions s
join articles a
  on a.feed_id = s.feed_id
left join user_articles ua
  on ua.user_id = s.user_id
 and ua.article_id = a.id
where s.feed_id = :feed_id
  and ua.article_id is null;

-- Upsert a feed discovered from a URL validation flow.
insert into feeds (
  feed_url,
  site_url,
  title,
  description,
  favicon_url,
  etag,
  last_modified,
  next_poll_at,
  poll_interval_minutes,
  status
)
values (
  :feed_url,
  :site_url,
  :title,
  :description,
  :favicon_url,
  :etag,
  :last_modified,
  now(),
  30,
  'active'
)
on conflict (feed_url) do update
set
  site_url = excluded.site_url,
  title = coalesce(excluded.title, feeds.title),
  description = coalesce(excluded.description, feeds.description),
  favicon_url = coalesce(excluded.favicon_url, feeds.favicon_url),
  updated_at = now()
returning id, feed_url, title, status;

-- Create a subscription if the user does not already have one.
insert into subscriptions (user_id, feed_id, folder_id, title_override)
values (:user_id, :feed_id, :folder_id, :title_override)
on conflict (user_id, feed_id) do update
set
  folder_id = coalesce(excluded.folder_id, subscriptions.folder_id),
  title_override = coalesce(excluded.title_override, subscriptions.title_override),
  updated_at = now()
returning id, user_id, feed_id, folder_id, title_override;

-- Create an import tracking row.
insert into imports (user_id, status, total_feeds, feeds_added)
values (:user_id, 'pending', 0, 0)
returning id, status;

-- Mark import processing state.
update imports
set
  status = 'processing',
  total_feeds = :total_feeds
where id = :import_id
  and user_id = :user_id
returning id, status, total_feeds;

-- Mark import completion.
update imports
set
  status = 'completed',
  feeds_added = :feeds_added,
  error_message = :error_message
where id = :import_id
  and user_id = :user_id
returning id, status, total_feeds, feeds_added, error_message;

-- Mark import failure.
update imports
set
  status = 'failed',
  error_message = :error_message
where id = :import_id
  and user_id = :user_id
returning id, status, error_message;
