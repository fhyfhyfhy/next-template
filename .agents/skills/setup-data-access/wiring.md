# Wiring

The code each choice in SKILL.md needs. Code comments follow the repo's language rule. The facts marked as measured were checked on `next` 16.4.0 with `cacheComponents` on; on another version, confirm them with the probe in [Verify](#verify) before relying on them, and correct this file where they differ.

## Backend

**Called directly**: `resolveApiUrl` already joins `NEXT_PUBLIC_API_BASE_URL`. Server requests need it absolute.

**Behind this app's origin**: forward a prefix that no Route Handler uses, such as `/backend`:

```ts
// next.config.ts
async rewrites() {
  // rewrite 在构建时写进 routes manifest：构建和运行都要有 API_BASE_URL，运行时改它不会改变 rewrite。
  if (!process.env.API_BASE_URL) {
    throw new Error("API_BASE_URL is not set: see Backend API in README.md");
  }
  return [
    {
      source: "/backend/:path*",
      destination: `${process.env.API_BASE_URL}/:path*`,
    },
  ];
},
```

```ts
// lib/fetch.ts
export function resolveApiUrl(path: ApiPath): string {
  // 浏览器走同源的 rewrite（next.config.ts），服务端直连后端。
  const base =
    typeof window === "undefined" ? process.env.API_BASE_URL : "/backend";
  return `${base}${path}`;
}
```

- `API_BASE_URL` takes no `NEXT_PUBLIC_` prefix, since the browser never reads it. Measured: `next start` keeps the destination the build wrote even when `API_BASE_URL` changes, so a deployment sets it at build time, not only at runtime.
- The browser's request carries its whole `Cookie` header through the rewrite to the backend (measured), unlike the server path in [Credentials](#credentials), which forwards one cookie.
- Replace `NEXT_PUBLIC_API_BASE_URL` in the project's code, tests, and README, including `resolveApiUrl`'s doc comment. `lib/fetch.test.mjs` runs with no `window`, so it takes the server branch and sets `API_BASE_URL`.

