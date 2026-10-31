# Checks

Each check names when it applies, what passes, what happens otherwise, how to observe it live, and its source. Doc paths are under `node_modules/next/dist/docs/01-app/`; [SKILL.md](SKILL.md) records the documentation baseline. "Measured" marks a runtime observation from 16.4.0. Re-run the applicable live check on the deployed version before treating that observation as verified there.

## Inventory

Search the source and config for:

- **Route rendering**: the route table `pnpm build` prints: `○` static, `◐` partially prerendered (static shell plus streamed parts), `ƒ` dynamic.
- **Caching**: `"use cache"`, `"use cache: remote"`, `"use cache: private"`, `cacheLife(`, `cacheTag(`.
- **On-demand revalidation**: `updateTag(`, `revalidateTag(`, `revalidatePath(`.
- **Server Actions**: `"use server"`.
- **Background work**: `after(` from `next/server`.
- **Per-link prefetch**: `prefetch={true}` on `<Link>`.
- **Images**: `next/image`, and `images` in `next.config.ts`.
- **Proxy**: `proxy.ts`.
- **Config**: `output`, `deploymentId`, `generateBuildId`, `cacheHandler`, `cacheHandlers`, `cacheMaxMemorySize`, `headers`, `rewrites`, `redirects`, `assetPrefix` in `next.config.ts`; the `NEXT_PUBLIC_*` env vars the code reads.

## Always

### Server process

- **Pass**: production runs `next start` or `node .next/standalone/server.js`. With `output: "standalone"`, `public/` and `.next/static/` are copied into `.next/standalone/`, unless a CDN or the proxy serves them.
- **Otherwise**: with standalone output, scripts, styles, and public files return 404.
- **Live**: a page and one `/_next/static/` file both return 200.
- **Source**: `03-api-reference/05-config/01-next-config-js/output.md`.

### Build-time values

- **Pass**: the build step receives every `NEXT_PUBLIC_*` var the code reads and every env var `next.config.ts` reads for `rewrites`, `redirects`, or `headers`. The former are inlined into the bundle; the latter are fixed into the routes manifest at build, and `next start` keeps them even when the env changes (measured for `rewrites`).
- **Otherwise**: the browser bundle holds `undefined`, or routing points at a stale or invalid destination.
- **Source**: `02-guides/self-hosting.md` (Environment Variables).

### Reverse proxy

- **Pass**: a reverse proxy such as Nginx sits in front of Next.js and handles malformed requests, slow connections, payload limits, and rate limiting.
- **Otherwise**: the Next.js server spends its capacity on what a proxy would reject.
- **Source**: `02-guides/self-hosting.md` (Reverse Proxy).

### Keep-alive timeout

- **Applies**: a proxy or load balancer reuses connections to Next.js, such as AWS ALB or Nginx with upstream keep-alive.
- **Pass**: the Next.js server's keep-alive timeout is longer than the idle timeout of the hop in front of it: `next start --keepAliveTimeout <ms>`, or the `KEEP_ALIVE_TIMEOUT` env var for the standalone `server.js` (read in `next/dist/build/utils.js`).
- **Otherwise**: Node.js closes an idle connection without telling the proxy, and the proxy's next request on it fails with a proxy error, intermittently.
- **Source**: `03-api-reference/06-cli/next.md` (Configuring a timeout for downstream proxies).

### Streaming

- **Applies**: the build has `◐` or `ƒ` routes, or any `<Suspense>` or `loading.tsx`.
- **Pass**: every hop between the client and Next.js passes chunked responses through unbuffered: Nginx through `X-Accel-Buffering: no` (from `headers()` in `next.config.ts`) or `proxy_buffering off`, load balancers with chunked transfer or HTTP/2 streaming, and any proxy in between.
- **Otherwise**: the static shell and streamed parts arrive together once the whole render finishes. Suspense fallbacks never show, and time to first byte equals the slowest read.
- **Live**: against a route with a slow Suspense boundary, print when each chunk arrives. The first chunk, the static shell, must arrive well before the last; a single chunk, or all chunks at once, fails.

  The same command runs in bash and Windows PowerShell: the script uses backtick strings because Windows PowerShell 5.1 strips the double quotes inside an argument it passes to `node`.

  ```bash
  node -e 'const t=Date.now();fetch(process.argv[1]).then(async(r)=>{for await(const c of r.body)console.log(Date.now()-t,`ms`,c.length,`bytes`)})' "https://<host>/<route>"
  ```

- **Source**: `02-guides/self-hosting.md` (Streaming and Suspense), `02-guides/streaming.md`.

### Graceful shutdown

