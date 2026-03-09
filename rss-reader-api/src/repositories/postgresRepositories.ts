import type pg from 'pg';

import type {
  ArticleDetailDto,
  ArticleListCursor,
  ArticleListItemDto,
  ArticleStateMutationResponse,
  ExportFeedRow,
  FolderDto,
  FolderUnreadSummary,
  ImportStatusDto,
  SavedListCursor,
  SearchCursor,
  SidebarSummary,
  SubscriptionDto,
  UUID
} from '../types/contracts.js';
import type {
  ArticleRepository,
  FeedRepository,
  FolderRepository,
  ImportRepository,
  ServiceDependencies,
  SidebarRepository,
  SubscriptionRepository
} from '../types/ports.js';

type Queryable = pg.Pool | pg.PoolClient;
type ReleasableClient = pg.PoolClient;

function toIsoString(value: unknown): string | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value);
}

function mapFolder(row: Record<string, unknown>): FolderDto {
  return {
    id: String(row.id),
    name: String(row.name),
    position: Number(row.position),
    createdAt: toIsoString(row.created_at) ?? '',
    updatedAt: toIsoString(row.updated_at) ?? ''
  };
}

function mapSubscription(row: Record<string, unknown>): SubscriptionDto {
  return {
    id: String(row.id),
    folderId: row.folder_id ? String(row.folder_id) : null,
    titleOverride: row.title_override ? String(row.title_override) : null,
    createdAt: toIsoString(row.created_at) ?? '',
    updatedAt: toIsoString(row.updated_at) ?? '',
    feed: {
      id: String(row.feed_id),
      title: row.feed_title ? String(row.feed_title) : null,
      feedUrl: String(row.feed_url),
      siteUrl: row.site_url ? String(row.site_url) : null,
      status: String(row.status) as SubscriptionDto['feed']['status']
    }
  };
}

function mapArticleListItem(row: Record<string, unknown>): ArticleListItemDto {
  return {
    id: String(row.id),
    title: String(row.title),
    url: String(row.url),
    summary: row.summary ? String(row.summary) : null,
    publishedAt: toIsoString(row.published_at),
    isRead: Boolean(row.is_read),
    isSaved: Boolean(row.is_saved),
    feed: {
      id: String(row.feed_id),
      title: String(row.feed_title)
    }
  };
}

function mapArticleState(row: Record<string, unknown>): ArticleStateMutationResponse {
  return {
    articleId: String(row.article_id),
    isRead: Boolean(row.is_read),
    readAt: toIsoString(row.read_at),
    isSaved: Boolean(row.is_saved),
    savedAt: toIsoString(row.saved_at)
  };
}

function mapArticleDetail(row: Record<string, unknown>): ArticleDetailDto {
  return {
    ...mapArticleListItem(row),
    canonicalUrl: String(row.canonical_url),
    author: row.author ? String(row.author) : null,
    contentHtml: row.content_html ? String(row.content_html) : null,
    contentText: row.content_text ? String(row.content_text) : null,
    readAt: toIsoString(row.read_at),
    savedAt: toIsoString(row.saved_at)
  };
}

class PostgresFolderRepository implements FolderRepository {
  constructor(private readonly db: Queryable) {}

  async listByUser(userId: UUID): Promise<FolderDto[]> {
    const result = await this.db.query(
      `select id, name, position, created_at, updated_at
       from folders
       where user_id = $1
       order by position asc, name asc`,
      [userId]
    );
    return result.rows.map(mapFolder);
  }

  async create(userId: UUID, name: string): Promise<FolderDto> {
    const result = await this.db.query(
      `insert into folders (user_id, name, position)
       values (
         $1,
         $2,
         coalesce((select max(position) + 1 from folders where user_id = $1), 1)
       )
       returning id, name, position, created_at, updated_at`,
      [userId, name]
    );
    return mapFolder(result.rows[0]);
  }

