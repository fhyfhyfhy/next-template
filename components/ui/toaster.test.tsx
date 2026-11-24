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
  // sonner 在名称后面拼上快捷键提示，那部分随 sonner 的写法变，只看开头。
  expect(html).toMatch(/aria-label="通知/);
});
