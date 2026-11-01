// Demo 后端的数据集：同一个 Postgres 服务和对象存储里，各用各的 database 和 bucket，互不干扰。
// demo:* 命令用 dev，Data demo 的 e2e 用 e2e（playwright.demo.config.ts），数据层测试用 test（pnpm demo:test）。
// 连接参数和 compose.demo.yaml 一致；Demo 后端只连这里的服务，不读 .env 文件。

/** @type {Record<string, { database: string, bucket: string }>} */
export const DEMO_DATASETS = {
  dev: { database: "demo", bucket: "demo" },
  e2e: { database: "demo_e2e", bucket: "demo-e2e" },
  test: { database: "demo_test", bucket: "demo-test" },
};

export const POSTGRES = {
  host: "127.0.0.1",
  port: 54329,
  user: "demo",
  password: "demo",
  /** compose 创建的库，用来创建其他数据集的库。 */
  adminDatabase: "demo",
};

export const STORAGE = {
  endpoint: "http://127.0.0.1:7070",
  /** 浏览器加载文件用的地址，后面接 /<bucket>/<key>。 */
  publicBase: "http://localhost:7070",
  accessKeyId: "demo-access-key",
  secretAccessKey: "demo-secret-key",
};

/** `DEMO_DATASET` 选择的数据集，默认 dev。 */
export function datasetName(env = process.env) {
  const name = env.DEMO_DATASET ?? "dev";
  if (!Object.hasOwn(DEMO_DATASETS, name)) {
    throw new Error(
      `Unknown DEMO_DATASET ${name}; use one of ${Object.keys(DEMO_DATASETS).join(", ")}`,
    );
  }
  return name;
}

export function databaseUrl(database) {
  const { user, password, host, port } = POSTGRES;
  return `postgres://${user}:${password}@${host}:${port}/${database}`;
}

/**
 * 启动 Next 时写进环境变量的 Demo 后端配置。Demo 后端只在 `DEMO_DATABASE_URL` 存在时启用
 * （features/demo-task/server/connection.ts），所以只有 demo:* 命令和数据层测试会设置它们。
 */
export function demoEnv(name) {
  const { database, bucket } = DEMO_DATASETS[name];
  return {
    DEMO_DATABASE_URL: databaseUrl(database),
    DEMO_STORAGE_ENDPOINT: STORAGE.endpoint,
    DEMO_STORAGE_PUBLIC_URL: `${STORAGE.publicBase}/${bucket}`,
    DEMO_STORAGE_BUCKET: bucket,
    DEMO_STORAGE_ACCESS_KEY_ID: STORAGE.accessKeyId,
    DEMO_STORAGE_SECRET_ACCESS_KEY: STORAGE.secretAccessKey,
  };
}
