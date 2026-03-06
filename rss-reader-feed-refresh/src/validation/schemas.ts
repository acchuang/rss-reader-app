import { z } from 'zod';

const uuidSchema = z.string().uuid();

export const folderParamsSchema = z.object({
  folderId: uuidSchema
});

export const createFolderSchema = z.object({
  name: z.string().trim().min(1).max(80)
});

export const updateFolderSchema = createFolderSchema;

export const subscriptionParamsSchema = z.object({
  subscriptionId: uuidSchema
});

export const createSubscriptionSchema = z.object({
  url: z.string().trim().url(),
  folderId: uuidSchema.nullish(),
  titleOverride: z.string().trim().min(1).max(120).nullish()
});

export const updateSubscriptionSchema = z.object({
  folderId: uuidSchema.nullish(),
  titleOverride: z.string().trim().min(1).max(120).nullish()
});

export const articleParamsSchema = z.object({
  articleId: uuidSchema
});

export const articleListQuerySchema = z.object({
  view: z.enum(['unread', 'saved', 'recent', 'all']).default('unread'),
  folderId: uuidSchema.optional(),
  subscriptionId: uuidSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  cursorPublishedAt: z.string().datetime().optional(),
  cursorSavedAt: z.string().datetime().optional(),
  cursorRank: z.coerce.number().optional(),
  cursorArticleId: uuidSchema.optional()
});

export const bulkMarkReadSchema = z.object({
  articleIds: z.array(uuidSchema).min(1).max(500)
});

export const searchQuerySchema = z.object({
  q: z.string().trim().min(1).max(200),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  cursorRank: z.coerce.number().optional(),
  cursorArticleId: uuidSchema.optional()
});

export const importStatusParamsSchema = z.object({
  importId: uuidSchema
});
