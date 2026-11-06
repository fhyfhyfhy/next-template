import "server-only";
import { z } from "zod";

/**
 * 应用自己的部署要设置的环境变量，每个一个 schema，决定它是否必填、读出来是什么类型。这里只在服务端可用，
 * 给浏览器用的 `NEXT_PUBLIC_` 变量要另放一个模块。
 */
const VARIABLES = {
  // 本地运行时由 scripts/run-next.mjs 按数据集设置（scripts/local-services/datasets.mjs 的 localEnv()），部署时由平台设置。
  DATABASE_URL: z.url(),
  /** 服务端调用 S3 API 的地址。 */
  STORAGE_ENDPOINT: z.url(),
  /** 浏览器直接读取对象的地址前缀，通常是 CDN 或存储的公开域名。 */
  STORAGE_PUBLIC_URL: z.url(),
  STORAGE_BUCKET: z.string().min(1),
  STORAGE_ACCESS_KEY_ID: z.string().min(1),
  STORAGE_SECRET_ACCESS_KEY: z.string().min(1),
  /** 是否在这个进程里运行 generator（instrumentation.ts）。e2e 关掉它，由用例自己推进任务。 */
  TASK_GENERATOR_ENABLED: z.stringbool().default(true),
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
