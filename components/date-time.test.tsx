import { NextIntlClientProvider } from "next-intl";
import { renderToString } from "react-dom/server";
import { expect, test } from "vitest";

import { DateTime } from "./date-time";

// 浏览器那一侧（页面 hydrate 之后按电脑所在时区显示时间）由 e2e/date-time.spec.ts 验证。
test("服务端渲染出带时刻、没有文字的 <time> 元素", () => {
  const html = renderToString(
    <NextIntlClientProvider locale="en" timeZone="Asia/Shanghai" messages={{}}>
      <DateTime
        value={Date.UTC(2026, 9, 1)}
        format={{ dateStyle: "medium", timeStyle: "short" }}
      />
    </NextIntlClientProvider>,
  );
  expect(html).toMatch(
    /^<time dateTime="2026-10-01T00:00:00.000Z" class="[^"]*"><\/time>$/,
  );
});
