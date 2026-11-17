import { NextIntlClientProvider } from "next-intl";
import { renderToString } from "react-dom/server";
import { expect, test } from "vitest";

import ui from "@/messages/zh/ui.json";

import { Toaster } from "./toaster";

test("通知区域按页面语言命名，没有 toast 时也是", () => {
  const html = renderToString(
    <NextIntlClientProvider locale="zh" messages={{ ui }}>
      <Toaster />
    </NextIntlClientProvider>,
  );
  expect(html).toContain('aria-label="通知 alt+T"');
});
