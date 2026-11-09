---
source: .claude/rules/writing-style.md
source-sha256: ed4869de57245d5892a421a0dbf9d8805d0fdbece8d2331b8bf9bff35cc7f228
---

- Code comments and `describe`/`it`/`test` descriptions are in Simplified Chinese, except in skills and skill patches (`.agents/`), where every file is in English.
- The body of specs, design docs, plans, `GLOSSARY.md` and ADRs (`docs/adr/`) is in Simplified Chinese.
- Doc and asset file names, API and package names, commands, config keys, env vars, error messages and codes, log keys, protocols, schemas and database fields are written in English and kept as-is inside Chinese text, as are common programming terms: translating them costs meaning, compatibility and searchability.
