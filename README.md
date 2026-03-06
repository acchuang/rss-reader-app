# RSS Reader App

This repository contains the planning and backend foundation for an RSS reader webapp similar to Feedly.

Contents:

- `rss-reader-api`: Fastify + TypeScript backend with PostgreSQL repository adapters
- `rss-reader-feed-refresh`: deployable Railway cron worker for feed refresh jobs
- `rss-reader-db`: PostgreSQL schema, migrations, seeds, fixtures, and query pack
- `rss-reader-backend-spec`: API contracts, route map, service flows, and worker flows
- `RAILWAY.md`: Railway deployment notes for this repo

Suggested starting point:

1. apply the database migrations in `rss-reader-db`
2. configure `DATABASE_URL` for `rss-reader-api`
3. replace the in-process queue with a durable job queue
4. add a frontend app against the existing API surface

Deployment notes for Railway are in `RAILWAY.md`.
