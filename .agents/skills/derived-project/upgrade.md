# Upgrading a project

Take a project made from next-template to the template's latest `main`. The groups of files are in [SKILL.md](SKILL.md#the-templates-files).

1. From the project's root, run `node <checkout>/scripts/template-upgrade.mjs .`, where `<checkout>` is the next-template checkout this file is in. It refuses unless the checkout is at the latest `main`. It takes in the template's changes from the commit in `.template-version` to that `main`, writes the new commit into `.template-version`, puts this skill's pointer in place of the project's copy, and reports what it left to you, with the command that shows the template's change to a file.
2. Resolve each file the report lists by its group:
   - **Conflict markers**, in a file both sides changed in the same place: keep the project's differences that `docs/template-divergences.md` records, unless the template now covers one, and take the rest of the template's change. A conflict in an agent instruction means the project changed what it keeps as it is: move the project's text into a file of its own, or into next-template. In a project document, keep the project's text and take the template's change only where it describes code the project keeps.
   - **Left for a decision**: files the script left as they were, each with its reason, such as a file the template changed and the project deleted. Decide each from the template's change and the file's entry in `docs/template-divergences.md`.
   - **Generated files**: regenerate them, such as with `pnpm generate:examples`.
   - **Sample product**: not taken in. Read its changes with the command the report prints: a change that comes with a rule change shows how the project's own features change too.
3. When the project has replaced the data setup, put its own version back in place of whatever the script merged into or added to the data setup's files, then carry over by hand what applies from the template's change to them, keeping the headings other files link to.
4. Rewrite the text that came in, such as comments, test titles, and docs, in the project's prose language when it differs from the template's (`.claude/rules/writing-style.md`).
5. Bring the project's own code in line with the rules the upgrade changed: read the template's change to `AGENTS.md`, `.claude/rules/`, `.agents/`, and `docs/agents/` with the report's command, and check the project's code that each changed rule governs. The sample product's changes in the same commits show the rule applied.
6. Run `pnpm install`, then `pnpm check` and `pnpm test:e2e`, and fix what fails.
7. Update `docs/template-divergences.md`: an entry for each new difference, and none for a difference the template now covers. Send the upgrade, `.template-version` included, as one PR.
