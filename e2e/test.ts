import { expect, test as base } from "@playwright/test";

/**
 * 所有 spec 都从这里取 `test`。页面打出 next-intl 的 `MISSING_MESSAGE` 错误时用例失败：Client Component 用到的
 * namespace 没有下发，页面上只会显示 `namespace.key`。ESLint 的 i18n/client-namespaces 在 lint 时检查各个
 * `ClientMessages` 的列表（.claude/rules/i18n.md），这里兜住它分析不到的情况。
 */
export const test = base.extend<{ failOnMissingMessage: void }>({
  failOnMissingMessage: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("console", (message) => {
        if (
          message.type() === "error" &&
          message.text().includes("MISSING_MESSAGE")
        ) {
          errors.push(message.text());
        }
      });
      await use();
      expect(errors, "页面缺少文案").toStrictEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
