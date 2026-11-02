import { expect, test as base } from "@playwright/test";

/**
 * Every spec takes `test` from here. A test fails when its page logs next-intl's
 * `MISSING_MESSAGE` error: a namespace a Client Component uses was not sent,
 * and the page shows only `namespace.key`. ESLint's i18n/client-namespaces
 * checks each `ClientMessages` list at lint time (.claude/rules/i18n.md); this
 * catches the cases it cannot analyze.
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
      expect(errors, "the page is missing messages").toStrictEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
