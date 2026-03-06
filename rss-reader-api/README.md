# RSS Reader API Skeleton

Fastify + TypeScript backend skeleton for the RSS reader MVP.

This project is intentionally wired as an application skeleton:

- HTTP routes are implemented
- validation and error handling are implemented
- service boundaries are implemented
- PostgreSQL-backed repository adapters are implemented
- external infrastructure ports are defined
- worker entrypoints exist

The database design and SQL query pack live in:

- `/Users/acchuang/Project/rss-reader-db/migrations`
- `/Users/acchuang/Project/rss-reader-db/queries`

The backend planning docs live in:

- `/Users/acchuang/Project/rss-reader-backend-spec`

## Run

```bash
npm install
npm run dev
```

Current auth assumption for local scaffolding:

- send `x-user-id: <uuid>` on authenticated requests

Repository behavior:

- if `DATABASE_URL` is set, the app uses PostgreSQL-backed repositories from `src/repositories/postgresRepositories.ts`
- if `DATABASE_URL` is not set, the app falls back to stub adapters and returns `NOT_IMPLEMENTED` for unimplemented infrastructure paths

## Next implementation step

Implement the remaining infrastructure adapters:

- feed discovery/fetching
- queue enqueueing and worker runtime
- OPML parsing and upload storage
