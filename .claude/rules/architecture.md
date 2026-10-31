# Architecture

## Design principles

### Single responsibility

Each function, component, hook, or module does one thing. Signs it does too much: describing it takes an "and", explaining it takes a paragraph of comments, or an unrelated change has to touch it in several places. A hook that mixes data fetching, form state, and side effects becomes several hooks, one job each.

### Duplication and abstraction

Over-abstraction is harder to undo than duplication, so abstract sparingly:

- **Rule of three**: extract on the third occurrence. With only two, a copy is usually clearer.
- **YAGNI**: write single-use code as a plain, concrete implementation. Add abstractions, config options, and extension points when a real need arrives.
- Extract only **stable commonality**. Two pieces that merely look alike but will evolve separately stay separate — merging them now costs more to split later.

Design-system primitives are an exception to the rule of three: when a current UI need requires a shared visual and interaction contract, implement the primitive directly in `components/ui/`, even for its first consumer. Build only the capabilities needed now. Feature-specific UI still follows the ownership and extraction rules below.

### Design for change

Add features by **adding code** (a new component, case, or implementation) rather than reworking the internals of existing code:

- Drive variation with props, composition, lookup tables, or polymorphism, and keep type-based branching in one place. Split a chain of if/else handling unrelated cases into one unit per case.
- Extensible ≠ prematurely general: add extension points only for needs that have already arrived (see YAGNI above).

### One-way dependencies

Dependencies may stay within the same layer or point to a lower layer. Dependencies between features and between modules must remain acyclic. To break a cycle (`A → B → A`, or a longer loop), extract a shared contract or implementation into a lower layer within its owner, or move composition to the caller. Business code keeps its feature ownership when resolving cycles (see "Shared code ownership").

## Code organization

### Layers

Ordered top to bottom; each layer may import from the same layer and any layer below it, without creating cycles. This table and the next are enforced by `ROOT_LAYERS` / `FEATURE_LAYERS` in `eslint.config.mjs` — change both together.

Architecture checks apply equally to JavaScript and TypeScript sources, including JSX and ESM/CommonJS file extensions.

```
app/            routes; composes features
features/       business modules
components/     domain-neutral composite UI (e.g. data tables, empty states)
components/ui/  design-system components (generic UI primitives)
hooks/          domain-neutral hooks (interaction and platform behavior)
lib/            framework and infrastructure adapters
utils/          domain-neutral pure utility functions
constants/      domain-neutral constants and design tokens
types/          domain-neutral shared contracts
```

Cross-feature dependencies go through public entries (see "Feature public API") and remain one-way and acyclic.

### Feature structure

```
features/{name}/
  index.ts      entry (see "Feature public API")
  components/   feature-specific UI
  hooks/        feature-specific hooks
  stores/       Zustand stores
  api/          requests (fetchApi), Server Actions, query and mutation options factories
  utils/        feature-specific utilities
  constants/    feature-specific constants
  types/        feature business types
```

Same ordering rule: each layer may import from the same layer and any layer below it, without creating cycles.

### Where files go

- Use only the directories in the two tables above. To add a new kind of directory, update this document first.
- Browser end-to-end specs live in top-level `e2e/`, outside the layers. They observe the app through the browser and import no application code; ESLint enforces this. The Data demo's specs live in `e2e/demo/` and also drive the Mock API control endpoints; `pnpm demo:test:e2e` runs them, and `pnpm test:e2e` runs the rest.
- Layer directories (`hooks/`, `utils/`, `features/{name}/api/`, etc.) contain only files. The one exception is component directories: any `components/` may contain one level of component directories (see "Component directories"), and so may the reserved `components/ui/`.
- Independent hooks go in `hooks/` and utility functions in `utils/`. Component-specific private contexts, hooks, helpers, and types may stay in the component directory (see "Component directories").
- Keep types with the module or schema that owns them. Extract a shared contract into that owner's `types/` when needed to preserve dependency direction or give the contract an independent role.
- Choose feature or root placement by "Shared code ownership" below.

### Shared code ownership

Choose the owner by responsibility. Code that represents a business concept or changes with its policies belongs to that feature, including pure functions, presentational components, types, and constants. Cross-feature consumers reuse it through the feature's public entries. A global lifetime or multiple consumers does not change ownership.

Root shared code provides domain-neutral behavior with stable, reusable interfaces. Promote feature-local code only when concrete reuse justifies extraction, following "Duplication and abstraction". Business data, decisions, and actions come from callers through arguments, props, callbacks, or children. Framework adapters and shared providers are allowed; make their required setup explicit.

| Kind | Root shared code | Code owned by a feature |
| --- | --- | --- |
| `components/` | `DataTable` with caller-defined columns and cells | `TaskTable` with task actions and permissions |
| `components/ui/` | `Button`, `Dialog` | `DeleteTaskDialog` |
| `hooks/` | Domain-neutral hooks that `@mantine/hooks` lacks ([libraries.md](libraries.md)) | `useCurrentUser`, `useTaskPermissions` |
| `utils/` | `clamp`, `formatBytes` | `calculateOrderTotal`, `canDeleteTask` |
| `constants/` | Keyboard keys, design tokens | Subscription tiers, task status values |
| `types/` | Generic pagination contracts | `User`, `Task`, `Order` |
| `lib/` | Transport and framework adapters | Pricing, permission, and workflow policies |

`components/ui/` may use generic hooks for focus, measurement, keyboard handling, or controlled state, and declared providers for theme or locale. Feature components supply business data and actions. The same ownership rule applies transitively: a shared helper or adapter must not hide a dependency on a business policy.

