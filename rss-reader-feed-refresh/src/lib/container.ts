import { FeedHttpClient } from '../adapters/feedHttpClient.js';
import { InProcessQueue } from '../adapters/inProcessQueue.js';
import { OpmlFileParser } from '../adapters/opmlParser.js';
import { getPool } from './db.js';
import { createPostgresDependencies } from '../repositories/postgresRepositories.js';
import { createStubDependencies } from '../repositories/stubRepositories.js';
import { ArticleService } from '../services/articleService.js';
import { ExportService } from '../services/exportService.js';
import { FolderService } from '../services/folderService.js';
import { ImportService } from '../services/importService.js';
import { ReaderService } from '../services/readerService.js';
import { SearchService } from '../services/searchService.js';
import { SubscriptionService } from '../services/subscriptionService.js';
import { FeedRefreshWorkerService } from '../workers/feedRefreshWorkerService.js';
import { OpmlImportWorkerService } from '../services/opmlImportWorkerService.js';
import type { ServiceDependencies } from '../types/ports.js';

export interface AppServices {
  reader: ReaderService;
  folders: FolderService;
  subscriptions: SubscriptionService;
  articles: ArticleService;
  search: SearchService;
  imports: ImportService;
  exports: ExportService;
  feedRefreshWorker: FeedRefreshWorkerService;
  opmlImportWorker: OpmlImportWorkerService;
}

export function createDefaultDependencies(): ServiceDependencies {
  const queue = new InProcessQueue();
  const discovery = new FeedHttpClient();
  const pool = getPool();

  const baseDependencies: ServiceDependencies = {
    ...createStubDependencies(),
    discovery,
    feedFetch: discovery,
    queue,
    opmlParser: new OpmlFileParser()
  };

  if (!pool) {
    return baseDependencies;
  }

  return {
    ...baseDependencies,
    ...createPostgresDependencies(pool)
  };
}

export function createServices(dependencies: ServiceDependencies = createDefaultDependencies()): AppServices {
  const services: AppServices = {
    reader: new ReaderService(dependencies),
    folders: new FolderService(dependencies),
    subscriptions: new SubscriptionService(dependencies),
    articles: new ArticleService(dependencies),
    search: new SearchService(dependencies),
    imports: new ImportService(dependencies),
    exports: new ExportService(dependencies),
    feedRefreshWorker: new FeedRefreshWorkerService(dependencies),
    opmlImportWorker: new OpmlImportWorkerService(dependencies)
  };

  if (dependencies.queue instanceof InProcessQueue) {
    dependencies.queue.setProcessors({
      onFeedRefresh: async (feedId) => {
        await services.feedRefreshWorker.refreshFeed(feedId);
      },
      onOpmlImport: async (job) => {
        await services.opmlImportWorker.process(job);
      }
    });
  };

  return services;
}