  async rename(userId: UUID, folderId: UUID, name: string): Promise<FolderDto | null> {
    const result = await this.db.query(
      `update folders
       set name = $3
       where id = $1 and user_id = $2
       returning id, name, position, created_at, updated_at`,
      [folderId, userId, name]
    );
    return result.rows[0] ? mapFolder(result.rows[0]) : null;
  }

  async delete(userId: UUID, folderId: UUID): Promise<boolean> {
    const client = 'connect' in this.db ? await this.db.connect() : this.db;
    const ownsClient = 'release' in client;

    try {
      await client.query('begin');
      await client.query(
        `update subscriptions
         set folder_id = null
         where user_id = $1 and folder_id = $2`,
        [userId, folderId]
      );
      const result = await client.query(
        `delete from folders
         where id = $1 and user_id = $2
         returning id`,
        [folderId, userId]
      );
      await client.query('commit');
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      if (ownsClient) {
        (client as ReleasableClient).release();
      }
    }
  }

  async listUnreadSummaries(userId: UUID): Promise<FolderUnreadSummary[]> {
    const result = await this.db.query(
      `select
         f.id,
         f.name,
         f.position,
         count(ua.article_id) filter (where ua.is_read = false) as unread_count
       from folders f
       left join subscriptions s
         on s.folder_id = f.id and s.user_id = f.user_id
       left join articles a
         on a.feed_id = s.feed_id
       left join user_articles ua
         on ua.article_id = a.id and ua.user_id = f.user_id
       where f.user_id = $1
       group by f.id, f.name, f.position
       order by f.position asc, f.name asc`,
      [userId]
    );

    return result.rows.map((row: Record<string, unknown>) => ({
      id: String(row.id),
      name: String(row.name),
      position: Number(row.position),
      unreadCount: Number(row.unread_count)
    }));
  }
}

class PostgresSubscriptionRepository implements SubscriptionRepository {
  constructor(private readonly db: Queryable) {}

  async listByUser(userId: UUID): Promise<SubscriptionDto[]> {
    const result = await this.db.query(
      `select
         s.id,
         s.folder_id,
         s.title_override,
         s.created_at,
         s.updated_at,
         f.id as feed_id,
         f.title as feed_title,
         f.feed_url,
         f.site_url,
         f.status
       from subscriptions s
       join feeds f on f.id = s.feed_id
       where s.user_id = $1
       order by lower(coalesce(s.title_override, f.title)) asc`,
      [userId]
    );
    return result.rows.map(mapSubscription);
  }

  async getById(userId: UUID, subscriptionId: UUID): Promise<SubscriptionDto | null> {
    const result = await this.db.query(
      `select
         s.id,
         s.folder_id,
         s.title_override,
         s.created_at,
         s.updated_at,
         f.id as feed_id,
         f.title as feed_title,
         f.feed_url,
         f.site_url,
         f.status
       from subscriptions s
       join feeds f on f.id = s.feed_id
       where s.user_id = $1 and s.id = $2
       limit 1`,
      [userId, subscriptionId]
    );

    return result.rows[0] ? mapSubscription(result.rows[0]) : null;
  }

  async upsertFromValidatedFeed(input: {
    userId: UUID;
    feedId: UUID;
    folderId?: UUID | null;
    titleOverride?: string | null;
  }): Promise<SubscriptionDto> {
    const result = await this.db.query(
      `insert into subscriptions (user_id, feed_id, folder_id, title_override)
       values ($1, $2, $3, $4)
       on conflict (user_id, feed_id) do update
       set
         folder_id = coalesce(excluded.folder_id, subscriptions.folder_id),
         title_override = coalesce(excluded.title_override, subscriptions.title_override),
         updated_at = now()
       returning id, folder_id, title_override, created_at, updated_at, feed_id`,
      [input.userId, input.feedId, input.folderId ?? null, input.titleOverride ?? null]
    );

    const subscription = result.rows[0];
    const feedResult = await this.db.query(
      `select id as feed_id, title as feed_title, feed_url, site_url, status
       from feeds
       where id = $1`,
      [subscription.feed_id]
    );

    return mapSubscription({ ...subscription, ...feedResult.rows[0] });
  }

