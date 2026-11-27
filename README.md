# next-template

Next.js 模板。

## 规范

### 架构

由 Rule、Lint 和 Review 约束。

- Rule：[architecture.md](.claude/rules/architecture.md)、[components.md 的 Component directories](.claude/rules/components.md#component-directories)
- Lint：[eslint.config.mjs](eslint.config.mjs) 的架构部分，[scripts/eslint/architecture/](scripts/eslint/architecture/)，层级表在 [scripts/eslint/layers.mjs](scripts/eslint/layers.mjs)
- 文档：[docs/features.md](docs/features.md)
- Review：[code-review.md 的 Architecture](docs/agents/code-review.md#architecture)

### 数据与渲染

由 Rule、Lint、测试、Review 和 Skill 约束。

- Rule：[data-flow.md](.claude/rules/data-flow.md)、[server-data.md](.claude/rules/server-data.md)、[data-setup.md](.claude/rules/data-setup.md)、[tanstack-query.md](.claude/rules/tanstack-query.md)、[AGENTS.md 的 Environment variables](AGENTS.md#environment-variables)
- Lint：[eslint.config.mjs](eslint.config.mjs) 的数据部分，[scripts/eslint/data/](scripts/eslint/data/)
- 测试：[vitest.config.mts](vitest.config.mts) 的 db project，[scripts/db/migrate.test.mjs](scripts/db/migrate.test.mjs)、[scripts/local-services/seed.db.test.mjs](scripts/local-services/seed.db.test.mjs)、[lib/env.test.ts](lib/env.test.ts)、[lib/request/fetch.test.mjs](lib/request/fetch.test.mjs)、[lib/request/domain-error.test.ts](lib/request/domain-error.test.ts)
- Skill：[next-data-flow](.agents/skills/next-data-flow/SKILL.md)、[next-cache-components-optimizer](.agents/skills/next-cache-components-optimizer/SKILL.md)、[next-partial-prefetching-optimizer](.agents/skills/next-partial-prefetching-optimizer/SKILL.md)、[self-hosting-audit](.agents/skills/self-hosting-audit/SKILL.md)
- Review：[code-review.md 的 Data flow](docs/agents/code-review.md#data-flow)

### UI 与组件

由 Rule、Lint、测试、Review 和 Skill 约束。

- Rule：[components.md](.claude/rules/components.md)、[design-system.md](.claude/rules/design-system.md)、[react.md](.claude/rules/react.md)、[ui-catalog.md](.claude/rules/ui-catalog.md)、[libraries.md](.claude/rules/libraries.md)
- Lint：[eslint.config.mjs](eslint.config.mjs) 的 UI 部分，[scripts/eslint/tailwind-classes.mjs](scripts/eslint/tailwind-classes.mjs)；组件目录、UI 库封装和 `architecture/catalog-examples`（`components/ui` 的组件和 catalog 示例目录一一对应）的检查在架构部分
- 测试：[lib/cn.test.mjs](lib/cn.test.mjs)、[app/globals.test.ts](app/globals.test.ts)、[scripts/ui-catalog/index-generator.test.mjs](scripts/ui-catalog/index-generator.test.mjs)、[scripts/ui-catalog/index-freshness.test.mjs](scripts/ui-catalog/index-freshness.test.mjs)、[features/ui-catalog/utils/example-source.test.mjs](features/ui-catalog/utils/example-source.test.mjs)、[e2e/ui-catalog.spec.ts](e2e/ui-catalog.spec.ts)
- Skill
  - 组件：[vercel-composition-patterns](.agents/skills/vercel-composition-patterns/SKILL.md)
  - 选库：[pick-ui-library](.agents/skills/pick-ui-library/SKILL.md)
  - 设计：[emil-design-eng](.agents/skills/emil-design-eng/SKILL.md)、[apple-design](.agents/skills/apple-design/SKILL.md)、[mobile-native](.agents/skills/mobile-native/SKILL.md)、[break-ui](.agents/skills/break-ui/SKILL.md)
  - 动效：[animate](.agents/skills/animate/SKILL.md)、[animation-performance](.agents/skills/animation-performance/SKILL.md)、[animation-vocabulary](.agents/skills/animation-vocabulary/SKILL.md)、[choreograph](.agents/skills/choreograph/SKILL.md)、[find-animation-opportunities](.agents/skills/find-animation-opportunities/SKILL.md)、[improve-animations](.agents/skills/improve-animations/SKILL.md)、[review-animations](.agents/skills/review-animations/SKILL.md)
- Review：[code-review.md 的 UI](docs/agents/code-review.md#ui)

### i18n

由 Rule、Lint、测试和 Review 约束。

- Rule：[i18n.md](.claude/rules/i18n.md)，术语表 [messages/terms.json](messages/terms.json)
- Lint：[eslint.config.mjs](eslint.config.mjs) 的 i18n 部分，[scripts/eslint/i18n-plugin.mjs](scripts/eslint/i18n-plugin.mjs)、[scripts/eslint/client-namespaces.mjs](scripts/eslint/client-namespaces.mjs)、[scripts/eslint/message-owner.mjs](scripts/eslint/message-owner.mjs)
- 测试：[messages/messages.test.ts](messages/messages.test.ts)、[lib/i18n/request.test.ts](lib/i18n/request.test.ts)、[scripts/eslint/client-namespaces.test.mjs](scripts/eslint/client-namespaces.test.mjs)、[components/locale-switcher/locale-items.test.tsx](components/locale-switcher/locale-items.test.tsx)、[components/date-time.test.tsx](components/date-time.test.tsx)、[e2e/locale.spec.ts](e2e/locale.spec.ts)、[e2e/date-time.spec.ts](e2e/date-time.spec.ts)；[e2e/test.ts](e2e/test.ts) 让每个 e2e 用例在页面报 `MISSING_MESSAGE` 时失败
- Review：[code-review.md 的 i18n](docs/agents/code-review.md#i18n)

### 测试

由 Rule、Lint 和 Review 约束。

- Rule：[tests.md](.claude/rules/tests.md)、[e2e.md](.claude/rules/e2e.md)、[server-data.md 的 Tests](.claude/rules/server-data.md#tests)、[data-setup.md 的 Test databases](.claude/rules/data-setup.md#test-databases)
- 工具：[vitest.config.mts](vitest.config.mts) 的 unit 和 db 两个 project，[playwright.config.ts](playwright.config.ts)，e2e 的 fixture [e2e/test.ts](e2e/test.ts)、[e2e/backend.ts](e2e/backend.ts)，在修复前的提交上跑回归用例的 [scripts/e2e-at.mjs](scripts/e2e-at.mjs)
- Lint：[eslint.config.mjs](eslint.config.mjs) 的测试部分，[scripts/eslint/e2e-plugin.mjs](scripts/eslint/e2e-plugin.mjs)；`e2e/` 不引入应用代码的检查在架构部分
- Review：[code-review.md 的 Tests](docs/agents/code-review.md#tests)
