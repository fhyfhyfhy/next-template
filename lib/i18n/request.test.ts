import { beforeEach, describe, expect, test, vi } from "vitest";

import requestConfig from "./request";

// react-server 环境下的 getRequestConfig 原样返回传入的函数；测试进程不是这个环境，拿到的是只会抛错的占位实现。
vi.mock("next-intl/server", () => ({
  getRequestConfig: (create: unknown) => create,
}));
vi.mock("next/root-params", () => ({ locale: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

const rootParams = await import("next/root-params");
const rootLocale = vi.mocked(rootParams.locale);

function config(locale: string | undefined) {
  return requestConfig({
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- 要测的就是类型以外的值：Server Action 收到的 locale 来自浏览器。
    locale: locale as never,
    requestLocale: Promise.resolve(undefined),
  });
}

beforeEach(() => {
  rootLocale.mockReset();
});

describe("显式传入的 locale（Server Action 从浏览器拿到的值）", () => {
  test.each(["fr", "", "zh-CN"])("不支持的 %j 抛错", async (locale) => {
    await expect(config(locale)).rejects.toThrow(
      `Unsupported locale: ${locale}`,
    );
  });

  test("支持的直接用，不读 root param", async () => {
    await expect(config("en")).resolves.toMatchObject({ locale: "en" });
    expect(rootLocale).not.toHaveBeenCalled();
  });
});

describe("没有传入时读 [locale] root param", () => {
  test("支持的值直接用", async () => {
    rootLocale.mockResolvedValue("zh");
    await expect(config(undefined)).resolves.toMatchObject({ locale: "zh" });
  });

  test("不支持的值按 404 处理", async () => {
    rootLocale.mockResolvedValue("unknown.txt");
    await expect(config(undefined)).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
