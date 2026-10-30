---
name: setup-data-access
description: Fit this template's backend requests to the project (where requests go, the response format, and how requests carry the signed-in user's credential) by changing lib/fetch.ts, lib/credentials-*.ts, and app/providers.tsx. Run once per project, and again when the backend or the auth library changes.
disable-model-invocation: true
---

# Set up data access

The template's `fetchApi` (`lib/fetch.ts`) calls one backend at `NEXT_PUBLIC_API_BASE_URL`, unwraps a `{ code, data, message }` response envelope, and attaches the credential that `lib/credentials-server.ts` and `lib/credentials-browser.ts` return, which is none while they carry the template's `TODO`. This skill asks how the backend and sign-in work and changes the code to match.

The code is the only record of the result. Other skills and rules read these files to learn, for example, whether the Next.js server can request data for the signed-in user, so each changed file's doc comments must describe what it does for this project.

It covers requests and the credential they carry. Sign-in UI, sign-up, and route protection come from the auth library's own Next.js setup.

## Process

### 1. Explore

Read what exists before asking:

- `lib/fetch.ts`, `lib/credentials-server.ts`, `lib/credentials-browser.ts`, and `app/providers.tsx`. When the credentials files no longer carry the template's `TODO`, or `resolveApiUrl` and `fetchApi` differ from the template's, this is a re-run: ask only about what the user wants to change.
- `package.json`: an auth library and its version, such as `@supabase/ssr`, `next-auth`, `@clerk/nextjs`, `@auth0/nextjs-auth0`, `better-auth`, `firebase`, or `iron-session`.
- Env files (`.env*`): use a value such as the backend's base URL to probe it, but never print a value.
- `next.config.ts` (`rewrites`), `app/api/` (Route Handlers), `proxy.ts`, and the callers of `fetchApi` and `resolveApiUrl`. The callers in `features/demo-task/` belong to the Data demo, and `scripts/mock-api/` is its stand-in backend, started at `127.0.0.1:4010` only by the `demo:*` scripts: neither describes the project's backend.
- The backend, once its URL turns up: probe it with read-only requests, such as its OpenAPI or docs endpoint, the CORS headers it returns to a request carrying `Origin: http://localhost:3000` for section A, and a public endpoint's response body for section B. With a test account, also sign in once and read the cookies the response sets, for section C.

Done when you can say, for each section below, what you found and where, and what only the user can answer.

### 2. Ask

Take the sections in order, one per message. Lead with the recommended answer, chosen from what exploration found, so the user can accept it in a word. Where exploration already answered a question, state the finding instead of asking.

**A. Backend.** Where requests go. When exploration leaves it open, first ask the two facts that decide it: whether the backend serves CORS for the app's origin, and whether it recognizes users by a cookie it sets itself.

- **A separate backend the browser calls directly**: one absolute base URL for the server and the browser. Recommend it when the backend serves CORS for the app's origin and does not rely on its own cookie.
- **A separate backend behind this app's origin**: `rewrites` in `next.config.ts` forward a path prefix to it. The browser requests same-origin, so cookies the backend sets become first-party and reach the Next.js server too; the server calls the backend directly, possibly on an internal URL. Like any reverse proxy, the rewrite hands the backend every cookie of the app's domain. Recommend it when the backend sets its own session cookie or cannot serve CORS.
- **This app itself**: Route Handlers and data functions, no separate backend.

Settle the env var holding each base URL, its local value, and where each deployed environment sets it.

**B. Response format.**

- **An envelope**, as the template expects: `{ code, data, message }` with `code` 0 for success. Confirm the field names, the success value and its type, whether a failure can arrive with a 2xx status, and whether `message` is written for users.
- **Plain JSON**: the schema validates the whole body, and failures are non-2xx statuses. Collect the error code a failure body carries, if any.

**C. Credentials.** How the backend recognizes the signed-in user, and where the session lives:

- **None**: public endpoints only.
- **A session the Next.js server receives**: a cookie on the app's domain. Either an auth library's SSR integration stores it there, as most do, or the backend signs users in itself and its cookie arrives through the rewrite in section A. Server Components, Server Actions, and Route Handlers can then request user data. Recommend it whenever the setup allows it, then ask what the backend accepts: a bearer token the library issues, or the session cookie itself, and the cookie's name.
- **A credential only the browser holds**: a token in `localStorage`, a client SDK session in IndexedDB, or the backend's cookie on another site. Only the browser can request user data, so React Query owns all of it. Before accepting this, name that cost and offer the library's server-readable mode or the rewrite in section A.

When the user picks an auth library that is not set up yet, sign-in comes first: offer to set it up by its Next.js App Router guide now, or leave the credentials files as shipped for the time being.

**D. Signed out.** How the backend signals a missing or expired session (HTTP 401, or with an envelope possibly a code on a 2xx), and what that does:

- **Browser**: redirect to the sign-in page with a return path (recommended), open a sign-in dialog, or leave it to the error state.
- **Server**: pages that need a user check the session before requesting and redirect when it is missing, the Data Access Layer in `node_modules/next/dist/docs/01-app/02-guides/authentication.md`. A signed-out response during render then means the session expired mid-request; it reaches the nearest `error.tsx`, or Next.js's default error page when the app has none.
- **Token refresh**: the library's own (recommended; some need `proxy.ts` to refresh the cookie), or, when the backend issues tokens itself, one refresh shared by concurrent requests and one retry.
- **Sign-out**: wherever the app signs users out or switches accounts, apply the session-cache reset policy in `.claude/rules/data-fetching.md`, Signing out. Find those places and include them in the code changes.

Done when every section has an answer the user gave or accepted.

### 3. Confirm

Show the user, before editing:

- The answer to each section, one line each.
- The code changes from [wiring.md](wiring.md), one line per file.

Let them edit before writing.

### 4. Write

- Change the code as [wiring.md](wiring.md) describes for each choice, with the tests it names.
- In every file you change, make the doc comments describe this project: the credential each `credentials-*.ts` sends and where it comes from, the base URL in `resolveApiUrl`, the response format on `fetchApi` and `FetchApiConfig.schema`, and the signed-out handling in `app/providers.tsx`.
- Remove the `TODO` from both credentials files. A file left returning `{}` says why instead: the endpoints are all public, the browser sends the backend's cookie itself, or only the browser holds the credential.
- Put each env var's local value in `.env.local`, which git ignores, creating the file when it is missing.
- Update the "Backend API" section of `README.md`: each env var, an example local value, and whether the deployment needs it at build time as well as at runtime.
- Keep the Data demo runnable when section B changed the response format or the error types: rewrite `scripts/mock-api/envelope.mjs` to produce the new format, and update the Data demo code that reads backend errors (`ApiError` checks in `features/demo-task/`, the codes in its `constants/error-codes.ts`) to match.

### 5. Verify

Follow [wiring.md § Verify](wiring.md#verify). Done when each kind of caller was observed sending the credential the confirmed answers call for, the signed-out behavior was observed in the browser, the probe is deleted, and `pnpm lint`, `pnpm test`, `pnpm build`, and `pnpm demo:test:e2e` (the Data demo against the Mock API) then pass.

### 6. Report

Name the answers, the files changed, and what each check observed. Tell the user that later changes go straight into those files, and that re-running this skill is for switching the backend or the auth library.
