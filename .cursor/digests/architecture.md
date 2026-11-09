---
source: .claude/rules/architecture.md
source-sha256: 6291a01253b18144bf711602828c21d8f2dbb1463390ab682ddbe5b521ab5704
---

- A function, component, hook or module does one thing: a hook mixing data fetching, form state and side effects becomes several.
- Extract on the third occurrence (with two, a copy is usually clearer), never look-alikes evolving apart: over-abstraction is harder to undo than duplication.
- No abstraction, config option or extension point before a real need, but a current UI need for a shared visual and interaction contract gets its `components/ui/` primitive even with one consumer.
- New features add code rather than rework internals: variation uses props, composition, lookup tables or polymorphism, type-based branching stays in one place, and unrelated if/else cases split into one unit each.
- A dependency cycle is broken by moving a shared contract or implementation to a lower layer within its owner, or composition to the caller, never business code out of its feature.
- Application code lives only in `app/ features/ components/ components/ui/ hooks/ lib/ utils/ constants/ types/` and, per feature, `index.ts server.ts components/ hooks/ stores/ api/ server/ utils/ constants/ types/`. A new kind of directory joins these lists in `.claude/rules/architecture.md` first; they change with `ROOT_LAYERS` / `FEATURE_LAYERS` in `eslint.config.mjs`.
- Those directories hold only files, except `app/` route directories and `_components/`, one level of component directories in a `components/`, and one level of adapter directory in `lib/`, indexed only if outside code uses just one of its modules.
- Components only some routes use, with the code only they use, go in a `_components/` beside those routes.
- Types stay with their owning module or schema, moving to its `types/` only for dependency direction or an independent role.
- A constant only its module reads stays there, unexported; test data stays with its tests; a value another rule places by its code (a query key prefix) stays there.
- Code representing a business concept or changing with its policies (pure functions, components, types, constants too) belongs to that feature however widely used.
- Root shared code stays domain-neutral, taking from features only stable general parts with concrete reuse; business data, decisions and actions come from callers, and no helper or adapter hides a business-policy dependency or required setup. App-wide composition and policy live in `app/`.
- New code goes in the feature responsible for its concept; with none, a concept existing only as part of another (rows deleted with it) joins that feature, and one with its own tables and lifecycle gets its own, whose data others reach through its `server.ts`. Changing a feature's responsibility updates `docs/features.md` in the same change.
- A heavy dependency such as `three` goes through a sub-entry such as `canvas.ts` beside `index.ts`, keeping the main entry light and lazy loading possible.
