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

## Correct the guide section link

The bundled 16.4 guide includes the step number in this heading's anchor.

````diff
@@ ## D. FIX: apply the documented pattern @@
 URL-specific content in the instant
-UI](https://nextjs.org/docs/app/guides/optimizing-the-static-shell#include-url-specific-content-in-the-instant-ui)
+UI](https://nextjs.org/docs/app/guides/optimizing-the-static-shell#step-5-include-url-specific-content-in-the-instant-ui)
 and hand off to `next-partial-prefetching-optimizer`.
````

File: rig-template.md

````diff
@@ ### Test command and base URL @@
-EXPOSE_TESTING_API=1 pnpm build
-BASE_URL=http://localhost:3000 pnpm playwright test tests/static-shell.spec.ts
+EXPOSE_TESTING_API=1 pnpm build && BASE_URL=http://localhost:3000 pnpm playwright test tests/static-shell.spec.ts
+```
+
+PowerShell (stop if the build fails):
+
+```powershell
+$env:EXPOSE_TESTING_API = '1'
+pnpm build
+$instantBuildExitCode = $LASTEXITCODE
+Remove-Item Env:EXPOSE_TESTING_API
+if ($instantBuildExitCode -ne 0) { throw 'Production test build failed' }
+$env:BASE_URL = 'http://localhost:3000'
+pnpm playwright test tests/static-shell.spec.ts
 ```
 
````
