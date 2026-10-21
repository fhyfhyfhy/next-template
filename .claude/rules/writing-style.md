# Language in Files

Which language the text written into files uses: code comments, test descriptions, docs, and names.

## Language by content

| Content | Language |
| ------- | -------- |
| Body of specs, design docs, and plans | Simplified Chinese |
| Code comments | Simplified Chinese |
| `describe` / `it` / `test` descriptions in tests | Simplified Chinese |
| Skills and rules (`.claude/rules/`): name, description, instructions, and every file in them | English |

## Names and fixed terms

Write these in English, and keep them in their original form wherever they appear, Chinese text included: file and directory names, code identifiers, API and package names, commands, config keys, env vars, error messages and error codes, log keys, protocols, schemas, database fields, tool directives such as `eslint-disable`, and the fixed terms of third-party systems, standard protocols, public APIs, npm packages, and SDK docs. Translating them costs meaning, compatibility, searchability, and developer experience.

## Technical terms in Chinese text

Keep common programming terms in English and let them sit naturally in the Chinese sentence: 调这个 API、加一层 cache、写一个 hook、这个 service 有点问题、先跑一下 lint 和 test. Write API, HTTP, and SDK as they are.
