# animate

Upstream: `skills/animate/` in `emilkowalski/skills`, as `npx skills update` installs it.

## No canned first reply

An agent that invokes the skill mid-task needs the animation built, not a greeting that waits for a question.

```diff
@@ ## Initial Response @@
 # Building Animations
 
-## Initial Response
-
-When this skill is first invoked without a specific question, respond only with:
-
-> I'm ready to build animations that feel right, my knowledge comes from Emil Kowalski's animation philosophy.
-
-Do not provide any other information until the user asks a question.
-
 A construction skill. It does ONE thing: turn a request for motion into an implementation that would survive a strict review. It does not audit a codebase (that's `improve-animations`), critique a diff (that's `review-animations`), hunt for places that could animate (that's `find-animation-opportunities`), or build for React Native (that's `animate-expo`).
```

## This repo's motion conventions

Motion here is Tailwind classes, `app/globals.css` ends every CSS transition and animation under reduced motion, and Base UI and Sonner, wrapped in `components/ui/`, already build the components the recipes write by hand, so the skill's plain CSS, its gentler-not-zero reduced motion, and its hover media queries need translating. Two details also need stating, or the motion runs on a weak curve or doesn't move at all: the `ease-out` class is this skill's curve only because `app/globals.css` overrides it, and `scale-*` sets the `scale` property, which a transition of `transform` leaves out.

```diff
@@ before ## Operating Posture @@
 
+## In this repo
+
+Motion here is Tailwind classes on the component (`.claude/rules/components.md`, Styles and variants). Where this skill or RECIPES.md says otherwise, these hold:
+
+- **Reduced motion is global.** `app/globals.css` sets every CSS transition and animation duration to zero under `prefers-reduced-motion`, and no class overrides it, so a CSS transition or animation takes no `motion-reduce:` variant. Motion run from JavaScript checks the preference with `useReducedMotion` from `@mantine/hooks`.
+- **Hover is gated already.** Tailwind's `hover:` applies only under `@media (hover: hover)`, so it needs no media query of its own.
+- **Curves.** The `ease-out` and `ease-in-out` classes are this skill's curves: `app/globals.css` overrides Tailwind's weaker ones of the same names. Add `--ease-drawer` beside them the first time a drawer needs it (`.claude/rules/design-system.md`, Theme tokens).
+- **Transforms.** `scale-*`, `translate-*`, and `rotate-*` set the `scale`, `translate`, and `rotate` properties, not `transform`: transition them with `transition-transform`, or name them, as `transition-[opacity,scale]`.
+- **Enter and exit.** A Base UI part enters and exits through `data-starting-style:` and `data-ending-style:` classes and a CSS transition, growing from `origin-(--transform-origin)` when a trigger anchors it, as `node_modules/@base-ui/react/docs/react/handbook/animation.md` shows. Any other element enters with `starting:`, Tailwind's `@starting-style` variant, not a mount flag set in an effect. Neither needs Motion.
+- **Drawers, toasts, and drag to dismiss** come from libraries: Base UI's `Drawer`, which swipes to dismiss and snaps, wrapped in `components/ui/` (`.claude/rules/design-system.md`, Wrap a UI library), and Sonner through `Toaster` in `components/ui/toaster.tsx`. The recipes for them show what those libraries already do.
+
 ## Operating Posture
```
