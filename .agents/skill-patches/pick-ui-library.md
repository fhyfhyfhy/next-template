# pick-ui-library

Upstream: `skills/pick-ui-library/` in `emilkowalski/skills`, as `npx skills update` installs it.

## Agents pick libraries on their own

`.claude/rules/libraries.md` sends agents here for any need its own list leaves out, so the skill has to load when an agent chooses a library, not only when a user invokes it. The description names the moment to reach for it and lists only needs the skill still covers. The canned first reply goes too: an agent that invokes the skill mid-task needs the pick, not a greeting that waits for a question.

```diff
@@ frontmatter @@
 name: pick-ui-library
-description: Pick the right library for a given frontend task from a curated, opinionated list — numbers, OTP inputs, charts, command menus, virtualization, drag and drop, toasts, state, styling, and more. Only runs when explicitly invoked; it does not trigger on its own.
-disable-model-invocation: true
+description: Choose the library for a task from a curated list. Use before adding a dependency or writing code that needs one: toasts, OTP inputs, command menus, animation, animated numbers, drag and drop, virtualization, state, styling, syntax highlighting, and more.
 ---
```

```diff
@@ ## Initial Response @@
 # Picking The Right Library
 
-## Initial Response
-
-When this skill is first invoked without a specific question, respond only with:
-
-> I'm ready to pick the right library for your task, my picks come from Emil Kowalski's curated list.
-
-Do not provide any other information until the user asks a question.
-
 A lookup skill. When invoked with a task ("I need toasts", "what should I use for drag and drop?"), match the task to the curated list below and recommend the library. These are deliberate, taste-driven picks — don't substitute alternatives outside this list unless the user asks for one or the task genuinely isn't covered.
```

## Charts come from the repo's pick

The repo's chart pick is `@tanstack/react-charts`, listed in `.claude/rules/libraries.md`, so the skill leaves charts to it.

```diff
@@ ### Charts @@
 Reach for motion when you need springs, layout animations, exit animations, or gesture-driven values. A simple hover or fade doesn't need it — plain CSS transitions are the right tool there.
 
-### Charts
-
-| Task | Library |
-| --- | --- |
-| Real-time / streaming charts | [Liveline](https://github.com/benjitaylor/liveline) |
-| General charts (static or interactive dashboards) | [recharts](https://recharts.org) |
-
-The split: if data points arrive live and the chart scrolls with time, use Liveline. Everything else is recharts.
-
 ### Interaction & performance
```

## Class names come from the project's `cn`

`.claude/rules/components.md` sets `cn` from `@/lib/cn` for conditional and merged class names, so the skill leaves that choice to it.

```diff
@@ ### State & styling @@
 | State management | [zustand](https://zustand.docs.pmnd.rs) |
-| Constructing `className` strings conditionally | [clsx](https://github.com/lukeed/clsx) |
 | Type-safe, variant-driven styling for Tailwind | [cva](https://cva.style) |
```

```diff
@@ end of ### State & styling @@
 | Theme switching / dark mode (no flash on load) | [next-themes](https://github.com/pacocoursey/next-themes) |
 
-The styling split: clsx for ad-hoc conditional classes; cva when a component has real variants (size, intent, state) that deserve a typed API. They compose — cva uses clsx-style inputs internally.
-
 ## Common mismatches to catch
```

```diff
@@ end of ## Common mismatches to catch @@
 - **A `useState`-per-component web of props for shared state** → zustand.
-- **Template-literal className ternaries three conditions deep** → clsx (or cva if it's variant-shaped).
```
