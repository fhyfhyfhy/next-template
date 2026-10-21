# Code Comment Rules

Follow these rules when adding, modifying, or reviewing code, in any language or framework. Which language a comment is written in is set by `writing-style.md`.

## 1. Decide Whether a Comment Is Needed

Comments are for future maintainers. Before writing one, ask:

**Without this comment, what information would a maintainer be missing that could lead to an incorrect change six months from now?**

If you can identify a concrete risk, document the necessary information. If the comment only repeats the code or explains the current task, omit it. Follow Section 5 for public interface documentation.

Prefer clear names, extracted functions, types, assertions, or tests to express intent and rules. Use comments to explain reasons, requirements, and risks that these do not make clear.

In the following situations, check for information that the code does not express but maintainers need to know. Add a comment whenever such information is missing:

- Complex business rules or special edge cases.
- Temporary workarounds, compatibility handling, or legacy behavior, including why they must remain.
- Performance optimizations or algorithms and implementations that are difficult to understand.
- Conditions that security, permissions, concurrency, or transaction handling must guarantee.
- External system conventions, interface behavior the code relies on, or data format restrictions.

Explain the specific rule and what could go wrong if it is violated. Labels such as “very complex” or “do not touch” are not explanations.

## 2. Explain Why the Code Works This Way

- Explain why the code is written this way and what future changes must preserve. Omit descriptions of operations already clear from the code.
- Describe facts that hold today. Leave before-and-after comparisons and migration history to Git and PRs.
- Put design reasoning, comparisons between alternatives, requirement background, and review discussions in specs, plans, or PRs. Use Section 1 to decide which conclusions future maintainers also need in the code.
- When referring to other material, use specific object names, file paths, function names, constant names, ticket IDs, or external documentation links. Readers must be able to find the evidence without knowing the original conversation.

Place comments immediately above the relevant code. Short explanations may go at the end of the line.

## 3. Be Careful When Describing Other Code

Before describing another module’s or caller’s behavior, ask:

**If that behavior changes, will the person changing it notice that this comment also needs updating?**

Prefer approaches that stay correct without anyone remembering to come back, in this order:

1. Where possible, enforce requirements through types, assertions, or tests.
2. When explaining local implementation choices, state the conditions this code must satisfy.
3. When a reference to other code is necessary, name the specific file, function, or constant and verify its actual behavior.

Claims such as “already handled upstream,” “guaranteed by the caller,” or “this reference is stable” need verifiable evidence. Such comments alone do not justify omitting necessary validation, dependency entries, or error handling.

## 4. Keep Comments Short and Avoid Repetition

- Explain each reason once, where the relevant rule is defined or implemented. Elsewhere, add a brief reference only when needed.
- Implementation comments should usually be 1–3 lines and preferably no more than 5. External system pitfalls, algorithms that are difficult to understand, or protocol conventions may need longer explanations.
- When a comment block exceeds 10 lines, usually move the detailed explanation into a doc in the repo, such as under `docs/`. Keep the information needed to modify the code safely, plus the document path, beside the code. Public interface documentation should contain what callers actually need.
- If the proportion of comments in added lines is substantially higher than in the existing file, recheck each comment’s necessity. Roughly twice the existing proportion is a signal to review, not a hard limit. When the file has few existing comments, use Section 1.

## 5. Documentation Comments and Special Markers

**Public interfaces**

For public functions, classes, modules, and APIs, use the language’s standard documentation-comment format. State their purpose and, where applicable, explain:

- Conditions callers must satisfy before use.
- State changes or additional operations they trigger.
- When exceptions may occur and how failures are handled.

Omit parameter and return types already clear from declarations and type information.

**TODO / FIXME / HACK**

State the current problem or reason for keeping the code, along with the next action or the condition for removing it. Include a related ticket ID when one exists.

Suggested format:

`TODO: <problem or reason for keeping this>; <next action or removal condition> (<related ticket, optional>)`

**Obsolete code**

Delete obsolete code; Git keeps its history.

## 6. Completion Criteria for Changes and Reviews

When modifying code, read every nearby or directly affected comment. Verify that its descriptions of branches, paths, fields, calling relationships, and conditions for use still hold.

If a change affects how other functions or interfaces must be used, also check the documentation where they are defined. Update any descriptions that no longer match the code.

Before finishing, confirm:

- Added and modified comments follow these rules.
- Affected existing comments have been checked, and outdated content has been corrected or removed.
- Information maintainers need for this change is documented, without repeating the same explanation.

During review, check comments as carefully as code. Report inaccurate descriptions or missing information needed for safe maintenance as defects, rather than dismissing them as wording issues.