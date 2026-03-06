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
  ('11111111-1111-1111-1111-111111111111', 'reader@example.com', 'Reader Test User');

insert into folders (id, user_id, name, position)
values
  ('22222222-2222-2222-2222-222222222221', '11111111-1111-1111-1111-111111111111', 'Tech', 1),
  ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Design', 2);

insert into feeds (
  id,
  feed_url,
  site_url,
  title,
  next_poll_at,
  poll_interval_minutes,
  status
)
values
  (
    '33333333-3333-3333-3333-333333333331',
    'https://tech.example.com/feed.xml',
    'https://tech.example.com',
    'Tech Source',
    '2026-03-06 10:00:00+00',
    30,
    'active'
  ),
  (
    '33333333-3333-3333-3333-333333333332',
    'https://design.example.com/feed.xml',
    'https://design.example.com',
    'Design Source',
    '2026-03-06 10:00:00+00',
    30,
    'active'
  );

insert into subscriptions (id, user_id, feed_id, folder_id)
values
  (
    '44444444-4444-4444-4444-444444444441',
    '11111111-1111-1111-1111-111111111111',
    '33333333-3333-3333-3333-333333333331',
    '22222222-2222-2222-2222-222222222221'
  ),
  (
    '44444444-4444-4444-4444-444444444442',
    '11111111-1111-1111-1111-111111111111',
    '33333333-3333-3333-3333-333333333332',
    '22222222-2222-2222-2222-222222222222'
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
  hash
)
values
  (
    '55555555-5555-5555-5555-555555555551',
    '33333333-3333-3333-3333-333333333331',
    'tech-001',
    'https://tech.example.com/posts/async-ui',
    'https://tech.example.com/posts/async-ui',
    'Async UI Patterns',
    'Using optimistic UI safely.',
    'Using optimistic UI safely in list-heavy apps.',
    '2026-03-06 09:00:00+00',
    'fixture-hash-1'
  ),
  (
    '55555555-5555-5555-5555-555555555552',
    '33333333-3333-3333-3333-333333333331',
    'tech-002',
    'https://tech.example.com/posts/cache-invalidation',
    'https://tech.example.com/posts/cache-invalidation',
    'Cache Invalidation in Practice',
    'A practical guide to invalidation.',
    'A practical guide to invalidation for query-heavy products.',
    '2026-03-06 08:00:00+00',
    'fixture-hash-2'
  ),
  (
    '55555555-5555-5555-5555-555555555553',
    '33333333-3333-3333-3333-333333333332',
    'design-001',
    'https://design.example.com/posts/reader-density',
    'https://design.example.com/posts/reader-density',
    'Designing for Reader Density',
    'Balancing scan speed and legibility.',
    'Balancing scan speed and legibility in reader applications.',
    '2026-03-06 07:00:00+00',
    'fixture-hash-3'
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
    '11111111-1111-1111-1111-111111111111',
    '55555555-5555-5555-5555-555555555551',
    false,
    false,
    null,
    null,
    '2026-03-06 09:00:05+00'
  ),
  (
    '11111111-1111-1111-1111-111111111111',
    '55555555-5555-5555-5555-555555555552',
    true,
    false,
    '2026-03-06 09:10:00+00',
    null,
    '2026-03-06 08:00:05+00'
  ),
  (
    '11111111-1111-1111-1111-111111111111',
    '55555555-5555-5555-5555-555555555553',
    false,
    true,
    null,
    '2026-03-06 09:15:00+00',
    '2026-03-06 07:00:05+00'
  );

-- Expected assertions:
-- 1. unread count = 2
-- 2. saved count = 1
-- 3. folder "Tech" unread count = 1
-- 4. search for 'density' returns article_id 55555555-5555-5555-5555-555555555553
