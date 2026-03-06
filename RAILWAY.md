# Railway Deployment

This repo is ready for a basic Railway deployment with:

- one `api` service from `/rss-reader-api`
- one `feed-refresh` cron service from `/rss-reader-feed-refresh`
- one PostgreSQL service

This is suitable for development and early internal use. It is not yet production-grade because OPML imports and immediate background jobs still use an in-process queue.

## Current limitations

- feed refresh via cron is okay
- API hosting is okay
- in-process queueing is not durable across deploys/restarts
- the OPML import endpoint still expects an `uploadPath`, not multipart upload

## Services

### 1. API service

Create a Railway service from the GitHub repo and configure:

- Root Directory: `/rss-reader-api`
- Config as Code path: `/rss-reader-api/railway.toml`

Environment variables:

- `DATABASE_URL`: from the Railway PostgreSQL service
- `LOG_LEVEL`: `info`

The API exposes:

- healthcheck: `/health`

### 2. PostgreSQL service

Add Railway PostgreSQL to the same project.

Use Railway's provided `DATABASE_URL` for the API service.

### 3. Feed refresh cron service

Create a second service from the same GitHub repo and configure:

- Root Directory: `/rss-reader-feed-refresh`
- Config as Code path: `/rss-reader-feed-refresh/railway.toml`

Railway cron jobs run in UTC and should terminate as soon as the task finishes. The worker in this repo closes the Postgres pool and exits after one pass.

## Why the config path is explicit

Railway's monorepo docs note that config-as-code does not automatically follow the service root directory for isolated monorepos. Set the absolute config path in service settings.

## Initial database setup

After the PostgreSQL service is created, run the SQL files in this order:

1. `rss-reader-db/migrations/001_extensions_and_types.sql`
2. `rss-reader-db/migrations/002_core_tables.sql`
3. `rss-reader-db/migrations/003_triggers_and_views.sql`

Optional seed data:

1. `rss-reader-db/seeds/001_sample_data.sql`

## Recommended next improvement

Before public launch:

1. replace the in-process queue with Redis + BullMQ
2. add real file upload handling for OPML import
3. add a pre-deploy migration command or migration runner
