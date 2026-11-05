# Checks

Each check names when it applies, what passes, what happens otherwise, how to observe it live, and its source. Doc paths are under `node_modules/next/dist/docs/01-app/`, and source paths under `node_modules/next/dist/`; [SKILL.md](SKILL.md) records the documentation baseline. "Measured" marks a runtime observation, from 16.4.0 unless it names another version. Re-run the applicable live check on the deployed version before treating that observation as verified there.

## Inventory

Search the source and config for:

- **Route rendering**: the route table `pnpm build` prints: `○` static, `◐` partially prerendered (static shell plus streamed parts), `ƒ` dynamic.
- **Caching**: `"use cache"`, `"use cache: remote"`, `"use cache: private"`, `cacheLife(`, `cacheTag(`.
- **On-demand revalidation**: `updateTag(`, `revalidateTag(`, `revalidatePath(`.
- **Server Actions**: `"use server"`.
- **Background work**: `after(` from `next/server`.
- **Per-link prefetch**: `prefetch={true}` on `<Link>`.
- **Images**: `next/image`, and `images` in `next.config.ts`.
- **Proxy**: `proxy.ts`, its `matcher`, and any response it fetches from another server and returns.
- **Health route**: the route that probes and load balancer health checks request.
- **Module-level clients**: database pools and other clients created at module scope, and whether `proxy.ts`, the app, or both import them.
- **Writes outside Server Actions**: Route Handlers answering GET, pages, `proxy.ts`, and `after()` callbacks that write, and jobs or timers that `instrumentation.ts` starts.
- **Server-side time formatting**: `Intl.DateTimeFormat`, `toLocale*String`, or a date library in Server Components and prerendered routes.
- **Root-absolute URLs**, when `basePath` is set: `next/image` and `<img>` `src`, `<a href>`, `window.location`, `fetch()` URLs, a `Location` header built by hand, and each cookie's `Path`.
- **Scripts in the image**: every command the image or the deploy runs besides the server, such as a migration, a check, or a scheduled job.
- **Config**: `output`, `basePath`, `compress`, `deploymentId`, `generateBuildId`, `cacheHandler`, `cacheHandlers`, `cacheMaxMemorySize`, `headers`, `rewrites`, `redirects`, `assetPrefix`, `skipProxyUrlNormalize`, `outputFileTracingIncludes` in `next.config.ts`; the `NEXT_PUBLIC_*` env vars the code reads.

## Always

### Server process

- **Pass**: production runs `next start` or `node .next/standalone/server.js`. With `output: "standalone"`:
  - `public/` and `.next/static/` are copied into `.next/standalone/`, unless a CDN or the proxy serves them;
  - the image sets `HOSTNAME=0.0.0.0`: `server.js` listens on `$HOSTNAME`, which Docker and Kubernetes set to the container's host name;
  - each script the image runs besides the server finds its imports. The standalone `node_modules` holds only the packages the server loads at run time; a package the build bundled into its chunks, or one only the script uses, is missing (measured, 16.4.3). Add it with `outputFileTracingIncludes`, or install the script's dependencies in an image stage of their own.
- **Otherwise**: scripts, styles, and public files return 404; the server listens only on the address that host name resolves to, so a request to `localhost` inside the container, such as a Docker `HEALTHCHECK`, an exec probe, a sidecar, or `kubectl port-forward`, is refused; a script fails at its first import.
- **Live**: a page and one `/_next/static/` file both return 200, from outside the container and from `localhost` inside it. Each script runs in the built image, with a dry-run or help flag when it has one.
- **Source**: `03-api-reference/05-config/01-next-config-js/output.md`; the `server.js` template in `build/utils.js`.

### Build-time values

- **Pass**: the build step receives every `NEXT_PUBLIC_*` var the code reads and every env var `next.config.ts` reads for `rewrites`, `redirects`, or `headers`. The former are inlined into the bundle; the latter are fixed into the routes manifest at build, and `next start` keeps them even when the env changes (measured for `rewrites`). When one image serves several environments, every value that differs between them is read at run time.
- **Otherwise**: the browser bundle holds `undefined`, routing points at a stale or invalid destination, or one environment runs with another's value.
- **Source**: `02-guides/self-hosting.md` (Environment Variables).

