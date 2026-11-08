# Starting a project

Turn a copy of next-template into a new project. The groups of files are in [SKILL.md](SKILL.md#the-templates-files).

1. Copy the template's files at its latest `main` into the project's directory, and write that commit into `.template-version`. Then, from the project's root, run `node <checkout>/scripts/template-upgrade.mjs .`, which puts this skill's pointer in place of the project's copy.
2. Delete the [sample product](SKILL.md#sample-product), then empty `SAMPLE_PRODUCT` in `scripts/sample-product.mjs`, so `scripts/docs-links.test.mjs` stops looking for the linked files in the project. Write the project's own features in its place. The sample product is also wired into files the project keeps; change them there:
   - `app/[locale]/page.tsx`, whose home page redirects to the task list through `TASK_LIST_HREF`.
   - The background jobs in `instrumentation.ts`, and their switches `TASK_GENERATOR_ENABLED` and `UPLOAD_CLEANUP_ENABLED` in `lib/env.ts`, `lib/env.test.ts`, and `playwright.config.ts`.
   - The seed data's content types in `SEED_CONTENT_TYPES` in `scripts/local-services/services.mjs`, and the tables `scripts/local-services/seed.db.test.mjs` counts.
   - The namespaces registered in `lib/i18n/messages.ts`; in `messages/*/app.json`, the route keys `tasks`, `taskDetail`, `feed`, `search`, and `recent`, `pageError` for [`app/[locale]/(tasks)/error.tsx`](https://github.com/fhyfhyfhy/next-template/blob/main/app/%5Blocale%5D/%28tasks%29/error.tsx), and `metadata.description`; and the sample product's terms in `messages/terms.json`.
   - The specs that test kept code through the sample product's pages: `e2e/home.spec.ts`, `e2e/locale.spec.ts`, and `e2e/date-time.spec.ts`. Point them at the project's own pages rather than deleting them.
   - Comments that use its pages or tables as examples. Search the kept files for its words, such as task, upload, `任务`, and `上传`.
   - Object storage, if the project has no uploads: the `STORAGE_*` variables in `lib/env.ts` and in `localEnv` in `scripts/local-services/datasets.mjs`, the `storage` service in `compose.yaml`, the bucket setup and `PUBLIC_PREFIXES` in `scripts/local-services/services.mjs`, and `connectE2eStorage` in `e2e/backend.ts`.
3. When the project's data lives elsewhere, replace the data setup.
4. Rewrite the project documents as the project's own: its introduction in `README.md` and `GLOSSARY.md`, its terms and features in place of the sample product's entries in `GLOSSARY.md` and `docs/features.md`, and its own items in `TODO.md`.
5. Write `docs/template-divergences.md`, with an entry for each change the steps above made to a file the project keeps.
6. Run `pnpm check` and `pnpm test:e2e`.
