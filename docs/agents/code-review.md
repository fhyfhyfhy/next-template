# Code review

Project reviews for the `code-review` skill, one per section.

## Architecture

- **Standards:** `.claude/rules/architecture.md`
- **Brief:** Apply every section of the rule to where each changed file sits and what it depends on. Read past the diff wherever a rule depends on the rest of the repo: count occurrences across the repo before calling an extraction premature or overdue, and look at a changed module's callers and neighbours before judging its owner. ESLint enforces the layer tables (`ROOT_LAYERS` and `FEATURE_LAYERS` in `eslint.config.mjs`), import paths, component entries, and file and feature cycles; report the judgment calls it can't make, such as ownership, single responsibility, and abstraction.
