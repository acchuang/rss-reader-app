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

- send `Authorization: Bearer <uuid>` on authenticated requests
- `x-user-id: <uuid>` is also accepted for local testing
- `?userId=<uuid>` is available as a last-resort demo fallback
- `DEMO_USER_ID` can be set in deployment environments to force a seeded demo account

Repository behavior:

- if `DATABASE_URL` is set, the app uses PostgreSQL-backed repositories from `src/repositories/postgresRepositories.ts`
- if `DATABASE_URL` is not set, the app falls back to stub adapters and returns `NOT_IMPLEMENTED` for unimplemented infrastructure paths

## Next implementation step

Implement the remaining infrastructure adapters:

- feed discovery/fetching
- queue enqueueing and worker runtime
- OPML parsing and upload storage
