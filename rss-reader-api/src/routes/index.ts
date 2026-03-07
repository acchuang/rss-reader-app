import type { FastifyInstance } from 'fastify';

import type { AppServices } from '../lib/container.js';
import { requireUserId } from '../lib/auth.js';
import { articleParamsSchema, articleListQuerySchema, bulkMarkReadSchema, createFolderSchema, createOpmlImportSchema, createSubscriptionSchema, folderParamsSchema, importStatusParamsSchema, searchQuerySchema, subscriptionParamsSchema, updateFolderSchema, updateSubscriptionSchema } from '../validation/schemas.js';

export async function registerRoutes(app: FastifyInstance, services: AppServices): Promise<void> {
  app.get('/health', async () => ({ ok: true }));

  app.get('/api/sidebar', async (request) => {
    const userId = requireUserId(request);
    return services.reader.getSidebar(userId);
  });

  app.get('/api/folders', async (request) => {
    const userId = requireUserId(request);
    return services.folders.list(userId);
  });

  app.post('/api/folders', async (request) => {
    const userId = requireUserId(request);
    const body = createFolderSchema.parse(request.body);
    return services.folders.create(userId, body);
  });

  app.patch('/api/folders/:folderId', async (request) => {
    const userId = requireUserId(request);
    const params = folderParamsSchema.parse(request.params);
    const body = updateFolderSchema.parse(request.body);
    return services.folders.rename(userId, params.folderId, body);
  });

  app.delete('/api/folders/:folderId', async (request) => {
    const userId = requireUserId(request);
    const params = folderParamsSchema.parse(request.params);
    return services.folders.delete(userId, params.folderId);
  });

  app.get('/api/subscriptions', async (request) => {
    const userId = requireUserId(request);
    return services.subscriptions.list(userId);
  });

  app.post('/api/subscriptions', async (request) => {
    const userId = requireUserId(request);
    const body = createSubscriptionSchema.parse(request.body);
    return services.subscriptions.create(userId, body);
  });

  app.patch('/api/subscriptions/:subscriptionId', async (request) => {
    const userId = requireUserId(request);
    const params = subscriptionParamsSchema.parse(request.params);
    const body = updateSubscriptionSchema.parse(request.body);
    return services.subscriptions.update(userId, params.subscriptionId, body);
  });

  app.delete('/api/subscriptions/:subscriptionId', async (request) => {
    const userId = requireUserId(request);
    const params = subscriptionParamsSchema.parse(request.params);
    return services.subscriptions.delete(userId, params.subscriptionId);
  });

  app.post('/api/subscriptions/:subscriptionId/refresh', async (request) => {
    const userId = requireUserId(request);
    const params = subscriptionParamsSchema.parse(request.params);
    const subscription = await services.subscriptions.getById(userId, params.subscriptionId);
    const result = await services.feedRefreshWorker.refreshFeed(subscription.feed.id);

    return {
      refreshed: true,
      subscriptionId: subscription.id,
      ...result
    };
  });

  app.get('/api/articles', async (request) => {
    const userId = requireUserId(request);
    const query = articleListQuerySchema.parse(request.query);

    const cursor = query.view === 'saved'
      ? (query.cursorSavedAt && query.cursorArticleId
          ? { savedAt: query.cursorSavedAt, articleId: query.cursorArticleId }
          : null)
      : (query.cursorPublishedAt && query.cursorArticleId
          ? { publishedAt: query.cursorPublishedAt, articleId: query.cursorArticleId }
          : null);

    return services.articles.list(userId, {
      view: query.view,
      folderId: query.folderId,
      subscriptionId: query.subscriptionId,
      limit: query.limit,
      cursor
    });
  });

  app.get('/api/articles/:articleId', async (request) => {
    const userId = requireUserId(request);
    const params = articleParamsSchema.parse(request.params);
    return services.articles.getDetail(userId, params.articleId);
  });

  app.post('/api/articles/:articleId/read', async (request) => {
    const userId = requireUserId(request);
    const params = articleParamsSchema.parse(request.params);
    return services.articles.markRead(userId, params.articleId);
  });

  app.post('/api/articles/:articleId/unread', async (request) => {
    const userId = requireUserId(request);
    const params = articleParamsSchema.parse(request.params);
    return services.articles.markUnread(userId, params.articleId);
  });

  app.post('/api/articles/:articleId/save', async (request) => {
    const userId = requireUserId(request);
    const params = articleParamsSchema.parse(request.params);
    return services.articles.save(userId, params.articleId);
  });

  app.post('/api/articles/:articleId/unsave', async (request) => {
    const userId = requireUserId(request);
    const params = articleParamsSchema.parse(request.params);
    return services.articles.unsave(userId, params.articleId);
  });

  app.post('/api/articles/bulk-mark-read', async (request) => {
    const userId = requireUserId(request);
    const body = bulkMarkReadSchema.parse(request.body);
    return services.articles.bulkMarkRead(userId, body.articleIds);
  });

  app.get('/api/search', async (request) => {
    const userId = requireUserId(request);
    const query = searchQuerySchema.parse(request.query);
    const cursor = query.cursorRank !== undefined && query.cursorArticleId
      ? { rank: query.cursorRank, articleId: query.cursorArticleId }
      : null;

    return services.search.search(userId, {
      query: query.q,
      limit: query.limit,
      cursor
    });
  });

  app.post('/api/imports/opml', async (request) => {
    const userId = requireUserId(request);
    const body = createOpmlImportSchema.parse(request.body);
    return services.imports.createOpmlImport(userId, {
      uploadPath: body.uploadPath,
      opmlContent: body.opmlContent
    });
  });

  app.get('/api/imports/:importId', async (request) => {
    const userId = requireUserId(request);
    const params = importStatusParamsSchema.parse(request.params);
    return services.imports.getStatus(userId, params.importId);
  });

  app.get('/api/exports/opml', async (request, reply) => {
    const userId = requireUserId(request);
    const xml = await services.exports.getOpml(userId);
    reply.header('content-type', 'application/xml; charset=utf-8');
    return reply.send(xml);
  });
}
