---
source: .claude/rules/ui-catalog.md
source-sha256: 324d2b715a7de5f54301696305b0a88c6a9f93af1ec47ab56229e95506a5d75e
---

- One `*.example.tsx` per usage scenario.
- Playgrounds and usage examples stay independently copyable, as the catalog shows their code: no helper from a neighbouring file.
- Text in `*-examples/` stays literal, in the source locale; a component's description goes in `messages/<locale>/ui-catalog.json` under `components.<component-id>.description`.
- A change under `*-examples/` commits the regenerated `*.generated.ts` files under `features/ui-catalog/` with it.
