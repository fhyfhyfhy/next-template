import { isValidElement, type ReactNode } from "react";
import { afterEach, expect, test, vi } from "vitest";

import PageError from "./error";

// 错误边界在 React 之外按函数调用：useTranslations 是它唯一的 hook，用 key 代替文案，文案由
// messages/messages.test.ts 检查。
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

interface Pressable {
  onClick?: () => void;
  children?: ReactNode;
}

/** `node` 的元素树里处理点击的那个元素的 props。 */
function pressable(node: unknown): Pressable | undefined {
  if (Array.isArray(node)) return node.map(pressable).find(Boolean);
  if (!isValidElement<Pressable>(node)) return undefined;
  if (node.props.onClick) return node.props;
  return Object.values(node.props).map(pressable).find(Boolean);
}

test("页面的错误边界用按钮整页重新加载，不用 Next 的 retry", () => {
  const reload = vi.fn();
  vi.stubGlobal("window", { location: { reload } });
  const button = pressable(PageError());

  expect(button?.children).toBe("app.pageError.reload");
  button?.onClick?.();
  expect(reload).toHaveBeenCalledOnce();
});
