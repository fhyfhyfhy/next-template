# Plan Template

Every plan written by `improve-animations` follows this structure. The executor may be a less capable model with zero context and zero taste — the plan must contain everything, exactly. No references to "the audit above" or "the easing we discussed."

```markdown
# NNN — <Short imperative title>

- **状态**: TODO
- **Commit**: <output of `git rev-parse --short HEAD` when this plan was written>
- **严重程度**: HIGH | MEDIUM | LOW
- **类别**: <audit category>
- **预估范围**: <n files, rough size>

## 问题

What is wrong, where, and why it matters to how the product feels. Cite every
location as `path/to/file.tsx:123` and include the current code verbatim:

​```css
/* src/components/dropdown.css:14 — current */
.dropdown { transition: all 400ms ease-in; }
​```

## 目标

The exact end state. Every value spelled out — curves, durations, spring
configs, media queries. Never "use a nicer easing":

​```css
/* target */
.dropdown {
  transition: transform 200ms var(--ease-out), opacity 200ms var(--ease-out);
  transform-origin: var(--transform-origin);
}
​```

## 要遵循的仓库约定

How this codebase already does it, with one exemplar the executor should
imitate (token names, file placement, prop patterns):

- Easing tokens live in `src/styles/tokens.css`; add new curves there, e.g. `--ease-out: cubic-bezier(0.23, 1, 0.32, 1);`
- <exemplar file:line that already does this correctly>

## 步骤

1. <One concrete edit per step: file, what changes, resulting code.>
2. …

## 边界

- Do NOT touch <files/components out of scope>.
- Do NOT change markup/structure — motion properties only (unless a step says otherwise).
- Do NOT add new dependencies.
- If a step doesn't match the code you find (drift since the commit stamp), STOP and report instead of improvising.

## 验证

- **自动检查**: <exact commands — typecheck, lint, build — with expected outcome>.
- **手感检查**: run the UI, trigger <interaction>, and confirm:
  - <observable check, e.g. "the dropdown scales from its trigger, not from center">
  - <e.g. "spamming the toggle never restarts the animation from zero">
  - In DevTools, set playback to 10% (Animations panel) and confirm <detail>.
  - Toggle `prefers-reduced-motion` (Rendering panel) and confirm movement is dropped but opacity feedback remains.
- **完成标准**: <machine- or eye-checkable completion criteria>.
```

## Notes for the plan author

- One plan per finding. If two findings share every file and the same fix pattern (e.g. the same easing token swap across components), they may merge into one plan.
- Pull every value from [AUDIT.md](AUDIT.md) — never approximate from memory.
- The feel check is not optional. Motion can be mechanically correct and still feel wrong; give the executor (or the human reviewing the executor's diff) concrete things to watch for in slow motion.
- After writing plans, create or update `plans/README.md` with: a table of plans (number, title, severity, status), the recommended execution order, and any dependencies between plans.
