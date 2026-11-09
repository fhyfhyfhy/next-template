---
name: bugbot-digests
description: Cursor Bugbot reviews against the project's rules, one digest per rule placed by its paths into .cursor/BUGBOT.md files. Sets them up, writes and checks the digests with subagents, and confirms what Bugbot loads.
disable-model-invocation: true
---

Cursor Bugbot reviews a pull request against the `.cursor/BUGBOT.md` of each changed file's directory and of every directory above it. It also reads every file those link to, and on through their links, and it reads at most 30,000 characters from one file and 100,000 in one review. The rules in `.claude/rules/` run past that in full, so Bugbot gets each rule as a digest, inline: what a reviewer checks a diff against, about a third of the rule. `scripts/bugbot-rules.mjs` here writes each digest into the directories its rule's `paths` reach, as Claude Code loads the rule for the agent writing the change.

This is for a project made from next-template, run from its root; next-template keeps no digests. Below, `generate` means `node .agents/skills/bugbot-digests/scripts/bugbot-rules.mjs`.

## Set up

Copy [project-rule.md](project-rule.md) into the project's own rules, such as `.claude/rules/<project>/bugbot.md`. It holds the digest standard, and it loads for whoever changes a rule or a digest later.

## Write the digests

1. Run `generate --plan`. For each rule it gives where the digest goes, the rule's length, a starting budget, and the `source-sha256` to set.
2. Keep the project root's `BUGBOT.md` under about 25,000 characters: every change loads it, with the rules that have no `paths`, a root file such as `proxy.ts`, or a glob such as `**/*.tsx`. Tighten those rules' budgets when they add up past it.
3. Group the rules, two to four to a group and about 10,000 to 18,000 characters of rule each, and start a subagent per group with the writer brief in [briefs.md](briefs.md), all at once.
4. As each writer reports, start a fresh subagent on its group with the verifier brief, and send its findings back to the writer as that file says.

Done when no verification has a Wrong, Guessed or Unclear finding left, and every Missing finding marked behavior is in its digest.

## Generate and test

1. Run `generate`. It refuses while a digest's hash differs from its rule's, and reports the heaviest change's load.
2. Run `pnpm test .agents/skills/bugbot-digests/scripts/bugbot-rules.test.mjs`. It checks that the `BUGBOT.md` files are fresh, every rule has a current digest, nothing links, and no file passes `MAX_FILE_CHARS` nor any change `MAX_LOAD_CHARS`.
3. Commit `.cursor/`, the digests and the generated files, with the rule.

## Confirm what Bugbot loads

Comment `bugbot run verbose=true` on a pull request that changes ordinary files, such as the next one after the digests merge. On the pull request that adds or regenerates the `BUGBOT.md` files, each of them is a changed file, so Bugbot loads every one and drops what passes 100,000 characters, its learned rules among them. Done when its output lists, for the changed files, the `BUGBOT.md` files their directories call for, none truncated or dropped.

## Afterwards

The project rule keeps a changed rule's digest in step. A template upgrade ([derived-project](../derived-project/SKILL.md)) that changes the template's rules fails the generator and this test until their digests follow, and brings this skill's newer generator along.
