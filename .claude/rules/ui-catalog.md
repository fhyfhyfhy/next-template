---
paths:
  - "components/ui/**"
  - "features/ui-catalog/**"
---

# UI catalog

The UI catalog at `/ui` shows the design-system components in `components/ui/`, each with a playground and runnable usage examples.

## Examples

- A component's examples live in `features/ui-catalog/components/<component-id>-examples/`. For a new component, adapt the [Button directory](../../features/ui-catalog/components/button-examples), including its `preview.tsx`, `playground.tsx`, and public `index.ts`.
- Add one `*.example.tsx` per usage scenario; [basic.example.tsx](../../features/ui-catalog/components/button-examples/basic.example.tsx) shows minimal usage.
- Keep each example's component and its `metadata` export in the same TSX file; the [metadata types](../../features/ui-catalog/types/examples.ts) define the fields. Metadata uses literal values, because generation reads it without executing the TSX. `order` defaults to `0`, with the component ID or example filename breaking ties.
- A component's description follows the interface language: write it in every `messages/<locale>/ui-catalog.json` under `components.<component-id>.description`. Text inside `*-examples/` stays literal, in the source locale, so each file stays copyable.
- Keep playgrounds and usage examples independently copyable: the code the catalog displays comes from those runnable files. `Preview` owns the playground and its controls; the shared catalog code renders the usage examples.

## Generated indexes

The `dev` and `build` scripts update the generated indexes. Commit them with their sources; without the dev server, run `pnpm generate:examples`.
