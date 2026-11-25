import { renderToString } from "react-dom/server";
import { expect, test } from "vitest";

import { useHydrated } from "./use-hydrated";

function Probe() {
  return useHydrated() ? "已 hydrate" : "还没 hydrate";
}

// 浏览器那一侧由 e2e/ui-catalog.spec.ts 验证：Form 页和 Input 页的控件在 hydration 之前不可用，之后可以操作。
test("服务端渲染时还没 hydrate", () => {
  expect(renderToString(<Probe />)).toBe("还没 hydrate");
});
