import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { expect, test } from "vitest";

import en from "@/messages/en/ui.json";
import zh from "@/messages/zh/ui.json";

import { ProgressRoot } from "./root";
import { ProgressValue } from "./value";

const MESSAGES = { en, zh };

function render(element: ReactNode, locale: keyof typeof MESSAGES = "zh") {
  return renderToString(
    <NextIntlClientProvider locale={locale} messages={{ ui: MESSAGES[locale] }}>
      {element}
    </NextIntlClientProvider>,
  );
}

function visibleValue(html: string) {
  return /data-slot="progress-value"[^>]*>([^<]*)</.exec(html)?.[1];
}

test("进度未知时读屏读出页面语言的文案，不显示数值", () => {
  const html = render(
    <ProgressRoot value={null}>
      <ProgressValue />
    </ProgressRoot>,
  );

  expect(html).toContain('aria-valuetext="进度未知"');
  expect(visibleValue(html)).toBe("");
});

// 这个格式英文是 "64 percent"、中文是 "64%"：无论运行环境默认哪种语言，没按页面语言格式化时总有一个用例失败。
test.each([
  ["zh", "64%"],
  ["en", "64 percent"],
] as const)("%s 页面上读屏和可见数值都按页面语言格式化", (locale, expected) => {
  const html = render(
    <ProgressRoot
      value={64}
      format={{ style: "unit", unit: "percent", unitDisplay: "long" }}
    >
      <ProgressValue />
    </ProgressRoot>,
    locale,
  );

  expect(html).toContain(`aria-valuetext="${expected}"`);
  expect(visibleValue(html)).toBe(expected);
});

test("不传 format 时显示 value 在 min 到 max 间的百分比，超出范围按边界算", () => {
  const percent = (value: number) =>
    visibleValue(
      render(
        <ProgressRoot value={value} min={20} max={70}>
          <ProgressValue />
        </ProgressRoot>,
      ),
    );

  expect(percent(30)).toBe("20%");
  expect(percent(120)).toBe("100%");
  expect(percent(0)).toBe("0%");
});
