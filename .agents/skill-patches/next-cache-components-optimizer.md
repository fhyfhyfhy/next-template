# next-cache-components-optimizer

Upstream: `npx skills add https://github.com/vercel/next.js/tree/v16.4.0/skills -s next-cache-components-optimizer -a claude-code -a codex -y`, directory `skills/next-cache-components-optimizer/` in `vercel/next.js` at tag `v16.4.0`. `skills-lock.json` records this source and ref.

## Apply workspace conventions and cross-platform commands

Preserve this project's data ownership and transport constraints and use its browser-harness workflow for manual checks. The production Playwright instant() test remains the proof; the added PowerShell forms only adapt shell syntax.

````diff
@@ # next-cache-components-optimizer @@
 
 # next-cache-components-optimizer
+
+Workspace integration: preserve the owner and refresh contract from
+[`next-data-flow`](../next-data-flow/SKILL.md) when changing data access;
+its linked rules own backend transport and API modules. Use the installed
+`browser-harness` skill (`bh`) for manual browser checks and demonstrations.
+Keep the automated production `@next/playwright` `instant()` suite below;
+browser-harness observations and `next-dev-loop` development checks do not
+replace that regression proof.
 
 Set up an agentic optimization loop that drives a Next.js route from "not
@@ ## After optimization @@
 ```
 
+PowerShell:
+
+```powershell
+rg -n 'partialPrefetching|prefetch\s*=\s*[''"]partial[''"]' --glob 'next.config.*' --glob 'app/**' --glob 'src/app/**'
+```
+
 If `partialPrefetching: true` is in config, the app is globally adopted. If only
 `prefetch = 'partial'` matches, treat those destination segments as adopted
````

## Run the suite through the project's e2e entry

This project's Playwright `webServer` (`playwright.config.ts`) already makes the build with `EXPOSE_TESTING_API=1`, which `next.config.ts` sends to `.next-e2e`, and starts it on the e2e port with what the specs need; `testDir` is `e2e/`, and the config does not read `BASE_URL`. A suite elsewhere, or a build and server started by hand, misses all of that, so the suite is an e2e spec like any other.

File: rig-template.md

````diff
@@ ### Test command and base URL @@
 ```bash filename="Terminal"
-EXPOSE_TESTING_API=1 pnpm build
-BASE_URL=http://localhost:3000 pnpm playwright test tests/static-shell.spec.ts
+pnpm test:e2e e2e/static-shell.spec.ts
 ```
 
-If the rig does not use `webServer`, start `pnpm start --port 3000` in a
-separate terminal after the build, keep it running during the test command,
-and stop it afterward. Use only one server lifecycle for the measured app.
+Write the suite in `e2e/`, the config's `testDir`, as `.claude/rules/e2e.md`
+describes, and run it through `pnpm test:e2e`, the same command on PowerShell.
+Its `webServer` is the one server lifecycle: it makes the build with
+`EXPOSE_TESTING_API=1` and serves it at the config's `baseURL`, which the
+suite uses; the config does not read `BASE_URL`.
 
 Adapt the script names and port to the project. Follow the public
````

## Correct the guide section link

The bundled 16.4 guide includes the step number in this heading's anchor.

File: SKILL.md

````diff
@@ ## D. FIX: apply the documented pattern @@
 URL-specific content in the instant
-UI](https://nextjs.org/docs/app/guides/optimizing-the-static-shell#include-url-specific-content-in-the-instant-ui)
+UI](https://nextjs.org/docs/app/guides/optimizing-the-static-shell#step-5-include-url-specific-content-in-the-instant-ui)
 and hand off to `next-partial-prefetching-optimizer`.
````
