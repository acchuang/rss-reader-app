-- Core reader-facing SQL examples.
-- Parameter markers use :named style for readability. Adapt to your driver.

-- Sidebar counts summary for a user.
select
  count(*) filter (where ua.is_read = false) as unread_count,
  count(*) filter (where ua.is_saved = true) as saved_count
from user_articles ua
where ua.user_id = :user_id;

-- Folder unread counts for sidebar.
select
  f.id,
  f.name,
  f.position,
  count(ua.article_id) filter (where ua.is_read = false) as unread_count
from folders f
left join subscriptions s
  on s.folder_id = f.id
 and s.user_id = f.user_id
left join articles a
  on a.feed_id = s.feed_id
left join user_articles ua
  on ua.article_id = a.id
 and ua.user_id = f.user_id
where f.user_id = :user_id
group by f.id, f.name, f.position
order by f.position asc, f.name asc;

-- Feed unread counts for sidebar.
select
  s.id as subscription_id,
  s.folder_id,
  coalesce(s.title_override, fd.title) as title,
  fd.status,
  count(ua.article_id) filter (where ua.is_read = false) as unread_count
from subscriptions s
join feeds fd
  on fd.id = s.feed_id
left join articles a
  on a.feed_id = s.feed_id
left join user_articles ua
  on ua.article_id = a.id
 and ua.user_id = s.user_id
where s.user_id = :user_id
group by s.id, s.folder_id, s.title_override, fd.title, fd.status
order by lower(coalesce(s.title_override, fd.title)) asc;

-- Reader list: all unread.
-- Cursor inputs:
--   :cursor_published_at timestamptz nullable
--   :cursor_article_id uuid nullable
--   :limit integer
select
  a.id,
  a.title,
  a.url,
  a.summary,
  a.published_at,
  fd.id as feed_id,
  coalesce(s.title_override, fd.title) as feed_title,
  ua.is_read,
  ua.is_saved
from user_articles ua
join articles a
  on a.id = ua.article_id
join feeds fd
  on fd.id = a.feed_id
join subscriptions s
  on s.feed_id = a.feed_id
 and s.user_id = ua.user_id
where ua.user_id = :user_id
  and ua.is_read = false
  and (
    :cursor_published_at is null or
    (a.published_at, a.id) < (:cursor_published_at, :cursor_article_id)
  )
order by a.published_at desc nulls last, a.id desc
limit :limit;

-- Reader list: saved articles.
select
  a.id,
  a.title,
  a.url,
  a.summary,
  a.published_at,
  fd.id as feed_id,
  coalesce(s.title_override, fd.title) as feed_title,
  ua.is_read,
  ua.is_saved,
  ua.saved_at
from user_articles ua
join articles a
  on a.id = ua.article_id
join feeds fd
  on fd.id = a.feed_id
join subscriptions s
  on s.feed_id = a.feed_id
 and s.user_id = ua.user_id
where ua.user_id = :user_id
  and ua.is_saved = true
  and (
    :cursor_saved_at is null or
    (ua.saved_at, a.id) < (:cursor_saved_at, :cursor_article_id)
  )
order by ua.saved_at desc nulls last, a.id desc
limit :limit;

-- Reader list: folder-specific unread or all.
-- Bind :only_unread as boolean.
select
  a.id,
  a.title,
  a.url,
  a.summary,
  a.published_at,
  fd.id as feed_id,
  coalesce(s.title_override, fd.title) as feed_title,
  ua.is_read,
  ua.is_saved
from subscriptions s
join feeds fd
  on fd.id = s.feed_id
join articles a
  on a.feed_id = s.feed_id
join user_articles ua
  on ua.article_id = a.id
 and ua.user_id = s.user_id
where s.user_id = :user_id
  and s.folder_id = :folder_id
  and (:only_unread = false or ua.is_read = false)
  and (
    :cursor_published_at is null or
    (a.published_at, a.id) < (:cursor_published_at, :cursor_article_id)
  )
order by a.published_at desc nulls last, a.id desc
limit :limit;

-- Reader list: subscription-specific unread or all.
select
  a.id,
  a.title,
  a.url,
  a.summary,
  a.published_at,
  fd.id as feed_id,
  coalesce(s.title_override, fd.title) as feed_title,
  ua.is_read,
  ua.is_saved
from subscriptions s
join feeds fd
  on fd.id = s.feed_id
