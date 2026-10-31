# next-partial-prefetching-optimizer

Upstream: `npx skills add https://github.com/vercel/next.js/tree/v16.4.0/skills -s next-partial-prefetching-optimizer -a claude-code -a codex -y`, directory `skills/next-partial-prefetching-optimizer/` in `vercel/next.js` at tag `v16.4.0`. `skills-lock.json` records this source and ref.

## Apply workspace conventions and cross-platform commands

Preserve this project's data ownership and transport constraints and use its browser-harness workflow for manual checks. The production Playwright instant() test remains the proof; the added PowerShell forms only adapt shell syntax.

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

File: rig-template.md

````diff
@@ ### Test command and base URL @@
-EXPOSE_TESTING_API=1 pnpm build
-BASE_URL=http://localhost:3000 pnpm playwright test tests/prefetch-optimization.spec.ts
+EXPOSE_TESTING_API=1 pnpm build && BASE_URL=http://localhost:3000 pnpm playwright test tests/prefetch-optimization.spec.ts
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
+pnpm playwright test tests/prefetch-optimization.spec.ts
 ```
 
````

## Start the testing build in this project

This project's `next.config.ts` sends a build made with `EXPOSE_TESTING_API=1` to `.next-e2e`, so a server started without the variable serves `.next`, which lacks the testing API.

File: rig-template.md

````diff
@@ ### Test command and base URL @@
 ```
 
-If the rig does not use `webServer`, start `pnpm start --port 3000` in a
-separate terminal after the build, keep it running during the test command,
-and stop it afterward. Use only one server lifecycle for the measured app.
+If the rig does not use `webServer`, start the server with the same variable
+after the build, `EXPOSE_TESTING_API=1 pnpm start --port 3000` (PowerShell:
+`$env:EXPOSE_TESTING_API = '1'; pnpm start --port 3000`), in a separate
+terminal, keep it running during the test command, and stop it afterward.
+This project's `next.config.ts` puts a build made with the variable in
+`.next-e2e`, and `start` serves that directory only while the variable is set.
+Use only one server lifecycle for the measured app.
 
 Adapt the script names and port to the project. Follow the public
````
