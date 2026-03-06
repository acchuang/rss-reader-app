import type {
  ArticleDetailDto,
  ArticleListCursor,
  ArticleListItemDto,
  ArticleStateMutationResponse,
  BulkMarkReadRequest,
  CreateFolderRequest,
  CreateSubscriptionRequest,
  ExportFeedRow,
  FolderDto,
  FolderUnreadSummary,
  ImportOpmlResponse,
  ImportStatusDto,
  SavedListCursor,
  SearchCursor,
  SidebarSummary,
  SubscriptionDto,
  UpdateFolderRequest,
  UpdateSubscriptionRequest,
  UUID,
} from './api-contracts';

export interface FolderRepository {
  listByUser(userId: UUID): Promise<FolderDto[]>;
  create(userId: UUID, input: CreateFolderRequest): Promise<FolderDto>;
  rename(userId: UUID, folderId: UUID, input: UpdateFolderRequest): Promise<FolderDto | null>;
  delete(userId: UUID, folderId: UUID): Promise<boolean>;
  listUnreadSummaries(userId: UUID): Promise<FolderUnreadSummary[]>;
}

export interface SubscriptionRepository {
  listByUser(userId: UUID): Promise<SubscriptionDto[]>;
  upsertFromValidatedFeed(
    userId: UUID,
    input: { feedId: UUID; folderId?: UUID | null; titleOverride?: string | null }
  ): Promise<SubscriptionDto>;
  update(userId: UUID, subscriptionId: UUID, input: UpdateSubscriptionRequest): Promise<SubscriptionDto | null>;
  delete(userId: UUID, subscriptionId: UUID): Promise<{ deleted: boolean; feedId?: UUID }>;
  listExportRows(userId: UUID): Promise<ExportFeedRow[]>;
}

export interface FeedRepository {
  findByUrl(feedUrl: string): Promise<{ id: UUID; status: string } | null>;
  upsertValidatedFeed(input: {
    feedUrl: string;
    siteUrl?: string | null;
    title?: string | null;
    description?: string | null;
    faviconUrl?: string | null;
    etag?: string | null;
    lastModified?: string | null;
  }): Promise<{ id: UUID; status: string }>;
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
  listRecentOrAll(input: {
    userId: UUID;
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
  bulkMarkRead(userId: UUID, input: BulkMarkReadRequest): Promise<UUID[]>;
}

export interface SidebarRepository {
  getSummary(userId: UUID): Promise<SidebarSummary>;
}

export interface ImportRepository {
  create(userId: UUID): Promise<ImportOpmlResponse>;
  getById(userId: UUID, importId: UUID): Promise<ImportStatusDto | null>;
  markProcessing(userId: UUID, importId: UUID, totalFeeds: number): Promise<ImportStatusDto | null>;
  markCompleted(
    userId: UUID,
    importId: UUID,
    input: { feedsAdded: number; errorMessage?: string | null }
  ): Promise<ImportStatusDto | null>;
  markFailed(userId: UUID, importId: UUID, errorMessage: string): Promise<ImportStatusDto | null>;
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

export interface QueuePort {
  enqueueFeedRefresh(feedId: UUID): Promise<void>;
  enqueueOpmlImport(input: { importId: UUID; userId: UUID; uploadPath: string }): Promise<void>;
}
