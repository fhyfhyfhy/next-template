# pick-ui-library

Upstream: `skills/pick-ui-library/` in `emilkowalski/skills`, as `npx skills update` installs it.

## Agents pick libraries on their own

`.claude/rules/libraries.md` sends agents here for any need its own list leaves out, so the skill has to load when an agent chooses a library, not only when a user invokes it. The description names the moment to reach for it and lists only needs that this repo's rules leave open, with no `: ` in it, which strict YAML parsers such as `npx skills` reject in a plain value. The canned first reply goes too: an agent that invokes the skill mid-task needs the pick, not a greeting that waits for a question.

```diff
@@ frontmatter @@
 name: pick-ui-library
-description: Pick the right library for a given frontend task from a curated, opinionated list — numbers, OTP inputs, charts, command menus, virtualization, drag and drop, toasts, state, styling, and more. Only runs when explicitly invoked; it does not trigger on its own.
-disable-model-invocation: true
+description: Choose the library for a frontend need that .claude/rules/libraries.md leaves open, from a curated list. Use before adding a dependency or writing code that needs one, such as command menus, animation, animated numbers, drag and drop, virtualization, or syntax highlighting.
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

`.claude/rules/components.md` sets `cn` in `lib/cn.ts` for conditional and merged class names, so the skill leaves that choice to it.

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

## The repo's picks come first

Agents reach this skill from its description and from the animate skill, not only through `.claude/rules/libraries.md`, so without a pointer back they recommend from this list for a need the repo's rules already settle.

```diff
@@ ## How to use this @@
 ## How to use this
 
+`.claude/rules/libraries.md` holds this repo's picks, which take precedence over this list: read it first, and use this list for a need it leaves out.
+
 1. **Identify the task**, not the library the user named. "I need to show a dropdown" is a UI-primitives task (base-ui), even if they asked about something else.
```

## OG images come from Next.js

Next.js builds OG images with `ImageResponse` from `next/og`, which runs Satori itself, so a Next.js app needs no Satori dependency of its own.

```diff
@@ ### Motion & visuals @@
 | 3D globes | [Cobe](https://cobe.vercel.app) |
-| Dynamic OG images (HTML/CSS → SVG/PNG) | [Satori](https://github.com/vercel/satori) |
+| Dynamic OG images (HTML/CSS → PNG) | `ImageResponse` from `next/og`, built into Next.js, which runs [Satori](https://github.com/vercel/satori) |
 | Syntax highlighting | [shiki](https://shiki.style) |
```

## Base UI parts exit with CSS

The skill sends exit animations to motion, but this repo's primitives come from Base UI, whose parts enter and exit through `data-starting-style` and `data-ending-style` and a CSS transition. This change comes after "Charts come from the repo's pick", whose hunk quotes the upstream line it rewrites.

```diff
@@ ### Motion & visuals @@
 | Syntax highlighting | [shiki](https://shiki.style) |
 
-Reach for motion when you need springs, layout animations, exit animations, or gesture-driven values. A simple hover or fade doesn't need it — plain CSS transitions are the right tool there.
+Reach for motion when you need springs, layout animations, exit animations, or gesture-driven values. A simple hover or fade doesn't need it — plain CSS transitions are the right tool there. A Base UI part enters and exits through `data-starting-style` and `data-ending-style` with a CSS transition, so its exit needs no motion either.
 
```
