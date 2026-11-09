---
paths:
  - ".claude/rules/**"
  - ".cursor/digests/**"
  - ".agents/skills/bugbot-digests/**"
---

# Bugbot digests

Cursor Bugbot reviews pull requests against the `.cursor/BUGBOT.md` files that `node .agents/skills/bugbot-digests/scripts/bugbot-rules.mjs` writes: each rule's digest, in each directory its `paths` reach. A rule's digest sits at the same path under `.cursor/digests/`, such as `.cursor/digests/data-flow.md` for `.claude/rules/data-flow.md`.

- A change to a rule brings its digest in line in the same change, then runs the generator. It refuses while a digest's `source-sha256` differs from its rule's, and prints the hash to set. A template upgrade that changes the template's rules does the same for theirs.
- A digest opens with frontmatter naming its rule (`source: .claude/rules/data-flow.md`) and that rule's `source-sha256`, then lists what a reviewer checks a diff against:
  - Each constraint of the rule, one bullet each: what the change must do and, in one clause, what goes wrong otherwise where the rule says so. A consequence the rule does not state stays out rather than guessed.
  - Only what a diff can show and no check catches. Examples, code, the steps of writing the code, background, and what lint or a test already catches stay out, whether the rule says so or not. A test catches a constraint only when it fails on any new code that breaks it, not just on today's code path.
  - The rule's scope as the rule writes it: its examples stay examples, not a complete list, and its exceptions come along, so a reviewer flags no correct code.
  - Names, paths and identifiers as the rule writes them, in backticks, and no Markdown links: Bugbot reads on through every file a link names, and it can open no other file.
  - About a third of the rule's length. Bugbot reads at most `MAX_FILE_CHARS` from one `BUGBOT.md`, and a change loads at most `MAX_LOAD_CHARS` (both in the generator); its tests fail past either.