### Reverse proxy

- **Pass**: a reverse proxy such as Nginx sits in front of Next.js and handles malformed requests, slow connections, payload limits, and rate limiting. Headers that every response must carry are set there too: the 308s Next.js sends to normalize a path (a trailing, repeated, or back slash) carry none of the headers from `headers()` (measured, 16.4.3).
- **Otherwise**: the Next.js server spends its capacity on what a proxy would reject, and those 308s go out without the security headers.
- **Source**: `02-guides/self-hosting.md` (Reverse Proxy).

### Keep-alive timeout

- **Applies**: a proxy or load balancer reuses connections to Next.js, such as AWS ALB or Nginx with upstream keep-alive.
- **Pass**: the Next.js server's keep-alive timeout is longer than the idle timeout of the hop in front of it: `next start --keepAliveTimeout <ms>`, or the `KEEP_ALIVE_TIMEOUT` env var for the standalone `server.js` (read in `build/utils.js`).
- **Otherwise**: Node.js closes an idle connection without telling the proxy, and the proxy's next request on it fails with a proxy error, intermittently.
- **Source**: `03-api-reference/06-cli/next.md` (Configuring a timeout for downstream proxies).

### Health checks

- **Applies**: an orchestrator probe or a load balancer health check.
- **Pass**:
  - probes and health checks request a route that answers 200 from the process alone, under `basePath` when one is set;
  - `proxy.ts` lets that route through before any sign-in, locale, or redirect logic, and lets `/_next/static/`, `/_next/image`, and `public/` files through the same way;
  - a check that reaches a dependency, such as the database, is a separate route that no liveness probe or load balancer health check uses;
  - a timeout raced against a dependency call still handles the call's rejection once the timeout wins.
- **Otherwise**: a load balancer health check expecting 200, the usual default, fails on a redirect or a 401, and a Kubernetes probe fails on the 401, so no instance enters rotation; a dependency outage takes every instance out at once; an unhandled rejection exits the process, Node.js's default.
- **Live**: with no cookies, `curl -si "https://<host>/<health route>"` returns 200 with no `Location`, and so does the same request to `localhost` inside the container.
- **Source**: `03-api-reference/03-file-conventions/proxy.md` (Matcher); Node.js's `--unhandled-rejections` CLI option.

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

- **Pass**:
  - `SIGTERM` reaches the Next.js process itself: an exec-form `CMD`, or a wrapper that forwards signals, and `NEXT_MANUAL_SIG_HANDLE` unset or replaced by a handler of the app's own;
  - the instance keeps serving until the load balancer has stopped sending it requests: a Kubernetes `preStop` sleep, or the platform's drain delay, longer than the load balancer's deregistration takes;
  - the grace period before the kill, such as `terminationGracePeriodSeconds` or `docker stop --time`, covers that delay plus the longest request and pending `after()` work.

  On `SIGTERM`, `next start` and the standalone server stop accepting connections at once, finish in-flight requests, and exit (`cleanup` in `server/lib/start-server.js`); with nothing in flight, that takes under a second (measured, 16.4.3).
- **Otherwise**: with no delay, requests the load balancer sends in the seconds after `SIGTERM` are refused, on every deploy and scale-in. With no signal, in-flight requests are cut at the kill, and pending `after()` callbacks never run.
- **Live**: send a steady stream of requests through the load balancer during a rollout and count the failed ones: none. Start a slow request, stop its instance, and confirm the request completes.
- **Source**: `02-guides/self-hosting.md` (`after`).

### Compression