When a module mixes general behavior with business rules, keep the business part in its feature and extract only the stable general part. If multiple features need composition, their caller can assemble them without moving their business implementations into root directories.

Architecture checks are configured in [eslint.config.mjs](../../eslint.config.mjs). Feature cycles include type-only dependencies and may exist without file cycles. Run without ESLint's per-file `--cache`, since other files can change a feature's cycle status. Domain ownership and provider requirements are checked during review; directory placement alone does not prove that code is domain-neutral.

### Conditional credential entry

`lib/fetch.ts` uses `#credentials` as an environment boundary: `package.json` selects the server or browser credential adapter. A relative import cannot preserve that selection. The `architecture/package-imports` rule reserves this exception for that caller, verifies the two ordered targets, and rejects other `#` imports. Extend the architecture checks before introducing another conditional project entry.

The project's boundary and feature-cycle resolver follows relative and `@/` imports; it does not build a graph for conditional package imports. The separate layer and file-cycle rules currently resolve `#credentials` through its default browser branch. They do not establish that the `react-server` branch is cycle-free. When changing either credential adapter or its dependencies, check both runtime dependency paths for cycles, including a path back to `lib/fetch.ts`.

### Component directories

A simple component is a single file. A directory can contain a main component with private subcomponents, or a compound component with several public parts:

```
features/task/components/
  task-editor/
    index.tsx         ← entry and main component
    toolbar.tsx       ← private subcomponent
    status-bar.tsx
```

- Each directory has one public source `index` entry: normally `index.tsx` when it contains JSX, or `index.ts` for exports only. ESLint rejects multiple source entries across the supported JS/TS extensions. Declaration companions such as `index.d.ts` may accompany that entry; they are not additional implementation entries.
- Files inside import each other by relative path. This applies to every component directory, including root `components/`, `components/ui/`, and component directories under `app/` or a feature. All code outside the directory, including other components in the same feature and feature entries, imports or re-exports only through this entry. Cross-feature consumers still go through the feature's public entries.
- Explicitly export the components, contexts, hooks, and related types that callers need through the entry. Named re-exports and importing then exporting named bindings are both allowed. `export *`, `export * as`, and exporting an entire imported namespace (including through aliases) are forbidden so new implementation exports do not become public automatically. Namespace imports may be used internally, including `React`, or to select named public parts explicitly, such as `export const DialogRoot = Parts.Root`.
- Implementation files remain private import paths, even when selected symbols are exposed by the entry. Keep one component per implementation file; the entry may collect multiple public components.
- Keep component-specific contexts, hooks, helpers, and types alongside its parts. Keep implementation-only symbols private. Extract them to the appropriate layer within their owner when they acquire an independent reuse role; business ownership remains unchanged.

For example, a compound dialog exposes its composable parts and context while keeping its internal hook private:

```
components/ui/dialog/
  index.ts           ← public entry
  root.tsx           ← DialogRoot
  trigger.tsx        ← DialogTrigger
  popup.tsx          ← DialogPopup
  backdrop.tsx       ← DialogBackdrop
  context.ts         ← DialogContext
  use-dialog-context.ts ← private hook used by the parts
```

```ts
// components/ui/dialog/index.ts
export { DialogRoot } from "./root";
export type { DialogRootProps } from "./root";
export { DialogTrigger } from "./trigger";
export { DialogPopup } from "./popup";
export { DialogBackdrop } from "./backdrop";
export { DialogContext } from "./context";
```

Component directories are one level deep, so when one grows past ~5–7 files, split it into **sibling** component directories; the main component imports each sibling's entry, using relative paths within the same feature:

```
features/task/components/
  task-editor/            ← main component
    index.tsx
    status-bar.tsx
  task-editor-toolbar/    ← split-out subcomponent
    index.tsx
    format-button.tsx
```

### Feature public API

A feature's **entry** files at its root define its public API: the main entry `index.ts`, plus optional sub-entries (e.g. `canvas.ts`). Outside code imports only from entries using `@/features/{name}` or `@/features/{name}/{sub-entry}`; implementation paths remain private even when their symbols are re-exported. Files inside the same feature must import each other by relative path, including across subdirectories, while respecting component directory entries. Imports of project code outside that feature must use `@/`; third-party packages use their package names.

Feature implementation files import the modules they need directly; they must not import or re-export from their own feature's root entry or sub-entries. For example, `utils/example.ts` cannot reach a component through `../index`. Root entry files may aggregate other entries without creating cycles. Component directory entries remain required when crossing a component's private boundary.

**Heavy dependencies go through a sub-entry.** Named re-exports can be tree-shaken; their presence alone does not mean every exported module ships in the initial bundle. Side effects, module format, and bundler behavior affect the result. Separate heavy sub-entries make the dependency boundary explicit and provide a target for lazy loading:

- Export modules that `import` heavy libraries such as `three` from a sub-entry; the main `index.ts` exports only lightweight code.
- First-load and general code imports the main entry. Load nonessential heavy features on demand with dynamic imports / lazy loading through their sub-entry; a separate entry alone does not defer loading. Verify route and client bundle contents with the [Next.js bundle analyzer](https://nextjs.org/docs/app/guides/package-bundling).
- Modules that use only `import type` from a heavy library are exported from the main `index.ts` as usual with `export type` — types are erased at compile time.

```
features/scene-viewer/
  index.ts        ← main entry, lightweight exports only
  canvas.ts       ← sub-entry, re-exports 3D rendering code by relative path
  components/
    scene-canvas/index.tsx   ← import { Scene } from "three"
```
