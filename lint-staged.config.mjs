import { relative } from "node:path";

// 提交前只检查暂存的文件，推送前 .husky/pre-push 的 pnpm check 再完整检查一遍。
// 所有命令放在一个 glob 下按顺序执行：多个 glob 的任务会并行，同时改写和读取同一个文件会冲突。

const CODE = /\.[cm]?[jt]sx?$/;
// ESLint 还检查 Markdown：agent 指令的写法和文档的链接（eslint.config.mjs 的 AGENT_INSTRUCTIONS、DOCS）；其他 .md 由
// --no-warn-ignored 跳过。
const LINTED = /\.(?:[cm]?[jt]sx?|md)$/;

const args = (files) => files.map((file) => JSON.stringify(file)).join(" ");

const config = {
  "*": (absolutePaths) => {
    const files = absolutePaths.map((path) =>
      relative(process.cwd(), path).split("\\").join("/"),
    );
    const code = files.filter((file) => CODE.test(file));
    const linted = files.filter((file) => LINTED.test(file));
    const commands = [];
    // 先让 ESLint 修能自动修的，再格式化。跨文件的检查（比如 feature 之间的环）只看暂存文件不准，留给推送前的完整 lint。
    if (linted.length)
      commands.push(`eslint --fix --no-warn-ignored ${args(linted)}`);
    commands.push(`prettier --write --ignore-unknown ${args(files)}`);
    // 只跑改动文件相关的单元测试：数据库测试要 Docker，留给推送前的 pnpm check（vitest.config.mts）。
    if (code.length) {
      commands.push(
        `vitest related --run --project unit --passWithNoTests ${args(code)}`,
      );
    }
    // 这几个测试按文件内容检查，不经过 import，vitest related 找不到它们。
    if (files.some((file) => file.startsWith("messages/"))) {
      commands.push("vitest run --project unit messages/messages.test.ts");
    }
    if (files.some((file) => file.startsWith("features/ui-catalog/"))) {
      commands.push(
        "vitest run --project unit scripts/ui-catalog/index-freshness.test.mjs",
      );
    }
    // 链接和 ESLint 消息里的 See "小节" in <文件> 指向别的文件（scripts/eslint/docs-plugin.mjs）：改了标题或规则文件，
    // 断掉的是没暂存的文件里的引用，所以 lint 全部文档和 ESLint 消息所在的文件。
    if (
      files.some(
        (file) =>
          file.endsWith(".md") ||
          file === "eslint.config.mjs" ||
          file.startsWith("scripts/eslint/"),
      )
    ) {
      commands.push(
        `eslint --no-warn-ignored "**/*.md" eslint.config.mjs "scripts/eslint/**/*.mjs"`,
      );
    }
    return commands;
  },
};

export default config;
