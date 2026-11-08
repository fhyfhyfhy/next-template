---
paths:
  - "features/*/server/**"
  - "features/*/server.ts"
  - "features/*/api/*-action.ts"
  - "app/api/**"
---

# Server data

Code that reads and writes data on the server: a feature's data layer and `use cache` reads in `server/`, its `server.ts` entry, the Server Actions in its `api/`, and the Route Handlers under `app/api/`.

## Data layer

A feature's `server/` directory holds its data access: its queries and writes and the business rules they enforce. Code outside the feature reaches it through the feature's `server.ts` entry.

- Guard every module here and the `server.ts` entry with `import "server-only"`, except the modules that load outside Next.js, such as the tests (below) and migrations ([Schema changes](data-setup.md#schema-changes)). ESLint's `data-flow/server-only` reports a module without it.
- Export one function per operation. Wrap reads in React `cache()`, so `generateMetadata` and the page share one query within a render.
- Validate inputs inside the function: Route Handlers and Server Actions pass values that came from the browser. The data layer has the final say, even when a Server Action has checked the same values first.
- Writes that touch several rows run in one transaction. A function that another feature calls inside its transaction accepts that transaction as an optional executor parameter, as `attachUpload` in [`features/upload/server/uploads.ts`](https://github.com/fhyfhyfhy/next-template/blob/main/features/upload/server/uploads.ts) does.

## Results

- Map database rows to the feature's types in `types/` through one mapping function per resource.
- Their schemas describe JSON-native values only: timestamps as epoch milliseconds, `.nullable()` rather than `.optional()`, and no `.transform()`, `z.date()`, or `z.bigint()`. Server-prefetched data reaches the browser through RSC and refetched data through JSON; both must produce the same value.
- Wire names are the type's names: Route Handlers serialize the data layer's result without renaming or reshaping its fields. A list the data layer returns as an array goes out in the `{ items }` envelope that `lib/fetch.ts` expects of lists.

## Errors

- Reject a request that breaks a business rule with `DomainError` in `lib/domain-error.ts`: its HTTP status and a business code from the feature's `constants/error-codes.ts`, plus `param` and `params` when the UI needs them. Codes are unique across features; the first three digits are the status.
- Let the database enforce invariants it can, such as a unique name, and translate the constraint violation into the business code.
- Route Handlers turn a `DomainError` into the failure response that `lib/fetch.ts` parses. A Server Action returns or throws it ("Server Actions" below).

## Server Actions

Every write from the browser goes through a Server Action, including writes whose data React Query owns. Put each action in its own top-level `"use server"` module in `api/`, named `<verb>-<resource>-action.ts`, such as [`features/task/api/create-task-action.ts`](https://github.com/fhyfhyfhy/next-template/blob/main/features/task/api/create-task-action.ts). Its runtime exports are only async Server Actions; validation helpers used only by that action may stay private there.

- The action validates its inputs, with a translated schema when the form shows field messages, authorizes the write, and calls the data layer.
- An action whose caller handles some of the data layer's `DomainError`s returns an `ActionResult` through `toActionResult`, both in `lib/action-result.ts`, which turns those into `{ ok: false, error }`, `error` being the `ApiErrorObject` in `lib/fetch.ts`, which a failed Route Handler response carries too: a thrown error loses its code on the way to the browser. An action without such failures returns its data, or nothing. Both let other errors throw. Its options factory unwraps the result ([Mutations](tanstack-query.md#mutations)).
- When other callers need the same input schema, extract it to a sibling such as [`features/task/api/create-task-schema.ts`](https://github.com/fhyfhyfhy/next-template/blob/main/features/task/api/create-task-schema.ts); the action must not import the options factory that calls it.
- Expose actions needed outside the feature through the main entry `index.ts`, which Client Components can import: the `"use server"` directive in the action's own module turns the export into an action reference, whichever entry re-exports it.

## Writes from other systems

A write another system sends, such as a webhook delivery, comes through a Route Handler under `app/api/`: a Server Action has no stable endpoint for it to call.

- Authenticate the request as the sender's docs specify before acting on its body.
- The displays it changes refresh as [Changes made elsewhere](../../.agents/skills/next-data-flow/refresh.md#changes-made-elsewhere) says; `updateTag` works only in Server Actions.

Test that the handler applies an authenticated request and refuses an unauthenticated one without writing.

## Cached reads

A server read cached with `use cache` wraps the data-layer read in its own module in `server/` guarded by `import "server-only"`, one cached read per file, named `get-cached-<resource>.ts` after the function it exports, such as `getCachedTaskPage` in [`features/task/server/get-cached-task-page.ts`](https://github.com/fhyfhyfhy/next-template/blob/main/features/task/server/get-cached-task-page.ts) wrapping `listTasks` in [`features/task/server/tasks.ts`](https://github.com/fhyfhyfhy/next-template/blob/main/features/task/server/tasks.ts): `use cache` functions cannot enter a client bundle. Code outside the feature imports it from the feature's `server.ts` entry.

## Tests

Test each module in `server/` against a real database, in a `*.db.test.ts` file beside it, such as [`features/task/server/tasks.db.test.ts`](https://github.com/fhyfhyfhy/next-template/blob/main/features/task/server/tasks.db.test.ts) for `tasks.ts`. `pnpm test` runs them in its `db` project, against the database in [Test databases](data-setup.md#test-databases). Check each read's result with its schema after a JSON round trip. Pure rules extracted into `utils/` get plain unit tests, without the database.
