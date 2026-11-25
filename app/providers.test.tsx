import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { z } from "zod";

import { toast } from "@/components/ui/toaster";
import { loadMessages } from "@/lib/i18n/messages";
import { environmentManager } from "@/lib/react-query";
import { SchemaValidationError } from "@/lib/request/fetch";
import zh from "@/messages/zh/app.json";

import { handleRequestError } from "./providers";

// 示例业务的 e2e 也会走到这里，但派生项目会删掉示例业务，所以每种情况都在这里测。
// 弹出的 toast 从 sonner 的 toast.getToasts() 读，也就是 <Toaster /> 要显示的那些。
const runtimeIsServer = environmentManager.isServer();
const failure = new Error("failure");
const request = { id: "request-1" };

const shownToasts = () =>
  toast.getToasts().map((shown) => ({
    id: shown.id,
    title: "title" in shown ? shown.title : undefined,
  }));

beforeEach(() => {
  // 和浏览器里一样：toast 只在浏览器里弹。
  environmentManager.setIsServer(() => false);
});

afterEach(() => {
  environmentManager.setIsServer(() => runtimeIsServer);
  toast.dismiss();
  vi.restoreAllMocks();
});

test("按请求弹 toast：同一个请求再次失败只留一个，别的请求各弹一个，文案用调用方给的", () => {
  handleRequestError(failure, { errorMessage: "保存失败" }, request);
  handleRequestError(failure, { errorMessage: "保存失败" }, request);
  handleRequestError(
    failure,
    { errorMessage: "加载失败" },
    { id: "request-2" },
  );

  expect(shownToasts()).toStrictEqual([
    { id: "request-1", title: "保存失败" },
    { id: "request-2", title: "加载失败" },
  ]);
});

test("errorMessage 是函数时，按这次的错误选文案", () => {
  const notFound = new Error("not found");
  handleRequestError(
    notFound,
    { errorMessage: (error) => `失败：${String(error)}` },
    request,
  );

  expect(shownToasts()).toStrictEqual([
    { id: "request-1", title: `失败：${String(notFound)}` },
  ]);
});

test("调用方没给文案时显示通用文案", async () => {
  handleRequestError(failure, {}, request);

  const [shown] = shownToasts();
  expect(shown?.id).toBe("request-1");
  // 通用文案在 <Toaster /> 里渲染，那里在页面的 next-intl provider 之内。
  const html = renderToString(
    <NextIntlClientProvider locale="zh" messages={await loadMessages("zh")}>
      {shown?.title as ReactNode}
    </NextIntlClientProvider>,
  );
  expect(html).toBe(zh.requestError);
});

test.each([
  ["总是不弹", true],
  ["predicate 对这个错误返回 true", () => true],
])("调用方关掉提示（%s）时不弹", (_case, suppressErrorToast) => {
  handleRequestError(failure, { suppressErrorToast }, request);
  expect(shownToasts()).toStrictEqual([]);
});

test("predicate 对这个错误返回 false 时照常弹", () => {
  handleRequestError(
    failure,
    { suppressErrorToast: () => false, errorMessage: "保存失败" },
    request,
  );
  expect(shownToasts()).toStrictEqual([{ id: "request-1", title: "保存失败" }]);
});

test("服务端不弹：那里的 toast 永远不会被关闭", () => {
  environmentManager.setIsServer(() => true);
  handleRequestError(failure, { errorMessage: "保存失败" }, request);
  expect(shownToasts()).toStrictEqual([]);
});

test("响应不符合 schema 时记一条错误日志，关掉提示也记", () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const parsed = z.object({ id: z.string() }).safeParse({});
  if (parsed.success) throw new Error("这个响应体本应不符合 schema");
  const mismatch = new SchemaValidationError("/api/items", parsed.error);

  handleRequestError(mismatch, { suppressErrorToast: true }, request);

  expect(log).toHaveBeenCalledWith(mismatch);
  expect(shownToasts()).toStrictEqual([]);
});
