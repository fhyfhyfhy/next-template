# Language in Files

Which language the text written into files uses: code comments, test descriptions, docs, and names.

## Prose language

This repo's prose language is **Simplified Chinese**. This line is its only setting; the rest of this file and the skills that write docs follow it.

Changing it applies to text written from then on; existing text keeps its language until a task translates it. When you change it, also translate the plan headings in `.agents/skill-patches/improve-animations.md`, which fixes them in the prose language, and apply that patch again.

## Language by content

| Content | Language |
| ------- | -------- |
| Body of specs, design docs, plans, `GLOSSARY.md`, and ADRs (`docs/adr/`) | Prose language |
| Code comments | Prose language |
| `describe` / `it` / `test` descriptions in tests | Prose language |
| Agent instructions: `AGENTS.md`, `CLAUDE.md`, rules (`.claude/rules/`), skills (name, description, instructions, and every file in them) and their patches (`.agents/skill-patches/`), and the docs they send agents to (`docs/agents/`) | English, whatever the prose language |

## English in agent instructions

Text that must stay in another language, such as UI copy, test data, or a template for a prose-language document, is literal: quote it as inline code or a code block. Write everything else in English, including domain terms, which take their English names from `GLOSSARY.md`.

## Names and fixed terms

Write these in English, and keep them in their original form wherever they appear, Chinese text included: file and directory names, code identifiers, the term names in `GLOSSARY.md`, API and package names, commands, config keys, env vars, error messages and error codes, log keys, protocols, schemas, database fields, tool directives such as `eslint-disable`, and the fixed terms of third-party systems, standard protocols, public APIs, npm packages, and SDK docs. Translating them costs meaning, compatibility, searchability, and developer experience.

## Technical terms in Chinese text

Keep common programming terms in English and let them sit naturally in the Chinese sentence, as in `调这个 API`, `加一层 cache`, `写一个 hook`, `这个 service 有点问题`, and `先跑一下 lint 和 test`. Write API, HTTP, and SDK as they are.
