# Architecture

## Design principles

### Single responsibility

Each function, component, hook, or module does one thing. Signs it does too much: describing it takes an "and", explaining it takes a paragraph of comments, or an unrelated change has to touch it in several places. A hook that mixes data fetching, form state, and side effects becomes several hooks, one job each.

### Duplication and abstraction

Over-abstraction is harder to undo than duplication, so abstract sparingly:

- **Rule of three**: extract on the third occurrence. With only two, a copy is usually clearer.
- **YAGNI**: write single-use code as a plain, concrete implementation. Add abstractions, config options, and extension points when a real need arrives.
- Extract only **stable commonality**. Two pieces that merely look alike but will evolve separately stay separate — merging them now costs more to split later.

Design-system primitives are an exception to the rule of three and YAGNI: when a current UI need requires a shared visual and interaction contract, implement the primitive directly in `components/ui/`, even for its first consumer, with the scope that [Write a component](components.md#write-a-component) sets for primitives. Feature-specific UI still follows the ownership and extraction rules below.

### Design for change

Add features by **adding code** (a new component, case, or implementation) rather than reworking the internals of existing code:

- Drive variation with props, composition ([vercel-composition-patterns](../../.agents/skills/vercel-composition-patterns/SKILL.md)), lookup tables, or polymorphism, and keep type-based branching in one place. Split a chain of if/else handling unrelated cases into one unit per case.
- Extensible ≠ prematurely general: add extension points only for needs that have already arrived (see YAGNI above).

### One-way dependencies

Dependencies may stay within the same layer or point to a lower layer. Dependencies between features and between modules must remain acyclic. Feature cycles include type-only dependencies and may exist without file cycles. To break a cycle (`A → B → A`, or a longer loop), extract a shared contract or implementation into a lower layer within its owner, or move composition to the caller. Business code keeps its feature ownership when resolving cycles (see "Shared code ownership").

## Code organization

### Layers

Ordered top to bottom, as "One-way dependencies" describes; `utils/`, `constants/`, and `types/` share one layer, here and in the next table. This table and the next are enforced by `ROOT_LAYERS` / `FEATURE_LAYERS` in `scripts/eslint/layers.mjs` — change both together.

```
app/            routes; composes features
features/       business modules
components/     domain-neutral composite UI (e.g. data tables, empty states)
components/ui/  design-system components (generic UI primitives)
hooks/          domain-neutral hooks (interaction and platform behavior)
lib/            framework and infrastructure adapters
utils/          domain-neutral utility functions
constants/      domain-neutral constants
types/          domain-neutral shared contracts
```

### Feature structure

```
features/{name}/
  index.ts      main entry
  server.ts     server entry: the data layer and other server-only code (server-data.md)
  components/   feature-specific UI
  hooks/        feature-specific hooks
  stores/       Zustand stores
  api/          browser requests (fetchApi), Server Actions, query and mutation options factories (tanstack-query.md)
  server/       server-only data access: queries, writes, business rules, use cache reads (server-data.md, data-setup.md)
  utils/        feature-specific utilities
  constants/    feature-specific constants
  types/        feature business types
```

Ordered top to bottom, like "Layers".

### Where files go

- Application code goes only in the directories of the two tables above. To add a new kind of directory, update this document first.
- Browser end-to-end specs live in `e2e/` ([e2e.md](e2e.md)) and translated text in `messages/` ([i18n.md](i18n.md)), both outside the layers.
- Layer directories contain only files, with three exceptions:
  - `app/` holds its route directories. Components that only some routes use, with the code only they use, go in a `_components/` beside those routes, such as `app/[locale]/(orders)/_components/`, which Next.js leaves out of routing. It is a `components/` like any other, and being part of the `app/` layer, it may compose features. Each module in it sits in the deepest directory that holds every file using it: when a file above that directory needs it, it moves up; when all of its users sit in a deeper directory, it moves down there.
  - Any `components/` may contain one level of component directories ([Component directories](components.md#component-directories)), and so may the reserved `components/ui/`.
  - `lib/` may group an adapter that spans several files into one level of directory. When outside code uses only one of its modules, that module is the directory's `index`; when it uses several, it imports each by its path and the directory has no `index`.
- Keep types with the module or schema that owns them. Extract a shared contract into that owner's `types/` when needed to preserve dependency direction or give the contract an independent role.

### Feature boundaries

[docs/features.md](../../docs/features.md) records which features depend on which, what each one is responsible for, and what sits next to it but belongs elsewhere. Put new code in the feature responsible for the business concept it serves. When no feature is, decide by how the concept exists:

- A concept that exists only as part of another joins that concept's feature. In the database, its rows are deleted with the other's, as a task's comments are in [`features/task/`](https://github.com/fhyfhyfhy/next-template/tree/main/features/task).
- A concept that exists on its own gets a feature of its own. In the database, it has its own tables and lifecycle, and other features reach it through its `server.ts`, as the task feature attaches a cover through `attachUpload` from [`features/upload/server.ts`](https://github.com/fhyfhyfhy/next-template/blob/main/features/upload/server.ts).
- A setting that only serves another concept joins that concept's feature, even with a table and a page of its own, such as a default per category, kept in a table keyed by the category, that names an entity's owner when the entity is created. As a feature of its own, it would depend on that feature for its rules while that feature depends on it for the default.

Creating, merging, or splitting a feature, changing what one is responsible for, or adding or removing a dependency between features updates `docs/features.md` in the same change.

### Shared code ownership

Choose the owner by responsibility. Code that represents a business concept or changes with its policies belongs to that feature, including pure functions, presentational components, types, and constants. Cross-feature consumers reuse it through the feature's public entries. A global lifetime or multiple consumers does not change ownership.

Root shared code provides domain-neutral behavior with stable, reusable interfaces. Promote feature-local code only when concrete reuse justifies extraction, following "Duplication and abstraction". When a module mixes general behavior with business rules, keep the business part in its feature and extract only the stable general part. Business data, decisions, and actions come from callers through arguments, props, callbacks, or children.

### Package imports

Import from the same directory and its subdirectories by relative path (`./`), and from everywhere else through `@/`. A feature counts as one directory, and so does `app/`: their files import each other by relative path, `../` included.

### Feature public API

`package.json` declares the project's modules free of side effects (`sideEffects`, CSS aside), so the bundler loads only the modules behind the exports a caller uses. A feature's main entry may export client components beside schemas, types, and constants: a Server Component, a route handler, or a job `instrumentation.ts` starts that imports a schema from it loads none of the components. To keep the declaration true, a module's top level only defines; anything that must run is a function its caller calls. Import a project module for the names it uses, never for its effect alone (`architecture/side-effect-imports`).

Heavy dependencies, such as `three`, go through a sub-entry beside `index.ts`, such as `canvas.ts`, so callers can load the heavy part lazily.
