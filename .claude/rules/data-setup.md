---
paths:
  - "features/*/server/**"
  - "features/*/server.ts"
  - "lib/db.ts"
  - "scripts/db/**"
  - "scripts/local-services/**"
---

# Data setup

Where this project's data lives: the database server code connects to, who owns its tables, how its schema changes, and the databases the tests run against. The conventions that hold whatever the setup are in [server-data.md](server-data.md).

A project made from this template whose data lives elsewhere replaces this file whole with its own setup, keeping the headings other files link to; `scripts/docs-links.test.mjs` fails when one goes missing.

## Connection

Get the connection from `getDb` in `lib/db.ts`, typed with the feature's own table interfaces in `server/tables.ts`.

## Table ownership

A feature reads and writes only its own tables; another feature's data comes through that feature's `server.ts` functions, never a join on its tables. Foreign keys across features still belong in the database.

## Schema changes

Each feature exports its migrations from `server/migrations.mts` as a `migrations` record. Names start with a timestamp, so the migrations of every feature on one database form a single ordered sequence. `scripts/db/migrate.mjs` finds every feature's file and loads it outside Next.js with Node's type stripping, so it imports only `kysely`: no `server-only`, and nothing relative or through `@/`. Never edit an applied migration; add a new one. Migrations go forward only.

## Test databases

The `db` project of `pnpm test` runs against the `test` dataset on the local services, real Postgres and object storage, restored to the seed data before each test (`vitest.config.mts`). `pnpm test:e2e` runs against the `e2e` dataset ([Test data](e2e.md#test-data)).
