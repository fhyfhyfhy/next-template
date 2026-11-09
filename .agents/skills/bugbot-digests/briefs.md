# Subagent briefs

Fill in the angle-bracketed parts from `generate --plan`. Each brief stands alone: the subagent knows only what it says, and reads the digest standard from the project's copy of the rule.

## Writer

```
You are writing Cursor Bugbot digests for rules of <project>, at <absolute project root>. Work only
there, with absolute paths, and write only the digest files named below.

First read <the project's Bugbot digest rule, such as .claude/rules/<project>/bugbot.md>: it is the
standard each digest meets. Bugbot sees only the pull request's diff and the BUGBOT.md files, and a
generator puts each digest under a heading with its rule's title and an "Applies to:" line listing
the rule's paths, so the digest repeats neither.

Then, for each rule below, read the rule in full, and the lint config and tests it would leave a
constraint to (eslint.config.mjs, eslint.config.project.mjs, scripts/eslint/, the tests it names),
and write its digest:

---
source: .claude/rules/<path>
source-sha256: <hash>
---

- <bullet>

English bullets, with "### " subheadings only where the rule has clearly separate topics. Stay at
or under each budget, the whole file counted with wc -m; where it forces a choice, keep first the
constraints whose breach breaks behavior (wrong or lost data, security, races, writes applied twice
or never), then the design ones.

Rules:
<n. rule → digest, budget N characters, source-sha256 H>

Report, for each digest, its character count and each constraint you left out, one line each, with
the reason: lint or a test catches it, a diff can't show it, or budget.
```

## Verifier

A fresh subagent, not the writer, so that it reads each rule without the writer's choices in mind.

```
You are checking Cursor Bugbot digests against the rules they condense, in <project> at
<absolute project root>. Read only, with absolute paths.

<The project's Bugbot digest rule> is the standard each digest meets; read it first. For each pair
below, read the rule and the digest in full, and the lint config and tests the digest leaves
constraints to, then report what breaks the standard, as:

- Missing: a constraint of the rule the digest should carry and does not. Quote the rule's sentence
  and mark it behavior (its breach breaks behavior) or design.
- Wrong: a bullet that says what the rule does not, narrows or overstates it, or would flag correct
  code. Quote the bullet and the rule's sentence.
- Guessed: a "what goes wrong" clause the rule does not state.
- Unclear: a bullet a reviewer could not act on from the diff alone.
- Covered: a bullet that only repeats what lint, a test or a CI check catches; name the check.
- Conflict: a bullet that contradicts another digest loading for the same files.
- Rule error: a sentence of the rule that is wrong against the code or leaves out an exception the
  code has.

If a digest is sound, say so. Two or three lines a finding.

Pairs:
<rule → digest>
```
