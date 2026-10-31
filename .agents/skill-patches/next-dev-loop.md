# next-dev-loop

Upstream: `npx skills add https://github.com/vercel/next.js/tree/v16.4.0/skills -s next-dev-loop -a claude-code -a codex -y`, directory `skills/next-dev-loop/` in `vercel/next.js` at tag `v16.4.0`. `skills-lock.json` records this source and ref.

## Use browser-harness for the runtime loop

Use this workspace's browser-harness lifecycle, browser probes, and opt-in React inspection helpers while preserving Next.js MCP as the second view. React profiling reports per-instance committed renders; framework boundary and Suspense root-cause claims require matching evidence. Commands cover bash and PowerShell, and production cache/prefetch proofs stay with the official optimizers.

````diff
@@ frontmatter @@
   skill to confirm a change actually works in a running app — not
   just that it compiles or type-checks. Combines /_next/mcp
-  (Next.js's view) with agent-browser (the browser's view).
+  (Next.js's view) with browser-harness (the browser's view).
   Requires a running `next dev`.
 ---
@@ # next-dev-loop @@
   actions, server logs, and errors as Next.js saw them. Call
   `tools/list` for the current surface.
-- **`agent-browser`** — a CLI that drives a real Chrome. Knows
-  framework-agnostic browser things: DOM, console, network, React
-  fiber, vitals. Before driving it, run `agent-browser skills get core`
-  once for the version-matched usage guide — don't guess subcommands
-  from memory.
+- **`browser-harness`** — this workspace's real-browser workflow, invoked
+  through `bh`. Read its installed skill, including the agent-kit overrides,
+  before the first command. Use its documented accessibility, DOM, console,
+  network, screenshot, and opt-in React inspection capabilities. For component
+  trees, props/state/hooks, or commit profiling, read `react-inspection.md`
+  from the installed browser-harness skill before using its `react_*` helpers.
 
 The two views cross-check each other.
@@ ## requires @@
 - Next.js **16.3+** with **Turbopack** — `/_next/mcp` plus the
   proactive compile check via `get_compilation_issues`.
