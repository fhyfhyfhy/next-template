---
name: next-dev-loop
description: >
  Verify Next.js runtime behavior after editing app code. Use this
  skill to confirm a change actually works in a running app — not
  just that it compiles or type-checks. Combines /_next/mcp
  (Next.js's view) with browser-harness (the browser's view).
  Requires a running `next dev`.
---

# next-dev-loop

The edit/verify rhythm during `next dev` — make a change, then
confirm it actually works at runtime, not only that the types or
the build are happy.

You verify through two views of the same running app:

- **`/_next/mcp`** — an HTTP endpoint Next.js exposes about itself.
  Knows framework-specific things: routes, segments, RSC, server
  actions, server logs, and errors as Next.js saw them. Call
  `tools/list` for the current surface.
- **`browser-harness`** — this workspace's real-browser workflow, invoked
  through `bh`. Read its installed skill, including the agent-kit overrides,
  before the first command. Use its documented accessibility, DOM, console,
  network, screenshot, and opt-in React inspection capabilities. For component
  trees, props/state/hooks, or commit profiling, read `react-inspection.md`
  from the installed browser-harness skill before using its `react_*` helpers.

The two views cross-check each other.

## requires

- Next.js **16.3+** with **Turbopack** — `/_next/mcp` plus the
  proactive compile check via `get_compilation_issues`.
- The installed `browser-harness` skill and agent-kit's `bh` wrapper, with
  its dedicated Chrome reachable. The skill owns setup, accounts, domain
  notes, recordings, daemon naming, focus, and cleanup.

Both views must be live. If a prerequisite is missing, diagnose it using the
installed version and the browser-harness setup instructions, then report
the specific blocker. Do not claim runtime verification from source or an
HTTP-only check. A framework upgrade is a separate scope decision; see
https://nextjs.org/docs/app/getting-started/upgrading.

This loop verifies development behavior. Cache and prefetch behavior need
separate production verification. For static-shell or selected-link readiness,
use the corresponding official optimizer and its `@next/playwright` `instant()`
tests.

## preflight

Once per session, confirm both views are live.

1. **Open the target URL through browser-harness.** Read the `next dev`
   banner to get the actual URL and port. Inspect `current_tab()` and
   `list_tabs()` when continuing this task, and reuse its tab. For a new
   verification page, use `new_window(url)` so it renders while Chrome stays
   behind the user's work. Keep the returned tab ID for cleanup:

   ```bash
   bh <<'PY'
   print(new_window("http://localhost:<port>/<route>"))
   wait_for_load()
   print(page_info())
   PY
   ```

   PowerShell:

   ```powershell
   bh -Code @'
   print(new_window("http://localhost:<port>/<route>"))
   wait_for_load()
   print(page_info())
   '@
   ```

   The main agent omits `BU_NAME`. A browser subagent uses one assigned,
   distinct slug on every call, including cleanup: prefix bash commands with
   `BU_NAME=<task-slug>`; start each PowerShell command with
   `$env:BU_NAME = '<task-slug>';`. Use the wrapper's session isolation rather
   than inventing agent-browser session or restore flags.

   Reuse this task's tab across calls. Follow browser-harness for saved login
   state and account selection; the shared profile can contain another
   account. Before site interactions, read applicable domain notes under the
   workspace returned by `bh workspace`. Keep Chrome in the background;
   avoid activation calls and minimizing the verification window. For a
   focus-dependent feature, use the documented focus-emulation call.

   For React checks on a new page, open `new_window("about:blank")`, call
   `react_enable()`, then `goto_url(target_url)` instead of navigating directly
   with `new_window(url)`. On an existing app tab, `react_enable(reload=True)`
   installs before React boots again; preserve transient input and finish any
   active profile before that reload. Check `react_status()` for a ready tree
   and the capabilities needed by the check.

2. Probe `/_next/mcp` (`tools/list`) — confirm it's reachable and
   lists `get_compilation_issues`. Use the banner's actual origin plus
   `/_next/mcp`, not an assumed port. Check `get_project_metadata` against
   this worktree before using its route map.
   - Unreachable → check the server process, banner URL, and installed Next.js
     version. Resolve the cause before continuing.
   - `get_compilation_issues` absent → check the installed version and tool
     surface; report the missing capability instead of assuming an upgrade.
   - Call tools with the schemas returned by `tools/list`. HTTP clients must
     send the MCP JSON-RPC request and accept its SSE response.
3. `get_compilation_issues` doubles as a Turbopack probe. An error
   response of `"Turbopack project is not available..."` means the
   user is on webpack. Refuse — Turbopack is required.
4. `get_routes` → your route map for the rest of the session.

## loop

### before the edit — narrow the scope

