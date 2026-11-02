import { NextIntlClientProvider } from "next-intl";
import { renderToString } from "react-dom/server";
import { expect, test, vi } from "vitest";

import { LocaleItems } from "./locale-items";

// 部署在某个路径下的项目在 lib/base-path.ts 里设置它。
vi.mock("@/lib/base-path", () => ({ BASE_PATH: "/base" }));

test("设置了 basePath 时，每个语言链接都以它开头", () => {
  const html = renderToString(
    <NextIntlClientProvider locale="zh" messages={{}}>
      <LocaleItems href="/demos/ui?component=select" />
    </NextIntlClientProvider>,
  );
  const hrefs = [...html.matchAll(/href="([^"]*)"/g)].map(([, href]) => href);
  expect(hrefs).toStrictEqual(["/base/en/demos/ui?component=select"]);
});
