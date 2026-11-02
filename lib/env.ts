import "server-only";
import { z } from "zod";

/**
 * 应用自己的部署要设置的环境变量。应用代码只通过 `readEnv` 和 `requireEnv` 读它们，Node 和 Next 定义的变量
 * 除外（.claude/rules/architecture.md「Environment variables」）。这里只在服务端可用，给浏览器用的
 * `NEXT_PUBLIC_` 变量要另放一个模块。
 */
const ENV = {
  // Demo 后端：只有 demo:* 命令和数据层测试会设置，值来自 scripts/demo-backend/datasets.mjs 的 demoEnv()。
  DEMO_DATABASE_URL: z.url(),
  DEMO_STORAGE_ENDPOINT: z.url(),
  DEMO_STORAGE_PUBLIC_URL: z.url(),
  DEMO_STORAGE_BUCKET: z.string(),
  DEMO_STORAGE_ACCESS_KEY_ID: z.string(),
  DEMO_STORAGE_SECRET_ACCESS_KEY: z.string(),
} satisfies Record<string, z.ZodType<string>>;

export type EnvName = keyof typeof ENV;

/**
 * 读一个环境变量，没设置或是空字符串时返回 `undefined`，格式不对时抛错。每次调用都重新读 `process.env`：
 * 数据层测试会在同一个进程里改它。
 */
export function readEnv(name: EnvName): string | undefined {
  const value = process.env[name];
  if (!value) return undefined;
  const result = ENV[name].safeParse(value);
  if (!result.success) {
    throw new Error(`${name} is invalid: ${z.prettifyError(result.error)}`);
  }
  return result.data;
}

/** 读一个必须设置的环境变量，没设置时抛错。 */
export function requireEnv(name: EnvName): string {
  const value = readEnv(name);
  if (value === undefined) throw new Error(`${name} is not set`);
  return value;
}
