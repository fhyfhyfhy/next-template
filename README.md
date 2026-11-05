This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

Install dependencies, then run the development server:

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result. To browse the [Demo](#demo) with its Demo backend, start Docker, run `pnpm demo:dev` instead, and open `/demos`.

When port 3000 is taken, the `dev` and `start` scripts, including their `demo:` versions, move to the next free port and print the URL. Pass `--port` to pin one.

## Demo

`/demos` holds runnable reference implementations of this template's conventions, kept in projects made from it. They are served only under `pnpm dev` and the `pnpm demo:*` scripts: a plain production build (`pnpm build`, `pnpm start`) answers 404 for every `/demos` page, and its home page is a placeholder without a link to them, as `DEMOS_SERVED` in `app/demos.ts` decides.

- **UI demo** (`/demos/ui`): the design-system components; see [UI demo examples](#ui-demo-examples).
- **Data demo** (the other `/demos` pages): a small task app that exercises the data rules against the Demo backend. [`demos.md`](.agents/skills/next-data-flow/demos.md) maps each scenario to its rule, code, and e2e spec.

The **Demo backend** is built into this app the way the template expects a project's own backend to be ([ADR 0003](docs/adr/0003-fullstack-demo-backend.md)): the `demo-task` and `demo-upload` features hold its data layer, Route Handlers under `app/api/demo/` serve the browser's reads, and Server Actions do the writes. Data lives in Postgres and files in S3-compatible object storage ([ADR 0004](docs/adr/0004-demo-uploads-presigned-object-storage.md)), both from `compose.demo.yaml`, so the Demo needs Docker.

The Demo has its own scripts, `pnpm demo:dev`, `pnpm demo:build`, and `pnpm demo:start`: they start the two services (Postgres on `127.0.0.1:54329`, Versity Gateway on `127.0.0.1:7070`), create and migrate the Demo database, prepare its bucket, and pass the `DEMO_*` variables that enable the Demo backend to Next. The data persists in Docker volumes across restarts; the first run writes the seed data, and the fault lab's reset restores it. `docker compose -f compose.demo.yaml down -v` deletes it. Their build output goes to `.next-demo`, leaving the project's `.next` alone. Inside the app, the Demo generator advances tasks in the background, and every business operation waits 500 ms by default so loading states show; the fault lab's panel changes that delay until the next reset and injects faults into data-layer operations. `pnpm dev`, `pnpm build`, and `pnpm start` never set the `DEMO_*` variables, so `/api/demo` answers 404 under all three and a deployment never exposes the Demo backend; under `pnpm dev` the Data demo pages show a notice instead. The demos' e2e specs are described under [Tests](#tests).

## Checks

`pnpm check` runs `format:check`, `lint`, `typecheck`, and `test` in that order and stops at the first failure. The e2e sets and the Demo features' tests run on their own (see [Tests](#tests)).

Git hooks run through [husky](https://typicode.github.io/husky/), from `.husky/`:

| Hook | Does |
| --- | --- |
| `pre-commit` | refuses commits on `main`; on the staged files, runs `eslint --fix` and Prettier, the unit tests related to staged code (`vitest related`, in the `app` or `demo-unit` project), the messages test when `messages/` changed, and the docs links test when a `.md` changed ([lint-staged](https://github.com/lint-staged/lint-staged), `lint-staged.config.mjs`) |
| `pre-push` | `pnpm check` over the whole repo |
| `post-merge`, `post-checkout` | `pnpm install --frozen-lockfile` when `pnpm-lock.yaml` changed |

`pnpm install` enables the hooks through the `prepare` script; it skips that step when the dependencies are already installed, so an existing checkout runs `pnpm prepare` once.

`pnpm typecheck` runs `next typegen` before `tsc --noEmit`, because helpers such as `PageProps<"/[locale]/demos/tasks">` come from the route types Next generates in `.next/types`. `tsconfig.json` excludes the copies that `next dev`, the `demo:` scripts, and the e2e builds keep in `.next/dev` and the other `.next-*` directories: after a route is removed or renamed, they stay stale until their script runs again.

## Tests

Vitest runs every `*.test.*` file, kept next to the code it tests, in one of three projects in `vitest.config.mts`, which also resolves `@/` like `tsconfig.json`:

| Project | Tests | Run by |
| --- | --- | --- |
| `app` | everything outside the Demo features, including the data-layer tests (`*.db.test.*`) of the project's own features, which need their database | `pnpm test` |
| `demo-unit` | the Demo features' unit tests | `pnpm demo:test`, and `git commit` for the tests related to the staged Demo files |
| `demo-db` | the Demo features' data-layer tests, against real Postgres and object storage on the `test` dataset, its own database and bucket | `pnpm demo:test` |

`demo-db` starts the services, so `pnpm demo:test` needs Docker, which keeps it out of `pnpm check`.

End-to-end specs run with Playwright in two sets, each against its own production build and port, so they can run side by side and alongside `pnpm dev`. Install the browser once with `pnpm exec playwright install chromium`.

- `pnpm test:e2e` runs the project's own specs in `e2e/`, skipping `e2e/demo/`, against `pnpm build` and `pnpm start` on port 3998 (`E2E_PORT`). That build serves no demos, so a spec that opens a `/demos` page belongs in `e2e/demo/`. `e2e/home.spec.ts` is the minimal example to start from.
- `pnpm demo:test:e2e` runs the demos' specs in `e2e/demo/` against `pnpm demo:build` and `pnpm demo:start` on port 3999 (`DEMO_E2E_PORT`), on the `e2e` dataset: its own database and bucket in the same services. The specs reset it through `/api/demo/control/*` before each test, pause the Demo generator, and inject faults; a running `demo:dev` keeps the `dev` dataset and its data. Two checkouts share the `e2e` dataset, so run the set from one at a time.

Both sets build with the testing API that `instant()` from `@next/playwright` needs to hold back streamed content: their `webServer` sets `EXPOSE_TESTING_API=1`, which `next.config.ts` reads. Keep that variable out of deployment builds. Those builds go to `.next-e2e` and `.next-demo-e2e`, so a running `pnpm start` or `pnpm demo:start` keeps its own output. ESLint applies `eslint-plugin-playwright`'s recommended rules to `e2e/`.

While debugging, `E2E_REUSE_SERVER=1` makes either set reuse a server you started on its port, such as `DEMO_DATASET=e2e pnpm demo:dev --port 3999`; specs that depend on production behavior, such as prefetching, fail against a dev server, and a production server needs a build made with `EXPOSE_TESTING_API=1`.

## Data access

The template is full-stack: a project's backend lives in this app ([ADR 0003](docs/adr/0003-fullstack-demo-backend.md)), and the Data demo is its runnable reference.

- Each feature's `server/` holds its data layer: queries, writes, business rules, and migrations ([.claude/rules/server-data.md](.claude/rules/server-data.md)). `lib/db.ts` creates the Kysely + pg connection, `lib/object-storage.ts` wraps S3-compatible storage, and `lib/domain-error.ts` carries business-rule failures.
- Server Components, `use cache` reads, Server Actions, and Route Handlers call the data layer directly. The browser reads through `fetchApi` in `lib/fetch.ts` from Route Handlers under `/api` and writes through Server Actions ([.claude/rules/data-flow.md](.claude/rules/data-flow.md)).
- `lib/fetch.ts` defines the response format: a success returns the resource itself, and a failure has an `{ error: { code, message } }` body on a 4xx or 5xx status, or as the only field of a 2xx body. `app/providers.tsx` decides what a failed browser request shows.

## Internationalization

Pages are translated with [next-intl](https://next-intl.dev) into the locales listed in `lib/i18n/routing.ts`: `zh`, the default locale and the one new text is written in, and `en`. URLs carry no locale: `proxy.ts` shows each visitor the language they picked with the locale switcher, kept in the `NEXT_LOCALE` cookie, or else their browser's `Accept-Language`, and every locale is still prerendered ([ADR 0005](docs/adr/0005-unprefixed-urls-in-visitor-locale.md)).

Text lives in `messages/{locale}/{namespace}.json`, one namespace per owner. Agents write and translate it into every locale themselves, following [.claude/rules/i18n.md](.claude/rules/i18n.md), and `pnpm test` checks each locale against the source locale and `messages/terms.json`. Dates and times show in the computer's time zone: `DateTime` in `components/date-time.tsx` renders them in the browser once the page has hydrated.

## Agent skills

Skills live in `.agents/skills/`, which Codex reads directly. Claude Code reads `.claude/skills/`, which holds local links made by `scripts/link-skills.sh`; the SessionStart hook in `.claude/settings.json` runs it whenever a Claude Code session starts here. To make the links without starting a session, run `bash scripts/link-skills.sh` (in Git Bash on Windows).

Next.js framework guidance comes from the installed `node_modules/next/dist/docs/`. The project [data-flow skill](.agents/skills/next-data-flow/SKILL.md) covers choosing a data owner, designing refreshes, and diagnosing stale views, while the rules in `.claude/rules/` cover how to write the code; the official [Cache Components optimizer](.agents/skills/next-cache-components-optimizer/SKILL.md) and [Partial Prefetching optimizer](.agents/skills/next-partial-prefetching-optimizer/SKILL.md) provide targeted optimization workflows. [next-dev-loop](.agents/skills/next-dev-loop/SKILL.md) verifies development behavior using Next.js MCP and the user-level `browser-harness` skill, which this repo does not ship: install it from [browser-use/browser-harness](https://github.com/browser-use/browser-harness) for every agent that runs these workflows. Official skill adaptations are recorded in `.agents/skill-patches/` and reapplied on updates as [Skill patches](.agents/skills/skills-and-rules/PATCHES.md) describes.

Official Next.js skills record a versioned `ref` in `skills-lock.json`. When upgrading Next.js, select a compatible skill ref and reapply its patches; updating a pinned ref does not follow canary automatically.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## UI demo examples

The UI demo at `/demos/ui` shows the design-system components. Add examples under `features/demo-ui/components/<component-id>-examples/`.
For a new component, adapt the [Button directory](features/demo-ui/components/button-examples),
including its `demo.tsx`, `playground.tsx`, and public `index.ts`.
Add one `*.example.tsx` per usage scenario; use
[basic.example.tsx](features/demo-ui/components/button-examples/basic.example.tsx)
for minimal usage.

Keep the component and its `metadata` export in the same TSX file; the
[metadata types](features/demo-ui/types/examples.ts) define the fields.
Demo metadata uses literal values because generation reads it without executing TSX.
`order` defaults to `0`, with component ID or example filename breaking ties.

Keep playgrounds and usage examples independently copyable; displayed code comes
from those runnable files. `Demo` owns the playground and controls; shared UI demo
code renders usage examples.

The dev/build scripts update generated indexes. Commit them with their sources;
run `pnpm demo:generate:examples` when working without the dev server.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
