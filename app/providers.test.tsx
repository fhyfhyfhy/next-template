import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { z } from "zod";

import { toast } from "@/components/ui/toaster";
import { environmentManager } from "@/lib/react-query";
import { SchemaValidationError } from "@/lib/request/fetch";

import { handleRequestError } from "./providers";

// 只测 e2e 观察不到的情况：服务端渲染、schema 不匹配的日志、按错误选文案。弹出的 toast 从 sonner 的
// toast.getToasts() 读，也就是 <Toaster /> 要显示的那些。
const runtimeIsServer = environmentManager.isServer();
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

test("服务端不弹：那里的 toast 永远不会被关闭", () => {
  environmentManager.setIsServer(() => true);
  handleRequestError(
    new Error("failure"),
    { errorMessage: "保存失败" },
    request,
  );
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
