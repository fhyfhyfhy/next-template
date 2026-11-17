import { NextIntlClientProvider } from "next-intl";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { z } from "zod";

import { environmentManager } from "@/lib/react-query";
import { SchemaValidationError } from "@/lib/request/fetch";
import app from "@/messages/zh/app.json";

import { handleRequestError } from "./providers";

const toastError = vi.hoisted(() => vi.fn());
vi.mock("@/components/ui/toaster", () => ({
  toast: { error: toastError },
  Toaster: () => null,
}));

const runtimeIsServer = environmentManager.isServer();
const failure = new Error("Injected failure");
const request = { id: "request-1" };

beforeEach(() => {
  // 和浏览器里一样：toast 只在浏览器里弹。
  environmentManager.setIsServer(() => false);
});

afterEach(() => {
  environmentManager.setIsServer(() => runtimeIsServer);
  vi.restoreAllMocks();
  toastError.mockReset();
});

test("请求失败时按请求 id 弹一个 toast，文案用调用方给的", () => {
  handleRequestError(failure, { errorMessage: "保存失败" }, request);
  handleRequestError(
    failure,
    { errorMessage: (error) => `失败：${String(error)}` },
    { id: "request-2" },
  );

  expect(toastError.mock.calls).toStrictEqual([
    ["保存失败", { id: "request-1" }],
    [`失败：${String(failure)}`, { id: "request-2" }],
  ]);
});

test("调用方没给文案时，toast 显示通用文案", () => {
  handleRequestError(failure, {}, request);

  const [[message, options]] = toastError.mock.calls;
  // 它渲染在 <Toaster /> 里，那里有页面的 next-intl provider。
  const shown = renderToString(
    <NextIntlClientProvider locale="zh" messages={{ app }}>
      {message}
    </NextIntlClientProvider>,
  );
  expect(shown).toBe(app.requestError);
  expect(options).toStrictEqual({ id: "request-1" });
});

test.each([
  ["一律", true],
  ["对这个错误", () => true],
])("调用方%s关掉提示时不弹", (_when, suppress) => {
  handleRequestError(failure, { suppressErrorToast: suppress }, request);
  expect(toastError).not.toHaveBeenCalled();
});

test("调用方只对别的错误关掉提示时，照常弹", () => {
  handleRequestError(failure, { suppressErrorToast: () => false }, request);
  expect(toastError).toHaveBeenCalledOnce();
});

test("服务端不弹：那里的 toast 永远不会被关闭", () => {
  environmentManager.setIsServer(() => true);
  handleRequestError(failure, { errorMessage: "保存失败" }, request);
  expect(toastError).not.toHaveBeenCalled();
});

test("响应不符合 schema 时记一条错误日志，关掉提示也记", () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const parsed = z.object({ id: z.string() }).safeParse({});
  if (parsed.success) throw new Error("这个响应体本应不符合 schema");
  const mismatch = new SchemaValidationError("/api/items", parsed.error);

  handleRequestError(mismatch, { suppressErrorToast: true }, request);

  expect(log).toHaveBeenCalledWith(mismatch);
  expect(toastError).not.toHaveBeenCalled();
});
