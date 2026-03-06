export type UUID = string;
export type ISODateTime = string;

export type FeedStatus = 'active' | 'degraded' | 'failing' | 'disabled';
export type ImportStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface AuthenticatedRequestContext {
  userId: UUID;
  requestId: string;
}

export interface CursorPage<TCursor extends object, TItem> {
  items: TItem[];
  nextCursor: TCursor | null;
}

export interface SidebarSummary {
  views: {
    unreadCount: number;
    savedCount: number;
  };
  folders: FolderUnreadSummary[];
  feeds: FeedUnreadSummary[];
}

export interface FolderUnreadSummary {
  id: UUID;
  name: string;
  position: number;
  unreadCount: number;
}

export interface FeedUnreadSummary {
  subscriptionId: UUID;
  folderId: UUID | null;
  title: string;
  status: FeedStatus;
  unreadCount: number;
}

export interface FolderDto {
  id: UUID;
  name: string;
  position: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface CreateFolderRequest {
  name: string;
}

export interface UpdateFolderRequest {
  name: string;
}

export interface SubscriptionDto {
  id: UUID;
  folderId: UUID | null;
  titleOverride: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  feed: {
    id: UUID;
    title: string | null;
    feedUrl: string;
    siteUrl: string | null;
    status: FeedStatus;
  };
}

export interface CreateSubscriptionRequest {
  url: string;
  folderId?: UUID | null;
  titleOverride?: string | null;
}

export interface UpdateSubscriptionRequest {
  folderId?: UUID | null;
  titleOverride?: string | null;
}

export interface ArticleListCursor {
  publishedAt: ISODateTime;
  articleId: UUID;
}

export interface SavedListCursor {
  savedAt: ISODateTime;
  articleId: UUID;
}

export interface SearchCursor {
  rank: number;
  articleId: UUID;
}

export interface ArticleListItemDto {
  id: UUID;
  title: string;
  url: string;
  summary: string | null;
  publishedAt: ISODateTime | null;
  isRead: boolean;
  isSaved: boolean;
  feed: {
    id: UUID;
    title: string;
  };
}

export interface ArticleDetailDto extends ArticleListItemDto {
  canonicalUrl: string;
  author: string | null;
  contentHtml: string | null;
  contentText: string | null;
  readAt: ISODateTime | null;
  savedAt: ISODateTime | null;
}

export interface ListArticlesRequest {
  view: 'unread' | 'saved' | 'recent' | 'all';
  folderId?: UUID;
  subscriptionId?: UUID;
  search?: string;
  limit?: number;
  cursor?: ArticleListCursor | SavedListCursor | SearchCursor | null;
}

export interface BulkMarkReadRequest {
  articleIds: UUID[];
}

export interface ArticleStateMutationResponse {
  articleId: UUID;
  isRead: boolean;
  readAt: ISODateTime | null;
  isSaved: boolean;
  savedAt: ISODateTime | null;
}

export interface ImportOpmlResponse {
  id: UUID;
  status: ImportStatus;
}

export interface ImportStatusDto {
  id: UUID;
  status: ImportStatus;
  totalFeeds: number;
  feedsAdded: number;
  errorMessage: string | null;
}

export interface ExportFeedRow {
  folderName: string | null;
  title: string;
  feedUrl: string;
  siteUrl: string | null;
}

export interface ApiErrorBody {
  code:
    | 'UNAUTHORIZED'
    | 'FORBIDDEN'
    | 'NOT_FOUND'
    | 'CONFLICT'
    | 'VALIDATION_ERROR'
    | 'INVALID_FEED'
    | 'UPSTREAM_UNAVAILABLE'
    | 'RATE_LIMITED'
    | 'INTERNAL_ERROR';
  message: string;
  details?: Record<string, unknown>;
}
