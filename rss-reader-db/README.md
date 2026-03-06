# RSS Reader Database Draft

This folder contains a PostgreSQL-first database starting point for the RSS reader MVP.

Files:
- `migrations/001_extensions_and_types.sql`: required extensions and enum types
- `migrations/002_core_tables.sql`: core tables and indexes
- `migrations/003_triggers_and_views.sql`: `updated_at` triggers and helper views
- `seeds/001_sample_data.sql`: sample data for local development
- `fixtures/001_reader_flow.sql`: deterministic fixture for reader list/read/save/search tests
- `fixtures/002_ingestion_and_failures.sql`: deterministic fixture for feed refresh, backoff, and import tests
- `queries/001_reader_api_queries.sql`: parameterized SQL for reader-facing endpoints
- `queries/002_worker_queries.sql`: parameterized SQL for polling, dedupe, and fanout paths

Apply order:

```sql
\i migrations/001_extensions_and_types.sql
\i migrations/002_core_tables.sql
\i migrations/003_triggers_and_views.sql
```

Seed a local database:

```sql
\i seeds/001_sample_data.sql
```

Use fixtures in disposable databases only. They start by truncating tables so tests can run from a known state.
