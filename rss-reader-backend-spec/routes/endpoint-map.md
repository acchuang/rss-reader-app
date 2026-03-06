# Endpoint Map

This file maps each endpoint to:

- auth requirement
- request/response contract
- primary service
- repository/query dependencies
- expected error cases

The SQL references below map to `/Users/acchuang/Project/rss-reader-db/queries`.

## Auth and Request Context

Every non-auth endpoint requires:

- authenticated `userId`
- parsed request id for logging
- validated request body/query params

Handler template:

1. read auth context
2. validate request
3. call a single service method
4. map domain errors to API errors
5. return typed DTO

## `GET /api/sidebar`

- Auth: required
- Service: `ReaderService.getSidebar(userId)`
- Queries:
  - `001_reader_api_queries.sql`: sidebar counts summary
  - `001_reader_api_queries.sql`: folder unread counts
  - `001_reader_api_queries.sql`: feed unread counts
- Response: `SidebarSummary`
- Errors:
  - `401 UNAUTHORIZED`
  - `500 INTERNAL_ERROR`

Handler notes:
- This can be one service call backed by one repository method.
- Cache briefly if sidebar counts become expensive.

## `GET /api/folders`

- Auth: required
- Service: `FolderService.list(userId)`
- Repository: `FolderRepository.listByUser`
- Response: `FolderDto[]`

## `POST /api/folders`

- Auth: required
- Body: `CreateFolderRequest`
- Service: `FolderService.create(userId, input)`
- Repository: `FolderRepository.create`
- Response: `FolderDto`
- Errors:
  - `409 CONFLICT` if duplicate folder name for the same user
  - `422 VALIDATION_ERROR` if name is empty or too long

## `PATCH /api/folders/:folderId`

- Auth: required
- Body: `UpdateFolderRequest`
- Service: `FolderService.rename(userId, folderId, input)`
- Repository: `FolderRepository.rename`
- Response: `FolderDto`
- Errors:
  - `404 NOT_FOUND`
  - `409 CONFLICT`

## `DELETE /api/folders/:folderId`

- Auth: required
- Service: `FolderService.delete(userId, folderId)`
- Repository:
  - clear subscription folder ids
  - delete folder
- Response:

```json
{ "deleted": true }
```

- Errors:
  - `404 NOT_FOUND`

## `GET /api/subscriptions`

- Auth: required
- Service: `SubscriptionService.list(userId)`
- Repository: `SubscriptionRepository.listByUser`
- Response: `SubscriptionDto[]`

## `POST /api/subscriptions`

- Auth: required
- Body: `CreateSubscriptionRequest`
- Service: `SubscriptionService.create(userId, input)`
- Dependencies:
  - `FeedDiscoveryPort.discover`
  - `FeedRepository.upsertValidatedFeed`
  - `SubscriptionRepository.upsertFromValidatedFeed`
  - `QueuePort.enqueueFeedRefresh`
- Response: `SubscriptionDto`
- Errors:
  - `409 CONFLICT` when user already has the subscription and no update is needed
  - `422 INVALID_FEED` when discovery/parsing rejects the URL
  - `503 UPSTREAM_UNAVAILABLE` when feed/site fetch fails transiently

Handler notes:
- Accept either a direct feed URL or a site URL.
- Service owns URL normalization and duplicate handling semantics.

## `PATCH /api/subscriptions/:subscriptionId`

- Auth: required
- Body: `UpdateSubscriptionRequest`
- Service: `SubscriptionService.update(userId, subscriptionId, input)`
- Repository: `SubscriptionRepository.update`
- Response: `SubscriptionDto`
- Errors:
  - `404 NOT_FOUND`
  - `422 VALIDATION_ERROR`

## `DELETE /api/subscriptions/:subscriptionId`

- Auth: required
- Service: `SubscriptionService.delete(userId, subscriptionId)`
- Repository: `SubscriptionRepository.delete`
- Response:

```json
{ "deleted": true }
```

