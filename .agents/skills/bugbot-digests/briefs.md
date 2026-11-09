# Subagent briefs

Fill in the angle-bracketed parts from the generator's `--plan` output. Each brief stands alone: the subagent knows only what it says.

## Writer

```
You are writing Cursor Bugbot digests for rules of <project>, at <absolute project root>. Work only
there, with absolute paths.

First read <the project's Bugbot digest rule, such as .claude/rules/<project>/bugbot.md>: it is the
standard your digests follow. Then, for each rule below, read the rule in full and write its digest
at the path given.

Bugbot reviews pull request diffs and cannot open any other file. A generator inlines each digest
into .cursor/BUGBOT.md files under a heading with the rule's title and an "Applies to:" line listing
the rule's paths, so the digest repeats neither.

Format, exactly:

---
source: .claude/rules/<path>
source-sha256: <hash>
---

- <bullet>

- English. Bullets; "### " subheadings only where the rule has clearly separate topics.
- Each bullet is a check a reviewer can make on a diff: what the change must do, then, only where
  the rule states it, what goes wrong otherwise. Never guess a consequence the rule does not state.
- Leave out what lint or a test already catches: read eslint.config.mjs, eslint.config.project.mjs,
  scripts/eslint/ and the tests the rule names. A test that pins today's code path does not catch
  new code that breaks the constraint another way; such a constraint stays.
- Keep the rule's scope: its examples stay examples, and its exceptions come along, so the digest
  flags no correct code.
- No Markdown links; name files, paths and identifiers in backticks as the rule writes them.
- Stay at or under each budget (the whole file; check with wc -m). When the budget forces a choice,
  keep first the constraints whose breach breaks behavior (wrong or lost data, security, races,
  writes applied twice or never), then the design ones.
- Edit no other file, run no generator, commit nothing.

Rules:
<n. rule → digest, budget N characters, source-sha256 H>

Report, for each digest, its character count and each constraint you left out, one line each, with
the reason: lint or a test catches it, a diff can't show it, or budget.
```

## Verifier

A fresh subagent, not the writer, so that it reads the rule without the writer's choices in mind.

```
You are checking Cursor Bugbot digests against the rules they condense, in <project> at
<absolute project root>. Work read-only, with absolute paths; edit no file.

<The project's Bugbot digest rule> sets the standard; read it first. For each pair below, read the
rule and the digest in full, then report:

1. Missing: each constraint of the rule a reviewer could check in a diff, that no lint rule, test or
   CI check would catch when new code breaks it, and that the digest does not carry. Quote the
   rule's sentence and mark it "behavior" (its breach breaks behavior) or "design". Judge "a test
   catches it" strictly: a test that pins today's code path misses a new path.
2. Wrong: each bullet that says what the rule does not, narrows or overstates it (such as examples
   turned into a complete list, or a dropped exception), or would make a reviewer flag correct code.
   Quote the bullet and the rule's sentence.
3. Guessed: a "what goes wrong" clause the rule does not state.
4. Unclear: a bullet a reviewer could not act on without opening another file.
5. Covered: a bullet that only repeats what lint, a test or a CI check fully catches; name the check.
6. Conflicts: a bullet that contradicts another digest loading for the same files, and a rule
   sentence that is wrong against the code or leaves out an exception the code has.

If a digest is sound, say so. Two or three lines a finding.

Pairs:
<rule → digest>
```

## Sending findings back

Send the verifier's findings to the writer (it keeps its context), raising a budget where a missing behavior constraint needs the room, and pass on what the standard says about guessed consequences when the finding is one. A finding under 6 that the rule itself is wrong is fixed in the rule when the rule is the project's own; its digest then follows the new rule and its new hash.