- **Applies**: `compress` is not `false`.
- **Pass**: either the proxy or CDN in front compresses and `compress: false` hands the job to it, or CPU sizing ([Resources](#resources)) counts Next.js gzipping each response on each request, static files included. Either way, `/_next/static/*` is cached in front of Next.js ([Static assets](#static-assets)), so each file is compressed once per cache fill rather than per request.
- **Otherwise**: **risk**: static files cost CPU on every request. One instance serving cold page loads used about 2.3 cores, against about 1.25 for its HTML alone; the gzip runs on libuv's thread pool, beside the JavaScript thread (measured, 16.4.3).
- **Live**: `curl -sI -H "Accept-Encoding: gzip, br" "https://<host>/_next/static/<file>"`: `content-encoding` and the cache status headers show which hop compresses and whether it was cached.
- **Source**: `03-api-reference/05-config/01-next-config-js/compress.md`.

### Image optimization

- **Applies**: `next/image` with the default loader.
- **Pass**: the server optimizes images with `sharp`, configured per its Linux memory-allocator guidance on glibc systems; or `images.loader` points at a separate service; or images are `unoptimized`.
- **Otherwise**: memory grows under image traffic. Optimized images are cached per instance, so each instance optimizes each image again.
- **Source**: `02-guides/self-hosting.md` (Image Optimization), `03-api-reference/05-config/01-next-config-js/cacheMaxMemorySize.md`.

### Resources

- **Pass**:
  - **CPU**: each Next.js process gets about one core, and more load gets more instances. A process runs JavaScript on one thread: under load it used 1.2–1.3 cores serving HTML, and more when it also compressed static files (measured, 16.4.3).
  - **Memory**: the container's memory limit leaves room for `cacheMaxMemorySize` (50 MB by default) on each of its two caches: the server cache of prerendered pages, Route Handler responses, and optimized images, and the built-in `use cache` handler.
- **Otherwise**: a CPU limit below a core throttles every render, streaming included; the process is killed for exceeding its memory limit, or entries are evicted before reuse. Check key cardinality and observed reuse before changing the `use cache` LRU; preserve every input that changes the result.
- **Source**: `03-api-reference/05-config/01-next-config-js/cacheMaxMemorySize.md`; `03-api-reference/01-directives/use-cache.md` (Cache keys); `03-api-reference/05-config/01-next-config-js/cacheHandlers.md` (`get()`).

### Server time zone

- **Applies**: the inventory lists server-side time formatting.
- **Pass**: dates and times are formatted in the browser, in the viewer's time zone, or with an explicit `timeZone`; no output depends on the server's own time zone.
- **Otherwise**: the server formats in its own zone, usually UTC in a container and the developer's zone in development, so users see times hours off, and the client's render of the same time mismatches it during hydration.
- **Live**: run the production build with `TZ=UTC` and open a page in a browser set to another zone, such as Playwright's `timezoneId`: each time shows in the browser's zone.
- **Source**: `02-guides/preventing-flash-before-hydration.md`.

### Prefetch cost

- **Applies**: `prefetch={true}` on any `<Link>`.
- **Pass**: origin capacity covers the prefetched URLs that require runtime rendering, including links the user never clicks. A per-link prefetch can require a server invocation; when its output is entirely statically renderable, Next.js can serve static output instead. Inspect which request data remains available during prefetch before estimating the cost.
- **Otherwise**: runtime rendering load grows with prefetched links; a large list can generate substantial work before any navigation.
- **Live**: against the production build, observe prefetch requests for a representative list and correlate them with origin rendering. A browser request alone does not prove a new render; account for static output and reused cache entries.
- **Source**: `02-guides/optimizing-prefetching.md` (Resolve URL data at prefetch time, Keep the prefetch static, Trade-offs).

### Proxy relaying to another server

- **Applies**: `proxy.ts` returns a response it fetched from another server, such as the writable region's instance ([One writable region](#one-writable-region)), a legacy backend the app is replacing, or an instance of another build.
- **Pass**, each line with its failure:
  - `skipProxyUrlNormalize: true`. Otherwise Next.js strips `_rsc` and the navigation headers before `proxy.ts` runs, and a client-side navigation reaches the other server as a page load, which answers HTML in place of the RSC payload.
  - A relayed route's prefetches are relayed too. Otherwise the router can show a prefetch rendered here for a page that should come from the other server.
  - The relayed request keeps `Cookie` and `Authorization`, drops `Host`, `Accept-Encoding`, and the hop-by-hop headers, and carries the browser's host in `X-Forwarded-Host`. Otherwise the other server builds its URLs for its own host; and with `Accept-Encoding` forwarded, `fetch()` decodes the body and Next.js drops `Content-Encoding`, so an encoding `fetch()` cannot decode reaches the browser as garbage.
  - The HTTP client keeps no cookies between requests, as Node.js's `fetch()` does by default. Otherwise a client with a cookie jar adds the last user's session to the next relayed request that carries none, and that request acts as that user (measured, on a relay outside Next.js).
  - A header marks each relayed request, and a server relays nothing that carries it. The header unlocks nothing else: any browser can send it, so the receiving server checks authentication and authorization itself. Otherwise two misconfigured servers hand one request back and forth, or a forged header skips a check.
  - The upstream response loses its `x-middleware-*` and hop-by-hop headers, and keeps every `Set-Cookie`, none with a `Domain` the browser's host falls outside. Otherwise, when the other server is Next.js, this server follows that server's own proxy instructions, such as an `x-middleware-rewrite`, and answers 500 with `TypeError: Invalid URL` (measured, 16.4.3); and the browser drops a cookie set for the other host.
  - A `Location` on the other server's origin comes back as a path on the browser's host, matched only where `/`, `?`, `#`, or the end follows the origin, so `https://<origin>.evil.example` and `https://<origin>@evil.example` stay as they are; Next.js gets it as an absolute URL. Otherwise the browser leaves for the other server's host, or Next.js answers a relative `Location` with a 500 (measured, 16.4.3).
  - When the other server is unreachable, the relay answers 502 and retries no write itself.
  - A `/_next/static/` file this build has is answered here, and one only the other server's build has is relayed. Otherwise a page the other server renders from a newer build names chunks this instance lacks, and it never hydrates.
- **Live**: through the relaying instance, the command in [RSC requests](#rsc-requests) prints `text/x-component` for a relayed route; a relayed redirect lands on the browser's host; a relayed page hydrates; no response carries an `x-middleware-` header; a request with no cookie, sent right after a relayed sign-in, arrives at the other server with no cookie.
- **Source**: `03-api-reference/05-config/01-next-config-js/skipProxyUrlNormalize.md`, `03-api-reference/03-file-conventions/proxy.md`.

## More than one instance, or rolling deploys

A rolling deploy puts two builds behind one load balancer until it ends, and so does any setup that deploys the same code to several places at different times. Pages opened from the previous build keep calling the new one for as long as they stay open. The checks below cover that version skew.

### One build

- **Pass**: every instance of a deployment runs the same build output, such as one image. When separate builds are unavoidable, they share `generateBuildId` and the Server Action key ([Server Actions across builds](#server-actions-across-builds)).
- **Otherwise**: each build has its own build ID and Server Action IDs; a Server Action rendered by one instance fails on another with "Failed to find Server Action".
- **Source**: `02-guides/self-hosting.md` (Build Cache, Server Functions encryption key).

### Server Actions across builds

- **Applies**: `"use server"` in the inventory, with rolling deploys or with pages left open across a deploy.
- **Pass**: every build, each deploy's and not only one deploy's instances, gets the same `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`, passed as a build secret rather than a build argument or a layer, which the image history shows. The build fails when the key is empty. From one deploy to the next, an action keeps its file, its export name, and the arguments the previous build sends.
- **Otherwise**: Next.js salts each Server Action's ID with this key (`serverReferenceHashSalt` in `build/webpack-config.js`) and makes a new key for each build that has none. Two clean builds of one commit shared none of 19 action IDs; with one key, two builds that changed an action's own file shared all 19 (measured, 16.4.3). Without the key, every page from the previous build fails each Server Action during the rollout and after it, until reloaded: the server answers `x-nextjs-action-not-found`, the client throws `UnrecognizedActionError` before any build-ID check (`client/components/router-reducer/reducers/server-action-reducer.js`), and the user's write is lost.
- **Accepted with a fixed key**: the key is in the build output (`.next/server/server-reference-manifest.json`), so the image is as secret as the key; a build cache that reuses the `next build` layer keeps the key that layer was built with, since BuildKit keys a `RUN` on its text, not on secret contents; and action IDs no longer change per build, so each action checks authentication and authorization itself.
- **Live**: build twice from one commit with the key, and compare the action IDs in `.next/server/server-reference-manifest.json`: identical. Open a page, deploy, and submit one of its actions: it succeeds.
- **Source**: `02-guides/self-hosting.md` (Server Functions encryption key, Version Skew), `02-guides/data-security.md` (Overwriting encryption keys).

### Static files during a rollout

- **Applies**: rolling deploys behind a load balancer.
- **Pass**: one of these.
  - `/_next/static/` comes from storage that each build adds to and no build clears within a retention window, such as a bucket behind a CDN and `assetPrefix`.
  - The load balancer keeps each browser on one instance by a cookie the HTML response carries, and the app recovers when that instance goes away: a page from the previous build can still fail on a chunk it loads lazily, so an error boundary offers a reload. On a host shared with another app, see [Shared origin](#shared-origin).
  - Each image also carries the previous build's `/_next/static/` files.
  - The host routes each request to instances of its deployment by `deploymentId` (version locking).
- **Otherwise**: content-hashed chunks exist only in the build that made them. HTML from one build names chunks the other build's instances lack; the load balancer spreads the chunk requests, some of them 404, and the page stays unhydrated or breaks on its next lazy load, until a reload happens to land every request on one build. When `proxy.ts` gates `/_next/static/` behind a sign-in, the miss is a redirect instead of a 404.
- **Live**: during a rollout, or locally with two builds of the app behind one round-robin proxy, load a page through the load balancer several times and note each answer's build (`data-dpl-id`, or the chunk names in the HTML). Request each chunk it names through the load balancer, with the page's cookies: all 200. To check affinity, use a browser that also holds every cookie other apps on the host set; `curl` with only this app's cookies misses an interfering one.
- **Source**: `02-guides/self-hosting.md` (Version Skew, Immutable Assets), `03-api-reference/05-config/01-next-config-js/assetPrefix.md`.

### Deployment ID

- **Applies**: rolling deploys, or any window in which old and new versions serve at once.
- **Pass**: `deploymentId` in `next.config.ts`, or `NEXT_DEPLOYMENT_ID` at build, is set per deployment and identical across its instances.
- **What it does**: static asset URLs carry `?dpl=` and navigation requests carry `x-deployment-id`, which busts browser and CDN caches and gives a host something to route by. Next.js itself routes nothing by it. A navigation answered by another build reloads the page with or without it, by comparing build IDs (`client/components/router-reducer/fetch-server-response.js`), so on its own it prevents neither failure in the two checks above.
- **Otherwise**: **risk**: caches and the host cannot tell one deployment's requests from another's.
- **Live**: the page's `<html>` carries `data-dpl-id`, and static asset URLs carry `?dpl=`.
- **Source**: `03-api-reference/05-config/01-next-config-js/deploymentId.md`, `02-guides/self-hosting.md` (Version Skew).

### Rollout capacity

- **Applies**: rolling deploys.
- **Pass**: every limit holds the rollout's peak, not the steady state. The peak counts the replicas, the surge, and the instances still draining, which keep their quota and their connections until they exit, plus the jobs and scripts that run during the rollout. It fits the namespace quota, the node pool's ceiling (with every other app on a shared pool), and the database's connection limit. Connections per process are the sum of every pool the process holds. `proxy.ts` is bundled apart from the app, and the app's bundles can each load their own copy of a module, so one module-scope pool can exist several times in one process (measured, 16.4.3). Keep each pool on `globalThis` under a key of its own, and count the proxy's and the app's.
  Jobs, timers, and listeners that `instrumentation.ts` starts run in every instance, the surge included: each run is idempotent, or takes a lock, such as a row lock or a unique key.
- **Otherwise**: a surge instance waits unscheduled and the rollout stalls, or new instances fail with "too many connections" partway through it; a job's effect, such as a notification, happens once per instance.
- **Live**: with the database role's connection limit set to one process's computed total, send tens of concurrent page loads that reach the database through both `proxy.ts` and the app: none fails.
- **Source**: `03-api-reference/03-file-conventions/proxy.md` (Proxy is invoked separately from render code).

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
- **Pass**: `cacheHandlers.remote` points at shared storage, sized for a cold start on every deploy: each entry's key includes the build ID, or `deploymentId` when set, so a new build reads none of the previous build's entries.
- **Otherwise**: it uses the same per-instance in-memory LRU as `use cache`, so the directive gains nothing.
- **Source**: `03-api-reference/05-config/01-next-config-js/cacheHandlers.md` (Handler types), `03-api-reference/01-directives/use-cache.md` (Cache keys).

### Time-based caching

- **Applies**: `use cache` without on-demand revalidation.
- **Pass**: capacity and freshness expectations match the configured handler. With the default production memory handler, each instance computes its own entry on demand, and an entry past `revalidate` is a miss. A handler that keeps entries until `expire`, such as `lib/cache-handler.mts`, serves an entry past `revalidate` and refreshes it in the background, so a read can return data up to `expire` old; `cacheMaxMemorySize` does not size it. Lifetimes do not schedule synchronized refreshes across instances. Mark it **risk** when repeated computation across instances matters.
- **Source**: `03-api-reference/05-config/01-next-config-js/cacheHandlers.md` (`get()`); `03-api-reference/04-functions/cacheLife.md`.

## One writable region

These apply when the app serves from several regions and only one region's database takes writes: the read-only regions read a replica and relay writes to the writable region through `proxy.ts`, which [Proxy relaying to another server](#proxy-relaying-to-another-server) checks.

### What goes to the writable region

- **Pass**:
  - every method but GET and HEAD goes, Server Actions included, since each is a POST to its page's URL;
  - in a read-only region, nothing that answers a GET or HEAD writes: session renewal, last-seen stamps, counters, and `after()` callbacks are off there, or relayed. A write the relay cannot tell from a read beforehand is caught where the replica refuses it, and replayed in the writable region before any of the response is sent;
  - jobs, timers, and listeners that write, such as those `instrumentation.ts` starts, run only in the writable region;
  - a page that reads what only the writable region reaches, such as a third-party API allowed from one region or data that is not replicated, goes there, its prefetches included;
  - health checks, this build's `/_next/static/` files, `public/` files, and `/_next/image` are answered in the region. They hold no one's data and match across regions; relayed, they add a cross-region round trip to each page load after a write, and fail whenever the other region is unreachable.
- **Otherwise**: the replica refuses the write and the user gets a 500; every page view fails in a read-only region; a job runs once per region.
- **Live**: in a read-only region, submit a Server Action and a form: the writable region's log shows each relayed request. Browse there signed in: the read-only region's database logs no refused write.
- **Source**: `03-api-reference/03-file-conventions/proxy.md` (Server Functions are POST requests to their route).

### Reading your own writes

- **Pass**:
  - the answer to a relayed write sets a short-lived mark, a cookie whose `Max-Age` exceeds the replica's measured lag, and while the browser carries it, its requests go to the writable region. The cookie is `Secure` by build rather than by the request's scheme, which reads `http` where TLS ends at the load balancer. A failed relay sets no mark;
  - when sessions live in the database, signing in sets the mark too, since the new session can be missing from the replica for the first requests; and a sign-out counts in a read-only region only once the replica has it;
  - on-demand revalidation in a relayed action reaches the read-only regions' caches too: through a tag store every region shares, or through a `cacheLife` short enough for the user to accept the stale window ([On-demand revalidation](#on-demand-revalidation)).
- **Otherwise**: the writer's next page shows the state before their write, or a 404 for what they just created, which a page that treats a 404 as final never recovers from; a user who has just signed in is sent to sign in again; readers in the read-only regions see a revalidated tag's old data until the entry expires.
- **Live**: in a read-only region, create something and open it at once: it shows. Sign in there and load a page at once: it is signed in.
- **Source**: `02-guides/how-revalidation-works.md`.

### Rendering for the read-only region

- **Pass**: each value that differs by region and shapes a page, such as the locale, currency, feature flags, or public URLs, travels in a header the relay sets, replacing any the browser sent, and a relayed page renders with it rather than with the writable region's own.
- **Otherwise**: the page the writer sees after a write renders in the writable region's language and settings; with locale routing, it redirects to another locale's URL.
- **Live**: in a read-only region, the page after a write renders in that region's locale and settings.

### Deploy order

- **Pass**: the writable region deploys first, so it accepts what the read-only regions' next build relays. A read-only region runs the previous build through the gap, and for longer when its own deploy fails, so the builds share the Server Action key and stay compatible ([Server Actions across builds](#server-actions-across-builds)), and the read-only region relays the `/_next/static/` files only the newer build has ([Proxy relaying to another server](#proxy-relaying-to-another-server)). A read-only region rolls out only once its replica holds the schema the new build reads: logical replication carries no DDL.
- **Otherwise**: through the gap, every Server Action from a read-only region fails, and pages relayed to the newer build never hydrate; or the new build reads a column its replica lacks.
- **Live**: deploy the writable region only, then in a read-only region submit a Server Action and load a page right after a write: both work.

## Under a base path beside another app

These apply when `basePath` is set and another app serves the rest of the same host.

### Unprefixed URLs

- **Pass**: every root-absolute URL in the inventory carries `basePath`. Next.js adds it only to `<Link>`, the router, `redirect()`, and its own assets; anywhere else, write it in from one constant that `next.config.ts` also reads.
- **Otherwise**: the request leaves the app and lands on the other app's catch-all: its 404, its sign-in redirect, or one of its pages.
- **Live**: open each page of the production build with the browser's network log: every same-origin request stays under `basePath`.
- **Source**: `03-api-reference/05-config/01-next-config-js/basePath.md` (Links, Images).

### Shared entry point

- **Pass**:
  - the load balancer or ingress rule for `basePath` matches both `<basePath>` and `<basePath>/*`, is scoped to its hosts, and is evaluated before the other app's catch-all;
  - its health check requests the health route under `basePath` ([Health checks](#health-checks));
  - where one load balancer is configured from several apps' objects, such as Ingresses grouped onto one load balancer, everything this app's rule names, such as a TLS Secret, exists before the rule is applied;
  - the rollback order is written down: remove the rule before the targets it sends to.
- **Otherwise**: the base path keeps reaching the other app; one object the controller cannot reconcile can hold back every host on that load balancer; a rollback that removes the targets first leaves the base path answering 503.
- **Live**: before the change, record the status and one telling header of every host and path on the shared entry point with `curl -sI`; after it, the base path answers from Next.js and every other line matches the record.
- **Source**: the load balancer's or ingress controller's documentation.

### Shared origin

- **Pass**:
  - this app's cookies carry `Path=<basePath>`, unless the other app must read them;
  - the other app's `Path=/` cookies, which reach every request under `basePath`, are listed, and none of them routes or changes those requests. A load balancer stickiness cookie on `Path=/` can override this app's own pin: measured, a load balancer routed every request carrying the other app's insert-mode stickiness cookie at random, whatever this app's pin said, until the other app moved to a cookie of its own;
  - the security headers account for both apps: one origin is one security boundary, so a script injected into either app runs with the user's cookies for both.
- **Otherwise**: session affinity holds only for browsers that never visited the other app, and an injection in one app reaches the other's API.
- **Live**: in a browser that visited the other app first, list the cookies requests under `basePath` send, and repeat the affinity check in [Static files during a rollout](#static-files-during-a-rollout).
- **Source**: the load balancer's documentation on session persistence.

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
