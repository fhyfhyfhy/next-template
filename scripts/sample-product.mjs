// Sample product 的代码：派生项目删掉它，换成自己的 feature（.agents/skills/derived-project/SKILL.md 的 Sample product）。
// 每一项是从仓库根开始的路径前缀。`app/api/` 只列 Sample product 自己的目录，因为 rules 用 `app/api/` 泛指 Route Handler
// 的位置。scripts/docs-links.test.mjs 用它检查 agent 文档对 Sample product 的引用，scripts/template-upgrade.mjs 升级派生
// 项目时跳过它。派生项目删掉 Sample product 时清空这个列表。
export const SAMPLE_PRODUCT = [
  "features/task/",
  "features/upload/",
  "app/[locale]/(tasks)/",
  "app/api/tasks/",
  "app/api/feed/",
  "messages/en/task.json",
  "messages/zh/task.json",
  "e2e/tasks.ts",
  "e2e/tasks.spec.ts",
  "e2e/task-detail.spec.ts",
  "e2e/feed.spec.ts",
  "e2e/search.spec.ts",
  "e2e/recent.spec.ts",
  "scripts/local-services/seed.sql",
  "scripts/local-services/seed-files/",
];
