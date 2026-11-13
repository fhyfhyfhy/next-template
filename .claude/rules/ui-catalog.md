---
paths:
  - "components/ui/**"
  - "features/ui-catalog/**"
  - "scripts/ui-catalog/**"
---

# UI catalog

The UI catalog at `/ui` shows the design-system components in `components/ui/`, each with a playground and runnable usage examples.

## Examples

- A component's examples live in `features/ui-catalog/components/<component-id>-examples/`. For a new component, adapt the [Button directory](../../features/ui-catalog/components/button-examples).
- Add one `*.example.tsx` per usage scenario; [basic.example.tsx](../../features/ui-catalog/components/button-examples/basic.example.tsx) shows minimal usage.
- A compound component's examples show which root owns the state, which parts belong inside it, and which providers are required.
- Keep every file of a `<component-id>-examples/` directory at its top level, however many there are, rather than splitting it into siblings as [Component directories](components.md#component-directories) does: generation reads only the top-level files, so an example in a subdirectory never shows, and a sibling directory whose name ends in `-examples` becomes a component of its own.
- Keep each example's component and its `metadata` export in the same TSX file; the [metadata types](../../features/ui-catalog/types/examples.ts) define the fields.
- A component's description follows the interface language: write it in every `messages/<locale>/ui-catalog.json` under `components.<component-id>.description`. Text inside `*-examples/` stays literal, in the prose language, so each file stays copyable.
- Keep playgrounds and usage examples independently copyable: the code the catalog displays comes from those runnable files. `Preview` owns the playground and its controls; the shared catalog code renders the usage examples.

## Generated indexes

After any change in a `*-examples/` directory or in `scripts/ui-catalog/`, run `pnpm generate:examples` until it succeeds, and commit the generated indexes it updates with their sources.
