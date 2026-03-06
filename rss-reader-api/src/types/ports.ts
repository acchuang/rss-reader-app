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
} from './contracts.js';

export interface FolderRepository {
  listByUser(userId: UUID): Promise<FolderDto[]>;
  create(userId: UUID, name: string): Promise<FolderDto>;
  rename(userId: UUID, folderId: UUID, name: string): Promise<FolderDto | null>;
  delete(userId: UUID, folderId: UUID): Promise<boolean>;
  listUnreadSummaries(userId: UUID): Promise<FolderUnreadSummary[]>;
}

export interface SubscriptionRepository {
  listByUser(userId: UUID): Promise<SubscriptionDto[]>;
  upsertFromValidatedFeed(input: {
    userId: UUID;
    feedId: UUID;
    folderId?: UUID | null;
    titleOverride?: string | null;
  }): Promise<SubscriptionDto>;
  update(input: {
    userId: UUID;
    subscriptionId: UUID;
    folderId?: UUID | null;
    titleOverride?: string | null;
  }): Promise<SubscriptionDto | null>;
  delete(userId: UUID, subscriptionId: UUID): Promise<boolean>;
  listExportRows(userId: UUID): Promise<ExportFeedRow[]>;
}

export interface FeedRepository {
  upsertValidatedFeed(input: {
    feedUrl: string;
    siteUrl?: string | null;
    title?: string | null;
    description?: string | null;
    faviconUrl?: string | null;
    etag?: string | null;
    lastModified?: string | null;
  }): Promise<{ id: UUID; status: string }>;
  getById(feedId: UUID): Promise<{ id: UUID; feedUrl: string; etag?: string | null; lastModified?: string | null } | null>;
  claimNextDueFeed(): Promise<{ id: UUID; feedUrl: string; etag?: string | null; lastModified?: string | null } | null>;
  markRefreshSuccess(input: {
    feedId: UUID;
    etag?: string | null;
    lastModified?: string | null;
    nextPollAt: string;
  }): Promise<void>;
  markNotModified(input: { feedId: UUID; nextPollAt: string }): Promise<void>;
  markRefreshFailure(input: {
    feedId: UUID;
    nextPollAt: string;
    status: 'degraded' | 'failing';
    lastErrorMessage: string;
  }): Promise<void>;
  appendFetchLog(input: {
    feedId: UUID;
    statusCode?: number | null;
    fetchStartedAt: string;
    fetchFinishedAt: string;
    outcome: 'success' | 'not_modified' | 'parse_error' | 'network_error' | 'invalid_feed';
    errorMessage?: string | null;
    itemsFound: number;
  }): Promise<void>;
}

export interface ArticleRepository {
  listUnread(input: {
    userId: UUID;
    cursor?: ArticleListCursor | null;
    limit: number;
  }): Promise<ArticleListItemDto[]>;
  listSaved(input: {
    userId: UUID;
    cursor?: SavedListCursor | null;
    limit: number;
  }): Promise<ArticleListItemDto[]>;
  listRecentOrAll(input: {
    userId: UUID;
    onlyUnread: boolean;
    cursor?: ArticleListCursor | null;
    limit: number;
  }): Promise<ArticleListItemDto[]>;
  listByFolder(input: {
    userId: UUID;
    folderId: UUID;
    onlyUnread: boolean;
    cursor?: ArticleListCursor | null;
    limit: number;
  }): Promise<ArticleListItemDto[]>;
  listBySubscription(input: {
    userId: UUID;
    subscriptionId: UUID;
    onlyUnread: boolean;
    cursor?: ArticleListCursor | null;
    limit: number;
  }): Promise<ArticleListItemDto[]>;
  getDetail(userId: UUID, articleId: UUID): Promise<ArticleDetailDto | null>;
  search(input: {
    userId: UUID;
    query: string;
    cursor?: SearchCursor | null;
    limit: number;
  }): Promise<Array<ArticleListItemDto & { rank: number }>>;
  markRead(userId: UUID, articleId: UUID): Promise<ArticleStateMutationResponse | null>;
  markUnread(userId: UUID, articleId: UUID): Promise<ArticleStateMutationResponse | null>;
  save(userId: UUID, articleId: UUID): Promise<ArticleStateMutationResponse | null>;
  unsave(userId: UUID, articleId: UUID): Promise<ArticleStateMutationResponse | null>;
  bulkMarkRead(userId: UUID, articleIds: UUID[]): Promise<UUID[]>;
  findByGuid(feedId: UUID, guid: string): Promise<UUID | null>;
  findByCanonicalUrl(feedId: UUID, canonicalUrl: string): Promise<UUID | null>;
  insertArticle(input: {
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
  }): Promise<UUID | null>;
  fanOutArticle(feedId: UUID, articleId: UUID): Promise<void>;
}

export interface SidebarRepository {
  getSummary(userId: UUID): Promise<SidebarSummary>;
}

export interface ImportRepository {
  create(userId: UUID): Promise<{ id: UUID; status: 'pending' }>;
  getById(userId: UUID, importId: UUID): Promise<ImportStatusDto | null>;
  markProcessing(userId: UUID, importId: UUID, totalFeeds: number): Promise<void>;
  markCompleted(input: {
    userId: UUID;
    importId: UUID;
    feedsAdded: number;
    errorMessage?: string | null;
  }): Promise<void>;
  markFailed(input: { userId: UUID; importId: UUID; errorMessage: string }): Promise<void>;
}

export interface FeedDiscoveryPort {
  discover(input: { url: string }): Promise<
    | {
        kind: 'feed';
        feedUrl: string;
        siteUrl?: string | null;
        title?: string | null;
        description?: string | null;
        faviconUrl?: string | null;
        etag?: string | null;
        lastModified?: string | null;
      }
    | { kind: 'not_found' }
    | { kind: 'invalid' }
    | { kind: 'unavailable'; message: string }
  >;
}

export interface FeedFetchPort {
  fetchFeed(input: {
    feedUrl: string;
    etag?: string | null;
    lastModified?: string | null;
  }): Promise<
    | {
        kind: 'not_modified';
        statusCode: number;
      }
    | {
        kind: 'success';
        statusCode: number;
        etag?: string | null;
        lastModified?: string | null;
        entries: Array<{
          guid?: string | null;
          url: string;
          canonicalUrl: string;
          title: string;
          author?: string | null;
          summary?: string | null;
          contentHtml?: string | null;
          contentText?: string | null;
          publishedAt?: string | null;
        }>;
      }
  >;
}

export interface QueuePort {
  enqueueFeedRefresh(feedId: UUID): Promise<void>;
  enqueueOpmlImport(input: { importId: UUID; userId: UUID; uploadPath: string }): Promise<void>;
}

export interface OpmlParserPort {
  parse(uploadPath: string): Promise<Array<{ xmlUrl: string; title?: string; folderName?: string }>>;
}

export interface ServiceDependencies {
  folders: FolderRepository;
  subscriptions: SubscriptionRepository;
  feeds: FeedRepository;
  articles: ArticleRepository;
  sidebar: SidebarRepository;
  imports: ImportRepository;
  discovery: FeedDiscoveryPort;
  feedFetch: FeedFetchPort;
  queue: QueuePort;
  opmlParser: OpmlParserPort;
}
