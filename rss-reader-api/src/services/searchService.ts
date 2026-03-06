import { ValidationError } from '../lib/errors.js';
import type { ArticleListItemDto, CursorPage, SearchCursor } from '../types/contracts.js';
import type { ServiceDependencies } from '../types/ports.js';

export class SearchService {
  constructor(private readonly deps: ServiceDependencies) {}

  async search(
    userId: string,
    input: { query: string; limit: number; cursor?: SearchCursor | null }
  ): Promise<CursorPage<SearchCursor, ArticleListItemDto>> {
    const query = input.query.trim();
    if (!query) {
      throw new ValidationError('Search query cannot be empty');
    }

    const items = await this.deps.articles.search({
      userId,
      query,
      cursor: input.cursor ?? null,
      limit: input.limit
    });

    return {
      items,
      nextCursor: items.length > 0
        ? {
            rank: items[items.length - 1].rank,
            articleId: items[items.length - 1].id
          }
        : null
    };
  }
}
