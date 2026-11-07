import pg from "pg";

import { databaseUrl, POSTGRES } from "./datasets.mjs";
import { prepareDataset, startLocalServices } from "./services.mjs";

// 只在管理库上使用，和应用库里后台任务的 advisory lock 互不相干。
const TEST_RUN_LOCK_KEY = 2_026_110_701;

/**
 * vitest.config.mts 里 db 项目的 globalSetup：启动本地服务，把 test 数据集重置成只有种子数据，种子文件也传好。
 * 每个测试开始前由 test-reset.mjs 把表恢复成种子数据。
 * 同一台机器上的各份 checkout 共用 test 数据集：先拿一个 advisory lock，别的 checkout 正在跑时排队等它跑完，
 * 测试结束、或者进程退出断开连接时释放。
 */
export default async function setup() {
  startLocalServices();
  const lock = new pg.Client({
    connectionString: databaseUrl(POSTGRES.adminDatabase),
  });
  await lock.connect();
  const { rows } = await lock.query(
    "select pg_try_advisory_lock($1) as locked",
    [TEST_RUN_LOCK_KEY],
  );
  if (!rows[0].locked) {
    console.log(
      "Another checkout is running the database tests; waiting for it to finish",
    );
    await lock.query("select pg_advisory_lock($1)", [TEST_RUN_LOCK_KEY]);
  }
  await prepareDataset("test", { reset: true });
  return () => lock.end();
}
