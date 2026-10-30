This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

Install dependencies, then run the development server:

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result. To browse the [Demo](#demo) with its Mock API, run `pnpm demo:dev` instead and open `/demos`.

When port 3000 is taken, the `dev` and `start` scripts, including their `demo:` versions, move to the next free port and print the URL. Pass `--port` to pin one.

## Demo

`/demos` holds runnable reference implementations of this template's conventions, kept in projects made from it:

- **UI demo** (`/demos/ui`): the design-system components; see [UI demo examples](#ui-demo-examples).
- **Data demo** (the other `/demos` pages): a small task app that exercises the data-fetching rules against the Mock API. [`demos.md`](.agents/skills/next-data-flow/demos.md) maps each scenario to its rule, code, and e2e spec.

The **Mock API** (`scripts/mock-api/`) is a stand-in backend in a separate Node process ([ADR 0001](docs/adr/0001-demos-use-standalone-mock-api.md)). The Demo has its own scripts, `pnpm demo:dev`, `pnpm demo:build`, and `pnpm demo:start`: they start the Mock API on `127.0.0.1:4010` and point `NEXT_PUBLIC_API_BASE_URL` at it, overriding the project's backend URL, so during those runs every page, including the project's own features, talks to the Mock API. Their build output goes to `.next-demo`, leaving the project's `.next` alone. `pnpm dev`, `pnpm build`, and `pnpm start` never start the Mock API; under them the Data demo pages show a notice instead of sending requests. The Data demo's e2e specs are described under [Tests](#tests).

## Checks

`pnpm check` runs `format:check`, `lint`, `typecheck`, and `test` in that order and stops at the first failure. The e2e sets run on their own (see [Tests](#tests)).

`pnpm typecheck` runs `next typegen` before `tsc --noEmit`, because helpers such as `PageProps<"/demos/tasks">` come from the route types Next generates. It checks with `tsconfig.typecheck.json`, which reads only the copy `next typegen` just wrote and leaves out the copies that `next dev` and the `demo:` scripts keep in `.next/dev` and `.next-demo`: after a route is removed or renamed, those stay stale until their script runs again.

## Tests

`pnpm test` runs the unit tests with Vitest: every `*.test.*` file, kept next to the code it tests. `vitest.config.mts` resolves `@/` like `tsconfig.json`.

End-to-end specs run with Playwright in two sets, each against its own production build and port, so they can run side by side and alongside `pnpm dev`. Install the browser once with `pnpm exec playwright install chromium`.

- `pnpm test:e2e` runs the project's own specs in `e2e/`, skipping `e2e/demo/`, against `pnpm build` and `pnpm start` on port 3998. `e2e/home.spec.ts` is the minimal example to start from.
- `pnpm demo:test:e2e` runs the Data demo's specs in `e2e/demo/` against `pnpm demo:build` and `pnpm demo:start` on port 3999. When a `demo:` script is already running, later `demo:` scripts, these specs included, share its Mock API instead of starting another; it stops with the script that started it. The specs reset that Mock API before each test and restore it afterwards, so leave the `demo:dev` page alone while they run.

While debugging, `E2E_REUSE_SERVER=1` makes either set reuse a server you started on its port, such as `pnpm demo:dev --port 3999`; specs that depend on production behavior, such as prefetching, fail against a dev server.

## Backend API

Set `NEXT_PUBLIC_API_BASE_URL` to the backend's base URL, for example in `.env.local`. The `demo:*` scripts override it with the Mock API (see [Demo](#demo)).

Features call the backend only through `fetchApi`, so fitting the template to a backend touches these files alone:

- `lib/fetch.ts`: the base URL, the response format (as shipped, a `{ code, data, message }` envelope with `code` 0 for success), and the error types.
- `lib/credentials-server.ts` and `lib/credentials-browser.ts`: the signed-in user's credential for requests from the server and from the browser. Both send none as shipped. `package.json` resolves `#credentials` to the right one per environment.
- `app/providers.tsx`: what a signed-out response does in the browser.

The `setup-data-access` skill (`/setup-data-access` in Claude Code) asks about the backend, makes these changes, keeps the Mock API's response format in step, and verifies the result in a production build.

## Agent skills

Skills live in `.agents/skills/`, which Codex reads directly. Claude Code reads `.claude/skills/`, which holds local links made by `scripts/link-skills.sh`; the SessionStart hook in `.claude/settings.json` runs it whenever a Claude Code session starts here. To make the links without starting a session, run `bash scripts/link-skills.sh` (in Git Bash on Windows).

Next.js framework guidance comes from the installed `node_modules/next/dist/docs/`. The project [data-flow skill](.agents/skills/next-data-flow/SKILL.md) covers ownership and React Query integration; the official [Cache Components optimizer](.agents/skills/next-cache-components-optimizer/SKILL.md) and [Partial Prefetching optimizer](.agents/skills/next-partial-prefetching-optimizer/SKILL.md) provide targeted optimization workflows. [next-dev-loop](.agents/skills/next-dev-loop/SKILL.md) verifies development behavior using Next.js MCP and the user-level `browser-harness` skill. Official skill adaptations are recorded in `.agents/skill-patches/` and reapplied on updates as [Skill patches](.agents/skills/skills-and-rules/PATCHES.md) describes.

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
