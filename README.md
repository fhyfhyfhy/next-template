This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

Install dependencies, then run the development server:

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Agent skills

Skills live in `.agents/skills/`, which Codex reads directly. Claude Code reads `.claude/skills/`, which holds local links made by `scripts/link-skills.sh`; the SessionStart hook in `.claude/settings.json` runs it whenever a Claude Code session starts here. To make the links without starting a session, run `bash scripts/link-skills.sh` (in Git Bash on Windows).

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Showcase examples

Add demos under `features/component-showcase/components/<component-id>-examples/`.
For a new component, adapt the [Button directory](features/component-showcase/components/button-examples),
including its `demo.tsx`, `playground.tsx`, and public `index.ts`.
Add one `*.example.tsx` per usage scenario; use
[basic.example.tsx](features/component-showcase/components/button-examples/basic.example.tsx)
for minimal usage.

Keep the component and its `metadata` export in the same TSX file; the
[metadata types](features/component-showcase/types/examples.ts) define the fields.
Demo metadata uses literal values because generation reads it without executing TSX.
`order` defaults to `0`, with component ID or example filename breaking ties.

Keep playgrounds and usage examples independently copyable; displayed code comes
from those runnable files. `Demo` owns the playground and controls; shared showcase
code renders usage examples.

The dev/build scripts update generated indexes. Commit them with their sources;
run `pnpm generate:examples` when working without the dev server.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
