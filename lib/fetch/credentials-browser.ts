/**
 * The credentials a browser request to the backend carries; `fetchApi` imports them through
 * `#credentials`, and `credentials-server.ts` says why the two files are split.
 * Client Components also resolve to this file during server rendering and in unit tests (Vitest),
 * where there is no `window` and no browser credential: when filling it in, first return `{}` when
 * `typeof window === "undefined"`. The cookies the browser sends on its own do not pass through here.
 */
export async function credentialHeaders(): Promise<Record<string, string>> {
  // TODO: no credentials are configured yet; fill this in for the backend's authentication (setup-data-access skill), or, when the browser's own cookies are enough or every endpoint is public, say so here instead.
  return {};
}
