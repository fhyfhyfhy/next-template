---
paths:
  - "features/*/server/**"
  - "features/*/server.ts"
  - "app/api/**"
---

# Server data layer

A feature's `server/` directory holds its server-side data access: the queries and writes on the tables it owns and the business rules they enforce. Server Components, `generateMetadata`, `use cache` reads, Server Actions, Route Handlers, and background jobs started from `instrumentation.ts` call these functions directly. Code outside the feature reaches them through the feature's `server.ts` entry ([Feature public API](architecture.md#feature-public-api)). The Data demo's `features/demo-task/server/` and `features/demo-upload/server/` are the runnable reference ([demos.md](../../.agents/skills/next-data-flow/demos.md)).

Server code never requests the app's own Route Handlers: a prerender at build time has no server to answer, and at request time it adds a round trip (`node_modules/next/dist/docs/01-app/02-guides/backend-for-frontend.md`, Caveats). Route Handlers exist for the browser.

## Functions

- Guard every module with `import "server-only"`, except `migrations.mts` (below).
- Export one function per operation. Wrap reads in React `cache()`, so `generateMetadata` and the page share one query within a render.
- A Server Component or `generateMetadata` that reads uncached, per-request data awaits `connection()` from `next/server` before calling the data layer. At request time Next renders a route once more before the render it sends, and `cache()` deduplicates only within one render, so without `connection()` the query runs twice. Reads inside `use cache` need no `connection()` and must not call it. The task detail page (`app/[locale]/demos/(data)/tasks/[id]/page.tsx`) is the reference.
- Validate inputs inside the function: Route Handlers and Server Actions pass values that came from the browser. A Server Action may validate first with a translated schema to produce field messages, but the data layer stays authoritative.
- Writes that touch several rows run in one transaction. A function that another feature calls inside its transaction accepts that transaction as an optional executor parameter, as `attachUpload` in `features/demo-upload/server/uploads.ts` does.

## Results

- Map database rows to the feature's types in `types/` through one mapping function per resource. These are the same types that Route Handlers serialize and `fetchApi` validates in the browser, so they hold only JSON-native values: timestamps as epoch milliseconds, `null` rather than `undefined`, no `Date` or `bigint`. A server prefetch puts them in the browser cache through RSC serialization and a refetch through JSON; both must produce the same value.
- Wire names are the type's names: Route Handlers serialize the data layer's result without renaming or reshaping its fields. A list the data layer returns as an array goes out in the `{ items }` envelope that `lib/fetch.ts` expects of lists.

## Errors

- Reject a request that breaks a business rule with `DomainError` from `lib/domain-error.ts`: its HTTP status and a business code from the feature's `constants/error-codes.ts`, plus `param` and `params` when the UI needs them. Codes are unique across features; the first three digits are the status.
- Let the database enforce invariants it can, such as a unique name, and translate the constraint violation into the business code.
- Route Handlers turn a `DomainError` into the failure response that `lib/fetch.ts` parses. A Server Action returns the codes its caller recognizes as `{ ok: false, code }` and lets other errors throw ([Server Actions](data-fetching-api.md#server-actions)).

## Tables and migrations

- Get the connection from `createDb` in `lib/db.ts`, typed with the feature's own table interfaces in `server/tables.ts`. A feature reads and writes only its own tables; another feature's data comes through that feature's `server.ts` functions, never a join on its tables. Foreign keys across features still belong in the database.
- Each feature exports its migrations from `server/migrations.mts` as a `migrations` record. Names start with a timestamp, so the migrations of every feature on one database form a single ordered sequence. A runner script loads the file with Node's type stripping (`scripts/demo-backend/migrate.mjs` for the Demo database), so it imports only `kysely` and nothing relative or through `@/`. Never edit an applied migration; add a new one. Migrations go forward only.

## Tests

Test the data layer through the feature's `server.ts` entry against a real database, in `*.db.test.ts` files next to that entry; `pnpm demo:test` runs them for the Demo features. Check each read's result with its schema after a JSON round trip. Pure rules extracted into `utils/` are tested in `pnpm test`.

## Demo-only parts

`demoOperation` in `features/demo-task/server/demo-controls.ts` adds the fault lab's latency, injected faults, and call log around the Demo's operations, and `features/demo-task/server/lab.ts` holds the fault lab's control functions. Project data layers need neither.
