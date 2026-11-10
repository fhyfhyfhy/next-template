# next-partial-prefetching-optimizer

Upstream: `npx skills add https://github.com/vercel/next.js/tree/v16.4.0/skills -s next-partial-prefetching-optimizer -a claude-code -a codex -y`, directory `skills/next-partial-prefetching-optimizer/` in `vercel/next.js` at tag `v16.4.0`. `skills-lock.json` records this source and ref.

## Apply workspace conventions

Preserve this project's data ownership and transport constraints and use its browser-harness workflow for manual checks. The production Playwright instant() test remains the proof.

````diff
@@ # Partial Prefetching optimizer @@
 
 # Partial Prefetching optimizer
+
+Workspace integration: preserve the owner and refresh contract from
+[`next-data-flow`](../next-data-flow/SKILL.md) when changing data access;
+its linked rules own backend transport and API modules. Use the installed
+`browser-harness` skill (`bh`) for manual browser checks and demonstrations.
+Keep the automated production `@next/playwright` `instant()` suite below;
+browser-harness observations and `next-dev-loop` development checks do not
+replace that regression proof.
 
 Optimize each requested source link and destination as its own contract. Turn
````

## Run the suite through the project's e2e entry

This project's Playwright `webServer` (`playwright.config.ts`) already makes the build with `EXPOSE_TESTING_API=1`, which `next.config.ts` sends to `.next-e2e`, and starts it on the e2e port with what the specs need; `testDir` is `e2e/`, and the config does not read `BASE_URL`. A suite elsewhere, or a build and server started by hand, misses all of that, so the suite is an e2e spec like any other.

File: rig-template.md

````diff
@@ ### Test command and base URL @@
 ```bash filename="Terminal"
-EXPOSE_TESTING_API=1 pnpm build
-BASE_URL=http://localhost:3000 pnpm playwright test tests/prefetch-optimization.spec.ts
+pnpm test:e2e e2e/prefetch-optimization.spec.ts
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
