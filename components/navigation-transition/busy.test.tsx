import { renderToString } from "react-dom/server";
import { expect, test } from "vitest";

import { NavigationBusy } from "./busy";
import { NavigationTransition } from "./root";

// 只有浏览器会导航，导航进行中 aria-busy="true" 由 e2e/ui-catalog.spec.ts 检查。

test("没有导航在替换的内容不标记为更新中，调用方的 class 和调淡的 class 并存", () => {
  const html = renderToString(
    <NavigationTransition>
      <NavigationBusy className="mb-4">content</NavigationBusy>
    </NavigationTransition>,
  );
  expect(html).toContain('aria-busy="false"');
  expect(html).toContain(
    'class="transition-opacity aria-busy:opacity-60 mb-4"',
  );
});

test("不在 NavigationTransition 里时拒绝渲染", () => {
  expect(() =>
    renderToString(<NavigationBusy>content</NavigationBusy>),
  ).toThrow("<NavigationTransition>");
});
