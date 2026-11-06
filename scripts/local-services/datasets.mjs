// 本地服务（compose.yaml）里的数据集：同一个 Postgres 服务和对象存储里，各用各的 database 和 bucket，互不干扰。
// pnpm dev 和 build:local、start:local 默认用 dev，e2e 用 e2e（playwright.config.ts），数据库测试用 test（vitest.config.mts）。
// 连接参数和 compose.yaml 一致。部署环境不用这里，由平台设置同名的环境变量（lib/env.ts）。

/** @type {Record<string, { database: string, bucket: string }>} */
export const DATASETS = {
  dev: { database: "app", bucket: "app" },
  e2e: { database: "app_e2e", bucket: "app-e2e" },
  test: { database: "app_test", bucket: "app-test" },
};

export const POSTGRES = {
  host: "127.0.0.1",
  port: 54329,
  user: "app",
  password: "app",
  /**
   * 连上它去创建和删除各数据集的库。用 Postgres 镜像初始化时自带的 postgres 库：dev 数据集的 app 库要被
   * db:reset 删掉，而 Postgres 不能删除当前连着的库。
   */
  adminDatabase: "postgres",
};

export const STORAGE = {
  endpoint: "http://127.0.0.1:7070",
  /** 浏览器加载文件用的地址，后面接 /<bucket>/<key>。 */
  publicBase: "http://localhost:7070",
  accessKeyId: "local-access-key",
  secretAccessKey: "local-secret-key",
};

/** `LOCAL_DATASET` 选择的数据集，默认 dev。 */
export function datasetName(env = process.env) {
  const name = env.LOCAL_DATASET ?? "dev";
  assertDataset(name);
  return name;
}

export function assertDataset(name) {
  if (!Object.hasOwn(DATASETS, name)) {
    throw new Error(
      `Unknown dataset ${name}; use one of ${Object.keys(DATASETS).join(", ")}`,
    );
  }
}

export function databaseUrl(database) {
  const { user, password, host, port } = POSTGRES;
  return `postgres://${user}:${password}@${host}:${port}/${database}`;
}

/** 连到这个数据集时应用需要的环境变量，名称和 lib/env.ts 一致。 */
export function localEnv(name) {
  const { database, bucket } = DATASETS[name];
  return {
    DATABASE_URL: databaseUrl(database),
    STORAGE_ENDPOINT: STORAGE.endpoint,
    STORAGE_PUBLIC_URL: `${STORAGE.publicBase}/${bucket}`,
    STORAGE_BUCKET: bucket,
    STORAGE_ACCESS_KEY_ID: STORAGE.accessKeyId,
    STORAGE_SECRET_ACCESS_KEY: STORAGE.secretAccessKey,
  };
}
