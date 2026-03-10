create table users (
  id uuid primary key default gen_random_uuid(),
  email citext not null unique,
  name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint folders_user_name_unique unique (user_id, name)
);

create table feeds (
  id uuid primary key default gen_random_uuid(),
  feed_url text not null unique,
  site_url text,
  title text,
  description text,
  favicon_url text,
  etag text,
  last_modified text,
  last_polled_at timestamptz,
  last_success_at timestamptz,
  next_poll_at timestamptz not null default now(),
  poll_interval_minutes integer not null default 120,
  status feed_status not null default 'active',
  consecutive_failures integer not null default 0,
  last_error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint feeds_poll_interval_positive check (poll_interval_minutes > 0),
  constraint feeds_failure_count_nonnegative check (consecutive_failures >= 0)
);

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  feed_id uuid not null references feeds(id) on delete cascade,
  folder_id uuid references folders(id) on delete set null,
  title_override text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscriptions_user_feed_unique unique (user_id, feed_id)
);

create table articles (
  id uuid primary key default gen_random_uuid(),
  feed_id uuid not null references feeds(id) on delete cascade,
  guid text,
  url text not null,
  canonical_url text not null,
  title text not null,
  author text,
  summary text,
  content_html text,
  content_text text,
  published_at timestamptz,
  fetched_at timestamptz not null default now(),
  hash text not null,
  created_at timestamptz not null default now(),
  search_document tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(summary, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(content_text, '')), 'C')
  ) stored
);

create table user_articles (
  user_id uuid not null references users(id) on delete cascade,
  article_id uuid not null references articles(id) on delete cascade,
  is_read boolean not null default false,
  is_saved boolean not null default false,
  read_at timestamptz,
  saved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, article_id),
  constraint user_articles_read_state_check
    check (
      (is_read = false and read_at is null) or
      (is_read = true and read_at is not null)
    ),
  constraint user_articles_saved_state_check
    check (
      (is_saved = false and saved_at is null) or
      (is_saved = true and saved_at is not null)
    )
);

create table feed_fetch_logs (
  id uuid primary key default gen_random_uuid(),
  feed_id uuid not null references feeds(id) on delete cascade,
  status_code integer,
  fetch_started_at timestamptz not null,
  fetch_finished_at timestamptz not null,
  outcome fetch_outcome not null,
  error_message text,
  items_found integer not null default 0,
  created_at timestamptz not null default now(),
  constraint feed_fetch_logs_items_found_nonnegative check (items_found >= 0),
  constraint feed_fetch_logs_finished_after_started check (fetch_finished_at >= fetch_started_at)
);

create table imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  status import_status not null default 'pending',
  total_feeds integer not null default 0,
  feeds_added integer not null default 0,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint imports_total_feeds_nonnegative check (total_feeds >= 0),
  constraint imports_feeds_added_nonnegative check (feeds_added >= 0),
  constraint imports_feeds_added_lte_total check (feeds_added <= total_feeds)
);

create unique index articles_feed_guid_unique
  on articles (feed_id, guid)
  where guid is not null;

create unique index articles_feed_canonical_url_unique
  on articles (feed_id, canonical_url);

create index feeds_poll_due_idx on feeds (status, next_poll_at);
create index feeds_last_polled_idx on feeds (last_polled_at);
create index subscriptions_user_idx on subscriptions (user_id);
create index subscriptions_feed_idx on subscriptions (feed_id);
create index subscriptions_folder_idx on subscriptions (user_id, folder_id);
create index articles_feed_published_idx on articles (feed_id, published_at desc, id desc);
create index articles_published_idx on articles (published_at desc, id desc);
create index articles_search_idx on articles using gin (search_document);
create index user_articles_unread_idx
  on user_articles (user_id, is_read, created_at desc, article_id desc);
create index user_articles_saved_idx
  on user_articles (user_id, is_saved, saved_at desc, article_id desc);
create index user_articles_article_idx on user_articles (article_id);
create index feed_fetch_logs_feed_time_idx on feed_fetch_logs (feed_id, fetch_started_at desc);
create index feed_fetch_logs_outcome_idx on feed_fetch_logs (outcome, fetch_started_at desc);
create index imports_user_created_idx on imports (user_id, created_at desc);
