---
name: derived-project
description: Projects made from next-template, and which of its files they keep, replace, or add. Use when starting a project from the template, replacing its sample product or data setup, upgrading a project to a later template commit, or deciding where a change goes in a project made from it.
---

A project made from [next-template](https://github.com/fhyfhyfhy/next-template) starts as a copy of it, as [start.md](start.md) describes, and takes in its later commits, as [upgrade.md](upgrade.md) describes. `.template-version`, at the project's root, names the template commit it last took in.

## The template's files

Each of the template's files belongs to one group, which decides what a project does with it:

- **Sample product** (below): the project deletes it and writes its own features in its place.
- **Data setup**: `.claude/rules/data-setup.md` and the code it describes: `lib/db.ts`, `scripts/db/`, the `db` project in `vitest.config.mts`, `compose.yaml`, and `scripts/local-services/`. A project whose data lives elsewhere, such as in another app's database, replaces it as a whole: it writes its own `data-setup.md`, keeping the headings other files link to, and its own code for what that file describes, without `compose.yaml` and `scripts/local-services/` when it runs no local services. Any other project keeps it as it is.
- **Agent instructions**: `AGENTS.md`, `CLAUDE.md`, and the files in `.claude/rules/`, `.agents/`, and `docs/agents/`, apart from `data-setup.md`. The project keeps them as they are, setting only the prose language in `.claude/rules/writing-style.md`. A change that every project made from the template needs is made in next-template.
- **Project documents**: `README.md`, `TODO.md`, `GLOSSARY.md`, `docs/features.md`, and `docs/adr/`. They describe the project, so it rewrites them as its own, keeping what they say about the code it keeps.
- **Everything else**: application code, configuration, scripts, and tests. The project keeps them, changing a file only where it must, and gives each change an entry in `docs/template-divergences.md`: what the template does, what the project does instead, and why.

Everything a project adds is a file of its own: its rules and skills where [skills-and-rules](../skills-and-rules/SKILL.md) places them, and its code where `.claude/rules/architecture.md` does.

## Sample product

Everything that serves tasks and uploads: its features, routes, namespace, specs, and seed data, each path listed in `SAMPLE_PRODUCT` in next-template's `scripts/sample-product.mjs`, and their entries in `GLOSSARY.md` and `docs/features.md`.
