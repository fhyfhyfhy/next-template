# Conventions

## Test and lint tooling

- When adding tests, reuse the existing test entry and select scope through runner arguments. Add a separate entry only when execution setup differs, such as browser tests requiring a server.
- When adding source checks, extend the existing linter through configuration, plugins, or local rules. Use a standalone checker only when the linter cannot support the required inputs or execution, and document that limitation.

## Data fetching

Backend requests follow [data-fetching.md](data-fetching.md). Read it before you add a request, use a query or mutation hook, or change how a request's errors are shown.
