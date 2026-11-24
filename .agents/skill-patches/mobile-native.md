# mobile-native

Upstream: `skills/mobile-native/` in `emilkowalski/skills`, as `npx skills update` installs it.

## No canned first reply

An agent that invokes the skill mid-task needs the fixes, not a greeting that waits for a question.

```diff
@@ ## Initial Response @@
 # Feeling Native On Mobile
 
-## Initial Response
-
-When this skill is first invoked without a specific question, respond only with:
-
-> I'm ready to make your web app feel native on mobile, my knowledge comes from Emil Kowalski's design engineering philosophy.
-
-Do not provide any other information until the user asks a question.
-
 A fix-it skill. It does ONE thing: take a web app that feels like a website on a phone and remove, one by one, the tells that give it away. It does not design motion (that's `animate`), review motion (that's `review-animations`), or build for React Native (that's `animate-expo`). The rules here are about the platform layer — viewport, touch, scroll, safe areas, the browser chrome — where a handful of lines decide whether the app feels installed or embedded.
```

## Fixes land where this repo keeps them

This repo styles with Tailwind classes and theme tokens, and a wrapper's classes in `components/ui/` beat a rule in the `@layer base` of `app/globals.css`, so the skill's global input rule would change nothing. Next.js renders the viewport meta tag from a `viewport` export, and two files here render `<html>`.

```diff
@@ before ## Operating Posture @@
 
+In this repo, these hold wherever the fixes below say otherwise:
+
+- Write a fix as Tailwind classes with the theme tokens of `app/globals.css` (`.claude/rules/components.md`, Styles and variants), not with the variables below, such as `--gray-3`, which this repo lacks. Tailwind's preflight already sets `-webkit-tap-highlight-color` and `-webkit-text-size-adjust`.
+- A control's own fix, such as a 16px font size on touch devices, goes in its wrapper in `components/ui/`, as `components/ui/input.tsx` does with `pointer-coarse:text-base`: a rule in the `@layer base` of `app/globals.css` loses to the wrapper's classes. Page-wide CSS, such as `overscroll-behavior` on `html`, goes in that `@layer base`.
+- Viewport and theme-color settings go in a `viewport` export, typed with `Viewport` from `next`, of both files that render `<html>`: `app/[locale]/layout.tsx` and `app/global-not-found.tsx`. Next.js writes the viewport meta tag itself, so never add a `<meta>` for them.
+
 ## Operating Posture
```
