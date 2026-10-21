# Skill patches

A third-party skill is customized through a **patch**: `.agents/skill-patches/<skill>.md`. The committed skill is always its upstream text with the patch applied, so an upgrade takes the new upstream text and applies the patch again.

## Format

````markdown
# <skill>

Upstream: <the command or source that yields the untouched upstream text>

## <What the change does>

<Why, in a sentence or two.>

```diff
@@ <landmark in words: a heading, "after the frontmatter"> @@
 <context line, quoted from upstream>
-<upstream line to remove>
+<line to add>
```
````

- A **change** is a heading, its why, and hunks or a replace table. The why decides where and whether the change still applies once upstream rewords or moves the text it touches.
- A **hunk** edits one place, in unified diff syntax: context (leading space) and `-` lines quote the untouched upstream exactly, `+` lines are the final text. The `@@` line names a landmark in place of line numbers, which shift on every upgrade. One or two context lines on each side, enough to make the place unique.
- A **replace table** rewrites strings everywhere in scope, for a rename spread too wide for hunks. Cells are code spans: the string is what sits inside the backticks. A `Scope:` line under the table says where it applies and, with examples, what stays.

  | Upstream | Workspace |
  | --- | --- |
  | `<string>` | `<string>` |

- Changes edit `SKILL.md`. A change to another file in the skill starts with `File: <path in the skill>`. A new file is a hunk with `@@ new file @@` and only `+` lines.

## Customize a skill

Add the change to the skill's patch, creating the patch if needed, then apply that change to the skill. The skill and its patch change in the same commit.

## Apply a patch

Start from the untouched upstream text, which the `Upstream:` line names. Keep a copy of it outside the skill until you are done, since the checks below read it. Then apply the changes in order:

- Place each hunk by its context and `-` lines. Where upstream reworded or moved them, place it by its landmark and why.
- Copy `+` lines exactly as written.
- Replace tables rewrite each upstream occurrence once, so they never touch `+` lines or text another row or table already rewrote.
- A change that no longer fits stays out: its place is gone, or upstream now does the same.
- Refresh the patch: rewrite its context lines, `-` lines, and Scope examples to quote the new upstream, and drop changes upstream has absorbed, so the next apply matches exactly.

Done when:

- every change is applied, or left out because it no longer fits;
- every grep hit for a table's Upstream string in the upstream copy is rewritten in the skill or out of that table's scope;
- the skill's `git diff` drops no `+` line and adds only lines of the upstream copy, as the tables rewrite them, apart from changes you adjusted or left out.

Then tell the user what upstream changed and which changes you adjusted or left out.
