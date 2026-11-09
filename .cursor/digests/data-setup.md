---
source: .claude/rules/data-setup.md
source-sha256: ae57d597a61a36f958321b5a0a05380bd8db56ce543d10951655d964af64f53c
---

- Connect with `getDb` in `lib/db.ts`, typed with the feature's own `server/tables.ts`.
- A feature uses only its own tables: others' data comes through their `server.ts`, never a join. A cross-feature reference still gets its foreign key.
- `server/migrations.mts` exports a `migrations` record, names timestamp-first so every feature's migrations form one sequence. It imports only `kysely`: `scripts/db/migrate.mjs` loads it outside Next.js.
- Never edit an applied migration; add a new one. Forward only.
