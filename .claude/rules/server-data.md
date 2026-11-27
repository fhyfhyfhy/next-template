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

- Guard every module here and the `server.ts` entry with `import "server-only"`, except the modules that load outside Next.js, such as the tests (below) and migrations ([Schema changes](data-setup.md#schema-changes)).
- Export one function per operation. Wrap reads in React `cache()`, so `generateMetadata` and the page share one query within a render. `cache()` memoizes only during a server render, not in a background job or a test, and matches arguments by identity: callers share a read only when they pass the same primitives or the same object, such as one actor resolved once per request.
- Validate inputs inside the function: Route Handlers and Server Actions pass values that came from the browser. The data layer has the final say, even when a Server Action has checked the same values first. Parse them with `parseInput` in `lib/request/domain-error.ts`, which refuses a value its schema rejects with `badRequest`, naming the field at fault.
- Authorize inside the function too, for the same reason. A function whose result or effect depends on who asks takes that actor as a required argument and enforces the rule itself: a read returns only what the actor may see, and a write the actor may not make is rejected ("Errors" below). The entry that received the request (a Server Component, Route Handler, or Server Action) resolves the session and passes the actor; the data layer reads no cookies or headers, so the same function runs inside `use cache`, in a background job, and in a `*.db.test.ts`. A caller without a session, such as a background job, passes the actor it acts for.
- Writes that touch several rows run in one transaction. A function that another feature calls inside its transaction accepts that transaction as an optional executor parameter, as `attachUpload` in [`features/upload/server/uploads.ts`](https://github.com/fhyfhyfhy/next-template/blob/main/features/upload/server/uploads.ts) does.
- A transaction never spans a call to another system, which would hold its locks and its connection for as long as that system takes. When a write needs one between two database writes, commit a claim first, make the call, then record its result, each step idempotent so a retry after a crash repeats no effect.

## Results

- Map database rows to the feature's types in `types/` through one mapping function per resource.
- Their schemas describe JSON-native values only: timestamps as epoch milliseconds, `.nullable()` rather than `.optional()`, and no `.transform()`, `z.date()`, or `z.bigint()`. Server-prefetched data reaches the browser through RSC and refetched data through JSON; both must produce the same value.
- Wire names are the type's names: Route Handlers serialize the data layer's result without renaming or reshaping its fields. A list the data layer returns as an array goes out in the `{ items }` envelope that `lib/request/fetch.ts` expects of lists.
- Change what a Route Handler the browser reads returns in steps that both builds parse. A page stays open across a deploy, and during a rolling deploy may reach an instance of the other build; `fetchApi` parses each response with the schema of the page's build and throws when it does not match. A field the previous build's schema requires stays in the response for one more deploy, while this build's schema makes it optional. A field added stays optional in the schema until the deploy after the one that adds it. A field a schema does not know is safe: `z.object` drops it.

## Errors

- Reject a request that breaks a business rule with `DomainError` in `lib/request/domain-error.ts`: its HTTP status and a business code from the feature's `constants/error-codes.ts`, plus `param` and `params` when the UI needs them. When the UI shows more than its copy, such as the records that block the write, pass them as `data`, JSON-native values that the UI parses with the schema of that code. Codes are unique across features; the first three digits are the status. `lib/request/domain-error.test.ts` checks both.
- An authorization failure uses a general code, through the helpers in `lib/request/domain-error.ts`. A record the actor may not see answers `notFound` (404), as a missing one does, so the response does not reveal that it exists. `forbidden` (403) answers a write on a record the actor can see but may not change, and a whole view the actor's role does not open. For a view, the read checks the role before it looks up any record, so every URL of the view answers the same and reveals no record; the Server Component turns that error into `forbidden()` from `next/navigation`, which renders the segment's `forbidden.tsx` and needs `experimental.authInterrupts`, as [`app/[locale]/(tasks)/tasks/[id]/page.tsx`](https://github.com/fhyfhyfhy/next-template/blob/main/app/%5Blocale%5D/%28tasks%29/tasks/%5Bid%5D/page.tsx) turns a missing task into `notFound()`. A Route Handler or Server Action whose operation needs a session throws `unauthorized` (401) when the request has none.
- Let the database enforce invariants it can, such as a unique name, and translate the constraint violation into the business code.
- Route Handlers turn a `DomainError` into the failure response that `lib/request/fetch.ts` parses. A Server Action returns or throws it ("Server Actions" below).

## Server Actions

Every write from the browser goes through a Server Action, including writes whose data React Query owns. Put each action in its own top-level `"use server"` module in `api/`, named `<verb>-<resource>-action.ts`, such as [`features/task/api/create-task-action.ts`](https://github.com/fhyfhyfhy/next-template/blob/main/features/task/api/create-task-action.ts). Its runtime exports are only async Server Actions; validation helpers used only by that action may stay private there.

- The action validates its inputs, with a translated schema when the form shows field messages, resolves the session when the write depends on who makes it, and calls the data layer with that actor; the data layer authorizes the write ("Data layer" above).
- An action whose caller handles some of the data layer's `DomainError`s returns an `ActionResult` through `toActionResult`, both in `lib/request/action-result.ts`, which turns those into `{ ok: false, error }`, `error` being the `ApiErrorObject` in `lib/request/fetch.ts`, which a failed Route Handler response carries too: a thrown error loses its code on the way to the browser. An action without such failures returns its data, or nothing. Both let other errors throw. Its options factory unwraps the result ([Mutations](tanstack-query.md#mutations)).
- Across a deploy, an action keeps its file, its export name, and the arguments the previous build sends. A page left open from that build calls it by an ID built from its file and export name, given the encryption key every build shares ([Server Actions across builds](../../.agents/skills/self-hosting-audit/checks.md#server-actions-across-builds)), so an action renamed, moved, removed, or no longer taking those arguments fails on every such page.
- When other callers need the same input schema, extract it to a sibling such as [`features/task/api/create-task-schema.ts`](https://github.com/fhyfhyfhy/next-template/blob/main/features/task/api/create-task-schema.ts); the action must not import the options factory that calls it.
- Expose actions needed outside the feature through the main entry `index.ts`, which Client Components can import: the `"use server"` directive in the action's own module turns the export into an action reference, whichever entry re-exports it.

## Writes from other systems

A write another system sends, such as a webhook delivery, comes through a Route Handler under `app/api/`: a Server Action has no stable endpoint for it to call.

- Authenticate the request as the sender's docs specify before acting on its body. Where the docs define a request that carries no signature, such as an endpoint verification handshake, answer only that request unsigned. Where they recommend rather than require a check, such as a timestamp window, decide it for the project and write down the reason beside the check.
- The sender retries a delivery it got no timely answer for, so handle a delivery idempotently. Answer within the sender's time limit. When the work takes longer, commit the delivery first, then answer, and finish the work on a path that retries it: once answered, the sender retries nothing.
- The displays it changes refresh as [Changes made elsewhere](../../.agents/skills/next-data-flow/refresh.md#changes-made-elsewhere) says; `updateTag` works only in Server Actions.

Test that the handler applies an authenticated request, refuses an unauthenticated one without writing, and applies a repeated delivery once.

## Cached reads

A server read cached with `use cache` wraps the data-layer read in its own module in `server/` guarded by `import "server-only"`, one cached read per file, named `get-cached-<resource>.ts` after the function it exports, such as `getCachedTaskPage` in [`features/task/server/get-cached-task-page.ts`](https://github.com/fhyfhyfhy/next-template/blob/main/features/task/server/get-cached-task-page.ts) wrapping `listTasks` in [`features/task/server/tasks.ts`](https://github.com/fhyfhyfhy/next-template/blob/main/features/task/server/tasks.ts): `use cache` functions cannot enter a client bundle. Code outside the feature imports it from the feature's `server.ts` entry.

## Tests

Test each module in `server/` against a real database, in a `*.db.test.ts` file beside it, such as [`features/task/server/tasks.db.test.ts`](https://github.com/fhyfhyfhy/next-template/blob/main/features/task/server/tasks.db.test.ts) for `tasks.ts`. `pnpm test` runs them in its `db` project, against the database in [Test databases](data-setup.md#test-databases). Check each read's result with its schema after a JSON round trip. Test a function that takes an actor with one who lacks access: the read returns nothing of the record, and the write is rejected and changes nothing.
