---
name: derived-project
description: Projects made from next-template: which of the template's files they keep, replace, or add, how to start one, and how to upgrade one to the template's latest version.
disable-model-invocation: true
---

A project made from [next-template](https://github.com/fhyfhyfhy/next-template) starts as a copy of it ([start.md](start.md)) and takes in the template's latest `main` from then on ([upgrade.md](upgrade.md)). `.template-version`, at the project's root, names the template commit it last took in. In the project, this skill is a pointer the upgrade puts in place, which sends agents to a local next-template checkout.

## The template's files

Each of the template's files belongs to one group, which decides what a project does with it:

- **Sample product** (below): the project deletes it and writes its own features in its place.
- **Data setup**: `.claude/rules/data-setup.md` and the code it describes: `lib/db.ts`, `scripts/db/`, the `db` project in `vitest.config.mts`, `e2e/backend.ts`, `compose.yaml`, and `scripts/local-services/`. A project with a data setup of its own, such as another app's database, replaces it as a whole: it writes its own `data-setup.md`, keeping the headings other files link to, and its own code for what that file describes, with the helpers `.claude/rules/e2e.md` names in its `e2e/backend.ts`, and without `compose.yaml` and `scripts/local-services/` when it runs no local services. It keeps the `build:local` and `start:local` scripts in `package.json`, which the skills run to build and start production on this machine: without local services, they build and start with the connection settings the machine's environment gives. Any other project keeps it as it is.
- **Agent instructions**: `AGENTS.md`, `CLAUDE.md`, and the files in `.claude/rules/`, `.agents/`, and `docs/agents/`, apart from `data-setup.md`. The project keeps them as they are, apart from what it sets: the prose language in `.claude/rules/writing-style.md`, and `AGENTS.md` § Agent skills and the files in `docs/agents/`, which describe its own issue tracker, triage labels, domain docs, and reviews. The upgrade replaces this skill with its pointer. A change that every project made from the template needs is made in next-template.
- **Project documents**: `README.md`, `TODO.md`, `GLOSSARY.md`, `docs/features.md`, and `docs/adr/`. They describe the project, so it rewrites them as its own.
- **Everything else**: application code, configuration, scripts, and tests. The project keeps them, changing a file only where it must, and gives each change an entry in `docs/template-divergences.md`: what the template does, what the project does instead, and why. A change other projects would want too is made in next-template instead.

Everything a project adds is a file of its own: its rules and skills where [skills-and-rules](../skills-and-rules/SKILL.md) places them, its lint checks and ignores in `eslint.config.project.mjs`, which `eslint.config.mjs` loads after its own, and its code where `.claude/rules/architecture.md` does.

## Sample product

The example business the template ships, so that its conventions have working code to show: the paths `SAMPLE_PRODUCT` in `scripts/sample-product.mjs` lists.
