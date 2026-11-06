# Code review

Project reviews for the `code-review` skill, one per section.

## Architecture

- **Runs when:** the diff changes application code (the directories in the Layers table of `.claude/rules/architecture.md`, plus `instrumentation.ts` and `proxy.ts` at the root) or `docs/features.md`. An edit inside a function body is enough, since it can give a module a second job, add an unrelated branch, or copy logic a third time.
- **Standards:** `.claude/rules/architecture.md` and `docs/features.md`
- **Brief:** Review only the changes to application code and `docs/features.md`, and in them these parts of the rule; ESLint checks the rest.
  - The whole of **Single responsibility**, **Duplication and abstraction**, **Design for change**, **Where files go**, and **Shared code ownership**. Count occurrences across the repo before calling an extraction premature or overdue, and look at a changed module's callers and neighbours before judging its owner.
  - **Feature boundaries**: compare the changes with `docs/features.md`: code outside its feature's responsibility, and a new feature whose concept an existing entry covers or that exists only as part of another concept. Judge a change to `docs/features.md` itself by the same section.
  - **One-way dependencies**: when the change resolves a cycle or an upward import, the business code stays in its feature instead of moving into a root layer.
  - **Layers** and **Feature structure**: each file sits in the layer and feature subdirectory its responsibility belongs to.
  - **Component directories**: a single file or a directory, an `index` that exports only what callers need, one level deep, and a directory past about 5–7 files split into siblings.
  - **Feature public API**: heavy dependencies go through a sub-entry.
  - Each `eslint-disable` the diff adds for `architecture/*`, `import/no-restricted-paths`, or `import/no-cycle`: whether its description justifies the exception.
