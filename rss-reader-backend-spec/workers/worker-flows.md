# Worker Flows

## Queues

Recommended queues:

- `feed-validate` if validation is async
- `feed-refresh`
- `opml-import`

For MVP, direct feed validation in the request path is acceptable. Feed refresh and OPML import should still be async.

## `feed-refresh` Job

Input:

```json
{ "feedId": "uuid" }
```

Two valid operating modes:

1. targeted refresh by known `feedId`
2. scheduler-driven claim of the next due feed

Recommended worker shape:

- `FeedRefreshWorker.runOnce()`
- `FeedRefreshWorker.runLoop()`

### Targeted refresh flow

1. load feed metadata
2. fetch with conditional headers
3. dispatch to `FeedRefreshService`
4. write operational log row

### Scheduled refresh flow

1. run due-feed claim query
2. if no row is returned, exit
3. refresh claimed feed

## `opml-import` Job

Input:

```json
{
  "importId": "uuid",
  "userId": "uuid",
  "uploadPath": "/tmp/file.opml"
}
```

Flow:

1. mark import `processing`
2. parse OPML
3. count total feed urls
4. for each entry:
   - derive folder name
   - create folder if missing
   - run feed discovery/validation
   - upsert feed
   - upsert subscription
5. accumulate:
   - `feedsAdded`
   - skipped duplicates
   - invalid feeds
6. mark import `completed`
7. if fatal parse/storage failure occurs, mark import `failed`

Notes:

- Partial success is expected and should not fail the entire import.
- The final `errorMessage` can hold a compact summary such as `2 invalid feeds skipped`.

## Backoff Rules

Suggested policy:

- `0 failures`: next poll in 30 minutes, `active`
- `1-2 failures`: next poll in 2 hours, `degraded`
- `3+ failures`: next poll in 6-24 hours, `failing`
- repeated permanent parse errors: allow manual disable path later

The worker should compute:

- next poll timestamp
- next feed status
- log outcome

## Repository Expectations for Workers

Required repository methods in a real implementation:

- `claimNextDueFeed()`
- `markRefreshSuccess()`
- `markNotModified()`
- `markRefreshFailure()`
- `appendFetchLog()`
- `findArticleByGuid()`
- `findArticleByCanonicalUrl()`
- `insertArticle()`
- `fanOutArticle()`
- `rebuildFanoutForFeed()`

These map directly to `/Users/acchuang/Project/rss-reader-db/queries/002_worker_queries.sql`.
