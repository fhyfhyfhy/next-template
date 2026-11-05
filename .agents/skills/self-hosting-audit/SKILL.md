---
name: self-hosting-audit
description: Audit a self-hosted Next.js deployment (Node server, Docker, Kubernetes, behind a reverse proxy, load balancer, or CDN) against the Next.js features this app uses — streaming, `use cache` and revalidation across instances, version skew while two builds serve (static chunks, Server Actions), health checks and graceful shutdown, read-only regions relaying writes to one writable region, a base path shared with another app, CDN caching of HTML and RSC requests. Use before the first self-hosted deployment, when the deployment's shape changes, or when something misbehaves only once deployed or only during a rollout.
---

# Self-hosting audit

Features that work unchanged under one `next start` can break or degrade once the app runs on several instances, through a rollout, behind a buffering proxy or a CDN, or beside another app on one host. This audit finds which of them apply to this deployment and checks each one, in the repo and against a running deployment. It reports; it changes nothing unless the user asks for a fix.

Documentation checked against installed `next` 16.4.3, from `node_modules/next/dist/docs/01-app/02-guides/self-hosting.md`, `cdn-caching.md`, `ppr-platform-guide.md`, and the references and source files each check cites. Historical runtime measurements are dated separately in [checks.md](checks.md). When `package.json` names another version, re-read the cited docs before relying on a check. When a doc or an observation contradicts a check, correct it in `checks.md` in the same change, and name the correction and its evidence in your report.

## Steps

1. **Establish the deployment's shape**:
   - how many instances serve the app (fixed or autoscaled), in which regions, which region's database takes writes, and the URL of a deployed environment, such as staging, for live checks;
   - how a new version rolls out, and how long two builds serve at once: the surge and pace of a rollout, and any other region or environment that deploys the same code later;
   - what sits in front (reverse proxy, load balancer, CDN, and which products), what its health checks request, and which other apps share the host or the load balancer;
   - the limits a rollout's peak counts against: quotas, node pools, and database connection limits.

   Find each answer yourself, in this order, using only commands that read:
   - **The repo**: `Dockerfile`, compose files, Kubernetes, Helm, or Terraform manifests, proxy configs such as `nginx.conf`, CI and deploy workflows (targets, replica counts, rollout strategy), `next.config.ts`, the README and `docs/`, and the git history of those files.
   - **The tools on this machine**, when they are installed and already authenticated: `kubectl get deploy,hpa,ingress -o yaml`, `docker compose config`, or the hosting provider's CLI describing the service.
   - **The deployed app**, once a URL turns up in the repo or the tools: response headers name the layers in front, such as `server`, `via`, `age`, `x-cache`, `cf-cache-status`, or `x-amz-cf-id`.

   Then ask the user, in one message, only for what none of these settled and a check depends on. Done when each answer is known with its source, or asked.
2. **Inventory what the app uses**, as [checks.md § Inventory](checks.md#inventory) lists. Done when each item has its locations, or is marked unused.
3. **Run the applicable checks.** [checks.md](checks.md) groups them by when they apply: always, with more than one instance or rolling deploys, with one writable region, under a base path beside another app, and behind a CDN. Skip a group that does not apply and say why. Read each check's setting in the repo; where it lives outside the repo, read it with the tools from step 1 or observe it live, and ask the user only when neither reaches it. Done when every applicable check has a status: **pass**; **fail**; **risk**, which works but carries a cost the user must accept or fix; or **unverified**, with what would verify it.
4. **Observe it live.** Run each check's live observation against the deployed environment when one is reachable. Otherwise run it against `pnpm build` and `pnpm start`, behind the repo's proxy config when it has one, and say so: a local run cannot show what the real proxy, load balancer, or CDN does. The rolling-deploy checks show only while two builds serve: observe them during a real rollout, or locally with two builds of the app behind one round-robin proxy. A live observation overrides a reading of the config. Done when each observation ran, or is listed as unverified with the reason.
5. **Report.** A table, most severe first: check, status, evidence (file and line, config value, or observed output), and the fix as an exact setting or code change. When the user asks for fixes, change what lives in the repo, and give exact settings for infrastructure outside it.
