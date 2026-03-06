import { createHash } from 'node:crypto';

import type { ServiceDependencies } from '../types/ports.js';

function nextPollIso(minutesFromNow: number): string {
  return new Date(Date.now() + minutesFromNow * 60_000).toISOString();
}

export class FeedRefreshWorkerService {
  constructor(private readonly deps: ServiceDependencies) {}

  async refreshNextDueFeed(): Promise<{ processed: boolean; feedId?: string }> {
    const feed = await this.deps.feeds.claimNextDueFeed();
    if (!feed) {
      return { processed: false };
    }

    return this.refreshFeed(feed.id);
  }

  async refreshFeed(feedId: string): Promise<{ processed: boolean; feedId: string }> {
    const startedAt = new Date().toISOString();
    const feed = await this.deps.feeds.getById(feedId);

    if (!feed) {
      return { processed: false, feedId };
    }

    try {
      const response = await this.deps.feedFetch.fetchFeed({
        feedUrl: feed.feedUrl,
        etag: feed.etag ?? null,
        lastModified: feed.lastModified ?? null
      });

      if (response.kind === 'not_modified') {
        await this.deps.feeds.markNotModified({
          feedId,
          nextPollAt: nextPollIso(30)
        });

        await this.deps.feeds.appendFetchLog({
          feedId,
          statusCode: response.statusCode,
          fetchStartedAt: startedAt,
          fetchFinishedAt: new Date().toISOString(),
          outcome: 'not_modified',
          itemsFound: 0
        });

        return { processed: true, feedId };
      }

      let insertedCount = 0;

      for (const entry of response.entries) {
        if (entry.guid) {
          const existingByGuid = await this.deps.articles.findByGuid(feedId, entry.guid);
          if (existingByGuid) {
            continue;
          }
        }

        const existingByUrl = await this.deps.articles.findByCanonicalUrl(feedId, entry.canonicalUrl);
        if (existingByUrl) {
          continue;
        }

        const articleId = await this.deps.articles.insertArticle({
          feedId,
          guid: entry.guid ?? null,
          url: entry.url,
          canonicalUrl: entry.canonicalUrl,
          title: entry.title,
          author: entry.author ?? null,
          summary: entry.summary ?? null,
          contentHtml: entry.contentHtml ?? null,
          contentText: entry.contentText ?? null,
          publishedAt: entry.publishedAt ?? null,
          fetchedAt: new Date().toISOString(),
          hash: this.buildArticleHash({
            canonicalUrl: entry.canonicalUrl,
            title: entry.title,
            publishedAt: entry.publishedAt ?? null
          })
        });

        if (!articleId) {
          continue;
        }

        await this.deps.articles.fanOutArticle(feedId, articleId);
        insertedCount += 1;
      }

      await this.deps.feeds.markRefreshSuccess({
        feedId,
        etag: response.etag ?? null,
        lastModified: response.lastModified ?? null,
        nextPollAt: nextPollIso(30)
      });

      await this.deps.feeds.appendFetchLog({
        feedId,
        statusCode: response.statusCode,
        fetchStartedAt: startedAt,
        fetchFinishedAt: new Date().toISOString(),
        outcome: 'success',
        itemsFound: insertedCount
      });

      return { processed: true, feedId };
    } catch (error) {
      await this.deps.feeds.markRefreshFailure({
        feedId,
        nextPollAt: nextPollIso(120),
        status: 'degraded',
        lastErrorMessage: error instanceof Error ? error.message : 'Unknown refresh failure'
      });

      await this.deps.feeds.appendFetchLog({
        feedId,
        statusCode: null,
        fetchStartedAt: startedAt,
        fetchFinishedAt: new Date().toISOString(),
        outcome: 'parse_error',
        errorMessage: error instanceof Error ? error.message : 'Unknown refresh failure',
        itemsFound: 0
      });

      throw error;
    }
  }

  buildArticleHash(input: { canonicalUrl: string; title: string; publishedAt?: string | null }): string {
    return createHash('sha256')
      .update(JSON.stringify(input))
      .digest('hex');
  }
}