join articles a
  on a.feed_id = s.feed_id
join user_articles ua
  on ua.article_id = a.id
 and ua.user_id = s.user_id
where s.user_id = :user_id
  and s.id = :subscription_id
  and (:only_unread = false or ua.is_read = false)
  and (
    :cursor_published_at is null or
    (a.published_at, a.id) < (:cursor_published_at, :cursor_article_id)
  )
order by a.published_at desc nulls last, a.id desc
limit :limit;

-- Single article detail.
select
  a.id,
  a.feed_id,
  a.title,
  a.url,
  a.canonical_url,
  a.author,
  a.summary,
  a.content_html,
  a.content_text,
  a.published_at,
  coalesce(s.title_override, fd.title) as feed_title,
  ua.is_read,
  ua.is_saved,
  ua.read_at,
  ua.saved_at
from user_articles ua
join articles a
  on a.id = ua.article_id
join feeds fd
  on fd.id = a.feed_id
join subscriptions s
  on s.feed_id = a.feed_id
 and s.user_id = ua.user_id
where ua.user_id = :user_id
  and a.id = :article_id;

-- Search results within the user's visible article set.
select
  a.id,
  a.title,
  a.url,
  a.summary,
  a.published_at,
  coalesce(s.title_override, fd.title) as feed_title,
  ua.is_read,
  ua.is_saved,
  ts_rank_cd(a.search_document, websearch_to_tsquery('simple', :query)) as rank
from user_articles ua
join articles a
  on a.id = ua.article_id
join feeds fd
  on fd.id = a.feed_id
join subscriptions s
  on s.feed_id = a.feed_id
 and s.user_id = ua.user_id
where ua.user_id = :user_id
  and a.search_document @@ websearch_to_tsquery('simple', :query)
  and (
    :cursor_rank is null or
    (ts_rank_cd(a.search_document, websearch_to_tsquery('simple', :query)), a.id) < (:cursor_rank, :cursor_article_id)
  )
order by rank desc, a.id desc
limit :limit;

-- Mark an article read.
update user_articles
set
  is_read = true,
  read_at = now()
where user_id = :user_id
  and article_id = :article_id
  and is_read = false
returning user_id, article_id, is_read, read_at;

-- Mark an article unread.
update user_articles
set
  is_read = false,
  read_at = null
where user_id = :user_id
  and article_id = :article_id
  and is_read = true
returning user_id, article_id, is_read, read_at;

-- Save an article.
update user_articles
set
  is_saved = true,
  saved_at = now()
where user_id = :user_id
  and article_id = :article_id
  and is_saved = false
returning user_id, article_id, is_saved, saved_at;

-- Unsave an article.
update user_articles
set
  is_saved = false,
  saved_at = null
where user_id = :user_id
  and article_id = :article_id
  and is_saved = true
returning user_id, article_id, is_saved, saved_at;

-- Bulk mark read for a caller-provided article id list.
-- Bind :article_ids as uuid[].
update user_articles
set
  is_read = true,
  read_at = now()
where user_id = :user_id
  and article_id = any(:article_ids)
  and is_read = false
returning article_id;

-- Create a folder.
insert into folders (user_id, name, position)
values (
  :user_id,
  :name,
  coalesce(
    (select max(position) + 1 from folders where user_id = :user_id),
    1
  )
)
returning *;

-- Rename a folder.
update folders
set name = :name
where id = :folder_id
  and user_id = :user_id
returning *;

-- Delete a folder but keep subscriptions.
update subscriptions
set folder_id = null
where user_id = :user_id
  and folder_id = :folder_id;

delete from folders
where id = :folder_id
  and user_id = :user_id
returning id;

-- Move a subscription to a folder or root.
update subscriptions
set folder_id = :folder_id
where id = :subscription_id
  and user_id = :user_id
returning *;

-- Remove a subscription.
delete from subscriptions
where id = :subscription_id
  and user_id = :user_id
returning id, feed_id;

-- Exportable OPML feed list.
select
  f.name as folder_name,
  coalesce(s.title_override, fd.title) as title,
  fd.feed_url,
  fd.site_url
from subscriptions s
join feeds fd
  on fd.id = s.feed_id
left join folders f
  on f.id = s.folder_id
where s.user_id = :user_id
order by f.position asc nulls last, f.name asc nulls last, lower(coalesce(s.title_override, fd.title)) asc;
