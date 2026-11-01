import { NextIntlClientProvider } from "next-intl";
import { renderToString } from "react-dom/server";
import { expect, test, vi } from "vitest";

import { LocaleItems } from "./locale-items";

// A project served under a path sets it in lib/base-path.ts.
vi.mock("@/lib/base-path", () => ({ BASE_PATH: "/base" }));

test("with a basePath, every language link starts with it", () => {
  const html = renderToString(
    <NextIntlClientProvider locale="zh" messages={{}}>
      <LocaleItems href="/demos/ui?component=select" />
    </NextIntlClientProvider>,
  );
  const hrefs = [...html.matchAll(/href="([^"]*)"/g)].map(([, href]) => href);
  expect(hrefs).toStrictEqual(["/base/en/demos/ui?component=select"]);
});