  async update(input: {
    userId: UUID;
    subscriptionId: UUID;
    folderId?: UUID | null;
    titleOverride?: string | null;
  }): Promise<SubscriptionDto | null> {
    const sets: string[] = [];
    const values: unknown[] = [input.subscriptionId, input.userId];
    let index = values.length + 1;

    if (input.folderId !== undefined) {
      sets.push(`folder_id = $${index++}`);
      values.push(input.folderId);
    }

    if (input.titleOverride !== undefined) {
      sets.push(`title_override = $${index++}`);
      values.push(input.titleOverride);
    }

    if (sets.length === 0) {
      const existing = await this.listByUser(input.userId);
      return existing.find((item) => item.id === input.subscriptionId) ?? null;
    }

    sets.push('updated_at = now()');

    const result = await this.db.query(
      `update subscriptions
       set ${sets.join(', ')}
       where id = $1 and user_id = $2
       returning id, folder_id, title_override, created_at, updated_at, feed_id`,
      values
    );

    if (!result.rows[0]) {
      return null;
    }

    const feedResult = await this.db.query(
      `select id as feed_id, title as feed_title, feed_url, site_url, status
       from feeds
       where id = $1`,
      [result.rows[0].feed_id]
    );

    return mapSubscription({ ...result.rows[0], ...feedResult.rows[0] });
  }

