# RSS Reader Feed Refresh Worker

Cron-oriented worker service for refreshing RSS feeds on Railway.

This folder is intentionally a deployable sibling of `rss-reader-api` so Railway can run it with a different start command and cron schedule.

The database design and SQL query pack live in:

- `/Users/acchuang/Project/rss-reader-db/migrations`
- `/Users/acchuang/Project/rss-reader-db/queries`

The backend planning docs live in:

- `/Users/acchuang/Project/rss-reader-backend-spec`

## Run

```bash
npm install
npm run worker:feed-refresh
```