- **Pass**: on shutdown, the Next.js process itself receives `SIGTERM` and gets 10–30 seconds before it is killed: Kubernetes `terminationGracePeriodSeconds`, `docker stop --time`, or the platform's equivalent. A shell-form `CMD`, or a wrapper script that does not forward signals, keeps the signal from reaching it.
- **Otherwise**: in-flight requests are cut, and pending `after()` callbacks never run.
- **Live**: start a slow request, stop the container, and confirm the request completes.
- **Source**: `02-guides/self-hosting.md` (`after`).

### Image optimization

- **Applies**: `next/image` with the default loader.
- **Pass**: the server optimizes images with `sharp`, configured per its Linux memory-allocator guidance on glibc systems; or `images.loader` points at a separate service; or images are `unoptimized`.
- **Otherwise**: memory grows under image traffic. Optimized images are cached per instance, so each instance optimizes each image again.
- **Source**: `02-guides/self-hosting.md` (Image Optimization), `03-api-reference/05-config/01-next-config-js/cacheMaxMemorySize.md`.

### Memory

- **Pass**: the container's memory limit leaves room for `cacheMaxMemorySize` (50 MB by default) on each of its two caches: the server cache of prerendered pages, Route Handler responses, and optimized images, and the built-in `use cache` handler.
- **Otherwise**: the process is killed for exceeding its limit, or entries are evicted before reuse. Check key cardinality and observed reuse before changing the `use cache` LRU; preserve every input that changes the result.
- **Source**: `03-api-reference/05-config/01-next-config-js/cacheMaxMemorySize.md`; `03-api-reference/01-directives/use-cache.md` (Cache keys); `03-api-reference/05-config/01-next-config-js/cacheHandlers.md` (`get()`).

### Prefetch cost

- **Applies**: `prefetch={true}` on any `<Link>`.
- **Pass**: origin capacity covers the prefetched URLs that require runtime rendering, including links the user never clicks. A per-link prefetch can require a server invocation; when its output is entirely statically renderable, Next.js can serve static output instead. Inspect which request data remains available during prefetch before estimating the cost.
- **Otherwise**: runtime rendering load grows with prefetched links; a large list can generate substantial work before any navigation.
- **Live**: against the production build, observe prefetch requests for a representative list and correlate them with origin rendering. A browser request alone does not prove a new render; account for static output and reused cache entries.
- **Source**: `02-guides/optimizing-prefetching.md` (Resolve URL data at prefetch time, Keep the prefetch static, Trade-offs).

## More than one instance, or rolling deploys

### One build

- **Pass**: every instance runs the same build output, such as one image. When separate builds are unavoidable, they share `generateBuildId` and `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`.
- **Otherwise**: each build has its own build ID and Server Function encryption key; a Server Action rendered by one instance fails on another with "Failed to find Server Action".
- **Source**: `02-guides/self-hosting.md` (Build Cache, Server Functions encryption key).

### Deployment ID

- **Applies**: rolling deploys, or any window in which old and new versions serve at once.
- **Pass**: `deploymentId` in `next.config.ts`, or `NEXT_DEPLOYMENT_ID` at build, is set per deployment and identical across its instances.
- **Otherwise**: during a rollout, a client from the old version requests chunks, Server Actions, or prefetched payloads the new version lacks, and navigation or actions break. With the ID set, a mismatch triggers a full reload instead. Next.js does not route by deployment, so without routing at the load balancer, clients that reach the other version reload rather than navigate.
- **Live**: the page's `<html>` carries `data-dpl-id`, and static asset URLs carry `?dpl=`.
- **Source**: `03-api-reference/05-config/01-next-config-js/deploymentId.md`, `02-guides/self-hosting.md` (Version Skew).

### On-demand revalidation

- **Applies**: `updateTag`, `revalidateTag`, or `revalidatePath` in the inventory.
- **Pass**: one of these.
  - Shared handlers coordinate tags across instances: `cacheHandlers.default` for `use cache` entries and `cacheHandler` for prerendered pages, both on shared storage. The `use cache` handler implements `updateTags`, `refreshTags`, and `getExpiration`, and `cacheMaxMemorySize` is `0` so the server cache reads go to the store.
  - The user accepts that other instances serve the old result for a window: list each tag with its window and where it is invalidated. With the built-in `use cache` handler, the window ends at the entry's `cacheLife` `revalidate` time. A handler that keeps entries until `expire`, such as `lib/cache-handler.mts`, also returns the old result on the first read past `revalidate`, so the window can last until `expire`.
  - The load balancer pins each user to one instance (session affinity), and the user accepts the window above for everyone else. The writer keeps seeing their change until their instance goes away in a rolling deploy, scale-in, or crash.
- **Otherwise**: the call invalidates only the instance that ran it. The writer sees their change in the action's response, then loses it on the next request that lands on another instance.
- **Live**: with two instances reachable separately, write through one and read the affected page through the other. With session affinity, also write through the load balancer and reload several times: every response shows the change.
- **Source**: `02-guides/self-hosting.md` (Multi-Instance Cache Coordination), `03-api-reference/05-config/01-next-config-js/cacheHandlers.md` (Distributed Tag Coordination), `02-guides/how-revalidation-works.md`.

