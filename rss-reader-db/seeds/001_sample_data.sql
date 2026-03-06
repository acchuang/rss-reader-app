insert into users (id, email, name)
values
  ('10000000-0000-0000-0000-000000000001', 'alice@example.com', 'Alice'),
  ('10000000-0000-0000-0000-000000000002', 'bob@example.com', 'Bob');

insert into folders (id, user_id, name, position)
values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Engineering', 1),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Product', 2),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'Newsletters', 1);

insert into feeds (
  id,
  feed_url,
  site_url,
  title,
  description,
  favicon_url,
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
    '30000000-0000-0000-0000-000000000001',
    'https://engineering.example.com/feed.xml',
    'https://engineering.example.com',
    'Engineering Weekly',
    'Updates from the engineering team',
    'https://engineering.example.com/favicon.ico',
    '"eng-v12"',
    'Fri, 06 Mar 2026 08:00:00 GMT',
    '2026-03-06 08:00:00+00',
    '2026-03-06 08:00:00+00',
    '2026-03-06 08:30:00+00',
    30,
    'active',
    0,
    null
  ),
  (
    '30000000-0000-0000-0000-000000000002',
    'https://product.example.com/rss',
    'https://product.example.com',
    'Product Dispatch',
    'Product strategy and launches',
    'https://product.example.com/favicon.ico',
    '"prod-v4"',
    'Fri, 06 Mar 2026 07:30:00 GMT',
    '2026-03-06 07:30:00+00',
    '2026-03-06 07:30:00+00',
    '2026-03-06 08:00:00+00',
    30,
    'active',
    0,
    null
  ),
  (
    '30000000-0000-0000-0000-000000000003',
    'https://broken.example.com/feed',
    'https://broken.example.com',
    'Broken Source',
    'A flaky upstream feed',
    'https://broken.example.com/favicon.ico',
    null,
    null,
    '2026-03-05 23:00:00+00',
    '2026-03-04 23:00:00+00',
    '2026-03-06 12:00:00+00',
    360,
    'failing',
    3,
    'HTTP 502 from origin'
  );

insert into subscriptions (id, user_id, feed_id, folder_id, title_override)
values
  (
    '40000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    null
  ),
  (
    '40000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000002',
    'Product Team'
  ),
  (
    '40000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000002',
    '30000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000003',
    null
  );

insert into articles (
  id,
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
  hash,
  created_at
)
values
  (
    '50000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    'eng-001',
    'https://engineering.example.com/posts/ship-faster?utm_source=rss',
    'https://engineering.example.com/posts/ship-faster',
    'Ship Faster With Smaller Deploys',
    'Jordan Lee',
    'A guide to smaller, safer releases.',
    '<p>A guide to smaller, safer releases.</p>',
    'A guide to smaller, safer releases.',
    '2026-03-06 06:00:00+00',
    '2026-03-06 08:00:00+00',
    'hash-eng-001',
    '2026-03-06 08:00:00+00'
  ),
  (
    '50000000-0000-0000-0000-000000000002',
    '30000000-0000-0000-0000-000000000001',
    'eng-002',
    'https://engineering.example.com/posts/queue-design',
    'https://engineering.example.com/posts/queue-design',
    'Queue Design for Background Jobs',
    'Jordan Lee',
    'How to structure durable workers.',
    '<p>How to structure durable workers.</p>',
    'How to structure durable workers.',
    '2026-03-05 18:00:00+00',
    '2026-03-06 08:00:00+00',
    'hash-eng-002',
    '2026-03-06 08:00:00+00'
  ),
  (
    '50000000-0000-0000-0000-000000000003',
    '30000000-0000-0000-0000-000000000002',
    'prod-001',
    'https://product.example.com/posts/q2-roadmap',
    'https://product.example.com/posts/q2-roadmap',
    'Q2 Roadmap Themes',
    'Mina Park',
    'Themes and bets for the next quarter.',
    '<p>Themes and bets for the next quarter.</p>',
    'Themes and bets for the next quarter.',
    '2026-03-06 05:30:00+00',
    '2026-03-06 07:30:00+00',
    'hash-prod-001',
    '2026-03-06 07:30:00+00'
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
    '10000000-0000-0000-0000-000000000001',
    '50000000-0000-0000-0000-000000000001',
    false,
    true,
    null,
    '2026-03-06 08:05:00+00',
    '2026-03-06 08:00:01+00'
  ),
  (
    '10000000-0000-0000-0000-000000000001',
    '50000000-0000-0000-0000-000000000002',
    true,
    false,
    '2026-03-06 08:10:00+00',
    null,
    '2026-03-06 08:00:02+00'
  ),
  (
    '10000000-0000-0000-0000-000000000001',
    '50000000-0000-0000-0000-000000000003',
    false,
    false,
    null,
    null,
    '2026-03-06 07:30:01+00'
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    '50000000-0000-0000-0000-000000000001',
    false,
    false,
    null,
    null,
    '2026-03-06 08:00:01+00'
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    '50000000-0000-0000-0000-000000000002',
    false,
    false,
    null,
    null,
    '2026-03-06 08:00:02+00'
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
    '60000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    200,
    '2026-03-06 07:59:58+00',
    '2026-03-06 08:00:00+00',
    'success',
    null,
    2
  ),
  (
    '60000000-0000-0000-0000-000000000002',
    '30000000-0000-0000-0000-000000000003',
    502,
    '2026-03-05 22:59:58+00',
    '2026-03-05 23:00:03+00',
    'network_error',
    'HTTP 502 from origin',
    0
  );

insert into imports (id, user_id, status, total_feeds, feeds_added, error_message)
values
  (
    '70000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'completed',
    2,
    2,
    null
  );
