create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_set_updated_at
before update on users
for each row
execute function set_updated_at();

create trigger folders_set_updated_at
before update on folders
for each row
execute function set_updated_at();

create trigger feeds_set_updated_at
before update on feeds
for each row
execute function set_updated_at();

create trigger subscriptions_set_updated_at
before update on subscriptions
for each row
execute function set_updated_at();

create trigger user_articles_set_updated_at
before update on user_articles
for each row
execute function set_updated_at();

create trigger imports_set_updated_at
before update on imports
for each row
execute function set_updated_at();

create or replace view due_feed_refreshes as
select
  f.id,
  f.feed_url,
  f.status,
  f.next_poll_at,
  f.poll_interval_minutes,
  f.consecutive_failures
from feeds f
where f.status <> 'disabled'
  and f.next_poll_at <= now()
order by f.next_poll_at asc, f.consecutive_failures asc, f.id asc;

create or replace view article_reader_rows as
select
  ua.user_id,
  a.id as article_id,
  a.feed_id,
  a.title,
  a.url,
  a.canonical_url,
  a.summary,
  a.published_at,
  a.created_at as article_created_at,
  ua.is_read,
  ua.is_saved,
  ua.read_at,
  ua.saved_at
from user_articles ua
join articles a on a.id = ua.article_id;
