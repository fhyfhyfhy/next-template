import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { expect, test } from "vitest";

import ui from "@/messages/zh/ui.json";

import { ProgressRoot } from "./root";

function render(element: ReactNode) {
  return renderToString(
    <NextIntlClientProvider locale="zh" messages={{ ui }}>
      {element}
    </NextIntlClientProvider>,
  );
}

test("进度未知时读屏读出页面语言的文案", () => {
  expect(render(<ProgressRoot value={null} />)).toContain(
    'aria-valuetext="进度未知"',
  );
});

test("百分比按页面语言而不是运行环境的语言格式化", () => {
  // 英文按这个格式是 "64 percent"，中文是 "64%"，能区分 locale 从哪里来。
  expect(
    render(
      <ProgressRoot
        value={64}
        format={{ style: "unit", unit: "percent", unitDisplay: "long" }}
      />,
    ),
  ).toContain('aria-valuetext="64%"');
});
