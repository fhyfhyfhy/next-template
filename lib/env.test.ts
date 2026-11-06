import { afterEach, describe, expect, test, vi } from "vitest";

import { env, validateEnv } from "./env";

const REQUIRED = {
  DATABASE_URL: "postgres://app:app@127.0.0.1:54329/app",
  STORAGE_ENDPOINT: "http://127.0.0.1:7070",
  STORAGE_PUBLIC_URL: "http://localhost:7070/app",
  STORAGE_BUCKET: "app",
  STORAGE_ACCESS_KEY_ID: "key",
  STORAGE_SECRET_ACCESS_KEY: "secret",
};

function stubRequired(overrides: Record<string, string> = {}) {
  for (const [name, value] of Object.entries({ ...REQUIRED, ...overrides })) {
    vi.stubEnv(name, value);
  }
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("应用的环境变量", () => {
  test("必填的连接参数都设置时校验通过，读到的就是设置的值", () => {
    stubRequired();

    expect(() => validateEnv()).not.toThrow();
    expect(env.DATABASE_URL).toBe(REQUIRED.DATABASE_URL);
  });

  test("缺了必填的变量时校验失败，报出变量名", () => {
    stubRequired({ DATABASE_URL: "" });

    expect(() => validateEnv()).toThrow(/DATABASE_URL/);
    expect(() => env.DATABASE_URL).toThrow(/DATABASE_URL is invalid/);
  });

  test("空字符串当作没设置：可选变量取默认值", () => {
    stubRequired({ TASK_GENERATOR_ENABLED: "" });

    expect(env.TASK_GENERATOR_ENABLED).toBe(true);
  });

  test("TASK_GENERATOR_ENABLED 设为 false 时关闭 generator", () => {
    stubRequired({ TASK_GENERATOR_ENABLED: "false" });

    expect(env.TASK_GENERATOR_ENABLED).toBe(false);
  });
});
