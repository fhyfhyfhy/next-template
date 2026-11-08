A full-stack [Next.js](https://nextjs.org) app for generating 3D models from a prompt, which doubles as a project template. A project made from it keeps the conventions, tooling, and agent instructions, and replaces the sample product, the task and upload business, with its own; see [Starting a project](#starting-a-project).

## Getting Started

Start Docker, then install dependencies and run the development server:

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result. `pnpm dev` first starts the local services, migrates the database, and writes the seed data into an empty one; see [Local services](#local-services).

When port 3000 is taken, the `dev` and `start` scripts, including their `:local` versions, move to the next free port and print the URL. Pass `--port` to pin one.

## Local services

`compose.yaml` runs the backend's services for local work: Postgres on `127.0.0.1:54329` and Versity Gateway, an S3-compatible object storage, on `127.0.0.1:7070`. Each checkout on the machine shares the two containers. They hold one dataset per use, each its own database and bucket, so the uses leave each other's data alone:

| Dataset | Used by |
| --- | --- |
| `dev` | `pnpm dev`, `pnpm build:local`, `pnpm start:local` |
| `e2e` | `pnpm test:e2e` |
| `test` | the data-layer tests in `pnpm test` |

`pnpm dev` always runs on local services. `pnpm build:local` and `pnpm start:local` do too, for checking production behavior on your machine. Each starts the services, creates and migrates the dataset `LOCAL_DATASET` names (`dev` by default), writes the seed data when it has no tasks, and passes its connection settings to Next as the environment variables in `lib/env.ts`. The data persists in Docker volumes across restarts. `pnpm db:reset` restores a dataset to the seed data, and `docker compose down -v` deletes all of them. Inside the app, the generator advances tasks in the background, as an outside generation service would.

`pnpm build` and `pnpm start` are for deployments: they read the connection settings from the environment. `lib/env.ts` fails the build when prerendering reads a missing one, and `pnpm start` checks them all before serving. See [Deployment](#deployment).

## Starting a project

A project made from this template deletes the sample product and writes its own features in its place, and keeps the rest: the conventions, tooling, and agent instructions, the layers outside `features/`, the UI catalog, and the app shell. A project whose data lives elsewhere, such as in another app's database, also replaces the data setup. The [derived-project](.agents/skills/derived-project/SKILL.md) skill lists the sample product and what a project does with each of the template's files, [start.md](.agents/skills/derived-project/start.md) walks through starting one, and [upgrade.md](.agents/skills/derived-project/upgrade.md) through taking in a later template commit with `scripts/template-upgrade.mjs`.

## Checks

`pnpm check` runs `format:check`, `lint`, `typecheck`, and `test` in that order and stops at the first failure. `test` includes the data-layer tests, so it needs Docker; the e2e specs run on their own (see [Tests](#tests)).

Git hooks run through [husky](https://typicode.github.io/husky/), from `.husky/`:

| Hook | Does |
| --- | --- |
| `pre-commit` | refuses commits on `main`; on the staged files, runs `eslint --fix` and Prettier, the unit tests related to staged code (`vitest related` in the `unit` project), the messages test when `messages/` changed, and the docs links test when a `.md` changed ([lint-staged](https://github.com/lint-staged/lint-staged), `lint-staged.config.mjs`) |
| `pre-push` | `pnpm check` over the whole repo |
| `post-merge`, `post-checkout` | `pnpm install --frozen-lockfile` when `pnpm-lock.yaml` changed |

`pnpm install` enables the hooks through the `prepare` script; it skips that step when the dependencies are already installed, so an existing checkout runs `pnpm prepare` once.

`pnpm typecheck` runs `next typegen` before `tsc --noEmit`, because helpers such as `PageProps<"/[locale]/tasks">` come from the route types Next generates in `.next/types`. `tsconfig.json` excludes the copies that `next dev` and the e2e build keep in `.next/dev` and `.next-e2e`: after a route is removed or renamed, they stay stale until their script runs again.

## Tests

Vitest runs every `*.test.*` file, kept next to the code it tests, in one of two projects in `vitest.config.mts`, which also resolves `@/` like `tsconfig.json`:

| Project | Tests |
| --- | --- |
| `unit` | everything except the data-layer tests |
| `db` | the data-layer tests (`*.db.test.*`), against real Postgres and object storage on the `test` dataset; the project starts the local services |

`pnpm test` runs both.

`pnpm test:e2e` runs the Playwright specs in `e2e/` against a production build on port 3998 (`E2E_PORT`), on the `e2e` dataset. Install the browser once with `pnpm exec playwright install chromium`. Before building, it resets the dataset to the seed data, so the prerendered pages match the database; the specs then add their own data straight to that database through fixtures built on `e2e/backend.ts` ([.claude/rules/e2e.md](.claude/rules/e2e.md)). The server runs with the background jobs off (`TASK_GENERATOR_ENABLED=false`, `UPLOAD_CLEANUP_ENABLED=false`), so tasks advance only when a spec advances them. Two checkouts share the `e2e` dataset, so run the specs from one at a time.

The e2e build turns on the testing API that `instant()` from `@next/playwright` needs to hold back streamed content: its `webServer` sets `EXPOSE_TESTING_API=1`, which `next.config.ts` reads. Keep that variable out of deployment builds. The build goes to `.next-e2e`, so a running `pnpm start` keeps its own output. ESLint applies `eslint-plugin-playwright`'s recommended rules to `e2e/`.

While debugging, `E2E_REUSE_SERVER=1` makes the specs reuse a server you started on the port. Reset the dataset with `pnpm db:reset e2e`, start a dev server on it, and run the specs against it:

```bash
LOCAL_DATASET=e2e TASK_GENERATOR_ENABLED=false UPLOAD_CLEANUP_ENABLED=false pnpm dev --port 3998
E2E_REUSE_SERVER=1 pnpm test:e2e
```

In PowerShell:

```powershell
$env:LOCAL_DATASET = "e2e"; $env:TASK_GENERATOR_ENABLED = "false"; $env:UPLOAD_CLEANUP_ENABLED = "false"; pnpm dev --port 3998
$env:E2E_REUSE_SERVER = "1"; pnpm test:e2e
```

Specs that depend on production behavior, such as prefetching, fail against a dev server, and a production server needs a build made with `EXPOSE_TESTING_API=1`.

## Data access

The app is full-stack: its backend lives in this app ([ADR 0006](docs/adr/0006-template-is-a-real-project.md)).

- Each feature's `server/` holds its data layer: queries, writes, business rules, and migrations ([.claude/rules/server-data.md](.claude/rules/server-data.md), [.claude/rules/data-setup.md](.claude/rules/data-setup.md)). `lib/db.ts` creates the Kysely + pg connection, `lib/object-storage.ts` wraps S3-compatible storage, and `lib/domain-error.ts` carries business-rule failures.
- Server Components, `use cache` reads, Server Actions, and Route Handlers call the data layer directly. The browser reads through `fetchApi` in `lib/fetch.ts` from Route Handlers under `/api` and writes through Server Actions ([.claude/rules/data-flow.md](.claude/rules/data-flow.md)).
- `lib/fetch.ts` defines the response format: a success returns the resource itself, and a failure has an `{ error: { code, message } }` body on a 4xx or 5xx status, or as the only field of a 2xx body. `app/providers.tsx` decides what a failed browser request shows.
- User files go from the browser straight to object storage through a presigned URL, and a Server Action then attaches the upload to its record ([ADR 0004](docs/adr/0004-uploads-presigned-object-storage.md)).

## Internationalization

Pages are translated with [next-intl](https://next-intl.dev) into the locales listed in `lib/i18n/routing.ts`: `zh`, the default locale and the one new text is written in, and `en`. URLs carry no locale: `proxy.ts` shows each visitor the language they picked with the locale switcher, kept in the `NEXT_LOCALE` cookie, or else their browser's `Accept-Language`, and every locale is still prerendered ([ADR 0005](docs/adr/0005-unprefixed-urls-in-visitor-locale.md)).

Text lives in `messages/{locale}/{namespace}.json`, one namespace per owner. Agents write and translate it into every locale themselves, following [.claude/rules/i18n.md](.claude/rules/i18n.md), and `pnpm test` checks each locale against the source locale and `messages/terms.json`. Dates and times show in the computer's time zone: `DateTime` in `components/date-time.tsx` renders them in the browser once the page has hydrated.

## Agent skills

Skills live in `.agents/skills/`, which Codex reads directly. Claude Code reads `.claude/skills/`, which holds local links made by `scripts/link-skills.sh`; the SessionStart hook in `.claude/settings.json` runs it whenever a Claude Code session starts here. To make the links without starting a session, run `bash scripts/link-skills.sh` (in Git Bash on Windows).

Next.js framework guidance comes from the installed `node_modules/next/dist/docs/`. The project [data-flow skill](.agents/skills/next-data-flow/SKILL.md) decides how backend data reaches a page and stays fresh, while the rules in `.claude/rules/` cover how to write the code; the official [Cache Components optimizer](.agents/skills/next-cache-components-optimizer/SKILL.md) and [Partial Prefetching optimizer](.agents/skills/next-partial-prefetching-optimizer/SKILL.md) provide targeted optimization workflows. [next-dev-loop](.agents/skills/next-dev-loop/SKILL.md) verifies development behavior using Next.js MCP and the user-level `browser-harness` skill, which this repo does not ship: install it from [browser-use/browser-harness](https://github.com/browser-use/browser-harness) for every agent that runs these workflows. Official skill adaptations are recorded in `.agents/skill-patches/` and reapplied on updates as [Skill patches](.agents/skills/skills-and-rules/PATCHES.md) describes.

Official Next.js skills record a versioned `ref` in `skills-lock.json`. When upgrading Next.js, select a compatible skill ref and reapply its patches; updating a pinned ref does not follow canary automatically.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## UI catalog

The UI catalog at `/ui` shows the design-system components, each with a playground and runnable usage examples, written as [.claude/rules/ui-catalog.md](.claude/rules/ui-catalog.md) describes.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deployment

Deploy the app as a long-running Node process, such as in a container, because two parts depend on one:

- `instrumentation.ts` starts background jobs on an interval, the generator and the upload cleanup, so the process has to keep running between requests. Serverless platforms, Vercel among them, don't keep it running.
- The `use cache` handler in `lib/cache-handler.mts` keeps entries in each process's memory, and `updateTag` expires them only in the process that handled the write. Run one instance, or replace the handler with one the instances share before running more; the [self-hosting-audit](.agents/skills/self-hosting-audit/SKILL.md) skill checks a deployment for this and the rest.

Build each environment against that environment. The build reads the database to prerender the gallery's first page, and the rows it reads and `STORAGE_PUBLIC_URL` stay in the static output (see "Environment variables" in `AGENTS.md`), so a build made for one environment shows that environment's data elsewhere. For each release:

1. Set the environment variables in `lib/env.ts`.
2. Run `pnpm db:migrate` against the environment's `DATABASE_URL`. The build reads the new schema, so migrate before building, and keep each migration compatible with the version still serving until the new one starts.
3. Run `pnpm build`, then `pnpm start`.

Check out the [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
