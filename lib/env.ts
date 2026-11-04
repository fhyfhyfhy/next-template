import "server-only";
import { z } from "zod";

/**
 * 应用自己的部署要设置的环境变量，每个一个 schema，决定它是否必填、读出来是什么类型。这里只在服务端可用，
 * 给浏览器用的 `NEXT_PUBLIC_` 变量要另放一个模块。
 */
const VARIABLES = {
  // Demo 后端：只有 demo:* 命令和数据层测试会设置，值来自 scripts/demo-backend/datasets.mjs 的 demoEnv()。
  DEMO_DATABASE_URL: z.url().optional(),
  DEMO_STORAGE_ENDPOINT: z.url().optional(),
  DEMO_STORAGE_PUBLIC_URL: z.url().optional(),
  DEMO_STORAGE_BUCKET: z.string().optional(),
  DEMO_STORAGE_ACCESS_KEY_ID: z.string().optional(),
  DEMO_STORAGE_SECRET_ACCESS_KEY: z.string().optional(),
} satisfies Record<string, z.ZodType>;

type Variables = typeof VARIABLES;
type Env = { readonly [Name in keyof Variables]: z.output<Variables[Name]> };

function isVariable(name: PropertyKey): name is keyof Variables {
  return Object.hasOwn(VARIABLES, name);
}

// 空字符串当作没设置：.env 和部署平台里常留着 `NAME=`。
function raw(name: string) {
  return process.env[name] || undefined;
}

function read<T extends z.ZodType>(name: string, schema: T): z.output<T> {
  const result = schema.safeParse(raw(name));
  if (!result.success) {
    throw new Error(`${name} is invalid: ${z.prettifyError(result.error)}`);
  }
  return result.data;
}

/**
 * 每次访问都重新读 `process.env`，只校验被访问的那个变量：数据层测试会在同一个进程里改它，
 * build 也不要求运行时才有的变量已经设置。
 */
export const env = new Proxy(
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- 目标对象本身不存属性：每次读取都由下面的 get 拦截，用 VARIABLES 里对应的 schema 解析出 Env 声明的类型，所以这个断言不会让类型和运行时的值对不上。
  {} as Env,
  {
    get: (_, name) =>
      isVariable(name) ? read(name, VARIABLES[name]) : undefined,
  },
);

/**
 * 一次校验全部变量，把所有问题一起报出来。instrumentation.ts 在服务启动时调用：抛错时 Next 把它打在启动日志里，
 * 之后每个请求都返回 500。
 */
export function validateEnv() {
  const values = Object.fromEntries(
    Object.keys(VARIABLES).map((name) => [name, raw(name)]),
  );
  const result = z.object(VARIABLES).safeParse(values);
  if (!result.success) {
    throw new Error(
      `Invalid environment variables:\n${z.prettifyError(result.error)}`,
    );
  }
}
