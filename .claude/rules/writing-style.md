# Language in Files

Which language the text written into files uses: code comments, test descriptions, developer-facing strings, docs, and names.

## Language by content

| Content | Language |
| ------- | -------- |
| Code comments | English |
| `describe` / `it` / `test` descriptions in tests | English |
| Developer-facing strings: ESLint rule messages, thrown errors, logs, headers of generated files | English |
| Agent instructions: `AGENTS.md`, `CLAUDE.md`, rules (`.claude/rules/`), and skills (name, description, instructions, and every file in them) | English |
| Body of specs, design docs, and plans; `GLOSSARY.md`; `docs/` | Simplified Chinese |
| User-visible text | Every locale, under `messages/`, through next-intl ([i18n.md](i18n.md)) |

## Literals in their own language

Some string literals stay in the language of what they stand for, not of the code around them:

- An e2e spec that finds an element by its text or accessible name, or asserts on it, uses the text the page shows in the locale under test, the default `zh` included.
- Made-up content that stands in for user or backend data, such as the Mock API's seed records and what a test types into the page, may be in any language; a test of text handling may need it to be.
- `components/locale-switcher` names each language in that language.

## Names and fixed terms

Write these in English, and keep them in their original form wherever they appear, Chinese text included: file and directory names, code identifiers, API and package names, commands, config keys, env vars, error messages and error codes, log keys, protocols, schemas, database fields, tool directives such as `eslint-disable`, and the fixed terms of third-party systems, standard protocols, public APIs, npm packages, and SDK docs. Translating them costs meaning, compatibility, searchability, and developer experience.

## Technical terms in Chinese text

In the Chinese docs, keep common programming terms in English and let them sit naturally in the sentence: 调这个 API、加一层 cache、写一个 hook、这个 service 有点问题、先跑一下 lint 和 test. Write API, HTTP, and SDK as they are.