**This app itself**: leave `NEXT_PUBLIC_API_BASE_URL` unset and `lib/fetch.ts` unchanged. `resolveApiUrl` then returns same-origin paths, which reach the Route Handlers from the browser but cannot be fetched on the server, so server code calls the data functions the Route Handlers call instead of `fetchApi`. Those functions check the session through a Data Access Layer (`node_modules/next/dist/docs/01-app/02-guides/authentication.md`), so [Credentials](#credentials) below does not apply.

## Response format

The template unwraps a `{ code, data, message }` envelope, described by `envelopeSchema` and `SUCCESS_CODE` in `lib/fetch.ts`. `fetchApi` throws `ApiError` for a non-2xx status or a `code` other than `SUCCESS_CODE`, and `ApiError` reads `code` from any failure body that is an envelope.

**Another envelope**: rename the fields in `envelopeSchema`, set `SUCCESS_CODE`, and change the type of `ApiError.code` when codes are strings. When `data` has another name, also rename it where `fetchApi` reads `envelope.data?.data`.

**Plain JSON**: remove `envelopeSchema` and `SUCCESS_CODE`. `fetchApi` throws `ApiError` for a non-2xx status only, and the schema validates the whole body, `null` for an empty one. When failure bodies carry an error code, such as `{ detail, code }`, `ApiError` reads `code` from that shape; otherwise remove `ApiError.code`.

- Rewrite every comment in `lib/fetch.ts` that describes the envelope: the one above `envelopeSchema`, and those on `ApiError`, `SchemaValidationError`, `shouldRetryRequest`, `fetchApi`, and `FetchApiConfig.schema`.
- Change the bodies `lib/fetch.test.mjs`'s test server returns to the new format, keeping a case for each failure: a non-2xx, a failure code on a 2xx when the envelope allows one, and a body in the wrong shape.
- `shouldRetryRequest` retries only statuses of 500 and above, so a failure code on a 2xx is never retried.
- When `message` is written for users, `handleRequestError` in `app/providers.tsx` can toast it, read from `error.body`, in place of the generic text.

## Credentials

The template ships the split. `fetchApi` imports `credentialHeaders` from `#credentials`, which the `imports` field of `package.json` resolves per environment to `lib/credentials-server.ts` or `lib/credentials-browser.ts`; both return `{}` until filled in below. `fetchApi` attaches what they return unless a call passes `auth: false`, and a header the caller sets wins.

Measured resolution:

| Code running in | Resolves to | Credential attached |
| --- | --- | --- |
| Server Components, Server Actions, Route Handlers | `credentials-server.ts` | From the request's cookies |
| Client Components rendering on the server | `credentials-browser.ts`, with no `window` | None |
| The browser | `credentials-browser.ts` | From the browser's session |
| `node --test` and TypeScript | `credentials-browser.ts`, with no `window` | None, so existing `fetchApi` tests pass unchanged |

Server-only imports (`next/headers`, `server-only`, the auth library's server helpers) go in `credentials-server.ts` only; its doc comment says why. When filling in either file, replace its `TODO` and the function body, and make the doc comment say what the file now sends and where it comes from.

A credentialed call inside `use cache` throws `next-request-in-use-cache`, naming the file and line. When the route prerenders, the build fails; on a dynamically rendered route it passes the build and fails at request time (`node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-cache.md`, Request-time APIs). Search the project for `fetchApi` calls inside `use cache` that lack `auth: false` before filling in `credentials-server.ts`.

### `lib/credentials-server.ts`

A bearer token from the auth library:

```ts
export async function credentialHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken(); // 认证库的服务端 helper，从 session cookie 取 access token
  return token ? { Authorization: `Bearer ${token}` } : {};
}
```

The session cookie itself: forward only the cookies the backend reads. Forwarding the whole `Cookie` header would hand the backend every cookie this app holds.

```ts
import { cookies } from "next/headers";

const SESSION_COOKIE = "session";

export async function credentialHeaders(): Promise<Record<string, string>> {
  const session = (await cookies()).get(SESSION_COOKIE);
  return session ? { Cookie: `${session.name}=${session.value}` } : {};
}
```

Keep `import "server-only";` first, with no blank line before the next import: `simple-import-sort` puts them in one group. When the library's server helper makes a network call each time, such as verifying the token with the auth server, wrap `credentialHeaders` in React's `cache()` so one render makes it once. When only the browser holds the credential, leave the file as shipped.

### `lib/credentials-browser.ts`

```ts
export async function credentialHeaders(): Promise<Record<string, string>> {
  if (typeof window === "undefined") return {};
  // 动态引入：Client Component 服务端渲染时也会加载本模块，静态引入的认证模块会在服务端求值，用到 `window` 等浏览器 API 时报错。
  const { getAccessToken } = await import("./auth-browser");
  const token = await getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
```

- Import the auth code inside the `window` branch, as above. A static import also runs it during SSR, and `node --test` loads this file too but cannot resolve `@/` or extensionless paths. A package that touches no browser API when imported may be imported statically.
- A cookie the backend reads itself needs nothing here: leave the file as shipped, and the browser sends the cookie. A backend on another origin also needs `credentials: "include"` on the request, set in `fetchApi` when `auth` is on, and a CORS policy that allows credentials from the app's origin.

## Signed out

- **Browser**: `handleRequestError` in `app/providers.tsx` handles the signed-out response before the toast logic, so it runs for queries and mutations whatever their `meta`. It also runs on the `QueryClient` that renders Client Components on the server, where there is nothing to redirect. A redirect to the sign-in page:

  ```ts
  if (error instanceof ApiError && error.status === 401) {
    if (!environmentManager.isServer()) {
      const signIn = new URL("/sign-in", window.location.origin);
      signIn.searchParams.set("next", `${window.location.pathname}${window.location.search}`);
      // 整页跳转：丢掉上一个会话留在内存里的 query 缓存和路由缓存。
      // replace 不留历史记录：返回键不会回到这个已失效的页面、再被跳回登录页。
      window.location.replace(signIn);
    }
    return;
  }
  ```

  Match the condition to how the backend signals it, such as `error.code === SIGNED_OUT_CODE` for a code on a 2xx.

- **Server**: a check in the Data Access Layer, such as `requireUser()`, redirects with `redirect()` before the page requests user data. It reads the session, so under Cache Components it runs inside `<Suspense>` or `use cache: private` (`node_modules/next/dist/docs/01-app/02-guides/authentication-with-cache-components.md`).
- **Refresh by this app**: keep one in-flight refresh promise that concurrent requests share, and retry a 401 once after it settles. Cover both in `lib/fetch.test.mjs`.

## Verify

Observe each path sending its credential, in a production build against a backend that echoes what it receives:

1. **Echo backend.** A local HTTP server that answers every request with the `Authorization` and `Cookie` headers it received, in the response format the project uses. When sign-in goes through the backend, it also implements the sign-in endpoint, setting the session cookie. For a backend the browser calls directly, it allows CORS with credentials from `http://localhost:3000`. Keep it running through the build as well as `pnpm start`: prerendering calls the backend.
2. **Probe.** Add a temporary `app/data-access-probe/` that calls `fetchApi` from each kind of caller the project uses:
   - A Server Component inside `<Suspense>`.
   - A Server Action.
   - A Route Handler, in its own subfolder: a page and a `route.ts` cannot share a segment.
   - A client query.
   - A Client Component calling `useSuspenseQuery` under a Server Component that awaits `connection()`, so it renders on the server per request.
   - When public endpoints exist, a `use cache` function calling with `auth: false`.
   - For the signed-out check, a page of its own, since the redirect navigates away.

   Keep the probe's zod schema in a file without `"use client"`: a Server Component importing it from a client file gets a client reference, not the schema.
3. **Run.** Set the base URL env vars for both `pnpm build` and `pnpm start`. With the app running, sign in with a test account: through the app's sign-in UI, or, when it has none yet, through a probe button that calls the sign-in endpoint the way sign-in would. Trigger each probe and compare what the echo backend received with what each caller should send under the confirmed answers. Then end the session and confirm the signed-out behavior.
4. **Clean up.** Stop the verification servers and delete the probe and the echo backend. Run `pnpm exec next typegen` with the same config env vars as the build to replace the generated route types before the next typecheck. The probe only needs to build; it does not need to pass lint.
