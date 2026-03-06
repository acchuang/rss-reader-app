# RSS Reader Backend Scaffolding

This folder is a backend implementation guide for the RSS reader MVP. It assumes:

- PostgreSQL schema from `/Users/acchuang/Project/rss-reader-db/migrations`
- SQL query pack from `/Users/acchuang/Project/rss-reader-db/queries`
- a TypeScript backend with HTTP handlers, service layer, repository layer, and worker jobs

Suggested app layout in a real repo:

```text
src/
  app.ts
  auth/
  routes/
    auth.routes.ts
    folders.routes.ts
    subscriptions.routes.ts
    articles.routes.ts
    search.routes.ts
    imports.routes.ts
    exports.routes.ts
    sidebar.routes.ts
  handlers/
  services/
  repositories/
  workers/
  validation/
  lib/
```

Files here:

- `contracts/api-contracts.ts`: request/response DTOs
- `contracts/repository-contracts.ts`: repository and service port interfaces
- `routes/endpoint-map.md`: endpoint-by-endpoint handler scaffold
- `services/service-flows.md`: service-layer responsibilities and call flows
- `workers/worker-flows.md`: scheduler, refresh, dedupe, and import worker flows

Recommended implementation order:

1. Implement auth and request context
2. Implement repositories against the SQL query pack
3. Implement services
4. Implement HTTP handlers
5. Implement worker jobs and queue wiring

This scaffold is framework-agnostic on purpose. It is concrete enough to map into Fastify, NestJS, Express, or Next.js route handlers.