Ask the running app, not the codebase. `/_next/mcp` knows which
files rendered the current route; use those as your search scope.
Runtime introspection stays cheap as the codebase grows; agentic
search doesn't.

### after the edit — verify

Four failure modes. Check each:

- **Compiles** — `get_compilation_issues`.
- **Runs without errors** — `/_next/mcp` (server and bubbled-up
  browser errors both surface here).
- **Behaves as intended** — `bh` drives the real interaction. Find targets
  through the accessibility tree, use the documented input helpers, then
  assert the resulting URL and visible state. Capture a screenshot when the
  result depends on layout or appearance. Use the browser-harness interaction
  references for console or network evidence; do not guess helper names.
- **React-level behavior, when relevant** — use `react_tree()` and
  `react_inspect(renderer_id, element_id)` for current instances and available
  props, state, and hooks. Inspect before profiling. For render regressions,
  call `react_profile_start()`, perform the interaction, then call
  `react_profile_stop()` and retain its raw profile. Report committed renders
  per renderer and element ID, keeping same-name instances separate; these
  are not component-function call counts. Follow the browser-harness reference
  for setup and renderer/build limitations. DOM evidence can prove visible
  fallbacks and preserved inputs; a browser tree alone does not prove a
  server/client module boundary or a Suspense root cause. Support those claims
  with relevant Next.js MCP, source/build, or test evidence. If a required
  claim still lacks evidence, report it as unverified and keep checking the
  other paths.

Pick the specific tool from `tools/list` or the installed browser-harness
skill and its references rather than from memory.

## gotchas

- **Preserve `.next` while the development server is running.** Moving or
  deleting it disconnects the server from its generated state and discards
  incremental caches. Moving it to a backup is still a reset. If a production
  build needs isolated output, configure a separate `distDir`.
- **Keep the task's daemon and tab stable.** Follow browser-harness's
  `BU_NAME` rules on every call. A daemon isolates attachment, not website
  cookies: the dedicated browser profile is shared.
- **Reconcile disagreements before changing the app.** Verify the URL,
  worktree, port, account, attached tab, and fresh MCP/browser evidence. A
  clean server render does not rule out a browser-only bug.
- After navigation, call `wait_for_load()`, then check the expected URL and
  UI condition. A completed load does not prove asynchronous UI has settled;
  wait for the specific result without relying on global network idleness.
- For an empty read or `about:blank`, inspect `current_tab()`, `list_tabs()`,
  and `page_info()`. Use `ensure_real_tab()` for a stale or internal tab,
  then reattach to this task's tab and retry. An empty read alone does not
  establish whether the app or attachment failed.
- Hidden tabs can throttle rendering and timers. Follow browser-harness's
  `new_window()` recovery when a page must render or scrolling times out.
- Refresh browser and React evidence after navigation or Fast Refresh; read
  the tree again for current renderer and element IDs before inspecting.
- `/_next/mcp` replies can be SSE. Parse JSON from the `data:` payloads;
  do not parse the `event:` lines as JSON. Use an SSE-aware HTTP client or
  parse the response explicitly in Node/Python on either operating system.
- `get_errors` and `get_page_metadata` need at least one navigation
  to populate.

## reference

Use the current `tools/list` response and schemas as the source of truth.
The tools below describe the expected surface; report any missing capability
needed by the current verification.

```
# /_next/mcp                 notes
get_project_metadata         projectPath, devServerUrl, bundler
get_routes                   fs-scan; no browser session needed
get_errors                   runtime + build; needs a browser session;
                             includes browser-side errors caught by the
                             dev server
get_page_metadata            segment trie + routerType; needs a browser
                             session; use as a discovery shortcut for
                             which files power a route
get_logs                     returns logFilePath
get_server_action_by_id      hashed id → file + functionName
get_compilation_issues       Turbopack only; errors on webpack
                             ("Turbopack project is not available")
```

## teardown

Finish browser-harness's domain-note and recording obligations when they
apply. Close only tabs opened by this task, using their recorded IDs, then
run `bh stop` with the same `BU_NAME` scope as the rest of the task. The
dedicated profile retains its login state; there is no separate restore key.
Leave `next dev` up if another loop or the user still needs it; otherwise stop
only the server this task started.

## Report Next.js friction

Only participate in agent feedback when managed Next.js feedback instructions
are already loaded for the project. Their presence means the feature is
enabled; their absence means it is disabled.

When enabled, add qualifying feedback candidates found during verification to
the feedback candidate queue for the current user request, then continue
verification. Do not run the feedback command or open review forms during the
loop or at this Skill's teardown.

The managed instructions own the single reporting pass immediately before the
final response. If they are absent, do not queue or report feedback.
