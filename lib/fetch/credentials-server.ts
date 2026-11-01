import "server-only";

/**
 * The credentials a request to the backend from a Server Component, Server Action or Route Handler
 * carries; `fetchApi` imports them through `#credentials`: package.json's `imports` resolves to this
 * file only under the `react-server` condition, and to `credentials-browser.ts` on the browser side.
 * Not one file branching on `typeof window`: Client Components have no `window` during server
 * rendering either, so the server branch would be bundled there, where a static import of
 * `next/headers` or `server-only` fails the build.
 * When it reads this request's cookies, its callers run per request, and a call inside `use cache`
 * must pass `auth: false`.
 */
export async function credentialHeaders(): Promise<Record<string, string>> {
  // TODO: no credentials are configured yet, so endpoints that need a signed-in user get none on the server; fill this in for the backend's authentication (setup-data-access skill), or, when every endpoint is public, say so here instead.
  return {};
}
