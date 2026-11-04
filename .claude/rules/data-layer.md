---
paths:
  - "features/*/server/**"
  - "features/*/server.ts"
  - "app/api/**"
---

# Server data layer

A feature's `server/` directory holds its server-side data access: the queries and writes on the tables it owns and the business rules they enforce. Server code calls it directly, as [Transport](data-fetching.md#transport) describes; code outside the feature reaches it through the feature's `server.ts` entry ([Feature public API](architecture.md#feature-public-api)). The Data demo's `features/demo-task/server/` and `features/demo-upload/server/` are the runnable reference ([demos.md](../../.agents/skills/next-data-flow/demos.md)).

## Functions

- Guard every module here and the `server.ts` entry with `import "server-only"`, except `migrations.mts` (below).
- Export one function per operation. Wrap reads in React `cache()`, so `generateMetadata` and the page share one query within a render.
- Validate inputs inside the function: Route Handlers and Server Actions pass values that came from the browser. The data layer has the final say, even when a Server Action has checked the same values first.
- Writes that touch several rows run in one transaction. A function that another feature calls inside its transaction accepts that transaction as an optional executor parameter, as `attachUpload` in `features/demo-upload/server/uploads.ts` does.

## Results

- Map database rows to the feature's types in `types/` through one mapping function per resource. Their schemas allow only JSON-native values ([Requests](api-modules.md#requests)), so the mapping turns timestamps into epoch milliseconds and missing values into `null`.
- Wire names are the type's names: Route Handlers serialize the data layer's result without renaming or reshaping its fields. A list the data layer returns as an array goes out in the `{ items }` envelope that `lib/fetch.ts` expects of lists.

## Errors

- Reject a request that breaks a business rule with `DomainError` from `lib/domain-error.ts`: its HTTP status and a business code from the feature's `constants/error-codes.ts`, plus `param` and `params` when the UI needs them. Codes are unique across features; the first three digits are the status.
- Let the database enforce invariants it can, such as a unique name, and translate the constraint violation into the business code.
- Route Handlers turn a `DomainError` into the failure response that `lib/fetch.ts` parses. A Server Action returns or throws it as [Server Actions](api-modules.md#server-actions) describes.

## Tables and migrations

- Get the connection from `createDb` in `lib/db.ts`, typed with the feature's own table interfaces in `server/tables.ts`. A feature reads and writes only its own tables; another feature's data comes through that feature's `server.ts` functions, never a join on its tables. Foreign keys across features still belong in the database.
- Each feature exports its migrations from `server/migrations.mts` as a `migrations` record. Names start with a timestamp, so the migrations of every feature on one database form a single ordered sequence. A runner script loads the file with Node's type stripping (`scripts/demo-backend/migrate.mjs` for the Demo database), so it imports only `kysely` and nothing relative or through `@/`. Never edit an applied migration; add a new one. Migrations go forward only.

## Tests

Test the data layer through the feature's `server.ts` entry against a real database, in `*.db.test.ts` files next to that entry; `pnpm demo:test` runs them for the Demo features. Check each read's result with its schema after a JSON round trip. Pure rules extracted into `utils/` are tested in `pnpm test`.

## Demo-only parts

`demoOperation` in `features/demo-task/server/demo-controls.ts` adds the fault lab's latency, injected faults, and call log around the Demo's operations, and `features/demo-task/server/lab.ts` holds the fault lab's control functions. Project data layers need neither.