### Remote cache

- **Applies**: `"use cache: remote"` in the inventory.
- **Pass**: `cacheHandlers.remote` points at shared storage.
- **Otherwise**: it uses the same per-instance in-memory LRU as `use cache`, so the directive gains nothing.
- **Source**: `03-api-reference/05-config/01-next-config-js/cacheHandlers.md` (Handler types).

### Time-based caching

- **Applies**: `use cache` without on-demand revalidation.
- **Pass**: capacity and freshness expectations match the configured handler. With the default production memory handler, each instance computes its own entry on demand, and an entry past `revalidate` is a miss. A handler that keeps entries until `expire`, such as `lib/cache-handler.mts`, serves an entry past `revalidate` and refreshes it in the background, so a read can return data up to `expire` old; `cacheMaxMemorySize` does not size it. Lifetimes do not schedule synchronized refreshes across instances. Mark it **risk** when repeated computation across instances matters.
- **Source**: `03-api-reference/05-config/01-next-config-js/cacheHandlers.md` (`get()`); `03-api-reference/04-functions/cacheLife.md`.

## Behind a CDN

### Static assets

- **Pass**: the CDN caches `/_next/static/*` with the origin's `public, max-age=31536000, immutable`, without overriding it.
- **Live**: `curl -sI` a static file twice through the CDN: the header is present, and the second response is a cache hit by the CDN's status header.
- **Source**: `02-guides/cdn-caching.md` (Static assets).

### HTML follows Cache-Control

- **Pass**: the CDN honors the origin's `Cache-Control` for HTML rather than caching every response. `◐` and `ƒ` routes send `private, no-cache, no-store, max-age=0, must-revalidate` (measured for a `◐` route); `○` routes send `s-maxage=31536000`.
- **Otherwise**: the most severe failure here: a page rendered for one signed-in user is served to others.
- **Live**: request a `◐` or `ƒ` route twice through the CDN, signed in as two different users: the CDN's status header shows a miss or bypass both times, and each response shows its own user.
- **Source**: `02-guides/self-hosting.md` (Usage with CDNs), `02-guides/cdn-caching.md` (Cache-Control headers).

### RSC requests

- **Pass**: the CDN forwards the `rsc`, `next-router-prefetch`, `next-router-segment-prefetch`, `next-router-state-tree`, and `next-url` request headers; keeps the `_rsc` query parameter in its cache key and does not strip query strings; and follows the 307 that Next.js returns for a missing or wrong `_rsc`.
- **Otherwise**: a cached HTML response answers a navigation request, or the reverse, and client-side navigation falls back to full page loads or breaks.
- **Live**: through the CDN, the command below prints `text/x-component`; omit `-H "rsc: 1"` to check that the HTML request prints `text/html`.

  Bash (macOS or Git Bash):

  ```bash
  curl -sL -o /dev/null -w "%{content_type}\n" -H "rsc: 1" "https://<host>/<route>"
  ```

  Windows PowerShell:

  ```powershell
  curl.exe -sL -o NUL -w "%{content_type}\n" -H "rsc: 1" "https://<host>/<route>"
  ```

  Locally, the bare `rsc: 1` request is first redirected to add `_rsc` (measured). In a browser, clicking an internal link sends a `?_rsc=` request that returns `text/x-component`, and the page does not reload.
- **Source**: `02-guides/cdn-caching.md` (Where CDN Caching Is Challenging, Handling Headers at the CDN).

### CDN purge on revalidation

- **Applies**: the CDN caches `○` routes, or other responses with `s-maxage`, and the app revalidates on demand.
- **Pass**: each revalidation also purges the affected CDN keys, for both the HTML and the RSC variants.
- **Otherwise**: `revalidateTag` and `revalidatePath` clear only the Next.js cache; the CDN serves its copy until `s-maxage` runs out.
- **Source**: `02-guides/cdn-caching.md` (Cache-Control headers).

### Proxy before the cache

- **Applies**: `proxy.ts` exists.
- **Pass**: `proxy.ts` runs before the CDN cache, or the CDN bypasses caching for the routes whose auth, redirects, or rewrites it decides.
- **Otherwise**: a cached response skips `proxy.ts`, and with it the auth check or redirect.
- **Source**: `02-guides/cdn-caching.md` (Where CDN Caching Is Challenging).

### Static shell at the edge

- Not a check: typical CDNs cannot serve a cached static shell and resume the dynamic parts from the origin, so HTML for `◐` routes comes from the origin, which still sends the static shell first. There is nothing to configure, and no CDN latency gain for that HTML. Report it as information when the user expects one.
- **Source**: `02-guides/ppr-platform-guide.md`.
