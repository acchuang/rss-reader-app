import { randomUUID } from 'node:crypto';

import { NotImplementedAppError } from '../lib/errors.js';
import type { ServiceDependencies } from '../types/ports.js';

function notImplemented(method: string): never {
  throw new NotImplementedAppError(`${method} is not implemented. Replace stub repositories with SQL-backed adapters.`);
}

export function createStubDependencies(): ServiceDependencies {
  return {
    folders: {
      listByUser: async () => notImplemented('FolderRepository.listByUser'),
      create: async () => notImplemented('FolderRepository.create'),
      rename: async () => notImplemented('FolderRepository.rename'),
      delete: async () => notImplemented('FolderRepository.delete'),
      listUnreadSummaries: async () => notImplemented('FolderRepository.listUnreadSummaries')
    },
    subscriptions: {
      listByUser: async () => notImplemented('SubscriptionRepository.listByUser'),
      getById: async () => notImplemented('SubscriptionRepository.getById'),
      upsertFromValidatedFeed: async () => notImplemented('SubscriptionRepository.upsertFromValidatedFeed'),
      update: async () => notImplemented('SubscriptionRepository.update'),
      delete: async () => notImplemented('SubscriptionRepository.delete'),
      listExportRows: async () => notImplemented('SubscriptionRepository.listExportRows')
    },
    feeds: {
      upsertValidatedFeed: async () => notImplemented('FeedRepository.upsertValidatedFeed'),
      getById: async () => notImplemented('FeedRepository.getById'),
      claimNextDueFeed: async () => notImplemented('FeedRepository.claimNextDueFeed'),
      markRefreshSuccess: async () => notImplemented('FeedRepository.markRefreshSuccess'),
      markNotModified: async () => notImplemented('FeedRepository.markNotModified'),
      markRefreshFailure: async () => notImplemented('FeedRepository.markRefreshFailure'),
      appendFetchLog: async () => notImplemented('FeedRepository.appendFetchLog')
    },
    articles: {
      listUnread: async () => notImplemented('ArticleRepository.listUnread'),
      listSaved: async () => notImplemented('ArticleRepository.listSaved'),
      listRecentOrAll: async () => notImplemented('ArticleRepository.listRecentOrAll'),
      listByFolder: async () => notImplemented('ArticleRepository.listByFolder'),
      listBySubscription: async () => notImplemented('ArticleRepository.listBySubscription'),
      getDetail: async () => notImplemented('ArticleRepository.getDetail'),
      search: async () => notImplemented('ArticleRepository.search'),
      markRead: async () => notImplemented('ArticleRepository.markRead'),
      markUnread: async () => notImplemented('ArticleRepository.markUnread'),
      save: async () => notImplemented('ArticleRepository.save'),
      unsave: async () => notImplemented('ArticleRepository.unsave'),
      bulkMarkRead: async () => notImplemented('ArticleRepository.bulkMarkRead'),
      findByGuid: async () => notImplemented('ArticleRepository.findByGuid'),
      findByCanonicalUrl: async () => notImplemented('ArticleRepository.findByCanonicalUrl'),
      insertArticle: async () => notImplemented('ArticleRepository.insertArticle'),
      fanOutArticle: async () => notImplemented('ArticleRepository.fanOutArticle'),
      backfillRecentArticlesForUser: async () => notImplemented('ArticleRepository.backfillRecentArticlesForUser')
    },
    sidebar: {
      getSummary: async () => notImplemented('SidebarRepository.getSummary')
    },
    imports: {
      create: async () => ({ id: randomUUID(), status: 'pending' }),
      getById: async () => notImplemented('ImportRepository.getById'),
      markProcessing: async () => notImplemented('ImportRepository.markProcessing'),
      markCompleted: async () => notImplemented('ImportRepository.markCompleted'),
      markFailed: async () => notImplemented('ImportRepository.markFailed')
    },
    discovery: {
      discover: async () => notImplemented('FeedDiscoveryPort.discover')
    },
    feedFetch: {
      fetchFeed: async () => notImplemented('FeedFetchPort.fetchFeed')
    },
    queue: {
      enqueueFeedRefresh: async () => notImplemented('QueuePort.enqueueFeedRefresh'),
      enqueueOpmlImport: async () => notImplemented('QueuePort.enqueueOpmlImport')
    },
    opmlParser: {
      parse: async () => notImplemented('OpmlParserPort.parse')
    }
  };
}