-- `agent-browser` **>= 0.31.1** — React introspection, worktree-scoped
-  `session id`, idempotent `--restore`, and launch flag reconciliation.
-
-These are hard floors, not soft preferences. If anything is missing,
-tell the user how to upgrade and stop. Don't fall back to grepping
-source or to a weaker probe — this skill assumes both views are live
-at the versions above.
-
-- Upgrade Next.js: `pnpm next upgrade` (or `npx next upgrade`).
-  Docs: https://nextjs.org/docs/app/getting-started/upgrading
-  (version-16 guide:
-  https://nextjs.org/docs/app/guides/upgrading/version-16)
-- Install or upgrade `agent-browser`: `npm i -g agent-browser@latest`.
-  If the CLI isn't on `PATH`, install it before continuing — preflight
-  expects to invoke it directly.
+- The installed `browser-harness` skill and agent-kit's `bh` wrapper, with
+  its dedicated Chrome reachable. The skill owns setup, accounts, domain
+  notes, recordings, daemon naming, focus, and cleanup.
+
+Both views must be live. If a prerequisite is missing, diagnose it using the
+installed version and the browser-harness setup instructions, then report
+the specific blocker. Do not claim runtime verification from source or an
+HTTP-only check. A framework upgrade is a separate scope decision; see
+https://nextjs.org/docs/app/getting-started/upgrading.
+
+This loop verifies development behavior. Cache and prefetch behavior need
+separate production verification. For static-shell or selected-link readiness,
+use the corresponding official optimizer and its `@next/playwright` `instant()`
+tests.
 
 ## preflight
@@ ## preflight @@
 Once per session, confirm both views are live.
 
-1. **Open `agent-browser` at the target URL, restoring saved
-   login state when present.** First derive one stable session id for
-   this checkout and use it for every `agent-browser` command:
+1. **Open the target URL through browser-harness.** Read the `next dev`
+   banner to get the actual URL and port. Inspect `current_tab()` and
+   `list_tabs()` when continuing this task, and reuse its tab. For a new
+   verification page, use `new_window(url)` so it renders while Chrome stays
+   behind the user's work. Keep the returned tab ID for cleanup:
 
    ```bash
-   SESSION="$(agent-browser session id --scope worktree --prefix next-dev-loop)"
-   export AGENT_BROWSER_SESSION="$SESSION"
-   export AGENT_BROWSER_RESTORE="$SESSION"
+   bh <<'PY'
+   print(new_window("http://localhost:<port>/<route>"))
+   wait_for_load()
+   print(page_info())
+   PY
    ```
 
-   Then open the target URL:
-
-   ```bash
-   agent-browser --session "$SESSION" --restore --enable react-devtools open <url>
+   PowerShell:
+
+   ```powershell
+   bh -Code @'
+   print(new_window("http://localhost:<port>/<route>"))
+   wait_for_load()
+   print(page_info())
+   '@
    ```
 
-   `--scope worktree` keeps parallel worktrees and copied checkouts
-   from colliding. Bare `--restore` uses the session id as the
-   persistence key, loads saved cookies/localStorage before navigation
-   when present, and auto-saves state on close. Always pass the desired
-   launch flags on `open`; agent-browser will reuse, relaunch, or restart
-   its scoped background state as needed.
-
-   Keep routine verification headless. If the user asks to see the UI, open the
-   current URL in the coding harness's inline browser. It is a separate browser
-   context, so do not assume state carries over. When login or existing
-   `agent-browser` state must carry over, reopen that session headed instead:
-
-   ```bash
-   agent-browser --session "$SESSION" --restore --headed --enable react-devtools open <url>
-   ```
-
-   Pause while the user drives login, then continue with the same session and
-   keep it headed for the rest of the loop.
+   The main agent omits `BU_NAME`. A browser subagent uses one assigned,
+   distinct slug on every call, including cleanup: prefix bash commands with
+   `BU_NAME=<task-slug>`; start each PowerShell command with
+   `$env:BU_NAME = '<task-slug>';`. Use the wrapper's session isolation rather
+   than inventing agent-browser session or restore flags.
+
+   Reuse this task's tab across calls. Follow browser-harness for saved login
+   state and account selection; the shared profile can contain another
+   account. Before site interactions, read applicable domain notes under the
+   workspace returned by `bh workspace`. Keep Chrome in the background;
+   avoid activation calls and minimizing the verification window. For a
+   focus-dependent feature, use the documented focus-emulation call.
+
+   For React checks on a new page, open `new_window("about:blank")`, call
+   `react_enable()`, then `goto_url(target_url)` instead of navigating directly
+   with `new_window(url)`. On an existing app tab, `react_enable(reload=True)`
+   installs before React boots again; preserve transient input and finish any
+   active profile before that reload. Check `react_status()` for a ready tree
+   and the capabilities needed by the check.
 
 2. Probe `/_next/mcp` (`tools/list`) — confirm it's reachable and
-   lists `get_compilation_issues`. First read the port off the
-   `next dev` banner; if it isn't 3000, set
-   `NEXT_MCP_URL=http://localhost:<port>/_next/mcp` before probing:
-   - Unreachable → either `next dev` isn't running, or Next.js is
-     below 16.3. Check `package.json` to disambiguate, then refuse.
-   - `get_compilation_issues` not in the list → Next.js below 16.3.
-     Refuse and tell the user to upgrade.
+   lists `get_compilation_issues`. Use the banner's actual origin plus
+   `/_next/mcp`, not an assumed port. Check `get_project_metadata` against
+   this worktree before using its route map.
+   - Unreachable → check the server process, banner URL, and installed Next.js
+     version. Resolve the cause before continuing.
+   - `get_compilation_issues` absent → check the installed version and tool
+     surface; report the missing capability instead of assuming an upgrade.
+   - Call tools with the schemas returned by `tools/list`. HTTP clients must
+     send the MCP JSON-RPC request and accept its SSE response.
 3. `get_compilation_issues` doubles as a Turbopack probe. An error
    response of `"Turbopack project is not available..."` means the
@@ ### after the edit — verify @@
 - **Runs without errors** — `/_next/mcp` (server and bubbled-up
   browser errors both surface here).
-- **Behaves as intended** — `agent-browser` drives the page; assert
-  what the user actually sees.
-- **React-level behavior** — `agent-browser` with react-devtools
-  enabled exposes the component tree, props, state, and render
-  counts. Anchor framework-level checks here (extra renders,
-  server/client boundary shifts, suspense fallbacks) — DOM asserts
-  alone miss them.
-
-Pick the specific tool from `tools/list` or the agent-browser
-manual rather than from memory.
+- **Behaves as intended** — `bh` drives the real interaction. Find targets
+  through the accessibility tree, use the documented input helpers, then
+  assert the resulting URL and visible state. Capture a screenshot when the
+  result depends on layout or appearance. Use the browser-harness interaction
+  references for console or network evidence; do not guess helper names.
+- **React-level behavior, when relevant** — use `react_tree()` and
+  `react_inspect(renderer_id, element_id)` for current instances and available
+  props, state, and hooks. Inspect before profiling. For render regressions,
+  call `react_profile_start()`, perform the interaction, then call
+  `react_profile_stop()` and retain its raw profile. Report committed renders
+  per renderer and element ID, keeping same-name instances separate; these
+  are not component-function call counts. Follow the browser-harness reference
+  for setup and renderer/build limitations. DOM evidence can prove visible
+  fallbacks and preserved inputs; a browser tree alone does not prove a
+  server/client module boundary or a Suspense root cause. Support those claims
+  with relevant Next.js MCP, source/build, or test evidence. If a required
+  claim still lacks evidence, report it as unverified and keep checking the
+  other paths.
+
+Pick the specific tool from `tools/list` or the installed browser-harness
+skill and its references rather than from memory.
 
 ## gotchas
@@ ## gotchas @@
   incremental caches. Moving it to a backup is still a reset. If a production
   build needs isolated output, configure a separate `distDir`.
-- **Every `agent-browser` command must know your session and restore
-  key, or it may use an empty default browser or fail to save login
-  state.** Easiest: export both `AGENT_BROWSER_SESSION="$SESSION"` and
-  `AGENT_BROWSER_RESTORE="$SESSION"` at the top of each shell you run
-  agent-browser in. If you do not export them, pass
-  `--session "$SESSION" --restore` on every command.
-- **When the two views disagree, suspect the tooling first.** If
-  `agent-browser` says a route is broken but `/_next/mcp` and the
-  server say it rendered cleanly, a stale or misdirected browser
-  session is the likelier cause than a real bug — reconcile the views
-  before debugging the app.
-- Confirming a click or navigation: the page settles a beat later, so
-  wait with `wait --load networkidle` (no path to get wrong), then
-  snapshot/read to confirm the page. Avoid `wait --url` unless you pass
-  the link's exact href — a guessed or placeholder path won't match the
-  real URL and times out after 25s.
-- A blank read, empty snapshot, `about:blank`, or a "no browser
-  session" error — right after `open` or after a click (even if `open`
-  reported the page) — is the browser dropping the page (a stale
-  session), not a broken route. Reopen your session at the URL with the
-  same launch flags as the active loop, then re-snapshot. If still blank, run
-  `agent-browser --session "$SESSION" --restore close`, then reopen with
-  those same flags. Don't fall back to `curl`; it bypasses the browser
-  you're testing.
-- React introspection output is stale after navigation. Re-run.
-- `/_next/mcp` replies are SSE — read the JSON off the `data:` line
-  with `sed -n 's/^data: //p'` (a plain `sed 's/^data: //'` leaves the
-  `event:` line and the parse fails).
+- **Keep the task's daemon and tab stable.** Follow browser-harness's
+  `BU_NAME` rules on every call. A daemon isolates attachment, not website
+  cookies: the dedicated browser profile is shared.
+- **Reconcile disagreements before changing the app.** Verify the URL,
+  worktree, port, account, attached tab, and fresh MCP/browser evidence. A
+  clean server render does not rule out a browser-only bug.
+- After navigation, call `wait_for_load()`, then check the expected URL and
+  UI condition. A completed load does not prove asynchronous UI has settled;
+  wait for the specific result without relying on global network idleness.
+- For an empty read or `about:blank`, inspect `current_tab()`, `list_tabs()`,
+  and `page_info()`. Use `ensure_real_tab()` for a stale or internal tab,
+  then reattach to this task's tab and retry. An empty read alone does not
+  establish whether the app or attachment failed.
+- Hidden tabs can throttle rendering and timers. Follow browser-harness's
+  `new_window()` recovery when a page must render or scrolling times out.
+- Refresh browser and React evidence after navigation or Fast Refresh; read
+  the tree again for current renderer and element IDs before inspecting.
+- `/_next/mcp` replies can be SSE. Parse JSON from the `data:` payloads;
+  do not parse the `event:` lines as JSON. Use an SSE-aware HTTP client or
+  parse the response explicitly in Node/Python on either operating system.
 - `get_errors` and `get_page_metadata` need at least one navigation
   to populate.
@@ ## reference @@
 ## reference
 
-All tools below are present once preflight passes. If `tools/list`
-is missing any of them, preflight should have refused — re-check.
+Use the current `tools/list` response and schemas as the source of truth.
+The tools below describe the expected surface; report any missing capability
+needed by the current verification.
 
 ```
@@ ## teardown @@
 ## teardown
 
-Close the session with the same session and restore context:
-`agent-browser --session "$SESSION" --restore close`. `close` saves
-that session's cookies and storage so the next loop's `--restore` open
-keeps the user logged in. Leave `next dev` up for the next loop.
+Finish browser-harness's domain-note and recording obligations when they
+apply. Close only tabs opened by this task, using their recorded IDs, then
+run `bh stop` with the same `BU_NAME` scope as the rest of the task. The
+dedicated profile retains its login state; there is no separate restore key.
+Leave `next dev` up if another loop or the user still needs it; otherwise stop
+only the server this task started.
 
 ## Report Next.js friction
````
