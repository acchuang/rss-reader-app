# Service Flows

## Service Boundaries

Recommended services:

- `ReaderService`
- `FolderService`
- `SubscriptionService`
- `ArticleService`
- `SearchService`
- `ImportService`
- `ExportService`
- `FeedRefreshService`

Rules:

- Handlers only validate input, call one service, and map errors.
- Services enforce business rules and orchestration.
- Repositories stay close to SQL and do not contain workflow logic.
- Workers call the same services where possible instead of duplicating business rules.

## `ReaderService`

Responsibilities:

- assemble sidebar payload
- keep reader home screen data fetches coherent

Method:

- `getSidebar(userId)`

Flow:

1. call `SidebarRepository.getSummary`
2. return `SidebarSummary`

## `FolderService`

Responsibilities:

- create, rename, delete folders
- enforce per-user naming rules

### `create(userId, input)`

1. trim and validate folder name
2. call `FolderRepository.create`
3. map unique-constraint violation to `CONFLICT`

### `rename(userId, folderId, input)`

1. validate input
2. call `FolderRepository.rename`
3. if null, raise `NOT_FOUND`
4. map unique-constraint violation to `CONFLICT`

### `delete(userId, folderId)`

1. call repository delete sequence
2. if nothing deleted, raise `NOT_FOUND`
3. return `{ deleted: true }`

## `SubscriptionService`

Responsibilities:

- normalize feed-add input
- discover and validate feeds
- avoid duplicate subscriptions
- enqueue initial refresh

### `list(userId)`

1. call `SubscriptionRepository.listByUser`
2. return rows

### `create(userId, input)`

1. validate URL shape
2. call `FeedDiscoveryPort.discover`
3. map discovery result:
   - `not_found` -> `INVALID_FEED`
   - `invalid` -> `INVALID_FEED`
   - `unavailable` -> `UPSTREAM_UNAVAILABLE`
4. call `FeedRepository.upsertValidatedFeed`
5. call `SubscriptionRepository.upsertFromValidatedFeed`
6. enqueue `feedRefresh(feedId)`
7. return `SubscriptionDto`

Notes:

- Duplicate subscription behavior should be explicit. Recommended: return existing subscription when the same feed already exists and a folder/title update was requested; otherwise raise `CONFLICT`.

### `update(userId, subscriptionId, input)`

1. validate folder/titleOverride fields
2. call `SubscriptionRepository.update`
3. if null, raise `NOT_FOUND`
4. return updated subscription

### `delete(userId, subscriptionId)`

1. call `SubscriptionRepository.delete`
2. if not deleted, raise `NOT_FOUND`
3. return `{ deleted: true }`

## `ArticleService`

Responsibilities:

- article list dispatch by filter mode
- state mutations
- cursor normalization

### `list(userId, input)`

1. validate that only one scope is present:
   - none
   - `folderId`
   - `subscriptionId`
2. normalize `limit` with sane bounds
3. choose repository call:
   - `view=unread` + no scope -> `listUnread`
   - `view=saved` -> `listSaved`
   - scope + unread/all -> scoped query with `onlyUnread`
   - `view=recent|all` with no scope -> use unread query variant with `onlyUnread = false` in a repo implementation
4. derive next cursor from the last item
5. return `CursorPage`

### `getDetail(userId, articleId)`

1. call `ArticleRepository.getDetail`
2. if null, raise `NOT_FOUND`
3. return detail

### `markRead`, `markUnread`, `save`, `unsave`

1. call repository mutation
2. if null, raise `NOT_FOUND`
3. return current state

### `bulkMarkRead(userId, input)`

1. validate ids are non-empty and below batch limit
2. call repository bulk mutation
3. return updated ids

## `SearchService`

Responsibilities:

- validate query text
- enforce search pagination

### `search(userId, query, pagination)`

1. trim query
2. reject empty query
3. call `ArticleRepository.search`
4. derive next cursor from the last item rank/id pair
5. return paged results

## `ImportService`

Responsibilities:

- create and track async OPML imports
- expose status lookup

### `createOpmlImport(userId, upload)`

1. validate upload type and size
2. persist upload to temp/object storage
3. call `ImportRepository.create`
4. enqueue `opmlImport(importId, userId, uploadPath)`
5. return import id/status

### `getStatus(userId, importId)`

1. fetch import row
2. if absent, raise `NOT_FOUND`
3. return status

## `ExportService`

Responsibilities:

- serialize current subscriptions as valid OPML

### `getOpml(userId)`

1. call `SubscriptionRepository.listExportRows`
2. group rows by folder name
3. serialize OPML XML
4. return with `application/xml`

## `FeedRefreshService`

Responsibilities:

- own worker-side refresh outcome rules
- centralize dedupe and fanout

### `refreshNextDueFeed()`

1. claim one due feed row with locking
2. fetch XML with ETag/Last-Modified
3. if `304`, update poll metadata and log `not_modified`
4. if fetch fails, compute new status/backoff, update feed, log failure
5. parse entries
6. for each entry:
   - normalize fields
   - dedupe by guid or canonical URL
   - insert article if new
   - fan out to subscribers
7. mark feed success and next poll time
8. log success

Domain rules:

- worker computes backoff and next poll timestamp
- dedupe prefers `guid`, then canonical URL
- fanout is idempotent through `on conflict do nothing`
