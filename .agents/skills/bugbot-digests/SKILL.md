---
name: bugbot-digests
description: Give Cursor Bugbot a digest of each rule, placed by the rule's paths into .cursor/BUGBOT.md files, written and checked by subagents.
disable-model-invocation: true
---

Cursor Bugbot reviews a pull request against the `.cursor/BUGBOT.md` of each changed file's directory and of every directory above it, up to a total of 100,000 characters. `scripts/bugbot-rules.mjs` here writes each rule's digest, what a reviewer checks a diff against, into the directories its rule's `paths` reach, as Claude Code loads the rule for the agent writing the change. What a digest holds, and why without links, is the project rule's ([project-rule.md](project-rule.md)).

This is for a project made from next-template, run from its root; next-template keeps no digests. Below, `generate` means `node .agents/skills/bugbot-digests/scripts/bugbot-rules.mjs`.

## Set up

Copy [project-rule.md](project-rule.md) into the project's own rules, such as `.claude/rules/<project>/bugbot.md`. It is the digest standard, and it loads for whoever changes a rule or a digest later.

## Write the digests

1. Run `generate --plan`. For each rule it gives where the digest goes, the rule's length, a starting budget and the `source-sha256` to set, and it ends with what the root's `BUGBOT.md` and the heaviest change would carry by those budgets. When the root's total passes the limit it names, lower the budgets of the rules that go to the root until it fits.
2. Group the rules, two to four to a group and about 10,000 to 18,000 characters of rule each, and start a subagent per group with the writer brief in [briefs.md](briefs.md), all at once.
3. As each writer reports, start a fresh subagent on its group with the verifier brief.
4. Send each verifier's findings to its writer, which keeps its context, raising a budget where a missing behavior constraint needs the room. A rule error is fixed in the rule when the rule is the project's own, and the digest then follows the new rule and its new hash. A template rule stays as next-template has it: the digest follows its text as it stands, and the error goes to next-template.

Done when no verification has a Wrong, Guessed, Unclear or Conflict finding left, every Missing finding marked behavior is in its digest, and every rule error is fixed or reported.

## Generate and test

1. Run `generate`. It refuses while a digest's hash differs from its rule's, and reports the heaviest change's load.
2. Run `pnpm test .agents/skills/bugbot-digests/scripts/bugbot-rules.test.mjs`. It checks that the `BUGBOT.md` files are fresh, every rule has a current digest, nothing links, and no file passes `MAX_FILE_CHARS` nor any change `MAX_LOAD_CHARS`.
3. Commit `.cursor/`, the digests and the generated files, with the rule.

## Confirm what Bugbot loads

Comment `bugbot run verbose=true` on a pull request that changes ordinary files, such as the next one after the digests merge. On the pull request that adds or regenerates the `BUGBOT.md` files, each of them is a changed file, so Bugbot loads every one and drops what passes 100,000 characters, its learned rules among them. Done when its output lists, for the changed files, the `BUGBOT.md` files their directories call for, none truncated or dropped.

## Afterwards

The project rule keeps a changed rule's digest in step. A template upgrade ([derived-project](../derived-project/SKILL.md)) that changes the template's rules fails `generate` and `bugbot-rules.test.mjs` until their digests follow, and brings this skill's newer generator along.