  async delete(userId: UUID, subscriptionId: UUID): Promise<boolean> {
    const result = await this.db.query(
      `delete from subscriptions
       where id = $1 and user_id = $2
       returning id`,
      [subscriptionId, userId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async listExportRows(userId: UUID): Promise<ExportFeedRow[]> {
    const result = await this.db.query(
      `select
         f.name as folder_name,
         coalesce(s.title_override, fd.title) as title,
         fd.feed_url,
         fd.site_url
       from subscriptions s
       join feeds fd on fd.id = s.feed_id
       left join folders f on f.id = s.folder_id
       where s.user_id = $1
       order by f.position asc nulls last, f.name asc nulls last, lower(coalesce(s.title_override, fd.title)) asc`,
      [userId]
    );

    return result.rows.map((row: Record<string, unknown>) => ({
      folderName: row.folder_name ? String(row.folder_name) : null,
      title: String(row.title),
      feedUrl: String(row.feed_url),
      siteUrl: row.site_url ? String(row.site_url) : null
    }));
  }
}

class PostgresFeedRepository implements FeedRepository {
  constructor(private readonly db: Queryable) {}

  async upsertValidatedFeed(input: {
    feedUrl: string;
    siteUrl?: string | null;
    title?: string | null;
    description?: string | null;
    faviconUrl?: string | null;
    etag?: string | null;
    lastModified?: string | null;
  }): Promise<{ id: UUID; status: string }> {
    const result = await this.db.query(
      `insert into feeds (
         feed_url, site_url, title, description, favicon_url, etag, last_modified, next_poll_at, poll_interval_minutes, status
       )
       values ($1, $2, $3, $4, $5, $6, $7, now(), 30, 'active')
       on conflict (feed_url) do update
       set
         site_url = excluded.site_url,
         title = coalesce(excluded.title, feeds.title),
         description = coalesce(excluded.description, feeds.description),
         favicon_url = coalesce(excluded.favicon_url, feeds.favicon_url),
         next_poll_at = now(),
         status = 'active',
         last_error_message = null,
         updated_at = now()
       returning id, status`,
      [
        input.feedUrl,
        input.siteUrl ?? null,
        input.title ?? null,
        input.description ?? null,
        input.faviconUrl ?? null,
        input.etag ?? null,
        input.lastModified ?? null
      ]
    );

    return {
      id: String(result.rows[0].id),
      status: String(result.rows[0].status)
    };
  }

  async getById(feedId: UUID): Promise<{ id: UUID; feedUrl: string; etag?: string | null; lastModified?: string | null } | null> {
    const result = await this.db.query(
      `select id, feed_url, etag, last_modified
       from feeds
       where id = $1`,
      [feedId]
    );

    if (!result.rows[0]) {
      return null;
    }

    return {
      id: String(result.rows[0].id),
      feedUrl: String(result.rows[0].feed_url),
      etag: result.rows[0].etag ? String(result.rows[0].etag) : null,
      lastModified: result.rows[0].last_modified ? String(result.rows[0].last_modified) : null
    };
  }

  async claimNextDueFeed(): Promise<{ id: UUID; feedUrl: string; etag?: string | null; lastModified?: string | null } | null> {
    const client = 'connect' in this.db ? await this.db.connect() : this.db;
    const ownsClient = 'release' in client;

    try {
      await client.query('begin');
      const result = await client.query(
        `with claimed as (
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
         returning f.id, f.feed_url, f.etag, f.last_modified`
      );
      await client.query('commit');

      if (!result.rows[0]) {
        return null;
      }

      return {
        id: String(result.rows[0].id),
        feedUrl: String(result.rows[0].feed_url),
        etag: result.rows[0].etag ? String(result.rows[0].etag) : null,
        lastModified: result.rows[0].last_modified ? String(result.rows[0].last_modified) : null
      };
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      if (ownsClient) {
        (client as ReleasableClient).release();
      }
    }
  }

  async markRefreshSuccess(input: {
    feedId: UUID;
    etag?: string | null;
    lastModified?: string | null;
    nextPollAt: string;
  }): Promise<void> {
    await this.db.query(
      `update feeds
       set
         etag = $2,
         last_modified = $3,
         last_polled_at = now(),
         last_success_at = now(),
         next_poll_at = $4,
         status = 'active',
         consecutive_failures = 0,
         last_error_message = null
       where id = $1`,
      [input.feedId, input.etag ?? null, input.lastModified ?? null, input.nextPollAt]
    );
  }

  async markNotModified(input: { feedId: UUID; nextPollAt: string }): Promise<void> {
    await this.db.query(
      `update feeds
       set last_polled_at = now(), next_poll_at = $2
       where id = $1`,
      [input.feedId, input.nextPollAt]
    );
  }

  async markRefreshFailure(input: {
    feedId: UUID;
    nextPollAt: string;
    status: 'degraded' | 'failing';
    lastErrorMessage: string;
  }): Promise<void> {
    await this.db.query(
      `update feeds
       set
         last_polled_at = now(),
         next_poll_at = $2,
         status = $3,
         consecutive_failures = consecutive_failures + 1,
         last_error_message = $4
       where id = $1`,
      [input.feedId, input.nextPollAt, input.status, input.lastErrorMessage]
    );
  }

  async appendFetchLog(input: {
    feedId: UUID;
    statusCode?: number | null;
    fetchStartedAt: string;
    fetchFinishedAt: string;
    outcome: 'success' | 'not_modified' | 'parse_error' | 'network_error' | 'invalid_feed';
    errorMessage?: string | null;
    itemsFound: number;
  }): Promise<void> {
    await this.db.query(
      `insert into feed_fetch_logs (
         feed_id, status_code, fetch_started_at, fetch_finished_at, outcome, error_message, items_found
       )
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [
        input.feedId,
        input.statusCode ?? null,
        input.fetchStartedAt,
        input.fetchFinishedAt,
        input.outcome,
        input.errorMessage ?? null,
        input.itemsFound
      ]
    );
  }
}

class PostgresArticleRepository implements ArticleRepository {
  constructor(private readonly db: Queryable) {}

  async listUnread(input: {
    userId: UUID;
    cursor?: ArticleListCursor | null;
    limit: number;
  }): Promise<ArticleListItemDto[]> {
    const result = await this.db.query(
      `select
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
       join articles a on a.id = ua.article_id
       join feeds fd on fd.id = a.feed_id
       join subscriptions s on s.feed_id = a.feed_id and s.user_id = ua.user_id
       where ua.user_id = $1
         and ua.is_read = false
         and ($2::timestamptz is null or (a.published_at, a.id) < ($2::timestamptz, $3::uuid))
       order by a.published_at desc nulls last, a.id desc
       limit $4`,
      [input.userId, input.cursor?.publishedAt ?? null, input.cursor?.articleId ?? null, input.limit]
    );
    return result.rows.map(mapArticleListItem);
  }

  async listSaved(input: {
    userId: UUID;
    cursor?: SavedListCursor | null;
    limit: number;
  }): Promise<ArticleListItemDto[]> {
    const result = await this.db.query(
      `select
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
       join articles a on a.id = ua.article_id
       join feeds fd on fd.id = a.feed_id
       join subscriptions s on s.feed_id = a.feed_id and s.user_id = ua.user_id
       where ua.user_id = $1
         and ua.is_saved = true
         and ($2::timestamptz is null or (ua.saved_at, a.id) < ($2::timestamptz, $3::uuid))
       order by ua.saved_at desc nulls last, a.id desc
       limit $4`,
      [input.userId, input.cursor?.savedAt ?? null, input.cursor?.articleId ?? null, input.limit]
    );
    return result.rows.map(mapArticleListItem);
  }

  async listRecentOrAll(input: {
    userId: UUID;
    onlyUnread: boolean;
    cursor?: ArticleListCursor | null;
    limit: number;
  }): Promise<ArticleListItemDto[]> {
    const result = await this.db.query(
      `select
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
       join articles a on a.id = ua.article_id
       join feeds fd on fd.id = a.feed_id
       join subscriptions s on s.feed_id = a.feed_id and s.user_id = ua.user_id
       where ua.user_id = $1
         and ($2::boolean = false or ua.is_read = false)
         and ($3::timestamptz is null or (a.published_at, a.id) < ($3::timestamptz, $4::uuid))
       order by a.published_at desc nulls last, a.id desc
       limit $5`,
      [input.userId, input.onlyUnread, input.cursor?.publishedAt ?? null, input.cursor?.articleId ?? null, input.limit]
    );
    return result.rows.map(mapArticleListItem);
  }

  async listByFolder(input: {
    userId: UUID;
    folderId: UUID;
    onlyUnread: boolean;
    cursor?: ArticleListCursor | null;
    limit: number;
  }): Promise<ArticleListItemDto[]> {
    const result = await this.db.query(
      `select
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
       join feeds fd on fd.id = s.feed_id
       join articles a on a.feed_id = s.feed_id
       join user_articles ua on ua.article_id = a.id and ua.user_id = s.user_id
       where s.user_id = $1
         and s.folder_id = $2
         and ($3::boolean = false or ua.is_read = false)
         and ($4::timestamptz is null or (a.published_at, a.id) < ($4::timestamptz, $5::uuid))
       order by a.published_at desc nulls last, a.id desc
       limit $6`,
      [input.userId, input.folderId, input.onlyUnread, input.cursor?.publishedAt ?? null, input.cursor?.articleId ?? null, input.limit]
    );
    return result.rows.map(mapArticleListItem);
  }

  async listBySubscription(input: {
    userId: UUID;
    subscriptionId: UUID;
    onlyUnread: boolean;
    cursor?: ArticleListCursor | null;
    limit: number;
  }): Promise<ArticleListItemDto[]> {
    const result = await this.db.query(
      `select
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
       join feeds fd on fd.id = s.feed_id
       join articles a on a.feed_id = s.feed_id
       join user_articles ua on ua.article_id = a.id and ua.user_id = s.user_id
       where s.user_id = $1
         and s.id = $2
         and ($3::boolean = false or ua.is_read = false)
         and ($4::timestamptz is null or (a.published_at, a.id) < ($4::timestamptz, $5::uuid))
       order by a.published_at desc nulls last, a.id desc
       limit $6`,
      [input.userId, input.subscriptionId, input.onlyUnread, input.cursor?.publishedAt ?? null, input.cursor?.articleId ?? null, input.limit]
    );
    return result.rows.map(mapArticleListItem);
  }

  async getDetail(userId: UUID, articleId: UUID): Promise<ArticleDetailDto | null> {
    const result = await this.db.query(
      `select
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
       join articles a on a.id = ua.article_id
       join feeds fd on fd.id = a.feed_id
       join subscriptions s on s.feed_id = a.feed_id and s.user_id = ua.user_id
       where ua.user_id = $1
         and a.id = $2`,
      [userId, articleId]
    );
    return result.rows[0] ? mapArticleDetail(result.rows[0]) : null;
  }

  async search(input: {
    userId: UUID;
    query: string;
    cursor?: SearchCursor | null;
    limit: number;
  }): Promise<Array<ArticleListItemDto & { rank: number }>> {
    const result = await this.db.query(
      `select
         a.id,
         a.title,
         a.url,
         a.summary,
         a.published_at,
         fd.id as feed_id,
         coalesce(s.title_override, fd.title) as feed_title,
         ua.is_read,
         ua.is_saved,
         ts_rank_cd(a.search_document, websearch_to_tsquery('simple', $2)) as rank
       from user_articles ua
       join articles a on a.id = ua.article_id
       join feeds fd on fd.id = a.feed_id
       join subscriptions s on s.feed_id = a.feed_id and s.user_id = ua.user_id
       where ua.user_id = $1
         and a.search_document @@ websearch_to_tsquery('simple', $2)
         and ($3::real is null or (ts_rank_cd(a.search_document, websearch_to_tsquery('simple', $2)), a.id) < ($3::real, $4::uuid))
       order by rank desc, a.id desc
       limit $5`,
      [input.userId, input.query, input.cursor?.rank ?? null, input.cursor?.articleId ?? null, input.limit]
    );

    return result.rows.map((row: Record<string, unknown>) => ({
      ...mapArticleListItem(row),
      rank: Number(row.rank)
    }));
  }

  async markRead(userId: UUID, articleId: UUID): Promise<ArticleStateMutationResponse | null> {
    const result = await this.db.query(
      `update user_articles
       set is_read = true, read_at = now()
       where user_id = $1 and article_id = $2
       returning article_id, is_read, read_at, is_saved, saved_at`,
      [userId, articleId]
    );
    return result.rows[0] ? mapArticleState(result.rows[0]) : null;
  }

  async markUnread(userId: UUID, articleId: UUID): Promise<ArticleStateMutationResponse | null> {
    const result = await this.db.query(
      `update user_articles
       set is_read = false, read_at = null
       where user_id = $1 and article_id = $2
       returning article_id, is_read, read_at, is_saved, saved_at`,
      [userId, articleId]
    );
    return result.rows[0] ? mapArticleState(result.rows[0]) : null;
  }

  async save(userId: UUID, articleId: UUID): Promise<ArticleStateMutationResponse | null> {
    const result = await this.db.query(
      `update user_articles
       set is_saved = true, saved_at = now()
       where user_id = $1 and article_id = $2
       returning article_id, is_read, read_at, is_saved, saved_at`,
      [userId, articleId]
    );
    return result.rows[0] ? mapArticleState(result.rows[0]) : null;
  }

  async unsave(userId: UUID, articleId: UUID): Promise<ArticleStateMutationResponse | null> {
    const result = await this.db.query(
      `update user_articles
       set is_saved = false, saved_at = null
       where user_id = $1 and article_id = $2
       returning article_id, is_read, read_at, is_saved, saved_at`,
      [userId, articleId]
    );
    return result.rows[0] ? mapArticleState(result.rows[0]) : null;
  }

  async bulkMarkRead(userId: UUID, articleIds: UUID[]): Promise<UUID[]> {
    const result = await this.db.query(
      `update user_articles
       set is_read = true, read_at = now()
       where user_id = $1 and article_id = any($2::uuid[])
       returning article_id`,
      [userId, articleIds]
    );
    return result.rows.map((row) => String(row.article_id));
  }

  async findByGuid(feedId: UUID, guid: string): Promise<UUID | null> {
    const result = await this.db.query(
      `select id from articles where feed_id = $1 and guid = $2 limit 1`,
      [feedId, guid]
    );
    return result.rows[0] ? String(result.rows[0].id) : null;
  }

  async findByCanonicalUrl(feedId: UUID, canonicalUrl: string): Promise<UUID | null> {
    const result = await this.db.query(
      `select id from articles where feed_id = $1 and canonical_url = $2 limit 1`,
      [feedId, canonicalUrl]
    );
    return result.rows[0] ? String(result.rows[0].id) : null;
  }

  async insertArticle(input: {
    feedId: UUID;
    guid?: string | null;
    url: string;
    canonicalUrl: string;
    title: string;
    author?: string | null;
    summary?: string | null;
    contentHtml?: string | null;
    contentText?: string | null;
    publishedAt?: string | null;
    fetchedAt: string;
    hash: string;
  }): Promise<UUID | null> {
    const result = await this.db.query(
      `insert into articles (
         feed_id, guid, url, canonical_url, title, author, summary, content_html, content_text, published_at, fetched_at, hash
       )
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       on conflict (feed_id, canonical_url) do nothing
       returning id`,
      [
        input.feedId,
        input.guid ?? null,
        input.url,
        input.canonicalUrl,
        input.title,
        input.author ?? null,
        input.summary ?? null,
        input.contentHtml ?? null,
        input.contentText ?? null,
        input.publishedAt ?? null,
        input.fetchedAt,
        input.hash
      ]
    );
    return result.rows[0] ? String(result.rows[0].id) : null;
  }

  async fanOutArticle(feedId: UUID, articleId: UUID): Promise<void> {
    await this.db.query(
      `insert into user_articles (user_id, article_id, is_read, is_saved, created_at)
       select s.user_id, $2, false, false, now()
       from subscriptions s
       where s.feed_id = $1
       on conflict (user_id, article_id) do nothing`,
      [feedId, articleId]
    );
  }

  async backfillRecentArticlesForUser(input: {
    userId: UUID;
    feedId: UUID;
    limit: number;
    markAsRead?: boolean;
  }): Promise<number> {
    const result = await this.db.query(
      `with recent_articles as (
         select a.id
         from articles a
         where a.feed_id = $2
         order by a.published_at desc nulls last, a.id desc
         limit $3
       ),
       inserted as (
         insert into user_articles (user_id, article_id, is_read, read_at, is_saved, created_at)
         select
           $1,
           recent_articles.id,
           $4::boolean,
           case when $4::boolean then now() else null end,
           false,
           now()
         from recent_articles
         on conflict (user_id, article_id) do nothing
         returning article_id
       )
       select count(*)::int as inserted_count
       from inserted`,
      [input.userId, input.feedId, input.limit, input.markAsRead ?? false]
    );

    return Number(result.rows[0]?.inserted_count ?? 0);
  }
}

class PostgresSidebarRepository implements SidebarRepository {
  constructor(private readonly db: Queryable) {}

  async getSummary(userId: UUID): Promise<SidebarSummary> {
    const [views, folders, feeds] = await Promise.all([
      this.db.query(
        `select
           count(*) filter (where is_read = false) as unread_count,
           count(*) filter (where is_saved = true) as saved_count
         from user_articles
         where user_id = $1`,
        [userId]
      ),
      this.db.query(
        `select
           f.id,
           f.name,
           f.position,
           count(ua.article_id) filter (where ua.is_read = false) as unread_count
         from folders f
         left join subscriptions s
           on s.folder_id = f.id and s.user_id = f.user_id
         left join articles a
           on a.feed_id = s.feed_id
         left join user_articles ua
           on ua.article_id = a.id and ua.user_id = f.user_id
         where f.user_id = $1
         group by f.id, f.name, f.position
         order by f.position asc, f.name asc`,
        [userId]
      ),
      this.db.query(
        `select
           s.id as subscription_id,
           s.folder_id,
           coalesce(s.title_override, fd.title) as title,
           fd.status,
           count(ua.article_id) filter (where ua.is_read = false) as unread_count
         from subscriptions s
         join feeds fd on fd.id = s.feed_id
         left join articles a on a.feed_id = s.feed_id
         left join user_articles ua
           on ua.article_id = a.id and ua.user_id = s.user_id
         where s.user_id = $1
         group by s.id, s.folder_id, s.title_override, fd.title, fd.status
         order by lower(coalesce(s.title_override, fd.title)) asc`,
        [userId]
      )
    ]);

    return {
      views: {
        unreadCount: Number(views.rows[0]?.unread_count ?? 0),
        savedCount: Number(views.rows[0]?.saved_count ?? 0)
      },
      folders: folders.rows.map((row: Record<string, unknown>) => ({
        id: String(row.id),
        name: String(row.name),
        position: Number(row.position),
        unreadCount: Number(row.unread_count)
      })),
      feeds: feeds.rows.map((row: Record<string, unknown>) => ({
        subscriptionId: String(row.subscription_id),
        folderId: row.folder_id ? String(row.folder_id) : null,
        title: String(row.title),
        status: String(row.status) as SidebarSummary['feeds'][number]['status'],
        unreadCount: Number(row.unread_count)
      }))
    };
  }
}

class PostgresImportRepository implements ImportRepository {
  constructor(private readonly db: Queryable) {}

  async create(userId: UUID): Promise<{ id: UUID; status: 'pending' }> {
    const result = await this.db.query(
      `insert into imports (user_id, status, total_feeds, feeds_added)
       values ($1, 'pending', 0, 0)
       returning id, status`,
      [userId]
    );
    return {
      id: String(result.rows[0].id),
      status: 'pending'
    };
  }

  async getById(userId: UUID, importId: UUID): Promise<ImportStatusDto | null> {
    const result = await this.db.query(
      `select id, status, total_feeds, feeds_added, error_message
       from imports
       where user_id = $1 and id = $2`,
      [userId, importId]
    );
    if (!result.rows[0]) {
      return null;
    }
    return {
      id: String(result.rows[0].id),
      status: String(result.rows[0].status) as ImportStatusDto['status'],
      totalFeeds: Number(result.rows[0].total_feeds),
      feedsAdded: Number(result.rows[0].feeds_added),
      errorMessage: result.rows[0].error_message ? String(result.rows[0].error_message) : null
    };
  }

  async markProcessing(userId: UUID, importId: UUID, totalFeeds: number): Promise<void> {
    await this.db.query(
      `update imports
       set status = 'processing', total_feeds = $3
       where user_id = $1 and id = $2`,
      [userId, importId, totalFeeds]
    );
  }

  async markCompleted(input: {
    userId: UUID;
    importId: UUID;
    feedsAdded: number;
    errorMessage?: string | null;
  }): Promise<void> {
    await this.db.query(
      `update imports
       set status = 'completed', feeds_added = $3, error_message = $4
       where user_id = $1 and id = $2`,
      [input.userId, input.importId, input.feedsAdded, input.errorMessage ?? null]
    );
  }

  async markFailed(input: { userId: UUID; importId: UUID; errorMessage: string }): Promise<void> {
    await this.db.query(
      `update imports
       set status = 'failed', error_message = $3
       where user_id = $1 and id = $2`,
      [input.userId, input.importId, input.errorMessage]
    );
  }
}

export function createPostgresDependencies(pool: pg.Pool): Pick<
  ServiceDependencies,
  'folders' | 'subscriptions' | 'feeds' | 'articles' | 'sidebar' | 'imports'
> {
  return {
    folders: new PostgresFolderRepository(pool),
    subscriptions: new PostgresSubscriptionRepository(pool),
    feeds: new PostgresFeedRepository(pool),
    articles: new PostgresArticleRepository(pool),
    sidebar: new PostgresSidebarRepository(pool),
    imports: new PostgresImportRepository(pool)
  };
}
