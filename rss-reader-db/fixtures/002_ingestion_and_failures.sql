truncate table
  feed_fetch_logs,
  imports,
  user_articles,
  articles,
  subscriptions,
  feeds,
  folders,
  users
restart identity cascade;

insert into users (id, email, name)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'ops@example.com', 'Ops User');

insert into feeds (
  id,
  feed_url,
  site_url,
  title,
  etag,
  last_modified,
  last_polled_at,
  last_success_at,
  next_poll_at,
  poll_interval_minutes,
  status,
  consecutive_failures,
  last_error_message
)
values
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
    'https://healthy.example.com/feed.xml',
    'https://healthy.example.com',
    'Healthy Feed',
    '"healthy-v1"',
    'Fri, 06 Mar 2026 09:00:00 GMT',
    '2026-03-06 09:00:00+00',
    '2026-03-06 09:00:00+00',
    '2026-03-06 09:30:00+00',
    30,
    'active',
    0,
    null
  ),
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2',
    'https://stale.example.com/feed.xml',
    'https://stale.example.com',
    'Failing Feed',
    null,
    null,
    '2026-03-06 02:00:00+00',
    '2026-03-05 20:00:00+00',
    '2026-03-06 08:00:00+00',
    360,
    'failing',
    4,
    'timeout while fetching feed'
  );

insert into subscriptions (id, user_id, feed_id)
values
  (
    'cccccccc-cccc-cccc-cccc-ccccccccccc1',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1'
  ),
  (
    'cccccccc-cccc-cccc-cccc-ccccccccccc2',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2'
  );

insert into articles (
  id,
  feed_id,
  guid,
  url,
  canonical_url,
  title,
  summary,
  content_text,
  published_at,
  fetched_at,
  hash
)
values
  (
    'dddddddd-dddd-dddd-dddd-ddddddddddd1',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
    'healthy-001',
    'https://healthy.example.com/posts/new-release?utm_source=rss',
    'https://healthy.example.com/posts/new-release',
    'New Release',
    'Release notes and migration guidance.',
    'Release notes and migration guidance.',
    '2026-03-06 08:45:00+00',
    '2026-03-06 09:00:00+00',
    'ingest-hash-1'
  );

insert into user_articles (
  user_id,
  article_id,
  is_read,
  is_saved,
  read_at,
  saved_at,
  created_at
)
values
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'dddddddd-dddd-dddd-dddd-ddddddddddd1',
    false,
    false,
    null,
    null,
    '2026-03-06 09:00:01+00'
  );

insert into feed_fetch_logs (
  id,
  feed_id,
  status_code,
  fetch_started_at,
  fetch_finished_at,
  outcome,
  error_message,
  items_found
)
values
  (
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
    200,
    '2026-03-06 08:59:57+00',
    '2026-03-06 09:00:00+00',
    'success',
    null,
    1
  ),
  (
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee2',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2',
    504,
    '2026-03-06 07:59:55+00',
    '2026-03-06 08:00:10+00',
    'network_error',
    'timeout while fetching feed',
    0
  );

insert into imports (id, user_id, status, total_feeds, feeds_added, error_message)
values
  (
    'ffffffff-ffff-ffff-ffff-fffffffffff1',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'completed',
    5,
    4,
    '1 invalid feed skipped'
  );

-- Expected assertions:
-- 1. due_feed_refreshes includes bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2
-- 2. dedupe should reject another insert for (feed_id, canonical_url) on healthy feed
-- 3. imports row records partial success without failing the whole import
