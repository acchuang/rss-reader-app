import { NotFoundError, ValidationError } from '../lib/errors.js';
import type {
  ArticleDetailDto,
  ArticleListCursor,
  ArticleListItemDto,
  ArticleStateMutationResponse,
  CursorPage,
  SavedListCursor,
  SearchCursor
} from '../types/contracts.js';
import type { ServiceDependencies } from '../types/ports.js';

type ListInput = {
  view: 'unread' | 'saved' | 'recent' | 'all';
  folderId?: string;
  subscriptionId?: string;
  limit: number;
  cursor?: ArticleListCursor | SavedListCursor | SearchCursor | null;
};

export class ArticleService {
  constructor(private readonly deps: ServiceDependencies) {}

  async list(userId: string, input: ListInput): Promise<CursorPage<object, ArticleListItemDto>> {
    if (input.folderId && input.subscriptionId) {
      throw new ValidationError('Choose either folderId or subscriptionId, not both');
    }

    let items: ArticleListItemDto[];

    if (input.view === 'saved') {
      items = await this.deps.articles.listSaved({
        userId,
        cursor: (input.cursor as SavedListCursor | null | undefined) ?? null,
        limit: input.limit
      });

      return {
        items,
        nextCursor: null
      };
    }

    if (input.folderId) {
      items = await this.deps.articles.listByFolder({
        userId,
        folderId: input.folderId,
        onlyUnread: input.view === 'unread',
        cursor: (input.cursor as ArticleListCursor | null | undefined) ?? null,
        limit: input.limit
      });
    } else if (input.subscriptionId) {
      items = await this.deps.articles.listBySubscription({
        userId,
        subscriptionId: input.subscriptionId,
        onlyUnread: input.view === 'unread',
        cursor: (input.cursor as ArticleListCursor | null | undefined) ?? null,
        limit: input.limit
      });
    } else if (input.view === 'unread') {
      items = await this.deps.articles.listUnread({
        userId,
        cursor: (input.cursor as ArticleListCursor | null | undefined) ?? null,
        limit: input.limit
      });
    } else {
      items = await this.deps.articles.listRecentOrAll({
        userId,
        onlyUnread: false,
        cursor: (input.cursor as ArticleListCursor | null | undefined) ?? null,
        limit: input.limit
      });
    }

    const lastItem = items[items.length - 1];
    const nextCursor = lastItem?.publishedAt
      ? {
          publishedAt: lastItem.publishedAt,
          articleId: lastItem.id
        }
      : null;

    return { items, nextCursor };
  }

  async getDetail(userId: string, articleId: string): Promise<ArticleDetailDto> {
    const article = await this.deps.articles.getDetail(userId, articleId);
    if (!article) {
      throw new NotFoundError('Article not found');
    }
    return article;
  }

  async markRead(userId: string, articleId: string): Promise<ArticleStateMutationResponse> {
    return this.requireArticleState(await this.deps.articles.markRead(userId, articleId));
  }

  async markUnread(userId: string, articleId: string): Promise<ArticleStateMutationResponse> {
    return this.requireArticleState(await this.deps.articles.markUnread(userId, articleId));
  }

  async save(userId: string, articleId: string): Promise<ArticleStateMutationResponse> {
    return this.requireArticleState(await this.deps.articles.save(userId, articleId));
  }

  async unsave(userId: string, articleId: string): Promise<ArticleStateMutationResponse> {
    return this.requireArticleState(await this.deps.articles.unsave(userId, articleId));
  }

  async bulkMarkRead(userId: string, articleIds: string[]): Promise<{ articleIds: string[] }> {
    const updated = await this.deps.articles.bulkMarkRead(userId, articleIds);
    return { articleIds: updated };
  }

  private requireArticleState(
    state: ArticleStateMutationResponse | null
  ): ArticleStateMutationResponse {
    if (!state) {
      throw new NotFoundError('Article not found');
    }
    return state;
  }
}