- Errors:
  - `404 NOT_FOUND`

## `GET /api/articles`

- Auth: required
- Query:
  - `view=unread|saved|recent|all`
  - optional `folderId`
  - optional `subscriptionId`
  - optional `limit`
  - optional cursor fields
- Service: `ArticleService.list(userId, input)`
- Repository:
  - unread list query
  - saved list query
  - folder list query
  - subscription list query
- Response: `CursorPage<..., ArticleListItemDto>`
- Errors:
  - `422 VALIDATION_ERROR`

Handler notes:
- The service should reject conflicting filters such as both `folderId` and `subscriptionId`.
- `recent` and `all` can share the same query shape with `onlyUnread = false`.

## `GET /api/articles/:articleId`

- Auth: required
- Service: `ArticleService.getDetail(userId, articleId)`
- Repository: `ArticleRepository.getDetail`
- Response: `ArticleDetailDto`
- Errors:
  - `404 NOT_FOUND`

## `POST /api/articles/:articleId/read`

- Auth: required
- Service: `ArticleService.markRead(userId, articleId)`
- Repository: `ArticleRepository.markRead`
- Response: `ArticleStateMutationResponse`
- Errors:
  - `404 NOT_FOUND`

## `POST /api/articles/:articleId/unread`

- Auth: required
- Service: `ArticleService.markUnread(userId, articleId)`
- Repository: `ArticleRepository.markUnread`
- Response: `ArticleStateMutationResponse`
- Errors:
  - `404 NOT_FOUND`

## `POST /api/articles/:articleId/save`

- Auth: required
- Service: `ArticleService.save(userId, articleId)`
- Repository: `ArticleRepository.save`
- Response: `ArticleStateMutationResponse`
- Errors:
  - `404 NOT_FOUND`

## `POST /api/articles/:articleId/unsave`

- Auth: required
- Service: `ArticleService.unsave(userId, articleId)`
- Repository: `ArticleRepository.unsave`
- Response: `ArticleStateMutationResponse`
- Errors:
  - `404 NOT_FOUND`

## `POST /api/articles/bulk-mark-read`

- Auth: required
- Body: `BulkMarkReadRequest`
- Service: `ArticleService.bulkMarkRead(userId, input)`
- Repository: `ArticleRepository.bulkMarkRead`
- Response:

```json
{ "articleIds": ["uuid"] }
```

- Errors:
  - `422 VALIDATION_ERROR`

Handler notes:
- Keep MVP behavior explicit by requiring article ids instead of a broad filter mutation.

## `GET /api/search`

- Auth: required
- Query:
  - `q`
  - `limit`
  - optional search cursor
- Service: `SearchService.search(userId, query, pagination)`
- Repository: `ArticleRepository.search`
- Response: `CursorPage<SearchCursor, ArticleListItemDto>`
- Errors:
  - `422 VALIDATION_ERROR`

## `POST /api/imports/opml`

- Auth: required
- Input: multipart file upload or a pre-staged storage key
- Service: `ImportService.createOpmlImport(userId, upload)`
- Dependencies:
  - `ImportRepository.create`
  - `QueuePort.enqueueOpmlImport`
- Response: `ImportOpmlResponse`
- Errors:
  - `422 VALIDATION_ERROR`
  - `429 RATE_LIMITED`

Handler notes:
- Keep HTTP handling thin. Parsing the OPML should happen in the worker.

## `GET /api/imports/:importId`

- Auth: required
- Service: `ImportService.getStatus(userId, importId)`
- Repository: `ImportRepository`
- Response: `ImportStatusDto`
- Errors:
  - `404 NOT_FOUND`

## `GET /api/exports/opml`

- Auth: required
- Service: `ExportService.getOpml(userId)`
- Repository: `SubscriptionRepository.listExportRows`
- Response: XML document
- Errors:
  - `500 INTERNAL_ERROR`

Handler notes:
- Generate OPML in the handler or a small serializer module from `ExportFeedRow[]`.
